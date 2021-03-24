import { WorldMapStateHex } from './worldMapState';
import { terrainColors } from '../game/world/terrain';
import { colorToNumber } from '../utils';

export type TileStates = Map<number, WorldMapStateHex>;

export interface MapMode {
  title: string;
  displayRivers: boolean;
  init?(tileStates: TileStates): void;
  setTile(state: WorldMapStateHex): number;
}

class TerrainMapMode implements MapMode {
  title = 'Terrain';
  displayRivers = true;
  setTile(state: WorldMapStateHex) {
    return terrainColors[state.terrainType]
  }
}

class PopulationMapMode implements MapMode {
  title = 'Population';
  displayRivers = false;
  maxPopulation: number;

  init(tileStates: TileStates) {
    this.maxPopulation = 0;
    let populatedTiles = 0;
    for (const state of tileStates.values()) {
      if (state.population !== undefined) {
        this.maxPopulation += state.population;
        populatedTiles++;
      }
    }
    this.maxPopulation /= populatedTiles;
  }

  setTile(state: WorldMapStateHex) {
    if (state.population) {
      const v = Math.round((state.population / this.maxPopulation) * 255);
      return colorToNumber([v, v, v]);
    }
    return 0x000000;
  }
}

export enum MapModeType {
  Terrain,
  Population
}

export const mapModes: Map<MapModeType, MapMode> = new Map([
  [MapModeType.Terrain, new TerrainMapMode()],
  [MapModeType.Population, new PopulationMapMode()],
]);