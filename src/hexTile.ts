import { CornerMap, DirectionMap, Direction, Corner, ColorArray } from './types';
import { TerrainType } from './terrain';

export type HexTile = {
  terrainType: TerrainType,
  edgeTerrainTypes: DirectionMap<TerrainType | null>,
  cornerTerrainTypes: CornerMap<TerrainType | null>,
  edgeRoads: DirectionMap<boolean | null>;
}

export const OFFSET_Y = 10;

export enum CellType {
  NONE = 0,

  DEBUG_SE,
  DEBUG_NE,
  DEBUG_N,
  DEBUG_NW,
  DEBUG_SW,
  DEBUG_S,
  DEBUG_CENTER,

  DEBUG_RIGHT,
  DEBUG_BOTTOM_RIGHT,
  DEBUG_BOTTOM_LEFT,
  DEBUG_LEFT,
  DEBUG_TOP_LEFT,
  DEBUG_TOP_RIGHT,

  DEBUG_RIGHT_0,
  DEBUG_RIGHT_1,
  DEBUG_BOTTOM_RIGHT_0,
  DEBUG_BOTTOM_RIGHT_1,
  DEBUG_BOTTOM_LEFT_0,
  DEBUG_BOTTOM_LEFT_1,
  DEBUG_LEFT_0,
  DEBUG_LEFT_1,
  DEBUG_TOP_LEFT_0,
  DEBUG_TOP_LEFT_1,
  DEBUG_TOP_RIGHT_0,
  DEBUG_TOP_RIGHT_1,

  TERRAIN_OCEAN,
  TERRAIN_COAST,
  TERRAIN_GRASSLAND,
  TERRAIN_FOREST,
  TERRAIN_GLACIAL,
  TERRAIN_DESERT,
  TERRAIN_TAIGA,
  TERRAIN_TUNDRA,

  RIVER,
  RIVER_MOUTH,
  RIVER_SOURCE,

  ROAD,
};

export const cellTypeFeatures: Partial<Record<CellType, number[]>> = {
  [CellType.TERRAIN_GRASSLAND]: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  [CellType.TERRAIN_FOREST]: [20, 21, 22, 23, 24, 25, 26, 27],
  [CellType.TERRAIN_TAIGA]: [40, 41, 42, 43, 44, 45, 46],
}

export const cellTypeTransitions = {
  [CellType.TERRAIN_GRASSLAND]: {
    other: CellType.TERRAIN_COAST,
    paint: [
      { operation: 'expand', width: 2, chance: 0.9, color: [] },
    ]
  },
}


export const directionToCellType = {
  [Direction.SE]: CellType.DEBUG_SE,
  [Direction.NE]: CellType.DEBUG_NE,
  [Direction.N]: CellType.DEBUG_N,
  [Direction.NW]: CellType.DEBUG_NW,
  [Direction.SW]: CellType.DEBUG_SW,
  [Direction.S]: CellType.DEBUG_S,
}

export const cellTypeColor: Partial<Record<CellType, ColorArray>> = {
  [CellType.DEBUG_SE]: [0, 255, 255],
  [CellType.DEBUG_NE]: [255, 0, 255],
  [CellType.DEBUG_N]: [255, 0, 0],
  [CellType.DEBUG_NW]: [0, 0, 255],
  [CellType.DEBUG_SW]: [255, 255, 0],
  [CellType.DEBUG_S]: [0, 255, 0],
  [CellType.DEBUG_CENTER]: [69, 69, 69],

  [CellType.DEBUG_RIGHT]: [0, 125, 125],
  [CellType.DEBUG_BOTTOM_RIGHT]: [0, 0, 125],
  [CellType.DEBUG_BOTTOM_LEFT]: [0, 125, 0],
  [CellType.DEBUG_LEFT]: [125, 0, 0],
  [CellType.DEBUG_TOP_LEFT]: [125, 0, 125],
  [CellType.DEBUG_TOP_RIGHT]: [125, 125, 0],

  [CellType.DEBUG_RIGHT_0]: [100, 0, 100],
  [CellType.DEBUG_RIGHT_1]: [0, 200, 200],
  [CellType.DEBUG_BOTTOM_RIGHT_0]: [0, 100, 100],
  [CellType.DEBUG_BOTTOM_RIGHT_1]: [0, 200, 0],
  [CellType.DEBUG_BOTTOM_LEFT_0]: [0, 100, 0],
  [CellType.DEBUG_BOTTOM_LEFT_1]: [200, 200, 0],
  [CellType.DEBUG_LEFT_0]: [100, 100, 0],
  [CellType.DEBUG_LEFT_1]: [0, 0, 200],
  [CellType.DEBUG_TOP_LEFT_0]: [0, 0, 100],
  [CellType.DEBUG_TOP_LEFT_1]: [200, 0, 0],
  [CellType.DEBUG_TOP_RIGHT_0]: [100, 0, 0],
  [CellType.DEBUG_TOP_RIGHT_1]: [200, 0, 200],
  
  [CellType.TERRAIN_COAST]: [37, 140, 219],
  [CellType.TERRAIN_OCEAN]: [30, 118, 186],
  [CellType.TERRAIN_GRASSLAND]: [120, 178, 76],
  [CellType.TERRAIN_FOREST]: [121, 168, 86],
  [CellType.TERRAIN_GLACIAL]: [250, 250, 250],
  [CellType.TERRAIN_DESERT]: [217, 191, 140],
  [CellType.TERRAIN_TUNDRA]: [150, 209, 195],
  [CellType.TERRAIN_TAIGA]: [57, 117, 47],

  [CellType.RIVER]: [37, 140, 219],
  [CellType.RIVER_MOUTH]: [37, 140, 219],
  [CellType.RIVER_SOURCE]: [37, 140, 219],

  [CellType.ROAD]: [128, 83, 11],
}

export const renderOrder: CellType[] = [
  CellType.RIVER,
  CellType.RIVER_MOUTH,
  CellType.RIVER_SOURCE,
  CellType.TERRAIN_COAST,
  CellType.TERRAIN_OCEAN,
  CellType.TERRAIN_GRASSLAND,
  CellType.TERRAIN_FOREST,
  CellType.TERRAIN_TAIGA,
  CellType.TERRAIN_GLACIAL,
  CellType.TERRAIN_DESERT,
  CellType.TERRAIN_TUNDRA,
]

export const directionCellTypes = {
  [Direction.SE]: CellType.DEBUG_SE,
  [Direction.NE]: CellType.DEBUG_NE,
  [Direction.N]: CellType.DEBUG_N,
  [Direction.NW]: CellType.DEBUG_NW,
  [Direction.SW]: CellType.DEBUG_SW,
  [Direction.S]: CellType.DEBUG_S,
}

export const cornerCellTypes = {
  [Corner.RIGHT]: CellType.DEBUG_RIGHT,
  [Corner.BOTTOM_RIGHT]: CellType.DEBUG_BOTTOM_RIGHT,
  [Corner.BOTTOM_LEFT]: CellType.DEBUG_BOTTOM_LEFT,
  [Corner.LEFT]: CellType.DEBUG_LEFT,
  [Corner.TOP_LEFT]: CellType.DEBUG_TOP_LEFT,
  [Corner.TOP_RIGHT]: CellType.DEBUG_TOP_RIGHT,
}

export const cornerSideCellTypes = {
  [Corner.RIGHT]: [CellType.DEBUG_RIGHT_0, CellType.DEBUG_RIGHT_1],
  [Corner.BOTTOM_RIGHT]: [CellType.DEBUG_BOTTOM_RIGHT_0, CellType.DEBUG_BOTTOM_RIGHT_1],
  [Corner.BOTTOM_LEFT]: [CellType.DEBUG_BOTTOM_LEFT_0, CellType.DEBUG_BOTTOM_LEFT_1],
  [Corner.LEFT]: [CellType.DEBUG_LEFT_0, CellType.DEBUG_LEFT_1],
  [Corner.TOP_LEFT]: [CellType.DEBUG_TOP_LEFT_0, CellType.DEBUG_TOP_LEFT_1],
  [Corner.TOP_RIGHT]: [CellType.DEBUG_TOP_RIGHT_0, CellType.DEBUG_TOP_RIGHT_1],
}

export const terrainPrimaryCellTypes: Partial<Record<TerrainType, CellType>> = {
  [TerrainType.OCEAN]: CellType.TERRAIN_OCEAN,
  [TerrainType.COAST]: CellType.TERRAIN_COAST,
  [TerrainType.GRASSLAND]: CellType.TERRAIN_GRASSLAND,
  [TerrainType.FOREST]: CellType.TERRAIN_FOREST,
  [TerrainType.GLACIAL]: CellType.TERRAIN_GLACIAL,
  [TerrainType.TAIGA]: CellType.TERRAIN_TAIGA,
  [TerrainType.TUNDRA]: CellType.TERRAIN_TUNDRA,
  [TerrainType.DESERT]: CellType.TERRAIN_DESERT,
  [TerrainType.RIVER]: CellType.RIVER,
  [TerrainType.RIVER_MOUTH]: CellType.RIVER_MOUTH,
  [TerrainType.RIVER_SOURCE]: CellType.RIVER_SOURCE,
};


export function getHexTileID(hexTile: HexTile) {
  return (
    // terrain type
    (((TerrainType.__LENGTH - 1) ** 0) * hexTile.terrainType) +

    // edge terrain types
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.SE)) * hexTile.edgeTerrainTypes[Direction.SE]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.NE)) * hexTile.edgeTerrainTypes[Direction.NE]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.N)) * hexTile.edgeTerrainTypes[Direction.N]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.NW)) * hexTile.edgeTerrainTypes[Direction.NW]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.SW)) * hexTile.edgeTerrainTypes[Direction.SW]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.S)) * hexTile.edgeTerrainTypes[Direction.S]) +

    // corner terrain types
    (((TerrainType.__LENGTH - 1) ** (7 + Corner.RIGHT)) * hexTile.cornerTerrainTypes[Corner.RIGHT]) +
    (((TerrainType.__LENGTH - 1) ** (7 + Corner.BOTTOM_RIGHT)) * hexTile.cornerTerrainTypes[Corner.BOTTOM_RIGHT]) +
    (((TerrainType.__LENGTH - 1) ** (7 + Corner.BOTTOM_LEFT)) * hexTile.cornerTerrainTypes[Corner.BOTTOM_LEFT]) +
    (((TerrainType.__LENGTH - 1) ** (7 + Corner.LEFT)) * hexTile.cornerTerrainTypes[Corner.LEFT]) +
    (((TerrainType.__LENGTH - 1) ** (7 + Corner.TOP_LEFT)) * hexTile.cornerTerrainTypes[Corner.TOP_LEFT]) +
    (((TerrainType.__LENGTH - 1) ** (7 + Corner.TOP_RIGHT)) * hexTile.cornerTerrainTypes[Corner.TOP_RIGHT]) +

    // hex edge features
    ((2 ** (13 + Direction.SE)) * Number(hexTile.edgeRoads[Direction.SE])) +
    ((2 ** (13 + Direction.NE)) * Number(hexTile.edgeRoads[Direction.NE])) +
    ((2 ** (13 + Direction.N)) * Number(hexTile.edgeRoads[Direction.N])) +
    ((2 ** (13 + Direction.NW)) * Number(hexTile.edgeRoads[Direction.NW])) +
    ((2 ** (13 + Direction.SW)) * Number(hexTile.edgeRoads[Direction.SW])) +
    ((2 ** (13 + Direction.S)) * Number(hexTile.edgeRoads[Direction.S]))
  );
}