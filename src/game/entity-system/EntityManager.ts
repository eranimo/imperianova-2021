import uuid from 'uuid-random';
import { Subject, BehaviorSubject } from 'rxjs';
import { MultiMap } from '../../utils/MultiMap';
import { MapSet } from '../../utils/MapSet';
import { get, set } from 'lodash';
import { number } from 'yargs';
import { EntityRef, EntityObject } from './fields';
import { Signal } from 'typed-signals';

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

export type FieldTypes = string | number | boolean | null | EntityRef | EntityObject;

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
  changed: Set<keyof T> = new Set();

  constructor(value: T, component: Component<T>) {
    this.id = uuid();
    this.value = value;
    this.component = component;

  }

  set<K extends keyof T>(key: K, value: T[K]) {
    this.changed.add(key);
    this.value[key] = value;
  }

  get<K extends keyof T>(key: K) {
    return get(this.value, key);
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
  values: {
    [key: string]: any,
  }
}

export type EntityExport = {
  id: string;
  components: {
    [type: string]: ComponentExport
  }
}

export class EntityManager {
  private components: Map<Component<any>, ComponentValue<any>[]> = new Map();
  private entities: Entity[] = [];
  private currentIndex = 0;
  private systems: System[] = [];
  private systemLastTick: Map<System, number> = new Map();
  private queries: Set<Query> = new Set();
  public ticks: number = 0;

  stats: BehaviorSubject<{
    entityCount: number,
  }>;

  constructor(startTicks: number = 0) {
    this.ticks = startTicks;
    this.stats = new BehaviorSubject(this.getStats());
  }

  import() {

  }

  export() {

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
    return entity;
  }

  registerComponent<T>(component: Component<T>) {
    if (this.components.has(component)) {
      return;
    }
    this.components.set(component, []);
    return this;
  }

  unregisterComponent<T>(component: Component<T>) {
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
        query.entities.add(entity);
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
        query.entities.delete(entity);
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

  update() {
    this.stats.next(this.getStats());
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
      system.update();
    }

    for (const [comp, compValues] of this.components) {
      for (const compValue of compValues) {
        if (compValue) {
          compValue.changed.clear();
        }
      }
    }
  }
}

export class Query {
  private systems: Set<System> = new Set();
  entities: Set<Entity> = new Set();

  constructor(
    private manager: EntityManager,
    public entityFunc: (entity: Entity) => boolean,
  ) {
    manager._registerQuery(this);
  }

  destroy() {
    this.manager._unregisterQuery(this);
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

  update() {
    throw new Error('Must implement in subclass');
  }
}