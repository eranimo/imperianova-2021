import { System } from '../entity-system';
import { Query, EntityManager } from '../entity-system/EntityManager';
import { Game } from './Game';
import { PopDataComponent, HexPositionComponent, WorldTileDataComponent } from './components';

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

export class PopDisplaySystem extends System {
  query: Query;

  init(manager: EntityManager) {
    this.query = manager.createQuery(entity => 
      entity.hasComponent(HexPositionComponent) &&
      entity.hasComponent(WorldTileDataComponent)
    );
  }

  update() {
    const { world, worldMap } = this.entityManager.context;
    for (const tile of this.query.entities) {
      const pos = tile.getComponent(HexPositionComponent);
      const tileData = tile.getComponent(WorldTileDataComponent);

      let tileSize = 0;
      for (const pop of tileData.value.pops) {
        const popData = pop.getComponent(PopDataComponent);
        tileSize += popData.value.size;
      }

      if (worldMap) {
        const hex = world.getHex(pos.value.x, pos.value.y);
        worldMap.setTileState(hex, 'population', tileSize);
      }
    }
    if (worldMap) {
      worldMap.setMapMode(worldMap.currentMapMode);
    }
  }

}

export function registerSystems(manager: EntityManager) {
  manager.registerSystem(new PopSystem());
  manager.registerSystem(new PopDisplaySystem(10));
}