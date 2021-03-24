import { BehaviorSubject, Subject } from 'rxjs';
import { MapView } from 'structurae';
import { MapMode, MapModeType, mapModes, TileStates } from './mapMode';
import { Size } from '../types';
import { WorldMapStateHex } from './worldMapState';
import { Grid2D } from '../utils/Grid2D';

const defaultMapMode = MapModeType.Terrain;

export class WorldMapManager {
  mapMode$: BehaviorSubject<MapMode> = new BehaviorSubject(mapModes.get(defaultMapMode));
  mapModeType$: BehaviorSubject<MapModeType> = new BehaviorSubject(defaultMapMode);
  worldMapState: MapView;
  dirty$: Subject<boolean> = new Subject();
  dirtyHex$: Subject<number> = new Subject();
  mapSize: Size;
  mapSizePixels: Size;
  private tileStates: TileStates;
  hexCoordForIndex: Grid2D<number>;
  hexList: WorldMapStateHex[];

  constructor(worldMapState: MapView) {
    this.worldMapState = worldMapState;
    this.hexList = worldMapState.get('hexes');
    this.mapSize = {
      width: worldMapState.get('hexWidth'),
      height: worldMapState.get('hexHeight'),
    };
    this.hexCoordForIndex = new Grid2D(this.mapSize.width, this.mapSize.height);
    this.mapSizePixels = {
      width: worldMapState.get('pointWidth'),
      height: worldMapState.get('pointHeight'),
    };
    this.tileStates = new Map();
    for (const hex of this.hexes()) {
      this.hexCoordForIndex.set(hex.coordX, hex.coordY, hex.index);
    }
  }

  getHexFromCoord(x: number, y: number): WorldMapStateHex {
    const index = this.hexCoordForIndex.get(x, y);
    const hex = this.getHex(index);
    if (hex === undefined) {
      throw new Error(`Cannot find hex at index "${index}" (${x}, ${y})`);
    }
    return hex;
  }

  getHex(index: number): WorldMapStateHex {
    return this.hexList[index];
  }

  *hexes() {
    for (const hex of this.hexList) {
      yield hex as WorldMapStateHex;
    }
  }

  setMapMode(mapModeType: MapModeType) {
    console.log('set map mode', mapModeType);
    this.mapModeType$.next(mapModeType);
    const inst = mapModes.get(mapModeType)
    if (inst.init) {
      inst.init(this.tileStates);
    }
    this.mapMode$.next(inst);
  }

  renderWorld() {
    this.dirty$.next(true);
  }

  renderHex(hexIndex: number) {
    this.dirtyHex$.next(hexIndex);
  }
}