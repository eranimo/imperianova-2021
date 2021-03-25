import Deltaframe from "deltaframe";
import { BehaviorSubject, Subject } from 'rxjs';
import { ObservableSet } from '../../utils/ObservableSet';
import { World, Hex } from '../world/World';
import { WorldData, WorldGeneratorOptions, WorldGenerator } from '../world/WorldGenerator';
import { registerSystems } from './systems';
import { WorldGrid } from '../world/WorldGrid';
import { EntityManager, Entity, ExportData } from '../entity-system/EntityManager';
import { GameInfoComponent, components } from './components';
import { createGameInfo } from './entities';
import { setupGame } from './setupGame';
import { MapModeType } from '../../WorldViewer/mapMode';
import { WorldMapState, WorldMapStateHex } from '../../WorldViewer/worldMapState';
import { Direction, directionIndexOrder } from '../../types';
import { AnyView, ArrayView, MapView, View } from 'structurae';


export type GameData = {
  world: WorldData,
  entityData: ExportData,
}

export type GameOptions = {
  numStartingPopulation: number,
  world: WorldGeneratorOptions,
}

export type Context = {
  game: Game,
  gameMap: GameMap,
  world: World,
  worldGrid: WorldGrid,
};

class GameMap {
  public worldMapState: MapView;
  public worldDirty$: Subject<void> = new Subject();
  public hexDirty$: Subject<number> = new Subject();
  private hexes: WorldMapStateHex[];
  public sab: SharedArrayBuffer;
  hexesView: ArrayView;

  constructor(public game: Game) {
    // create world map state
    console.log('Game', game);
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
        population: 0,
        height: game.world.getHexHeight(hex),
        coordX: hex.x,
        coordY: hex.y,
        posX: pos[0],
        posY: pos[1],
        river: river as any,
        road: road as any,
      })
    }
    const worldMapStateRaw = {
      hexWidth: game.world.gridSize.width,
      hexHeight: game.world.gridSize.height,
      pointWidth: game.world.hexgrid.pointWidth(),
      pointHeight: game.world.hexgrid.pointHeight(),
      sealevel: game.world.worldData.options.sealevel,
      hexes,
      // regions: [], 
    }
    const length = WorldMapState.getLength(worldMapStateRaw);
    this.sab = new SharedArrayBuffer(length);
    WorldMapState.from(worldMapStateRaw, new DataView(this.sab));
    const worldMapState = new WorldMapState(this.sab);
    this.worldMapState = worldMapState;
    this.hexes = worldMapState.get('hexes');
    this.hexesView = worldMapState.getView('hexes') as ArrayView;
    console.log('hexes', this.hexesView);
  }

  setHexState<K extends keyof WorldMapStateHex>(index: number, field: K, value: WorldMapStateHex[K]) {
    (this.hexesView.getView(index) as any).set(field, value);
  }

  setWorldDirty() {
    this.worldDirty$.next();
  }

  setHexDirty(hex: Hex) {
    this.hexDirty$.next(hex.index);
  }
}

export class Game {
  deltaframe: Deltaframe;
  entityManager: EntityManager;
  gameInfo: Entity;
  isPlaying$: BehaviorSubject<boolean>;
  saveID?: string;

  watchedEntities$: ObservableSet<Entity>;
  entityUpdates$: Subject<Entity>;

  context: Context;
  mapMode$: BehaviorSubject<MapModeType> = new BehaviorSubject(MapModeType.Terrain);

  gameMap: GameMap;

  constructor(
    public world: World,
    currentDate: number = 0,
  ) {
    this.gameMap = new GameMap(this);
    this.deltaframe = new Deltaframe();
    this.watchedEntities$ = new ObservableSet();
    this.entityUpdates$ = new Subject();
    this.isPlaying$ = new BehaviorSubject(false);
    const entityManager = new EntityManager();

    this.context = {
      game: this,
      gameMap: this.gameMap,
      world,
      worldGrid: new WorldGrid(world),
    };
    entityManager.context = this.context;
    
    for (const comp of components) {
      entityManager.registerComponent<any>(comp);
    }
    registerSystems(entityManager);
    this.gameInfo = createGameInfo(entityManager, {
      date: currentDate,
    });
    this.entityManager = entityManager;
  }

  static create(options: GameOptions) {
    const worldGen = new WorldGenerator();
    const world = worldGen.generate(options.world);
    const game = new Game(world);
    setupGame(game);
    return game;
  }

  static load(data: GameData, saveID: string) {
    const world = World.fromData(data.world);
    const game = new Game(world);
    game.saveID = saveID;
    game.entityManager.import(data.entityData);
    return game;
  }

  export(): GameData {
    return {
      world: this.world.worldData,
      entityData: this.entityManager.export(),
    };
  }

  watchEntityChanges(entity: Entity): [subject: Subject<Entity>, unsubscribe: Function] {
    console.log('watch entity', entity);
    const changes = new Subject<Entity>();
    this.watchedEntities$.add(entity);

    this.entityUpdates$.subscribe(updatedEntity => {
      if (updatedEntity.id === entity.id) {
        changes.next(updatedEntity);
      }
    });

    const unsubscribe = () => {
      this.watchedEntities$.delete(entity);
    }
    return [
      changes,
      unsubscribe,
    ];
  }

  update(time: number, deltaTime: number) {
    // console.log('day', this.gameinfo.c.date.dateTicks);
    this.gameInfo.getComponent(GameInfoComponent).value.date += 1;
    this.entityManager.update();
  }

  play() {
    this.isPlaying$.next(true);
    this.deltaframe.stop();
    this.deltaframe.start(this.update.bind(this));
  }

  pause() {
    this.isPlaying$.next(false);
    this.deltaframe.stop();
  }

  changeMapMode(mapModeType: MapModeType) {
    this.mapMode$.next(mapModeType);
  }
}
