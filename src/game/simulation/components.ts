import { Component } from '../entity-system';
import { Direction, Coordinate } from '../../types';
import { EntitySet } from '../entity-system/fields';
import { Game } from './Game';
import { World, Hex } from '../world/World';


// Core components
export type GameInfo = {
  date: number,
};
export const GameInfoComponent = new Component<GameInfo>('GameInfo');
export const WorldPositionComponent = new Component<Coordinate>('WorldPosition');
export const HexPositionComponent = new Component<Coordinate>('Position');

// Tiles

export type WorldTileData = {
  road: Partial<Record<Direction, boolean>>,
  pops: EntitySet,
}
export const WorldTileDataComponent = new Component<WorldTileData>('TileData');


// Resouerces

export enum ResourceType {
  FOOD,
}
export type ResourceData = {
  type: ResourceType,
  size: number,
  refreshRate?: number,
}
export const ResourceDataComponent = new Component<ResourceData>('ResourceData');

// Pops
export type PopData = {
  size: number,
  growth: number,
  class: PopTypes,
  game: Game,
  hex: Hex,
}

export enum PopTypes {
  HUNTERGATHERER = 0
}

export const CarryingCapacityMap : Map<PopTypes, (world: World, hex: Hex) => number> =
   new Map<PopTypes, (world: World, hex: Hex) => number> ([
    [PopTypes.HUNTERGATHERER, (world: World, hex: Hex) => world.getHexHunterCarryCapacity(hex)]
   ]);

export const MonthlyPopGrowthRate = 1.03 / 12;
export const PopDataComponent = new Component<PopData>('PopData');


export const components = [
  GameInfoComponent,
  WorldPositionComponent,
  HexPositionComponent,
  WorldTileDataComponent,
  ResourceDataComponent,
  PopDataComponent,
]