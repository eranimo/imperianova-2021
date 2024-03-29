import { BehaviorSubject, Subject } from 'rxjs';
import { ArrayView, MapView } from 'structurae';
import { MapMode, MapModeType, mapModes, TileStates } from './mapMode';
import { Size, Direction, Coord, oddq_directions } from '../types';
import { WorldMapStateHex, WorldMapState } from './worldMapState';
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
  hexLength: number;

  hexesView: ArrayView;

  constructor(worldMapState: MapView) {
    this.worldMapState = worldMapState;
    this.hexesView = this.worldMapState.getView('hexes') as ArrayView;
    this.mapSize = {
      width: worldMapState.get('hexWidth'),
      height: worldMapState.get('hexHeight'),
    };
    this.hexLength = this.mapSize.width * this.mapSize.height;
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
      return null;
    }
    return hex;
  }

  hasHex(x: number, y: number) {
    return this.hexesView.get(this.hexCoordForIndex.get(x, y)) !== undefined;
  }

  getHex(index: number): WorldMapStateHex {
    return this.hexesView.get(index);
  }

  getHexField<K extends keyof WorldMapStateHex>(index: number, field: K): WorldMapStateHex[K] {
    return (this.hexesView.getView(index) as any).get(field);
  }

  *hexes() {
    for (const hex of this.worldMapState.get('hexes')) {
      yield hex as WorldMapStateHex;
    }
  }

  getHexNeighbor(hex: Coord, direction: Direction): Coord {
    const [x, y] = hex;
    const parity = x & 1;
    const dir = oddq_directions[parity][direction];
    const coord = [x + dir[0], y + dir[1]];
    return coord as Coord;
  }

  setMapMode(mapModeType: MapModeType) {
    this.mapModeType$.next(mapModeType);
    const inst = mapModes.get(mapModeType)
    if (inst.init) {
      inst.init(this);
    }
    this.mapMode$.next(inst);
    this.dirty$.next(true);
  }

  renderWorld() {
    const inst = this.mapMode$.value;
    if (inst.init) {
      inst.init(this);
    }
    this.dirty$.next(true);
  }

  renderHex(hexIndex: number) {
    this.dirtyHex$.next(hexIndex);
  }
}