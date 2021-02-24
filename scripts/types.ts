import { TerrainType } from '../src/terrain';


export type TileSectionEdgeMap<T> = Partial<Record<TileSectionEdge, T>>;

export type HexTileSection = {
  type: TileSectionType,
  terrainType: TerrainType,
  edgeTerrainTypes?: TileSectionEdgeMap<TerrainType>,
  edgeRoads?: TileSectionEdgeMap<boolean>,
}

export enum TileSectionType {
  CENTER = 0,
  SE,
  NE,
  N,
  NW,
  SW,
  S,
}

export enum TileSectionEdge {
  // edge types only:
  CENTER = 0,
  EDGE,
  ADJ1,
  ADJ2,

  // center type only:
  SE,
  NE,
  N,
  NW,
  SW,
  S,
}

export enum ControlPoint {
  // center 
  HEX_CENTER,
  N,
  NE,
  SE,
  S,
  SW,
  NW,

  // edge
  EDGE_CENTER,
  ADJ1_LOW,
  ADJ1_MED,
  ADJ1_HIGH,
  ADJ2_LOW,
  ADJ2_MED,
  ADJ2_HIGH,
  CORNER_ADJ1,
  CORNER_ADJ2,
  EDGE_ADJ1,
  EDGE_ADJ2,
  INSIDE_CENTER,
}