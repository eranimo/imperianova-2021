import * as PIXI from 'pixi.js';
import { Size, Direction, oddq_directions } from './types';
import ndarray from 'ndarray';
import * as Honeycomb from 'honeycomb-grid';
import { octaveNoise } from './utils';
import SimplexNoise from 'simplex-noise';
import Alea from 'alea';
import { clamp } from 'lodash';


export enum TerrainType {
  NONE = 0,
  OCEAN = 1,
  LAND = 2,
  __LENGTH,
}

export enum EdgeFeature {
  NONE = 0,
  RIVER = 1,
  __LENGTH
}

export enum HexFeature {
  NONE = 0,
  ROAD = 1,
  __LENGTH
}

export type WorldOptions = {
  gridSize: Size,
  sealevel: number,
  seed: number,
}

const Hex = Honeycomb.extendHex({
  size: { xRadius: 32.663, yRadius: 34.641 },
  orientation: 'flat'
});
const Grid = Honeycomb.defineGrid(Hex);

export class World {
  public gridSize: Size;
  hexHeightmap: ndarray;
  grid: Honeycomb.Grid<Honeycomb.Hex<any>>;
  hexTerrainType: ndarray;
  private indexMap: Map<string, number>;
  private pointsMap: Map<string, [number, number]>;

  constructor(
    public options: WorldOptions,
  ) {
    const { gridSize, sealevel, seed } = options;
    this.gridSize = gridSize;
    this.indexMap = new Map();
    this.pointsMap = new Map();

    const rng = Alea(seed);
    const simplexNoise = new SimplexNoise(rng);

    this.hexHeightmap = ndarray(new Int32Array(gridSize.width * gridSize.height), [gridSize.width, gridSize.height]);
    this.hexTerrainType = ndarray(new Array(gridSize.width * gridSize.height), [gridSize.width, gridSize.height]);

    // generate height
    this.grid = Grid.rectangle({
      width: gridSize.width,
      height: gridSize.height,
    });
    this.grid.forEach((hex, index) => {
      const point = hex.round().toPoint();
      this.pointsMap.set(`${hex.x},${hex.y}`, [(point.x), (point.y)]);
      this.indexMap.set(`${hex.x},${hex.y}`, index);
      const value = octaveNoise(
        simplexNoise.noise2D.bind(simplexNoise),
        hex.x / 5,
        hex.y / 5,
        6,
        0.5,
        0.08,
      ) + 1 / 2;
      this.hexHeightmap.set(hex.x, hex.y, value * 255);
    });

    // decide terrain type
    this.grid.forEach(hex => {
      const height = this.hexHeightmap.get(hex.x, hex.y);
      if (height < sealevel) {
        this.hexTerrainType.set(hex.x, hex.y, TerrainType.OCEAN);
      } else {
        this.hexTerrainType.set(hex.x, hex.y, TerrainType.LAND);
      }
    })
    console.log('world', this);
  }

  getHex(x: number, y: number) {
    return this.grid[this.indexMap.get(`${x},${y}`)] || null;;
  }

  getHexFromPoint(point: PIXI.Point) {
    const hexCoords = Grid.pointToHex(point.x, point.y);
    return this.grid.get(hexCoords);
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

  get size() {
    return this.options.gridSize;
  }

  getTerrainForCoord(x: number, y: number) {
    if (y === -1 || y === this.size.height) {
      const half = Math.round(this.size.width / 2);
      const nx = clamp(((half + (half - x)) - 1), 0, this.size.width - 1);
      const ny = y === -1 ? 0 : this.size.height - 1;
      return this.hexTerrainType.data[this.indexMap.get(`${nx},${ny}`)];
    } else if (x === -1) {
      return this.hexTerrainType.data[this.indexMap.get(`${this.size.width - 1},${y}`)];
    } else if (x === this.size.width) {
      return this.hexTerrainType.data[this.indexMap.get(`${0},${y}`)];
    }
    return this.hexTerrainType.data[this.indexMap.get(`${x},${y}`)];
  }

  getHexNeighborTerrain(x: number, y: number): Partial<Record<Direction, TerrainType>> {
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

  getHexPosition(x: number, y: number) {
    return this.pointsMap.get(`${x},${y}`);
  }
}