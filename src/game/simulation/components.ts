import { Component } from '../entity-system';
import { Direction, Coordinate } from '../../types';
import { EntitySet, EntityRef } from '../entity-system/fields';


// Core components
export type GameInfo = {
  date: number,
  player?: EntityRef,
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

// Polities
export type PolityData = {
  name: string,
  mapColor: number,
  tiles: EntitySet, // Tile entities this polity owns
};
export const PolityDataComponent = new Component<PolityData>('PolityData');

// component on tiles with reference to polity that owns it
export type PolityTile = {
  polity: EntityRef,
};
export const PolityTileComponent = new Component<PolityTile>('PolityTile');

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
}
export const PopDataComponent = new Component<PopData>('PopData');


// add components here to register them
export const components = [
  GameInfoComponent,
  WorldPositionComponent,
  HexPositionComponent,
  WorldTileDataComponent,
  ResourceDataComponent,
  PopDataComponent,
  PolityDataComponent,
  PolityTileComponent,
]
