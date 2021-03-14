import { Query, System } from "ape-ecs";
import { Game } from './Game';
import { Road } from './components';


export class ChangesSystem extends System {
  watchedEntityID: Set<string>;
  game: Game;

  init(game: Game) {
    this.game = game;
    this.watchedEntityID = new Set();
    game.watchedEntities$.added$.subscribe(entity => {
      this.watchedEntityID.add(entity.id);
      for (const componentType of Object.keys(entity.types)) {
        this.subscribe(componentType);
      }
    });
    game.watchedEntities$.deleted$.subscribe(entity => {
      this.watchedEntityID.delete(entity.id);
    });
  }

  update() {
    for (const change of this.changes) {
      if (this.watchedEntityID.has(change.entity)) {
        this.game.entityUpdates$.next(this.world.getEntity(change.entity));
      }
    }
  }
}

export class RoadSystem extends System {
  game: Game;
  roads: Query;

  init(game: Game) {
    this.game = game;
    this.subscribe(Road);
  }

  update() {
    for (const change of this.changes) {
      const entity = this.game.ecs.getEntity(change.entity);
      if (change.type === 'add') {
        
      } else if (change.type === 'update') {

      } else if (change.type === 'destroy') {
        
      }
    }
  }
}