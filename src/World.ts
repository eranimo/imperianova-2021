import * as PIXI from 'pixi.js';
import { Size } from './types';
import ndarray from 'ndarray';
import * as Honeycomb from 'honeycomb-grid';
import { octaveNoise } from './utils';
import SimplexNoise from 'simplex-noise';
import Alea from 'alea';


export enum TerrainType {
  NONE = 0,
  OCEAN = 1,
  LAND = 2,
}

export type WorldOptions = {
  gridSize: Size,
  sealevel: number,
  seed: number,
}

export const HEX_SIZE = 10;

export class World {
  public gridSize: Size;
  hexHeightmap: ndarray;
  grid: Honeycomb.Grid<Honeycomb.Hex<{ size: number; }>>;
  hexTerrainType: ndarray;

  constructor(
    public options: WorldOptions,
  ) {
    const { gridSize, sealevel, seed } = options;
    this.gridSize = gridSize;

    const Hex = Honeycomb.extendHex({ size: HEX_SIZE });
    const Grid = Honeycomb.defineGrid(Hex);
    const rng = Alea(seed);
    const simplexNoise = new SimplexNoise(rng);

    this.hexHeightmap = ndarray(new Int32Array(gridSize.width * gridSize.height), [gridSize.width, gridSize.height]);
    this.hexTerrainType = ndarray(new Array(gridSize.width * gridSize.height), [gridSize.width, gridSize.height]);

    // generate height
    this.grid = Grid.rectangle(gridSize);
    this.grid.forEach(hex => {
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
}