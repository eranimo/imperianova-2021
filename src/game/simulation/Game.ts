import { Entity, IEntityObject, World as ECS } from 'ape-ecs';
import Deltaframe from "deltaframe";
import { BehaviorSubject, Subject } from 'rxjs';
import { ObservableSet } from '../../utils/ObservableSet';
import { World } from '../world/World';
import { WorldData } from '../world/WorldGenerator';
import { Date, FrameInfo } from './components';
import { ChangesSystem } from './systems';
import { WorldGrid } from '../world/WorldGrid';


export type GameData = {
  world: WorldData,
  entities: IEntityObject[],
}

export type Context = {
  world: World,
  worldGrid: WorldGrid,
};

export class Game {
  deltaframe: Deltaframe;
  ecs: ECS;
  gameinfo: Entity;
  isPlaying$: BehaviorSubject<boolean>;

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
    this.ecs = new ECS();

    this.context = {
      world,
      worldGrid: new WorldGrid(world),
    };
    
    this.ecs.registerComponent(FrameInfo);
    this.ecs.registerComponent(Date);
    this.ecs.registerSystem('EveryFrame', ChangesSystem, [this]);
    this.gameinfo = this.ecs.createEntity({
      id: 'GameInfo',
      c: {
        frame: { type: 'FrameInfo' },
        date: { type: 'Date', dateTicks: currentDate }
      }
    });
  }

  static fromData(data: GameData) {
    const world = World.fromData(data.world);
    const game = new Game(world);
    game.ecs.createEntities(data.entities);
    return Game;
  }

  export(): GameData {
    return {
      world: this.world.worldData,
      entities: this.ecs.getObject()
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
    this.gameinfo.c.frame.update({
      time,
      deltaTime,
    });
    this.gameinfo.c.date.update({
      dateTicks: this.gameinfo.c.date.dateTicks + 1,
    });
    this.ecs.runSystems('EveryFrame');
    this.ecs.tick();
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
