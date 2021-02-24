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

export enum LandType {
  NONE = 0,
  PLAIN,
  HILLS,
  MOUNTAIN,
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
