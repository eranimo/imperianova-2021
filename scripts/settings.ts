import { TerrainType } from '../src/terrain';
import { ColorArray, Coord } from '../src/types';
import { TileSectionType, ControlPoint } from './types';
import { hexToRgb } from '../src/utils';


const coastalColor: ColorArray = [39, 121, 201];
const riverColor: ColorArray = coastalColor; // [0, 0, 255];
export const terrainTypePrimaryColors: Map<TerrainType, ColorArray> = new Map([
  [TerrainType.OCEAN, [29, 89, 150]],
  [TerrainType.COAST, coastalColor],
  [TerrainType.RIVER, riverColor],
  [TerrainType.RIVER_SOURCE, riverColor],
  [TerrainType.RIVER_MOUTH, riverColor],
  [TerrainType.GRASSLAND, [120, 178, 76]],
  [TerrainType.FOREST, [96, 145, 59]],
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
  [TerrainType.RIVER, beachTransition],
  [TerrainType.RIVER_MOUTH, beachTransition],
  [TerrainType.RIVER_SOURCE, beachTransition],
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
        borderColor: hexToRgb('#2166AA'),
        accentColor: hexToRgb('#1F5FA0'),
      }]
    ])
  ],
  [
    TerrainType.COAST,
    new Map<TerrainType, TileColorTransition>([
      ...waterTransitions,
      [TerrainType.OCEAN, {
        borderColor: hexToRgb('#236CB5'),
        accentColor: hexToRgb('#2573BF'),
      }]
    ]),
  ],
  [
    TerrainType.RIVER,
    new Map<TerrainType, TileColorTransition>(waterTransitions),
  ],
  [
    TerrainType.RIVER_MOUTH,
    new Map<TerrainType, TileColorTransition>(waterTransitions),
  ],
  [
    TerrainType.RIVER_SOURCE,
    new Map<TerrainType, TileColorTransition>(waterTransitions),
  ],
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
export const controlPoints: Record<TileSectionType, Partial<Record<ControlPoint, Coord>>> = {
  [TileSectionType.CENTER]: {
    [ControlPoint.HEX_CENTER]: [31, 29],
    [ControlPoint.N]: [31, 15],
    [ControlPoint.NE]: [45, 22],
    [ControlPoint.SE]: [45, 37],
    [ControlPoint.S]: [31, 44],
    [ControlPoint.SW]: [18, 37],
    [ControlPoint.NW]: [18, 22],
  },
  [TileSectionType.N]: {
    [ControlPoint.EDGE_CENTER]: [31, 0],
    [ControlPoint.ADJ1_LOW]: [17, 3],
    [ControlPoint.ADJ1_MED]: [19, 6],
    [ControlPoint.ADJ1_HIGH]: [21, 10],
    [ControlPoint.ADJ2_LOW]: [46, 3],
    [ControlPoint.ADJ2_MED]: [44, 6],
    [ControlPoint.ADJ2_HIGH]: [42, 10],
    [ControlPoint.EDGE_ADJ1]: [18, 0],
    [ControlPoint.EDGE_ADJ2]: [45, 0],
    [ControlPoint.CORNER_ADJ1]: [15, 0],
    [ControlPoint.CORNER_ADJ2]: [48, 0],
    [ControlPoint.INSIDE_CENTER]: [31, 14],
  },
  [TileSectionType.NE]: {
    [ControlPoint.EDGE_CENTER]: [56, 15],
    [ControlPoint.ADJ1_LOW]: [47, 4],
    [ControlPoint.ADJ1_MED]: [45, 7],
    [ControlPoint.ADJ1_HIGH]: [43, 11],
    [ControlPoint.ADJ2_LOW]: [60, 29],
    [ControlPoint.ADJ2_MED]: [56, 29],
    [ControlPoint.ADJ2_HIGH]: [52, 29],
    [ControlPoint.EDGE_ADJ1]: [50, 4],
    [ControlPoint.EDGE_ADJ2]: [62, 26],
    [ControlPoint.CORNER_ADJ1]: [49, 2],
    [ControlPoint.CORNER_ADJ2]: [63, 29],
    [ControlPoint.INSIDE_CENTER]: [46, 21],
  },

  [TileSectionType.SE]: {
    [ControlPoint.EDGE_CENTER]: [56, 44],
    [ControlPoint.ADJ1_LOW]: [60, 30],
    [ControlPoint.ADJ1_MED]: [56, 30],
    [ControlPoint.ADJ1_HIGH]: [52, 30],
    [ControlPoint.ADJ2_LOW]: [47, 55],
    [ControlPoint.ADJ2_MED]: [45, 52],
    [ControlPoint.ADJ2_HIGH]: [43, 48],
    [ControlPoint.EDGE_ADJ1]: [62, 33],
    [ControlPoint.EDGE_ADJ2]: [50, 55],
    [ControlPoint.CORNER_ADJ1]: [63, 30],
    [ControlPoint.CORNER_ADJ2]: [49, 57],
    [ControlPoint.INSIDE_CENTER]: [46, 38],
  },

  [TileSectionType.S]: {
    [ControlPoint.EDGE_CENTER]: [31, 59],
    [ControlPoint.ADJ1_LOW]: [46, 56],
    [ControlPoint.ADJ1_MED]: [44, 53],
    [ControlPoint.ADJ1_HIGH]: [42, 49],
    [ControlPoint.ADJ2_LOW]: [17, 56],
    [ControlPoint.ADJ2_MED]: [19, 53],
    [ControlPoint.ADJ2_HIGH]: [21, 49],
    [ControlPoint.EDGE_ADJ1]: [45, 59],
    [ControlPoint.EDGE_ADJ2]: [18, 59],
    [ControlPoint.CORNER_ADJ1]: [48, 59],
    [ControlPoint.CORNER_ADJ2]: [15, 59],
    [ControlPoint.INSIDE_CENTER]: [31, 45],
  },

  [TileSectionType.SW]: {
    [ControlPoint.EDGE_CENTER]: [7, 44],
    [ControlPoint.ADJ1_LOW]: [16, 55],
    [ControlPoint.ADJ1_MED]: [18, 52],
    [ControlPoint.ADJ1_HIGH]: [20, 48],
    [ControlPoint.ADJ2_LOW]: [3, 30],
    [ControlPoint.ADJ2_MED]: [7, 30],
    [ControlPoint.ADJ2_HIGH]: [11, 30],
    [ControlPoint.EDGE_ADJ1]: [13, 55],
    [ControlPoint.EDGE_ADJ2]: [1, 33],
    [ControlPoint.CORNER_ADJ1]: [14, 57],
    [ControlPoint.CORNER_ADJ2]: [0, 30],
    [ControlPoint.INSIDE_CENTER]: [17, 38],
  },

  [TileSectionType.NW]: {
    [ControlPoint.EDGE_CENTER]: [7, 15],
    [ControlPoint.ADJ1_LOW]: [3, 29],
    [ControlPoint.ADJ1_MED]: [7, 29],
    [ControlPoint.ADJ1_HIGH]: [11, 29],
    [ControlPoint.ADJ2_LOW]: [16, 4],
    [ControlPoint.ADJ2_MED]: [18, 7],
    [ControlPoint.ADJ2_HIGH]: [20, 11],
    [ControlPoint.EDGE_ADJ1]: [1, 26],
    [ControlPoint.EDGE_ADJ2]: [13, 4],
    [ControlPoint.CORNER_ADJ1]: [0, 29],
    [ControlPoint.CORNER_ADJ2]: [14, 2],
    [ControlPoint.INSIDE_CENTER]: [17, 21],
  },
};


