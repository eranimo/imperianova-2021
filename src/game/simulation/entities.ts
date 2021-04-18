import { EntityManager } from '../entity-system/EntityManager';
import { PopDataComponent, HexPositionComponent, WorldTileDataComponent, GameInfo, GameInfoComponent, PopData, PolityData, PolityDataComponent } from './components';
import { Coordinate } from '../../types';
import { EntitySet } from '../entity-system/fields';
import { Color } from '../../utils/Color';
import { random } from 'lodash';

export function createGameInfo(
  manager: EntityManager,
  options: GameInfo,
) {
  const entity = manager.createEntity();
  entity.addComponent(GameInfoComponent, options);
  return entity;
}

export function createPolity(
  manager: EntityManager,
  options: {
    name: string,
  },
) {
  const entity = manager.createEntity();
  const color = Color.fromHSL(random(255), 0.75, 0.50).toNumber();
  entity.addComponent(PolityDataComponent, {
    name: options.name,
    mapColor: color,
    tiles: new EntitySet(),
  });
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
