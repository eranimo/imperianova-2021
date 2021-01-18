export type Size = {
  width: number;
  height: number;
}

export type Coord = [x: number, y: number];
export type CoordArray = Coord[];


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