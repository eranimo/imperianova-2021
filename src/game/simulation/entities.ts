import { EntityManager } from '../entity-system/EntityManager';
import { PopDataComponent, HexPositionComponent, WorldTileDataComponent, GameInfo, GameInfoComponent, PopData } from './components';
import { Coordinate } from '../../types';
import { EntitySet } from '../entity-system/fields';

export function createGameInfo(
  manager: EntityManager,
  options: GameInfo,
) {
  const entity = manager.createEntity();
  entity.addComponent(GameInfoComponent, options);
  return entity;
}


export function createTile(
  manager: EntityManager,
  options: {
    coord: Coordinate,
  },
) {
  const entity = manager.createEntity();
  entity.addComponent(HexPositionComponent, {
    x: options.coord.x,
    y: options.coord.y,
  });
  entity.addComponent(WorldTileDataComponent, {
    road: {},
    pops: new EntitySet(),
  })
  return entity;
}

export function createPop(
  manager: EntityManager,
  options: PopData,
) {
  const entity = manager.createEntity();
  entity.addComponent(PopDataComponent, options);
  return entity;
}