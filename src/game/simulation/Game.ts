import Deltaframe from "deltaframe";
import { BehaviorSubject, Subject } from 'rxjs';
import { ObservableSet } from '../../utils/ObservableSet';
import { World } from '../world/World';
import { WorldData, WorldGeneratorOptions, WorldGenerator } from '../world/WorldGenerator';
import { registerSystems } from './systems';
import { WorldGrid } from '../world/WorldGrid';
import { EntityManager, Entity, ExportData } from '../entity-system/EntityManager';
import { GameInfoComponent, components } from './components';
import { createGameInfo } from './entities';
import { setupGame } from './setupGame';
import { MapModeType } from '../../WorldViewer/mapMode';
import { AnyView, View } from 'structurae';
import { GameMap } from "./GameMap";
import { NameGenerator } from './nameGenerator';


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
  nameGenerator: NameGenerator,
};

const defaultMapmode = localStorage.mapMode
  ? parseInt(localStorage.mapMode, 10)
  : MapModeType.Terrain;

export class Game {
  deltaframe: Deltaframe;
  entityManager: EntityManager;
  gameInfo: Entity;
  isPlaying$: BehaviorSubject<boolean>;
  saveID?: string;

  watchedEntities$: ObservableSet<Entity>;
  entityUpdates$: Subject<Entity>;

  context: Context;
  mapMode$: BehaviorSubject<MapModeType> = new BehaviorSubject(defaultMapmode);

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
      nameGenerator: new NameGenerator(),
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

    (window as any).game = this;
  }

  get isPlaying() {
    return this.isPlaying$.value;
  }

  static create(options: GameOptions) {
    const worldGen = new WorldGenerator();
    const world = worldGen.generate(options.world);
    const game = new Game(world);
    setupGame(game);
    game.gameMap.init();
    game.gameMap.renderWorld();
    return game;
  }

  static load(data: GameData, saveID: string) {
    const world = World.fromData(data.world);
    const game = new Game(world);
    game.saveID = saveID;
    game.entityManager.import(data.entityData);
    game.gameMap.init();
    game.gameMap.renderWorld();
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
    this.entityManager.update(deltaTime);
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
    localStorage.mapMode = mapModeType;
    this.mapMode$.next(mapModeType);
  }
}
