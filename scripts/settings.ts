import { TerrainType } from '../src/game/world/terrain';
import { ColorArray, Coord } from '../src/types';
import { TileSectionType, SectionControlPoint, TileSectionTypeMap } from '../src/game/world/hexTile';
import { hexToRgb } from '../src/utils';


const coastalColor: ColorArray = [16, 122, 201];
const riverColor: ColorArray = coastalColor; // [0, 0, 255];
export const terrainTypePrimaryColors: Map<TerrainType, ColorArray> = new Map([
  [TerrainType.OCEAN, [14, 108, 181]],
  [TerrainType.COAST, coastalColor],
  [TerrainType.RIVER, riverColor],
  [TerrainType.RIVER_SOURCE, riverColor],
  [TerrainType.RIVER_MOUTH, riverColor],
  [TerrainType.GRASSLAND, [74, 150, 28]],
  [TerrainType.FOREST, [77, 138, 40]],
  [TerrainType.DESERT, [233, 216, 121]],
  [TerrainType.TAIGA, [107, 138, 84]],
  [TerrainType.TUNDRA, [122, 135, 112]],
  [TerrainType.GLACIAL, [235, 239, 242]],
]);

type TileColorTransition = {
  borderColor: ColorArray,
  accentColor?: ColorArray,
}

const beachColor: ColorArray = [247, 226, 107];
const beachAccentColor: ColorArray = [189, 204, 93];
const coastShallowsColor: ColorArray = [107, 183, 210];
const coastAccentColor: ColorArray = [69, 145, 203];
const coastTransition = {
  borderColor: coastShallowsColor,
  accentColor: coastAccentColor,
};
const beachTransition = {
  borderColor: beachColor,
  accentColor: beachAccentColor,
};

const waterTransitions: [TerrainType, TileColorTransition][] = [
  [TerrainType.DESERT, coastTransition],
  [TerrainType.GRASSLAND, coastTransition],
  [TerrainType.FOREST, coastTransition],
  [TerrainType.TAIGA, coastTransition],
  [TerrainType.TUNDRA, coastTransition],
  [TerrainType.GLACIAL, coastTransition],
];
const riverTransitions: [TerrainType, TileColorTransition][] = [
  [TerrainType.COAST, beachTransition],
  // [TerrainType.RIVER, beachTransition],
  // [TerrainType.RIVER_MOUTH, beachTransition],
  // [TerrainType.RIVER_SOURCE, beachTransition],
];
const desertWaterTransition: TileColorTransition = {
  borderColor: [219, 199, 87],
  accentColor: [230, 211, 101],
}
export const tileColorTransition: Map<TerrainType, Map<TerrainType, TileColorTransition>> = new Map([
  [
    TerrainType.OCEAN,
    new Map<TerrainType, TileColorTransition>([
      [TerrainType.COAST, {
        borderColor: [15,114,189],
        accentColor: [14,111,185],
      }]
    ])
  ],
  [
    TerrainType.COAST,
    new Map<TerrainType, TileColorTransition>([
      ...waterTransitions,
      [TerrainType.OCEAN, {
        borderColor: [15,116,193],
        accentColor: [16,119,197],
      }]
    ]),
  ],
  // [
  //   TerrainType.RIVER,
  //   new Map<TerrainType, TileColorTransition>(waterTransitions),
  // ],
  // [
  //   TerrainType.RIVER_MOUTH,
  //   new Map<TerrainType, TileColorTransition>(waterTransitions),
  // ],
  // [
  //   TerrainType.RIVER_SOURCE,
  //   new Map<TerrainType, TileColorTransition>(waterTransitions),
  // ],
  [
    TerrainType.GRASSLAND,
    new Map<TerrainType, TileColorTransition>([
      ...riverTransitions,
      [TerrainType.FOREST, {
        borderColor: [112, 167, 70]
      }],
      [TerrainType.DESERT, {
        borderColor: [177, 197, 99],
        accentColor: [148, 188, 87],
      }]
    ]),
  ],
  [
    TerrainType.FOREST,
    new Map<TerrainType, TileColorTransition>([
      ...riverTransitions,
    ]),
  ],
  [
    TerrainType.DESERT,
    new Map<TerrainType, TileColorTransition>([
      [TerrainType.COAST, desertWaterTransition],
      [TerrainType.RIVER, desertWaterTransition],
      [TerrainType.RIVER_MOUTH, desertWaterTransition],
      [TerrainType.RIVER_SOURCE, desertWaterTransition],
      [TerrainType.GRASSLAND, {
        borderColor: [210, 208, 112],
        accentColor: [222, 212, 117],
      }],
    ]),
  ],
  // [
  //   TerrainType.TUNDRA,
  //   new Map<TerrainType, TileColorTransition>([
  //     ...riverTransitions,
  //   ]),
  // ],
  // [
  //   TerrainType.TAIGA,
  //   new Map<TerrainType, TileColorTransition>([
  //     ...riverTransitions,
  //   ]),
  // ],
  // [
  //   TerrainType.GLACIAL,
  //   new Map<TerrainType, TileColorTransition>([
  //     ...riverTransitions,
  //   ]),
  // ]
]);
// control points
// TODO: base this off tile size or load from an image
// points are relative to template image
export const controlPoints: TileSectionTypeMap<Partial<Record<SectionControlPoint, Coord>>> = {
  [TileSectionType.CENTER]: {
    [SectionControlPoint.HEX_CENTER]: [31, 29],
    [SectionControlPoint.N]: [31, 15],
    [SectionControlPoint.NE]: [45, 22],
    [SectionControlPoint.SE]: [45, 37],
    [SectionControlPoint.S]: [31, 44],
    [SectionControlPoint.SW]: [18, 37],
    [SectionControlPoint.NW]: [18, 22],
  },
  [TileSectionType.N]: {
    [SectionControlPoint.EDGE_CENTER]: [31, 0],
    [SectionControlPoint.ADJ1_LOW]: [17, 3],
    [SectionControlPoint.ADJ1_MED]: [19, 6],
    [SectionControlPoint.ADJ1_HIGH]: [21, 10],
    [SectionControlPoint.ADJ1_INSIDE]: [22, 6],
    [SectionControlPoint.ADJ2_LOW]: [46, 3],
    [SectionControlPoint.ADJ2_MED]: [44, 6],
    [SectionControlPoint.ADJ2_HIGH]: [42, 10],
    [SectionControlPoint.ADJ2_INSIDE]: [41, 6],
    [SectionControlPoint.EDGE_ADJ1]: [18, 0],
    [SectionControlPoint.EDGE_ADJ2]: [45, 0],
    [SectionControlPoint.CORNER_ADJ1]: [15, 0],
    [SectionControlPoint.CORNER_ADJ2]: [48, 0],
    [SectionControlPoint.INSIDE_CENTER]: [31, 14],
  },
  [TileSectionType.NE]: {
    [SectionControlPoint.EDGE_CENTER]: [56, 15],
    [SectionControlPoint.ADJ1_LOW]: [47, 4],
    [SectionControlPoint.ADJ1_MED]: [45, 7],
    [SectionControlPoint.ADJ1_HIGH]: [43, 11],
    [SectionControlPoint.ADJ1_INSIDE]: [47, 9],
    [SectionControlPoint.ADJ2_LOW]: [60, 29],
    [SectionControlPoint.ADJ2_MED]: [56, 29],
    [SectionControlPoint.ADJ2_HIGH]: [52, 29],
    [SectionControlPoint.ADJ2_INSIDE]: [56, 26],
    [SectionControlPoint.EDGE_ADJ1]: [50, 4],
    [SectionControlPoint.EDGE_ADJ2]: [62, 26],
    [SectionControlPoint.CORNER_ADJ1]: [49, 2],
    [SectionControlPoint.CORNER_ADJ2]: [63, 29],
    [SectionControlPoint.INSIDE_CENTER]: [46, 21],
  },

  [TileSectionType.SE]: {
    [SectionControlPoint.EDGE_CENTER]: [56, 44],
    [SectionControlPoint.ADJ1_LOW]: [60, 30],
    [SectionControlPoint.ADJ1_MED]: [56, 30],
    [SectionControlPoint.ADJ1_HIGH]: [52, 30],
    [SectionControlPoint.ADJ1_INSIDE]: [56, 33],
    [SectionControlPoint.ADJ2_LOW]: [47, 55],
    [SectionControlPoint.ADJ2_MED]: [45, 52],
    [SectionControlPoint.ADJ2_HIGH]: [43, 48],
    [SectionControlPoint.ADJ2_INSIDE]: [47, 50],
    [SectionControlPoint.EDGE_ADJ1]: [62, 33],
    [SectionControlPoint.EDGE_ADJ2]: [50, 55],
    [SectionControlPoint.CORNER_ADJ1]: [63, 30],
    [SectionControlPoint.CORNER_ADJ2]: [49, 57],
    [SectionControlPoint.INSIDE_CENTER]: [46, 38],
  },

  [TileSectionType.S]: {
    [SectionControlPoint.EDGE_CENTER]: [31, 59],
    [SectionControlPoint.ADJ1_LOW]: [46, 56],
    [SectionControlPoint.ADJ1_MED]: [44, 53],
    [SectionControlPoint.ADJ1_HIGH]: [42, 49],
    [SectionControlPoint.ADJ1_INSIDE]: [41, 53],
    [SectionControlPoint.ADJ2_LOW]: [17, 56],
    [SectionControlPoint.ADJ2_MED]: [19, 53],
    [SectionControlPoint.ADJ2_HIGH]: [21, 49],
    [SectionControlPoint.ADJ2_INSIDE]: [22, 53],
    [SectionControlPoint.EDGE_ADJ1]: [45, 59],
    [SectionControlPoint.EDGE_ADJ2]: [18, 59],
    [SectionControlPoint.CORNER_ADJ1]: [48, 59],
    [SectionControlPoint.CORNER_ADJ2]: [15, 59],
    [SectionControlPoint.INSIDE_CENTER]: [31, 45],
  },

  [TileSectionType.SW]: {
    [SectionControlPoint.EDGE_CENTER]: [7, 44],
    [SectionControlPoint.ADJ1_LOW]: [16, 55],
    [SectionControlPoint.ADJ1_MED]: [18, 52],
    [SectionControlPoint.ADJ1_HIGH]: [20, 48],
    [SectionControlPoint.ADJ1_INSIDE]: [16, 50],
    [SectionControlPoint.ADJ2_LOW]: [3, 30],
    [SectionControlPoint.ADJ2_MED]: [7, 30],
    [SectionControlPoint.ADJ2_HIGH]: [11, 30],
    [SectionControlPoint.ADJ2_INSIDE]: [7, 33],
    [SectionControlPoint.EDGE_ADJ1]: [13, 55],
    [SectionControlPoint.EDGE_ADJ2]: [1, 33],
    [SectionControlPoint.CORNER_ADJ1]: [14, 57],
    [SectionControlPoint.CORNER_ADJ2]: [0, 30],
    [SectionControlPoint.INSIDE_CENTER]: [17, 38],
  },

  [TileSectionType.NW]: {
    [SectionControlPoint.EDGE_CENTER]: [7, 15],
    [SectionControlPoint.ADJ1_LOW]: [3, 29],
    [SectionControlPoint.ADJ1_MED]: [7, 29],
    [SectionControlPoint.ADJ1_HIGH]: [11, 29],
    [SectionControlPoint.ADJ1_INSIDE]: [7, 26],
    [SectionControlPoint.ADJ2_LOW]: [16, 4],
    [SectionControlPoint.ADJ2_MED]: [18, 7],
    [SectionControlPoint.ADJ2_HIGH]: [20, 11],
    [SectionControlPoint.ADJ2_INSIDE]: [16, 9],
    [SectionControlPoint.EDGE_ADJ1]: [1, 26],
    [SectionControlPoint.EDGE_ADJ2]: [13, 4],
    [SectionControlPoint.CORNER_ADJ1]: [0, 29],
    [SectionControlPoint.CORNER_ADJ2]: [14, 2],
    [SectionControlPoint.INSIDE_CENTER]: [17, 21],
  },
};


