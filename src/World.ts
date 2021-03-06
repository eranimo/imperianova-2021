import { Size, Direction, oddq_directions, oppositeDirections, directionIndexOrder, adjacentDirections, DirectionMap, directionTitles, Coord } from './types';
import ndarray from 'ndarray';
import * as Honeycomb from 'honeycomb-grid';
import { clamp } from 'lodash';
import { MultiDictionary, Queue } from 'typescript-collections';
import { Subject } from 'rxjs';
import { TerrainType, terrainTypeTitles } from './terrain';


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

export type Landmass = {
  id: number,
  size: number,
  hexes: Hex[],
}

export type Ecoregion = {
  id: number,
  size: number,
  hexes: Hex[],
  terrainType: TerrainType,
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
  hexNeighborDirections: Map<Hex, Map<Hex, Direction>>;
  hexRiverEdges: MultiDictionary<Hex, Direction>;
  hexRiverPoints: MultiDictionary<Hex, [Honeycomb.Point, Honeycomb.Point]>;
  hexRoads: Map<Hex, Map<Direction, Hex>>;
  riverHexPairs: Map<Hex, Set<Hex>>;
  landmasses: Landmass[];
  ecoregions: Ecoregion[];

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

    this.hexNeighborDirections = new Map();
    this.hexRoads = new Map();

    this.hexgrid.forEach((hex, index) => {
      hex.index = index;
      const point = hex.toPoint();
      this.pointsMap.set(`${hex.x},${hex.y}`, [point.x, point.y]);
      this.indexMap.set(`${hex.x},${hex.y}`, index);
    });

    this.hexgrid.forEach((hex, index) => {
      // calculate neighbor map
      const neighborMap = new Map();
      for (const direction of directionIndexOrder) {
        const neighborHex = this.getHexNeighbor(hex.x, hex.y, direction);
        neighborMap.set(neighborHex, direction);
      }
      this.hexNeighborDirections.set(hex, neighborMap);
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
  }

  getHexFromPoint(point: Coord) {
    const hexCoords = GridFactory.pointToHex(point[0], point[1]);
    return this.hexgrid.get(hexCoords);
  }

  getPointFromPosition(x: number, y: number) {
    const hex = this.hexgrid.get({ x, y });
    if (!hex) return null;
    const p = hex.toPoint();
    return [p.x, p.y];
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

  *hexNeighbors(hex: Hex) {
    const { x, y } = hex;
    const se_hex = this.getHexNeighbor(x, y, Direction.SE);
    if (se_hex !== null) {
      yield se_hex;
    }
    const ne_hex = this.getHexNeighbor(x, y, Direction.NE);
    if (ne_hex !== null) {
      yield ne_hex;
    }
    const n_hex = this.getHexNeighbor(x, y, Direction.N);
    if (n_hex !== null) {
      yield n_hex;
    }
    const nw_hex = this.getHexNeighbor(x, y, Direction.NW);
    if (nw_hex !== null) {
      yield nw_hex;
    }
    const sw_hex = this.getHexNeighbor(x, y, Direction.SW);
    if (sw_hex !== null) {
      yield sw_hex;
    }
    const s_hex = this.getHexNeighbor(x, y, Direction.S);
    if (s_hex !== null) {
      yield s_hex;
    }
  }

  floodFill(
    firstHex: Hex,
    isConnected: (h1: Hex, h2: Hex) => boolean,
    visited: Set<Hex> = new Set(), 
  ) {
    const q = new Queue<Hex>();
    q.enqueue(firstHex);
    visited.add(firstHex);
    const region = new Set<Hex>();
    while (q.size() > 0) {
      const hex = q.dequeue();
      region.add(hex);
      for (const h of this.hexNeighbors(hex)) {
        if (visited.has(h) === false && isConnected(hex, h)) {
          q.enqueue(h);
          visited.add(h);
        }
      }
    }
    return region;
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

  getTerrain(hex: Hex) {
    return this.getTerrainForCoord(hex.x, hex.y);
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

  /**
   * Returns true if both hexes are neighbors
   * @param hex1 First Hex
   * @param hex2 Second Hex
   */
  areHexesNeighbors(hex1: Hex, hex2: Hex): boolean {
    return this.hexNeighborDirections.get(hex1).has(hex2);
  }

  setHexRoad(node: Hex, otherNode: Hex, direction: Direction) {
    if (!this.hexRoads.has(node)) {
      this.hexRoads.set(node, new Map());
    }
    this.hexRoads.get(node).set(direction, otherNode);
  }

  setRoadPath(path: Hex[]) {
    path.forEach((node, index) => {
      const lastNode = path[index - 1];
      const nextNode = path[index + 1];
      if (lastNode) {
        const direction = this.hexNeighborDirections.get(node).get(lastNode);
        this.setHexRoad(node, lastNode, direction);
      }

      if (nextNode) {
        const direction = this.hexNeighborDirections.get(node).get(nextNode);
        this.setHexRoad(node, nextNode, direction);
      }
    });
  }

  hasRoad(hex: Hex, direction?: Direction) {
    if (this.hexRoads.has(hex)) {
      if (direction === undefined) {
        return true;
      }
      return this.hexRoads.get(hex).has(direction);
    }
    return false;
  }

  isLand(hex: Hex) {
    return (
      this.getTerrainForCoord(hex.x, hex.y) !== TerrainType.OCEAN &&
      this.getTerrainForCoord(hex.x, hex.y) !== TerrainType.COAST
    );
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

export function calculateCentroidForHexes(world: World, hexes: Hex[]): Coord {
  let x = 0;
  let y = 0;
  for (const hex of hexes) {
    const [nx, ny] = world.getHexPosition(hex.x, hex.y);
    x += nx + 32;
    y += ny + 30;
  }
  return [
    x / hexes.length,
    y / hexes.length,
  ];
}
