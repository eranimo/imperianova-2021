import { WorldMapStateHex } from './worldMapState';
import { terrainColors } from '../game/world/terrain';
import { colorToNumber } from '../utils';
import colormap from 'colormap';
import { MapView } from 'structurae';
import { WorldMapManager } from './WorldMapManager';

export type TileStates = Map<number, WorldMapStateHex>;

export interface MapMode {
  title: string;
  displayRivers: boolean;
  init?(manager: WorldMapManager): void;
  setTile(index: number, manager: WorldMapManager): number;
}

class TerrainMapMode implements MapMode {
  title = 'Terrain';
  displayRivers = true;
  setTile(index: number, manager: WorldMapManager) {
    return terrainColors[manager.getHexField(index, 'terrainType')];
  }
}

class HeightMapMode implements MapMode {
  title = 'Height';
  displayRivers = false;

  colorsWater: [number, number, number, number][];
  colorsLand: [number, number, number, number][];
  manager: WorldMapManager;

  init(manager: WorldMapManager) {
    this.manager = manager;
    this.colorsWater = colormap({
      colormap: 'freesurface-blue',
      format: 'float',
      nshades: 50,
    }).reverse();
    this.colorsLand = colormap({
      colormap: 'greens',
      format: 'float',
      nshades: 50,
    });
  }

  setTile(index: number, manager: WorldMapManager) {
    const height = manager.getHexField(index, 'height');
    const sealevel = this.manager.worldMapState.get('sealevel');
    let color: [number, number, number, number];
    if (height < sealevel) {
      const index = Math.round(((sealevel - height) / sealevel) * 50);
      color = this.colorsWater[index];
    } else {
      const index = Math.round(((height - sealevel) / (255 - sealevel)) * 50);
      color = this.colorsLand[index];
    }

    if (!color) {
      return 0x000000;
    }
    
    return colorToNumber([
      Math.round(color[0] * 255),
      Math.round(color[1] * 255),
      Math.round(color[2] * 255),
    ]);
  }
}

class PopulationMapMode implements MapMode {
  title = 'Population';
  displayRivers = false;
  maxPopulation: number;
  colors: [number, number, number, number][];

  init(manager: WorldMapManager) {
    this.maxPopulation = 0;
    for (let i = 0; i < manager.hexLength; i++) {
      const population = manager.getHexField(i, 'population');
      if (population !== undefined) {
        this.maxPopulation = Math.max(this.maxPopulation, population);
      }
    }
    this.colors = colormap({
      colormap: 'density',
      format: 'float',
      nshades: 50,
    });
  }

  setTile(index: number, manager: WorldMapManager) {
    const sealevel = manager.worldMapState.get('sealevel');
    const height = manager.getHexField(index, 'height');
    if (height < sealevel) {
      return 0x111111;
    }
    const population = manager.getHexField(index, 'population');
    const v = Math.round((population / this.maxPopulation) * 50);
    const color = isNaN(v) ? this.colors[0] : this.colors[v];
    if (!color) return 0x000000;
    return colorToNumber([
      Math.round(color[0] * 255),
      Math.round(color[1] * 255),
      Math.round(color[2] * 255),
    ]);
  }
}

export enum MapModeType {
  Terrain,
  Height,
  Population,
}

export const mapModes: Map<MapModeType, MapMode> = new Map([
  [MapModeType.Terrain, new TerrainMapMode()],
  [MapModeType.Height, new HeightMapMode()],
  [MapModeType.Population, new PopulationMapMode()],
]);