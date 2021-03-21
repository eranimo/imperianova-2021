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


export type GameData = {
  world: WorldData,
  entityData: ExportData,
}

export type GameOptions = {
  numStartingPopulation: number,
  world: WorldGeneratorOptions,
}

export type Context = {
  world: World,
  worldGrid: WorldGrid,
};

export class Game {
  deltaframe: Deltaframe;
  entityManager: EntityManager;
  gameInfo: Entity;
  isPlaying$: BehaviorSubject<boolean>;
  saveID?: string;

  watchedEntities$: ObservableSet<Entity>;
  entityUpdates$: Subject<Entity>;

  context: Context;

  constructor(
    public world: World,
    currentDate: number = 0,
  ) {
    this.deltaframe = new Deltaframe();
    this.watchedEntities$ = new ObservableSet();
    this.entityUpdates$ = new Subject();
    this.isPlaying$ = new BehaviorSubject(false);
    const entityManager = new EntityManager();

    this.context = {
      world,
      worldGrid: new WorldGrid(world),
    };
    
    for (const comp of components) {
      entityManager.registerComponent<any>(comp);
    }
    registerSystems(entityManager);
    this.gameInfo = createGameInfo(entityManager, {
      date: currentDate,
    })
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
}
