import uuid from 'uuid-random';
import { Subject, BehaviorSubject } from 'rxjs';
import { MultiMap } from '../../utils/MultiMap';
import { MapSet } from '../../utils/MapSet';
import { get, isFunction, set } from 'lodash';
import { number, strict } from 'yargs';
import { EntityRef, EntityObject, Value, IField } from './fields';
import { Signal } from 'typed-signals';
import { autorun, configure, makeAutoObservable, makeObservable, observable, runInAction } from 'mobx';

/**
 * Type class for a component
 */
export class Component<T> {
  constructor(
    public type: string,
    public defaultValue?: () => T,
  ) {}
}

enum UpdateType {
  ADDED, // component added to entity
  UPDATED, // component value updated
  REMOVED, // component removed from entity
}

export type ComponentUpdate<K = any, V = any> = {
  type: UpdateType,
  entityID: string;
  componentType: string,
  componentID: string;
  key?: K;
  value?: V;
}

export type FieldTypes = 
  string |
  number |
  boolean |
  null |
  object |
  IField<unknown> |
  { [key: string]: IField<unknown> };

type ComponentType = {
  [field: string]: FieldTypes,
};

/**
 * Instance of a component
 */
export class ComponentValue<T extends ComponentType> {
  id: string;
  value: T;
  component: Component<T>;
  added: boolean = false;
  entity: Entity | null = null;

  constructor(value: T, component: Component<T>) {
    this.id = uuid();
    this.value = value;
    this.component = component;

    this.value = observable(this.value, {
      deep: true,
    });
  }

  action(func: () => void) {
    runInAction(func);
  }

  attach(entity: Entity) {
    this.added = true;
    this.entity = entity;
  }

  detatch() {
    this.added = false;
    this.entity = null;
  }
}

export class Entity {
  manager: EntityManager;
  id: string;
  index: number;
  added: boolean = true;
  removed: boolean = false;

  onDelete: Signal<() => void> = new Signal();

  constructor(
    manager: EntityManager,
    index: number,
  ) {
    this.manager = manager;
    this.id = uuid();
    this.index = index;
  }

  addComponent<T extends ComponentType>(component: Component<T>, value?: T) {
    const componentValue = new ComponentValue(value || component.defaultValue(), component);
    this.manager._addEntityComponent(this, component, componentValue);
    componentValue.attach(this);
    return componentValue;
  }

  removeComponent<T extends ComponentType>(component: Component<T>): void {
    const componentValue = this.getComponent(component);
    componentValue.detatch();
    this.manager._removeEntityComponent(this, component);
  }

  getComponent<T extends ComponentType>(component: Component<T>): ComponentValue<T> | undefined {
    return this.manager._getEntityComponent(this, component);
  }

  hasComponent<T extends ComponentType>(component: Component<T>) {
    return !!this.manager._getEntityComponent(this, component);
  }

  remove() {
    this.onDelete.emit();
    this.onDelete.disconnectAll();
    this.removed = true;
  }

  createRef() {
    return new EntityRef(this);
  }
}

export type ComponentExport = {
  id: string;
  type: string;
  entityID: string;
  values: {
    [key: string]: any,
  }
}

export type ExportData = {
  ticks: number,
  components: {
    [type: string]: ComponentExport[],
  },
}

export class EntityManager {
  private components: Map<Component<any>, ComponentValue<any>[]> = new Map();
  private componentTypeMap: Map<string, Component<any>> = new Map();
  private entities: Entity[] = [];
  private currentIndex = 0;
  private systems: System[] = [];
  private systemLastTick: Map<System, number> = new Map();
  private queries: Set<Query> = new Set();
  private entityById: Map<string, Entity> = new Map();
  public ticks: number = 0;

  stats: BehaviorSubject<{
    entityCount: number,
  }>;

  constructor(startTicks: number = 0) {
    this.ticks = startTicks;
    this.stats = new BehaviorSubject(this.getStats());

    configure({
      enforceActions: 'never',
    });
  }

  /**
   * Removes all components and entities, resets tick counter
   */
  reset() {
    for (const comp of this.componentTypeMap.values()) {
      this.components.set(comp, []);
    }
    this.entities = [];
    this.currentIndex = 0;
    this.entityById = new Map();
    this.ticks = 0;
    this.systemLastTick = new Map();
    this.updateStats();
  }

  import(data: ExportData) {
    this.ticks = data.ticks;
    this.reset();
    // restore all entities
    const entities: Map<string, Entity> = new Map();
    for (const [type, components] of Object.entries(data.components)) {
      for (const component of components) {
        entities.set(component.entityID, this.createEntity(component.entityID));
      }
    }
    for (const [type, components] of Object.entries(data.components)) {
      if (!this.componentTypeMap.has(type)) {
        throw Error(`Could not find component with type "${type}"`)
      }
      const component = this.componentTypeMap.get(type);
      this.components.set(component, components.map(compExport => {
        const data = {};
        for (const [key, value] of Object.entries(compExport.values)) {
          if (value && value.__type) {
            if (value.__type === 'Value') {
              data[key] = new Value<any>(value.value);
            } else if (value.__type === 'EntityRef') {
              if (!entities.has(value.value)) {
                throw Error(`Could not find entity with ID "${value.value}"`);
              }
              const entity = entities.get(value.value);
              data[key] = new EntityRef(entity);
            }
          } else {
            data[key] = value;
          }
        }
        const cv = new ComponentValue(data, component);
        cv.attach(entities.get(compExport.entityID));
        return cv;
      }));
    }
    this.updateStats();
  }

  export(): ExportData {
    let data: ExportData = {
      ticks: this.ticks,
      components: {},
    };
    for (const [component, values] of this.components) {
      data.components[component.type] = [];
      for (const componentValue of values) {
        const componentData = {};
        if (componentValue !== undefined) {
          for (const [key, value] of Object.entries(componentValue.value)) {
            if (value && isFunction((value as any).export)) {
              componentData[key] = (value as any).export();
            } else if (typeof value === 'object') {
              const d = {};
              for (const [k, v] of Object.entries(value)) {
                d[k] = v.export();
              }
              componentData[key] = d;
            } else {
              componentData[key] = value;
            }
          }
          data.components[component.type].push({
            id: componentValue.id,
            entityID: componentValue.entity.id,
            type: component.type,
            values: componentData,
          })
        }
      }
    }
    return data;
  }

  createEntity(id?: string): Entity {
    const entity = new Entity(this, this.currentIndex);
    if (id !== undefined) {
      entity.id = id;
    }
    this.currentIndex = this.currentIndex + 1;
    this.entities[entity.index] = entity;
    this.components.forEach((componentValues) => {
      componentValues[entity.index] = undefined;
    });
    this.entityById.set(entity.id, entity);
    return entity;
  }

  hasEntity(id: string) {
    return this.entityById.has(id);
  }

  getEntity(id: string) {
    return this.entityById.get(id);
  }

  registerComponent<T>(component: Component<T>) {
    this.componentTypeMap.set(component.type, component);
    if (this.components.has(component)) {
      return;
    }
    this.components.set(component, []);
    return this;
  }

  unregisterComponent<T>(component: Component<T>) {
    this.componentTypeMap.delete(component.type);
    this.components.delete(component);
  }

  registerSystem(system: System) {
    system.init(this);
    this.systems.push(system);
  }

  unregsiterSystem(system: System) {
    this.systems = this.systems.filter(s => s == system);
  }

  _registerQuery(query: Query) {
    this.queries.add(query);
  }

  _unregisterQuery(query: Query) {
    this.queries.delete(query);
  }
  
  _addEntityComponent<T extends ComponentType>(entity: Entity, component: Component<T>, componentValue: ComponentValue<T>): void {
    const componentValues = this.components.get(component) as ComponentValue<T>[];
    if (!componentValues) {
      throw new Error(`Component is not registered.`);
    }
    componentValues[entity.index] = componentValue;

    // notify queries
    for (const query of this.queries) {
      if (query.entityFunc(entity)) {
        query._addEntity(entity)
      }
    }
  }
  
  _getEntityComponent<T extends ComponentType>(entity: Entity, component: Component<T>): ComponentValue<T> | undefined {
    const componentValues = this.components.get(component) as (ComponentValue<T> | undefined)[];
    if (!componentValues) {
      throw new Error(`Component is not registered.`);
    }
    return componentValues[entity.index];
  }
  
  _removeEntityComponent<T extends ComponentType>(entity: Entity, component: Component<T>): ComponentValue<T> | undefined {
    const componentValues = this.components.get(component) as (ComponentValue<T> | undefined)[];
    if (!componentValues) {
      throw new Error(`Component is not registered.`);
    }
    const prevValue = componentValues[entity.index];
    componentValues[entity.index] = undefined;
    for (const query of this.queries) {
      if (query.entities.has(entity) && !query.entityFunc(entity)) {
        query._removeEntity(entity);
      }
    }
    return prevValue;
  }

  createQuery(
    entityFunc: (entity: Entity) => boolean,
  ) {
    return new Query(this, entityFunc);
  }

  private maintain() {
    this.entities.forEach(entity => {
      if (!entity) {
        return;
      }
      entity.added = false;
      this.entityById.delete(entity.id);
      if (entity.removed) {
        this.components.forEach((componentValues) => {
          componentValues[entity.index] = undefined;
        });
        this.entities[entity.index] = undefined;
      }
    });
  }

  private getStats() {
    const stats = {
      entityCount: this.entities.length,
    };
    return stats;
  }

  private updateStats() {
    this.stats.next(this.getStats());
  }

  update(deltaTime: number = 1) {
    this.updateStats();
    this.maintain();
    this.ticks++;
    for (const system of this.systems) {
      if (system.frequency > 1) {
        const lastTick = this.systemLastTick.get(system);
        if ((this.ticks - lastTick) < system.frequency) {
          continue;
        }
      }
      this.systemLastTick.set(system, this.ticks);
      system.update(deltaTime);
    }

    console.log(this.export());
  }
}

export class Query {
  private systems: Set<System> = new Set();
  entities: Set<Entity> = new Set();

  onEntityAdded: Signal<(entity: Entity) => void> = new Signal();
  onEntityRemoved: Signal<(entity: Entity) => void> = new Signal();

  constructor(
    private manager: EntityManager,
    public entityFunc: (entity: Entity) => boolean,
  ) {
    manager._registerQuery(this);
  }

  _addEntity(entity: Entity) {
    this.entities.add(entity);
    this.onEntityAdded.emit(entity);
  }

  _removeEntity(entity: Entity) {
    this.entities.delete(entity);
    this.onEntityRemoved.emit(entity);
  }

  destroy() {
    this.manager._unregisterQuery(this);
    this.onEntityAdded.disconnectAll();
    this.onEntityRemoved.disconnectAll();
  }

  effect(
    func: (entity: Entity) => () => void | void,
  ) {
    let disposeMap: Map<Entity, Function> = new Map();

    this.onEntityAdded.connect(entity => {
      const disposer = func(entity);
      disposeMap.set(entity, disposer);
    });

    this.onEntityRemoved.connect(entity => {
      if (disposeMap.has(entity)) {
        disposeMap.get(entity)();
      }
    });
  }

  attach(system: System) {
    this.systems.add(system);
  }
}

export class System {
  constructor(
    public frequency: number = 1,
  ) {}

  init(manager: EntityManager) {
  }

  update(deltaTime: number) {
    throw new Error('Must implement in subclass');
  }
}