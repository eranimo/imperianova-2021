import { Hex, World } from './World';
import createGraph, { Graph } from 'ngraph.graph';
import path, { PathFinder } from 'ngraph.path';
import { Direction, directionIndexOrder, oppositeDirections } from '../../types';

type HexLink = {
  direction: Direction,
  weight?: (hex: Hex, neighborHex: Hex) => number,
}

export class WorldGrid {
  graph: Graph<Hex, HexLink>;
  pathFinder: PathFinder<Hex>;
  private hexRoadDirections: Map<Hex, Map<Direction, boolean>>;
  private hexRoadPairs: Map<Hex, Map<Direction, Hex>>;

  constructor(
    private world: World
  ) {
    this.graph = createGraph();
    this.hexRoadDirections = new Map();
    this.hexRoadPairs = new Map();
    this.pathFinder = path.aStar(this.graph, {
      distance(fromNode, toNode, link) {
        return link.data.weight(fromNode.data, toNode.data);
      },
      heuristic(fromNode, toNode) {
        return fromNode.data.distance(toNode.data);
      },
    });

    this.buildGrid();
  }

  addRoad(hex: Hex, neighborHex: Hex, direction: Direction) {
    const oppositeDirection = oppositeDirections[direction];
    if (!this.hexRoadDirections.has(hex)) this.hexRoadDirections.set(hex, new Map())
    this.hexRoadDirections.get(hex).set(direction, true);
    if (!this.hexRoadDirections.has(neighborHex)) this.hexRoadDirections.set(neighborHex, new Map());
    this.hexRoadDirections.get(neighborHex).set(oppositeDirection, true);
    if (!this.hexRoadPairs.has(hex)) this.hexRoadPairs.set(hex, new Map());
    this.hexRoadPairs.get(hex).set(direction, neighborHex);
    if (!this.hexRoadPairs.has(neighborHex)) this.hexRoadPairs.set(neighborHex, new Map());
    this.hexRoadPairs.get(neighborHex).set(oppositeDirection, hex);
  }

  hasRoad(hex: Hex, neighborHex) {
    if (this.hexRoadPairs.has(hex)) {
      return this.hexRoadPairs.get(hex).has(neighborHex);
    }
    return false;
  }

  addRoadPath(path: Hex[]) {
    path.forEach((node, index) => {
      const lastNode = path[index - 1];
      const nextNode = path[index + 1];
      if (lastNode) {
        const direction = this.world.hexNeighborDirections.get(node).get(lastNode);
        this.addRoad(node, lastNode, direction);
      }

      if (nextNode) {
        const direction = this.world.hexNeighborDirections.get(node).get(nextNode);
        this.addRoad(node, lastNode, direction);
      }
    });
  }

  private getHexWeight() {
    return (hex: Hex, neighborHex: Hex) => {
      if (
        (this.world.isLand(hex) && !this.world.isLand(neighborHex)) ||
        (!this.world.isLand(hex) && this.world.isLand(neighborHex))
      ) {
        return Number.POSITIVE_INFINITY;
      }
      if (this.hasRoad(hex, neighborHex)) {
        return 0;
      }
      return 1;
    };
  }

  private buildGrid() {
    this.graph.clear();
    this.world.hexgrid.forEach(hex => {
      this.graph.addNode(hex.index, hex);
    });
    this.world.hexgrid.forEach(hex => {
      const neighbors = this.world.getHexNeighbors(hex);
      for (const direction of directionIndexOrder) {
        const neighborHex = neighbors[direction] as Hex;
        if (neighborHex !== null) {
          this.graph.addLink(hex.index, neighborHex.index, {
            weight: this.getHexWeight(),
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