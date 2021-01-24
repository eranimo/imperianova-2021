import * as PIXI from 'pixi.js';
import { Size, Direction, oddq_directions, oppositeDirections, directionIndexOrder, adjacentDirections, DirectionMap, directionTitles } from './types';
import ndarray from 'ndarray';
import * as Honeycomb from 'honeycomb-grid';
import { octaveNoise, logGroupTime } from './utils';
import SimplexNoise from 'simplex-noise';
import Alea from 'alea';
import { clamp } from 'lodash';
import { MultiDictionary } from 'typescript-collections';
import { Subject } from 'rxjs';


export enum TerrainType {
  MAP_EDGE = 0,
  OCEAN = 1,
  GRASSLAND = 2,
  FOREST = 3,
  DESERT = 4,
  TAIGA = 5,
  TUNDRA = 6,
  GLACIAL = 7,
  RIVER = 8, // special
  RIVER_MOUTH = 9, // special
  RIVER_SOURCE = 10, // special
  __LENGTH,
}

export type TerrainTypeMap<T> = Record<Exclude<TerrainType, TerrainType.__LENGTH>, T>;

export const terrainColors: TerrainTypeMap<number> = {
  [TerrainType.MAP_EDGE]: 0x000000,
  [TerrainType.OCEAN]: 0x3F78CB,
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

export const terrainMinimapColors: TerrainTypeMap<string> = {
  [TerrainType.MAP_EDGE]: '#000000',
  [TerrainType.OCEAN]: '#3F78CB',
  [TerrainType.GRASSLAND]: '#81B446',
  [TerrainType.FOREST]: '#236e29',
  [TerrainType.DESERT]: '#D9BF8C',
  [TerrainType.TAIGA]: '#006259',
  [TerrainType.TUNDRA]: '#96D1C3',
  [TerrainType.GLACIAL]: '#FAFAFA',
  [TerrainType.RIVER]: '#3F78CB',
  [TerrainType.RIVER_MOUTH]: '#3F78CB',
  [TerrainType.RIVER_SOURCE]: '#3F78CB',
};

export const terrainTypeTitles: TerrainTypeMap<string> = {
  [TerrainType.MAP_EDGE]: 'MAP EDGE',
  [TerrainType.OCEAN]: 'Ocean',
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
  [TerrainType.OCEAN]: [TerrainType.DESERT, TerrainType.GRASSLAND, TerrainType.FOREST, TerrainType.TAIGA, TerrainType.TUNDRA, TerrainType.GLACIAL],
  [TerrainType.FOREST]: [TerrainType.TAIGA, TerrainType.GRASSLAND],
  [TerrainType.DESERT]: [TerrainType.GRASSLAND, TerrainType.FOREST],
  [TerrainType.TUNDRA]: [TerrainType.GLACIAL, TerrainType.TAIGA],
  [TerrainType.TAIGA]: [TerrainType.GRASSLAND, TerrainType.GLACIAL],
};

export enum EdgeFeature {
  NONE = 0,
  RIVER = 1,
  __LENGTH
}

export enum CornerFeature {
  NONE = 0,
  RIVER = 1,
  __LENGTH
}

export enum HexFeature {
  NONE = 0,
  ROAD = 1,
  __LENGTH
}

export type Hex = Honeycomb.Hex<IHex>; 
export const HexFactory = Honeycomb.extendHex<IHex>({
  size: { xRadius: 32.663, yRadius: 34.641 },
  orientation: 'flat'
} as any);
export const GridFactory = Honeycomb.defineGrid(HexFactory);
export interface IHex {
  index: number,
}

export type Edge = {
  id: number;
  direction: Direction;
  h1: Hex;
  h2: Hex;
  p1: Honeycomb.Point,
  p2: Honeycomb.Point,
  o1: Hex;
  o2: Hex;
  p1_edges?: [Edge, Edge];
  p2_edges?: [Edge, Edge];
  upstream?: number;
  height?: number;
}

export class World {
  public gridSize: Size;
  public hexgrid: Honeycomb.Grid<Hex>;
  private indexMap: Map<string, number>;
  private pointsMap: Map<string, [number, number]>;

  terrain: ndarray;
  heightmap: ndarray;
  terrainUpdates$: Subject<unknown>;

  rivers: Edge[][];
  hexRiverEdges: MultiDictionary<Hex, Direction>;
  hexRiverPoints: MultiDictionary<Hex, [Honeycomb.Point, Honeycomb.Point]>;
  riverHexPairs: Map<Hex, Set<Hex>>;

  constructor() {
    this.indexMap = new Map();
    this.pointsMap = new Map();
    this.terrainUpdates$ = new Subject();
  }

  setWorldSize(size: number) {
    const gridSize = {
      width: size * 2,
      height: size,
    };
    this.gridSize = gridSize;
    this.hexgrid = GridFactory.rectangle({
      width: gridSize.width,
      height: gridSize.height,
    });

    const arraySize = gridSize.width * gridSize.height;
    const arrayDim = [gridSize.width, gridSize.height];
    const terrainBuffer = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * arraySize);
    this.terrain = ndarray(new Uint32Array(terrainBuffer), arrayDim);

    const heightBuffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * arraySize);
    this.heightmap = ndarray(new Float32Array(heightBuffer), arrayDim);

    this.hexgrid.forEach((hex, index) => {
      hex.index = index;
      const point = hex.toPoint();
      this.pointsMap.set(`${hex.x},${hex.y}`, [point.x, point.y]);
      this.indexMap.set(`${hex.x},${hex.y}`, index);
    });
  }

  getHexPosition(x: number, y: number) {
    return this.pointsMap.get(`${x},${y}`);
  }

  setHexTerrain(hex: Hex, terrainType: TerrainType) {
    this.terrain.set(hex.x, hex.y, terrainType);
    this.terrainUpdates$.next([hex]);
  }

  getHex(x: number, y: number) {
    return this.hexgrid[this.indexMap.get(`${x},${y}`)] || null;
    // return this.hexgrid.get({ x, y });
  }

  getHexFromPoint(point: PIXI.Point) {
    const hexCoords = GridFactory.pointToHex(point.x, point.y);
    return this.hexgrid.get(hexCoords);
  }

  getPointFromPosition(x: number, y: number) {
    const hex = this.hexgrid.get({ x, y });
    if (!hex) return null;
    const p = hex.toPoint();
    return new PIXI.Point(p.x, p.y);
  }

  getHexCoordinate(hex: Hex) {
    const long = ((hex.x / this.gridSize.width) * 360) - 180;
    const lat = ((-hex.y / this.gridSize.height) * 180) + 90;
    return { lat, long };
  }

  getHexNeighbors(hex: Hex): DirectionMap<Hex> {
    const { x, y } = hex;
    const se_hex = this.getHexNeighbor(x, y, Direction.SE);
    const ne_hex = this.getHexNeighbor(x, y, Direction.NE);
    const n_hex = this.getHexNeighbor(x, y, Direction.N);
    const nw_hex = this.getHexNeighbor(x, y, Direction.NW);
    const sw_hex = this.getHexNeighbor(x, y, Direction.SW);
    const s_hex = this.getHexNeighbor(x, y, Direction.S);

    return {
      [Direction.SE]: se_hex,
      [Direction.NE]: ne_hex,
      [Direction.N]: n_hex,
      [Direction.NW]: nw_hex,
      [Direction.SW]: sw_hex,
      [Direction.S]: s_hex,
    }
  }

  getHexNeighbor(x: number, y: number, direction: Direction) {
    const coord = this.getHexNeighborCoord(x, y, direction);
    return this.getHex(coord[0], coord[1]);
  }

  getHexNeighborCoord(x: number, y: number, direction: Direction) {
    const parity = x & 1;
    const dir = oddq_directions[parity][direction];
    const coord = [x + dir[0], y + dir[1]];
    return coord;
  }

  getTerrainForCoord(x: number, y: number): TerrainType {
    if (y === -1 || y === this.gridSize.height) {
      const half = Math.round(this.gridSize.width / 2);
      const nx = clamp(((half + (half - x)) - 1), 0, this.gridSize.width - 1);
      const ny = y === -1 ? 0 : this.gridSize.height - 1;
      return this.terrain.data[this.indexMap.get(`${nx},${ny}`)];
    } else if (x === -1) {
      return this.terrain.data[this.indexMap.get(`${this.gridSize.width - 1},${y}`)];
    } else if (x === this.gridSize.width) {
      return this.terrain.data[this.indexMap.get(`${0},${y}`)];
    }
    return this.terrain.data[this.indexMap.get(`${x},${y}`)];
  }

  getHexNeighborTerrain(x: number, y: number): DirectionMap<TerrainType> {
    const se_hex = this.getHexNeighborCoord(x, y, Direction.SE);
    const se_hex_terrain = this.getTerrainForCoord(se_hex[0], se_hex[1]);

    const ne_hex = this.getHexNeighborCoord(x, y, Direction.NE);
    const ne_hex_terrain = this.getTerrainForCoord(ne_hex[0], ne_hex[1]);

    const n_hex = this.getHexNeighborCoord(x, y, Direction.N);
    const n_hex_terrain = this.getTerrainForCoord(n_hex[0], n_hex[1]);

    const nw_hex = this.getHexNeighborCoord(x, y, Direction.NW);
    const nw_hex_terrain = this.getTerrainForCoord(nw_hex[0], nw_hex[1]);

    const sw_hex = this.getHexNeighborCoord(x, y, Direction.SW);
    const sw_hex_terrain = this.getTerrainForCoord(sw_hex[0], sw_hex[1]);

    const s_hex = this.getHexNeighborCoord(x, y, Direction.S);
    const s_hex_terrain = this.getTerrainForCoord(s_hex[0], s_hex[1]);

    return {
      [Direction.SE]: se_hex_terrain,
      [Direction.NE]: ne_hex_terrain,
      [Direction.N]: n_hex_terrain,
      [Direction.NW]: nw_hex_terrain,
      [Direction.SW]: sw_hex_terrain,
      [Direction.S]: s_hex_terrain,
    }
  }

  debugNeighborTerrain(x: number, y: number) {
    const neighborTerrainTypes = this.getHexNeighborTerrain(x, y);
    const se_hex = this.getHexNeighbor(x, y, Direction.SE);
    const ne_hex = this.getHexNeighbor(x, y, Direction.NE);
    const n_hex = this.getHexNeighbor(x, y, Direction.N);
    const nw_hex = this.getHexNeighbor(x, y, Direction.NW);
    const sw_hex = this.getHexNeighbor(x, y, Direction.SW);
    const s_hex = this.getHexNeighbor(x, y, Direction.S);

    return {
      neighborCoords: {
        [directionTitles[Direction.SE]]: se_hex,
        [directionTitles[Direction.NE]]: ne_hex,
        [directionTitles[Direction.N]]: n_hex,
        [directionTitles[Direction.NW]]: nw_hex,
        [directionTitles[Direction.SW]]: sw_hex,
        [directionTitles[Direction.S]]: s_hex,
      },
      neighborTerrainTypes: {
        [directionTitles[Direction.SE]]: terrainTypeTitles[neighborTerrainTypes[Direction.SE]],
        [directionTitles[Direction.NE]]: terrainTypeTitles[neighborTerrainTypes[Direction.NE]],
        [directionTitles[Direction.N]]:  terrainTypeTitles[neighborTerrainTypes[Direction.N]],
        [directionTitles[Direction.NW]]: terrainTypeTitles[neighborTerrainTypes[Direction.NW]],
        [directionTitles[Direction.SW]]: terrainTypeTitles[neighborTerrainTypes[Direction.SW]],
        [directionTitles[Direction.S]]:  terrainTypeTitles[neighborTerrainTypes[Direction.S]],
      },
    }
  }
}