import { World as ECS, Entity } from "ape-ecs";
import { Direction, Coord } from '../../types';
import { Road } from './components';


export function createRoad(
  ecs: ECS,
  coord: Coord,
  roadEdges: Partial<Record<Direction, boolean>>
): Entity {
  return ecs.createEntity({
    c: {
      type: Road,
      coord,
      roadEdges,
    }
  });
}