import { Hex, World } from './World';
import createGraph, { Graph } from 'ngraph.graph';
import path, { PathFinder } from 'ngraph.path';
import { Direction, directionIndexOrder } from '../../types';

type HexLink = {
  direction: Direction,
  weight?: number,
}

export class WorldGrid {
  graph: Graph<Hex, HexLink>;
  pathFinder: PathFinder<Hex>;

  constructor(
    private world: World
  ) {
    this.graph = createGraph();
    this.pathFinder = path.aStar(this.graph, {
      distance(fromNode, toNode, link) {
        if (link.data.weight > 0) {
          return link.data.weight;
        }
        return fromNode.data.distance(toNode.data);
      },
      heuristic(fromNode, toNode) {
        return fromNode.data.distance(toNode.data);
      },
    });
  }

  buildGrid() {
    this.graph.clear();
    this.world.hexgrid.forEach(hex => {
      this.graph.addNode(hex.index, hex);
    });
    this.world.hexgrid.forEach(hex => {
      const neighbors = this.world.getHexNeighbors(hex);
      for (const direction of directionIndexOrder) {
        const neighborHex = neighbors[direction] as Hex;
        if (neighborHex !== null) {
          let weight;
          if (
            (this.world.isLand(hex) && !this.world.isLand(neighborHex)) ||
            (!this.world.isLand(hex) && this.world.isLand(neighborHex))
          ) {
            weight = Number.POSITIVE_INFINITY;
          }
          this.graph.addLink(hex.index, neighborHex.index, {
            weight,
            direction: direction,
          });
        }
      }
    });
  }

  findPath(hex1: Hex, hex2: Hex) {
    return this.pathFinder.find(hex1.index, hex2.index).map(node => node.data);
  }
}