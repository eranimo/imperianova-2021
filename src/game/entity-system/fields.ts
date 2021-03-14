import { BehaviorSubject } from 'rxjs';
import { Entity, Component } from './EntityManager';


export class Value<T> extends BehaviorSubject<T> {

  constructor(value: T) {
    super(value);
  }

  set(value: T) {
    this.next(value);
  }

  valueOf() {
    return this.value;
  }
}

export class EntityRef extends BehaviorSubject<Entity> {
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
}

export type EntityObject = {
  [key: string]: EntityRef,
};