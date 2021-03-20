import { System } from '../entity-system';
import { Query, EntityManager } from '../entity-system/EntityManager';
import { Game } from './Game';
import { PopDataComponent } from './components';

export class PopSystem extends System {
  query: Query;

  init(manager: EntityManager) {
    this.query = manager.createQuery(entity => entity.hasComponent(PopDataComponent));
  }

  update() {
    for (const entity of this.query.entities) {
      const popData = entity.getComponent(PopDataComponent);
      popData.value.size += popData.value.growth;
    }
  }
}

export function registerSystems(manager: EntityManager) {
  manager.registerSystem(new PopSystem());
}