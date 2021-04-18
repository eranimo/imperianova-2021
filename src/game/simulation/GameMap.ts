import { Subject } from 'rxjs';
import { Hex } from '../world/World';
import { WorldMapState, WorldMapStateHex } from '../../WorldViewer/worldMapState';
import { Direction, directionIndexOrder } from '../../types';
import { ArrayView, MapView } from 'structurae';
import { Game } from "./Game";


type FieldUpdate<K extends keyof WorldMapStateHex, V extends WorldMapStateHex[K]> = {
  index: number,
  field: K,
  value: V,
};

export class GameMap {
  public worldMapState: MapView;
  public worldDirty$: Subject<void> = new Subject();
  public hexDirty$: Subject<number> = new Subject();
  private hexes: WorldMapStateHex[];
  public sab: SharedArrayBuffer;
  hexesView: ArrayView;
  hexFieldUpdates: Subject<FieldUpdate<any, any>> = new Subject();

  constructor(public game: Game) {
  }
  
  init() {
    const game = this.game;
    // create world map state
    const hexes: WorldMapStateHex[] = [];
    for (const hex of game.world.hexgrid) {
      const river = {
        [Direction.SE]: 0,
        [Direction.NE]: 0,
        [Direction.N]: 0,
        [Direction.NW]: 0,
        [Direction.SW]: 0,
        [Direction.S]: 0,
      };
      if (game.world.riverHexPairs.has(hex)) {
        for (const dir of directionIndexOrder) {
          const neighbor = game.world.getHexNeighbor(hex.x, hex.y, dir);
          river[dir] = Number(game.world.riverHexPairs.get(hex).has(neighbor));
        }
      }
      const road = {
        [Direction.SE]: 0,
        [Direction.NE]: 0,
        [Direction.N]: 0,
        [Direction.NW]: 0,
        [Direction.SW]: 0,
        [Direction.S]: 0,
      };
      if (game.world.hexRoads.has(hex)) {
        for (const dir of directionIndexOrder) {
          road[dir] = Number(game.world.hexRoads.get(hex).has(dir));
        }
      }
      const pos = game.world.getHexPosition(hex.x, hex.y);
      hexes.push({
        index: hex.index,
        terrainType: game.world.getTerrain(hex),
        rainfall: game.world.getRainfall(hex),
        distanceToCoast: game.world.distanceToCoast.get(hex.x, hex.y),
        pressureJanuary: game.world.pressureJanuary.get(hex.x, hex.y),
        pressureJuly: game.world.pressureJuly.get(hex.x, hex.y),
        windDirectionJanuary: game.world.windJanuaryDirection.get(hex.x, hex.y),
        windSpeedJanuary: game.world.windJanuarySpeed.get(hex.x, hex.y),
        windDirectionJuly: game.world.windJulyDirection.get(hex.x, hex.y),
        windSpeedJuly: game.world.windJulySpeed.get(hex.x, hex.y),
        oceanCurrentDirectionJanuary: game.world.oceanCurrentJanuaryDirection.get(hex.x, hex.y),
        oceanCurrentSpeedJanuary: game.world.oceanCurrentJanuarySpeed.get(hex.x, hex.y),
        oceanCurrentDirectionJuly: game.world.oceanCurrentJulyDirection.get(hex.x, hex.y),
        oceanCurrentSpeedJuly: game.world.oceanCurrentJulySpeed.get(hex.x, hex.y),
        population: 0,
        height: game.world.getHexHeight(hex),
        coordX: hex.x,
        coordY: hex.y,
        posX: pos[0],
        posY: pos[1],
        river: river as any,
        road: road as any,
      });
    }
    const worldMapStateRaw = {
      hexWidth: game.world.gridSize.width,
      hexHeight: game.world.gridSize.height,
      pointWidth: game.world.hexgrid.pointWidth(),
      pointHeight: game.world.hexgrid.pointHeight(),
      sealevel: game.world.worldData.options.sealevel,
      hexes,
      // regions: [], 
    };
    const length = WorldMapState.getLength(worldMapStateRaw);
    this.sab = new SharedArrayBuffer(length);
    WorldMapState.from(worldMapStateRaw, new DataView(this.sab));
    const worldMapState = new WorldMapState(this.sab);
    this.worldMapState = worldMapState;
    this.hexes = worldMapState.get('hexes');
    this.hexesView = worldMapState.getView('hexes') as ArrayView;
  }

  setHexState<K extends keyof WorldMapStateHex>(index: number, field: K, value: WorldMapStateHex[K]) {
    (this.hexesView.getView(index) as any).set(field, value);
    this.hexFieldUpdates.next({ index, field, value });
  }

  getHexState<K extends keyof WorldMapStateHex>(index: number, field: K): WorldMapStateHex[K] {
    return (this.hexesView.getView(index) as any).get(field);
  }

  /**
   * Re-renders entire map in WorldViewer worker
   */
  renderWorld() {
    this.worldDirty$.next();
  }

  // TODO: implement
  renderHex(hex: Hex) {
    this.hexDirty$.next(hex.index);
  }
}
