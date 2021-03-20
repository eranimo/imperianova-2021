import { BehaviorSubject } from 'rxjs';
import { Entity, Component } from './EntityManager';


export interface IField<T> {
  export(): {
    __type: string,
    value: T
  }
}

export class Value<T> extends BehaviorSubject<T> implements IField<T> {

  constructor(value: T) {
    super(value);
  }

  set(value: T) {
    this.next(value);
  }

  valueOf() {
    return this.value;
  }

  export() {
    return {
      __type: 'Value',
      value: this.value,
    };
  }
}

export class EntityRef extends BehaviorSubject<Entity> implements IField<string> {
  public id: string;

  constructor(entity: Entity) {
    super(entity);
    this.onNewEntity(entity);
  }

  private onNewEntity(entity: Entity) {
    this.id = entity.id;
    entity.onDelete.connect(() => {
      this.id = null;
      this.next(null);
    });
  }

  set(entity: Entity) {
    this.onNewEntity(entity);
    super.next(entity);
  }

  valueOf() {
    return this.id;
  }

  export() {
    return {
      __type: 'EntityRef',
      value: this.id,
    };
  }
}

export type EntityObject = {
  [key: string]: EntityRef,
};

export class EntitySet implements IField<string[]> {
  data: Set<Entity>;

  constructor(entities: Entity[] = []) {
    this.data = new Set(entities);
  }

  add(entity: Entity) {
    return this.data.add(entity);
  }

  has(entity: Entity) {
    return this.data.has(entity);
  }

  delete(entity: Entity) {
    return this.data.delete(entity);
  }

  get size() {
    return this.data.size;
  }

  *[Symbol.iterator]() {
    for (const entity of this.data) {
      yield entity;
    }
  }

  export() {
    return {
      __type: 'EntitySet',
      value: Array.from(this.data.values()).map(i => i.id),
    };
  }
}