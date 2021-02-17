import { Tileset } from "./Tileset";
import { TerrainType } from './terrain';

export type Size = {
  width: number;
  height: number;
}

export type Coord = [x: number, y: number];
export type Line = [p1: Coord, p2: Coord];
export type CoordArray = Coord[];

export type AutogenObjectTile = {
  size: number,
  terrainTypes: TerrainType[],
  used: boolean,
};

export type ColorArray = [r: number, g: number, b: number];

export enum Direction {
  SE = 0,
  NE = 1,
  N = 2,
  NW = 3,
  SW = 4,
  S = 5,
  __LENGTH
}

export type DirectionMap<T> = Record<Exclude<Direction, Direction.__LENGTH>, T>;

export const directionShort = {
  [Direction.SE]: 'SE',
  [Direction.NE]: 'NE',
  [Direction.N]: 'N',
  [Direction.NW]: 'NW',
  [Direction.SW]: 'SW',
  [Direction.S]: 'S',
}

export const directionTitles = {
  [Direction.SE]: 'South East',
  [Direction.NE]: 'North East',
  [Direction.N]: 'North',
  [Direction.NW]: 'North West',
  [Direction.SW]: 'South West',
  [Direction.S]: 'South',
}

export const adjacentDirections = {
  [Direction.SE]: [Direction.NE, Direction.S],
  [Direction.NE]: [Direction.N, Direction.SE],
  [Direction.N]: [Direction.NW, Direction.NE],
  [Direction.NW]: [Direction.SW, Direction.N],
  [Direction.SW]: [Direction.S, Direction.NW],
  [Direction.S]: [Direction.SE, Direction.SW],
};

export const oppositeDirections: Partial<Record<Direction, Direction>> = {
  [Direction.SE]: Direction.NW,
  [Direction.NE]: Direction.SW,
  [Direction.N]: Direction.S,
  [Direction.NW]: Direction.SE,
  [Direction.SW]: Direction.NE,
  [Direction.S]: Direction.N,
}

export const directionIndexOrder = [
  Direction.SE,
  Direction.NE,
  Direction.N,
  Direction.NW,
  Direction.SW,
  Direction.S,
]

export const directionColors = {
  [Direction.SE]: [0, 255, 255],
  [Direction.NE]: [255, 0, 255],
  [Direction.N]: [255, 0, 0],
  [Direction.NW]: [0, 0, 255],
  [Direction.SW]: [255, 255, 0],
  [Direction.S]: [0, 255, 0],
}

export const oddq_directions = [
  [
    [+1, 0], [+1, -1], [0, -1],
    [-1, -1], [-1, 0], [0, +1]
  ],
  [
    [+1, +1], [+1, 0], [0, -1],
    [-1, 0], [-1, +1], [0, +1]
  ],
];

export enum Corner {
  RIGHT = 0,
  BOTTOM_RIGHT = 1,
  BOTTOM_LEFT = 2,
  LEFT = 3,
  TOP_LEFT = 4,
  TOP_RIGHT = 5,
  __LENGTH
}

export type CornerMap<T> = Record<Exclude<Corner, Corner.__LENGTH>, T>;

export const cornerTitles: CornerMap<string> = {
  [Corner.RIGHT]: 'Right',
  [Corner.BOTTOM_RIGHT]: 'Bottom Right',
  [Corner.BOTTOM_LEFT]: 'Bottom Left',
  [Corner.LEFT]: 'Left',
  [Corner.TOP_LEFT]: 'Top Left',
  [Corner.TOP_RIGHT]: 'Top Right',
}
export const directionCorners: DirectionMap<[Corner, Corner]> = {
  [Direction.SE]: [Corner.RIGHT, Corner.BOTTOM_RIGHT],
  [Direction.NE]: [Corner.TOP_RIGHT, Corner.RIGHT],
  [Direction.N]: [Corner.TOP_LEFT, Corner.TOP_RIGHT],
  [Direction.NW]: [Corner.LEFT, Corner.TOP_LEFT],
  [Direction.SW]: [Corner.BOTTOM_LEFT, Corner.LEFT],
  [Direction.S]: [Corner.BOTTOM_RIGHT, Corner.BOTTOM_LEFT],
}

export const cornerDirections = {
  [Corner.RIGHT]: [Direction.NE, Direction.SE],
  [Corner.BOTTOM_RIGHT]: [Direction.SE, Direction.S],
  [Corner.BOTTOM_LEFT]: [Direction.S, Direction.SW],
  [Corner.LEFT]: [Direction.SW, Direction.NW],
  [Corner.TOP_LEFT]: [Direction.NW, Direction.N],
  [Corner.TOP_RIGHT]: [Direction.N, Direction.NE],
}

export const cornerIndexOrder = [
  Corner.RIGHT,
  Corner.BOTTOM_RIGHT,
  Corner.BOTTOM_LEFT,
  Corner.LEFT,
  Corner.TOP_LEFT,
  Corner.TOP_RIGHT,
];

export type ExportedTileset = {
  buffer: Uint8ClampedArray,
  size: Size,
  tiles: {
    [tileID: number]: {
      x: number,
      y: number,
      width: number,
      height: number,
    }
  }
}