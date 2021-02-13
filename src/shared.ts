import { DirectionMap, CornerMap, Direction, Corner } from './types';

export enum TerrainType {
  NONE = 0,
  OCEAN = 1,
  COAST = 2,
  GRASSLAND = 3,
  FOREST = 4,
  DESERT = 5,
  TAIGA = 6,
  TUNDRA = 7,
  GLACIAL = 8,
  RIVER = 9, // special
  RIVER_MOUTH = 10, // special
  RIVER_SOURCE = 11, // special
  __LENGTH,
}

export const terrainTypeIndexOrder = [
  TerrainType.OCEAN,
  TerrainType.COAST,
  TerrainType.GRASSLAND,
  TerrainType.FOREST,
  TerrainType.DESERT,
  TerrainType.TAIGA,
  TerrainType.TUNDRA,
  TerrainType.GLACIAL,
  TerrainType.RIVER,
  TerrainType.RIVER_MOUTH,
  TerrainType.RIVER_SOURCE,
];

export type TerrainTypeMap<T> = Record<Exclude<TerrainType, TerrainType.__LENGTH>, T>;

export const terrainColors: TerrainTypeMap<number> = {
  [TerrainType.NONE]: 0x000000,
  [TerrainType.OCEAN]: 0x3261a6,
  [TerrainType.COAST]: 0x3F78CB,
  [TerrainType.GRASSLAND]: 0x81B446,
  [TerrainType.FOREST]: 0x236e29,
  [TerrainType.DESERT]: 0xD9BF8C,
  [TerrainType.TAIGA]: 0x006259,
  [TerrainType.TUNDRA]: 0x96D1C3,
  [TerrainType.GLACIAL]: 0xFAFAFA,
  [TerrainType.RIVER]: 0x3F78CB,
  [TerrainType.RIVER_MOUTH]: 0x3F78CB,
  [TerrainType.RIVER_SOURCE]: 0x3F78CB,
};

export const terrainTypeTitles: TerrainTypeMap<string> = {
  [TerrainType.NONE]: 'MAP EDGE',
  [TerrainType.OCEAN]: 'Ocean',
  [TerrainType.COAST]: 'Coast',
  [TerrainType.GRASSLAND]: 'Grassland',
  [TerrainType.FOREST]: 'Forest',
  [TerrainType.DESERT]: 'Desert',
  [TerrainType.TAIGA]: 'Taiga',
  [TerrainType.TUNDRA]: 'Tundra',
  [TerrainType.GLACIAL]: 'Glacial',
  [TerrainType.RIVER]: 'River',
  [TerrainType.RIVER_MOUTH]: 'River Mouth',
  [TerrainType.RIVER_SOURCE]: 'River Source',
};

export const terrainTransitions: Partial<Record<TerrainType, TerrainType[]>> = {
  [TerrainType.COAST]: [TerrainType.DESERT, TerrainType.GRASSLAND, TerrainType.FOREST, TerrainType.TAIGA, TerrainType.TUNDRA, TerrainType.GLACIAL],
  [TerrainType.FOREST]: [TerrainType.TAIGA, TerrainType.GRASSLAND],
  [TerrainType.DESERT]: [TerrainType.GRASSLAND, TerrainType.FOREST],
  [TerrainType.TUNDRA]: [TerrainType.GLACIAL, TerrainType.TAIGA],
  [TerrainType.TAIGA]: [TerrainType.GRASSLAND, TerrainType.GLACIAL],
  [TerrainType.OCEAN]: [TerrainType.COAST],
};

export type HexTile = {
  terrainType: TerrainType,
  edgeTerrainTypes: DirectionMap<TerrainType | null>,
  cornerTerrainTypes: CornerMap<TerrainType | null>,
  edgeRoads: DirectionMap<boolean | null>;
}

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