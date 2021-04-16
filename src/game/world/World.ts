import { Size, Direction, oddq_directions, oppositeDirections, directionIndexOrder, adjacentDirections, DirectionMap, directionTitles, Coord } from '../../types';
import ndarray from 'ndarray';
import * as Honeycomb from 'honeycomb-grid';
import { clamp, orderBy } from 'lodash';
import { MultiDictionary, Queue } from 'typescript-collections';
import { Subject } from 'rxjs';
import { TerrainType, terrainTypeTitles } from './terrain';
import { WorldData } from './WorldGenerator';
import uuid from 'uuid-random';
import { PairSet } from '../../utils/PairSet';


export type Hex = Honeycomb.Hex<IHex>; 
export const HexFactory = Honeycomb.extendHex<IHex>({
  size: { xRadius: 32.663, yRadius: 34.641 },
  orientation: 'flat'
} as any);
export const GridFactory = Honeycomb.defineGrid(HexFactory);
export interface IHex {
  index: number,
}

export type Edge = {
  id: number;
  h1: Hex;
  h2: Hex;
  o1: Hex;
  o2: Hex;
  p1_edges?: [Edge, Edge];
  p2_edges?: [Edge, Edge];
}

export type Landmass = {
  id: number,
  size: number,
  hexes: Hex[],
}

export type Ecoregion = {
  id: number,
  size: number,
  hexes: Hex[],
  terrainType: TerrainType,
}

export class World {
  public gridSize: Size;
  public hexgrid: Honeycomb.Grid<Hex>;
  private indexMap: Map<string, number>;
  private pointsMap: Map<string, [number, number]>;

  terrain: ndarray;
  heightmap: ndarray;
  rainfall: ndarray;
  distanceToCoast: ndarray;
  pressureJanuary: ndarray;
  pressureJuly: ndarray;

  terrainUpdates$: Subject<unknown>;

  rivers: Edge[][];
  hexNeighborDirections: Map<Hex, Map<Hex, Direction>>;
  hexRoads: Map<Hex, Map<Direction, Hex>>;
  riverHexPairs: Map<Hex, Set<Hex>>;
  landmasses: Landmass[];
  ecoregions: Ecoregion[];
  hexEdgesMap: Map<Hex, DirectionMap<Edge | null>>;
  hexEdges: Edge[];
  hexEdgeIDs: Map<number, Edge>;

  public worldData: WorldData;
  windJanuaryDirection: ndarray;
  windJanuarySpeed: ndarray;
  windJulyDirection: ndarray;
  windJulySpeed: ndarray;
  axialTilt: number;

  constructor() {
    this.indexMap = new Map();
    this.pointsMap = new Map();
    this.terrainUpdates$ = new Subject();
  }

  static fromData(worldData: WorldData) {
    const world = new World();
    world.setWorldData(worldData);
    world.setWorldSize(worldData.options.size);
    world.setWorldAxialTilt(worldData.options.axialTilt);
    world.setWorldTerrain(worldData.terrain, worldData.heightmap, worldData.distanceToCoast);
    world.setWorldClimate(
      worldData.pressureJanuary,
      worldData.pressureJuly,
      worldData.windJanuaryDirection,
      worldData.windJanuarySpeed,
      worldData.windJulyDirection,
      worldData.windJulySpeed,
    );
    world.setWorldRainfall(worldData.rainfall);
    world.setWorldRivers(worldData.rivers);
    return world;
  }

  setWorldData(worldData: WorldData) {
    this.worldData = worldData;
  }

  setWorldAxialTilt(axialTilt: number) {
    this.axialTilt = axialTilt;
  }

  setWorldSize(size: number) {
    const gridSize = {
      width: size * 2,
      height: size,
    };
    this.gridSize = gridSize;
    this.hexgrid = GridFactory.rectangle({
      width: gridSize.width,
      height: gridSize.height,
    });

    const arraySize = gridSize.width * gridSize.height;
    const arrayDim = [gridSize.width, gridSize.height];
    const terrainBuffer = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * arraySize);
    this.terrain = ndarray(new Uint32Array(terrainBuffer), arrayDim);

    const rainfallBuffer = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * arraySize);
    this.rainfall = ndarray(new Uint32Array(rainfallBuffer), arrayDim);

    const heightBuffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * arraySize);
    this.heightmap = ndarray(new Float32Array(heightBuffer), arrayDim);

    const distanceToCoastBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * arraySize);
    this.distanceToCoast = ndarray(new Int32Array(distanceToCoastBuffer), arrayDim);

    const pressureJanuaryBuffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * arraySize);
    this.pressureJanuary = ndarray(new Float32Array(pressureJanuaryBuffer), arrayDim);

    const pressureJulyBuffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * arraySize);
    this.pressureJuly = ndarray(new Float32Array(pressureJulyBuffer), arrayDim);

    const windJanuaryDirectionData = new Uint8ClampedArray(new ArrayBuffer(Uint8ClampedArray.BYTES_PER_ELEMENT * arraySize))
    this.windJanuaryDirection = ndarray(windJanuaryDirectionData, arrayDim);
    const windJanuarySpeedData = new Float32Array(new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * arraySize))
    this.windJanuarySpeed = ndarray(windJanuarySpeedData, arrayDim);

    const windJulyDirectionData = new Uint8ClampedArray(new ArrayBuffer(Uint8ClampedArray.BYTES_PER_ELEMENT * arraySize))
    this.windJulyDirection = ndarray(windJulyDirectionData, arrayDim);
    const windJulySpeedData = new Float32Array(new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * arraySize))
    this.windJulySpeed = ndarray(windJulySpeedData, arrayDim);

    this.hexNeighborDirections = new Map();
    this.hexRoads = new Map();

    this.hexgrid.forEach((hex, index) => {
      hex.index = index;
      const point = hex.toPoint();
      this.pointsMap.set(`${hex.x},${hex.y}`, [point.x, point.y]);
      this.indexMap.set(`${hex.x},${hex.y}`, index);
    });

    this.hexgrid.forEach((hex, index) => {
      // calculate neighbor map
      const neighborMap = new Map();
      for (const direction of directionIndexOrder) {
        const neighborHex = this.getHexNeighbor(hex.x, hex.y, direction);
        neighborMap.set(neighborHex, direction);
      }
      this.hexNeighborDirections.set(hex, neighborMap);
    });

    this.buildEdgeMap();
  }

  public setWorldTerrain(
    terrain: Uint32Array,
    heightmap: Uint8ClampedArray,
    distanceToCoast: Int32Array,
  ) {
    (this.terrain.data as Uint32Array).set(terrain, 0);
    (this.heightmap.data as Uint8ClampedArray).set(heightmap, 0);
    (this.distanceToCoast.data as Int32Array).set(distanceToCoast, 0);

    // identify landmasses
    console.time('identify landmasses');
    this.landmasses = [];
    let visited = new Set<Hex>();
    this.hexgrid.forEach(hex => {
      if (this.isLand(hex) && !visited.has(hex)) {
        const region = this.floodFill(
          hex,
          (h1, h2) => this.isLand(h2),
          visited,
        );
        const hexes = Array.from(region);
        this.landmasses.push({
          id: this.landmasses.length,
          size: region.size,
          hexes,
        });
      }
    });
    console.log('landmasses:', orderBy(this.landmasses, 'size', 'desc'));
    console.timeEnd('identify landmasses');

    // identify landmasses
    console.time('identify ecoregions');
    this.ecoregions = [];
    visited = new Set<Hex>();
    this.hexgrid.forEach(hex => {
      if (!visited.has(hex)) {
        const region = this.floodFill(
          hex,
          (h1, h2) => this.getTerrain(h1) === this.getTerrain(h2),
          visited,
        );
        const hexes = Array.from(region);
        const terrainType = this.getTerrain(hexes[0]);
        this.ecoregions.push({
          id: this.ecoregions.length,
          size: region.size,
          hexes,
          terrainType,
        });
      }
    });
    console.log('ecoregions:', orderBy(this.ecoregions, 'size', 'desc'));
    console.timeEnd('identify ecoregions');
  }

  setWorldRainfall(rainfall: Int32Array) {
    (this.rainfall.data as Uint32Array).set(rainfall, 0);
  }

  setWorldClimate(
    pressureJanuary: Float32Array,
    pressureJuly: Float32Array,
    windJanuaryDirection: Uint8ClampedArray,
    windJanuarySpeed: Float32Array,
    windJulyDirection: Uint8ClampedArray,
    windJulySpeed: Float32Array,
  ) {
    (this.pressureJanuary.data as Float32Array).set(pressureJanuary);
    (this.pressureJuly.data as Float32Array).set(pressureJuly);
    (this.windJanuaryDirection.data as Float32Array).set(windJanuaryDirection);
    (this.windJanuarySpeed.data as Float32Array).set(windJanuarySpeed);
    (this.windJulyDirection.data as Float32Array).set(windJulyDirection);
    (this.windJulySpeed.data as Float32Array).set(windJulySpeed);
  }

  setWorldRivers(riverData: number[][]) {
    this.rivers = riverData.map(riverEdgeIDs => riverEdgeIDs.map(edgeID => this.hexEdgeIDs.get(edgeID)));
    console.log('rivers', this.rivers);

    console.time('build river data structures');
    this.riverHexPairs = new Map();
    for (const riverEdges of this.rivers) {
      for (const edge of riverEdges) {
        if (this.riverHexPairs.has(edge.h1)) {
          this.riverHexPairs.get(edge.h1).add(edge.h2);
        } else {
          this.riverHexPairs.set(edge.h1, new Set([edge.h2]));
        }
        if (this.riverHexPairs.has(edge.h2)) {
          this.riverHexPairs.get(edge.h2).add(edge.h1);
        } else {
          this.riverHexPairs.set(edge.h2, new Set([edge.h1]));
        }
      }
    }
    console.timeEnd('build river data structures');
    console.log('riverHexPairs', this.riverHexPairs)
  }

  private buildEdgeMap() {
    // build a list of hex edges, calculate slope
    this.hexEdges = [];
    this.hexEdgeIDs = new Map();
    this.hexEdgesMap = new Map();
    console.time('build edge map');
    this.hexgrid.forEach((hex, index) => {
      this.hexEdgesMap.set(hex, {
        [Direction.SE]: null,
        [Direction.NE]: null,
        [Direction.N]: null,
        [Direction.NW]: null,
        [Direction.SW]: null,
        [Direction.S]: null,
      });
    });
    let edgeID = 0;
    this.hexgrid.forEach((hex, index) => {
      const neighbors = this.getHexNeighbors(hex);
      const edges = this.hexEdgesMap.get(hex);
      for (const dir of directionIndexOrder) {
        const neighborHex = neighbors[dir] as Hex;
        if (neighborHex && edges[dir] === null) {
          const [adj1Dir, adj2Dir ] = adjacentDirections[dir];
          const edge: Edge = {
            id: edgeID,
            h1: hex,
            h2: neighborHex,
            o1: neighbors[adj1Dir],
            o2: neighbors[adj2Dir],
          }
          edgeID++;
          // edgePairs.add(hex, neighborHex, edge);
          edges[dir] = edge;
          this.hexEdges.push(edge);
          this.hexEdgeIDs.set(edge.id, edge);
          this.hexEdgesMap.get(neighborHex)[oppositeDirections[dir]] = edge;
        }
      }
      this.hexEdgesMap.set(hex, edges);
    });
    console.timeEnd('build edge map');
    console.log('hexEdgeIDs', this.hexEdgeIDs);

    // find adjacent edges for each edge
    console.time('find adjacent edges');
    for (const edge of this.hexEdges) {
      const dir = this.hexNeighborDirections.get(edge.h1).get(edge.h2);
      const edges = this.hexEdgesMap.get(edge.h1);
      const neighborEdges = this.hexEdgesMap.get(edge.h2);
      const [adj1, adj2] = adjacentDirections[dir];
      const [adj1n, adj2n] = adjacentDirections[oppositeDirections[dir]];
      edge.p1_edges = [
        edges[adj1],
        neighborEdges[adj1n]
      ];
      edge.p2_edges = [
        edges[adj2],
        neighborEdges[adj2n]
      ];
    }
    console.timeEnd('find adjacent edges');
    console.log('hexEdges', this.hexEdges);
    console.log('hexEdgesMap', this.hexEdgesMap);
  }

  getHexPosition(x: number, y: number) {
    return this.pointsMap.get(`${x},${y}`);
  }

  setHexTerrain(hex: Hex, terrainType: TerrainType) {
    this.terrain.set(hex.x, hex.y, terrainType);
    this.terrainUpdates$.next([hex]);
  }

  getHex(x: number, y: number) {
    return this.hexgrid[this.indexMap.get(`${x},${y}`)] || null;
  }
  
  getHexHeight(hex: Hex) {
    return this.heightmap.get(hex.x, hex.y);
  }

  getHexFromPoint(point: Coord) {
    const hexCoords = GridFactory.pointToHex(point[0], point[1]);
    return this.hexgrid.get(hexCoords);
  }

  getPointFromPosition(x: number, y: number) {
    const hex = this.hexgrid.get({ x, y });
    if (!hex) return null;
    const p = hex.toPoint();
    return [p.x, p.y];
  }

  /**
   * Returns latitude in (-90 to 90) and longitude in (-180 to 180)
   * @param hex Hex
   * @returns Latitude and Longitude
   */
  getHexCoordinate(hex: Hex) {
    const long = ((hex.x / this.gridSize.width) * 360) - 180;
    const lat = ((-hex.y / this.gridSize.height) * 180) + 90;
    return { lat, long };
  }

  getHexNeighbors(hex: Hex): DirectionMap<Hex> {
    const { x, y } = hex;
    const se_hex = this.getHexNeighbor(x, y, Direction.SE);
    const ne_hex = this.getHexNeighbor(x, y, Direction.NE);
    const n_hex = this.getHexNeighbor(x, y, Direction.N);
    const nw_hex = this.getHexNeighbor(x, y, Direction.NW);
    const sw_hex = this.getHexNeighbor(x, y, Direction.SW);
    const s_hex = this.getHexNeighbor(x, y, Direction.S);

    return {
      [Direction.SE]: se_hex,
      [Direction.NE]: ne_hex,
      [Direction.N]: n_hex,
      [Direction.NW]: nw_hex,
      [Direction.SW]: sw_hex,
      [Direction.S]: s_hex,
    }
  }

  // Calculate the NPP of a hex
  // NPP is increased by the temperature and rainfal
  // on the hex, higher NPP correlates to biodiversity
  // and population carrying capacity
  getHexNPP(hex: Hex): number {
    const temp = (this.getTemperatureJanuary(hex) + this.getTemperatureJuly(hex)) / 2
    const precipitation = this.getRainfall(hex);
    return Math.min(3000 / (1 + Math.exp(1.315 - .119 * temp)), 3000 * (1 - Math.exp(-.000664 * precipitation)));
  }

  getHexHunterCarryCapacity(hex: Hex) : number {
    // if(this.getHexCoordinate(hex).lat > 70) {
    //   return 0.0;
    // }
    // 2700 is the NPP found on Earth
    const normNPP = this.getHexNPP(hex)/2700;
    const biodiversity = normNPP * .523 + Math.random() * .477;
    const pathogens = normNPP * .685 + Math.random() * 1.295 - .98;
    const carryCapacity = normNPP * .002 +
      biodiversity * 6.31 +
      pathogens * -.876 +
      normNPP * biodiversity * -.003 +
      normNPP * pathogens * -.002 +
      2.245;
    // console.log(normNPP, biodiversity, pathogens, carryCapacity);
    return Math.max(0, Math.exp(carryCapacity));
  }

  isMapEdge(hex: Hex) {
    return (
      hex.x === 0 || hex.x === (this.gridSize.width - 1) ||
      hex.y === 0 || hex.y === (this.gridSize.height - 1)
    );
  }

  *hexNeighbors(hex: Hex) {
    const { x, y } = hex;
    const se_hex = this.getHexNeighbor(x, y, Direction.SE);
    if (se_hex !== null) {
      yield se_hex;
    }
    const ne_hex = this.getHexNeighbor(x, y, Direction.NE);
    if (ne_hex !== null) {
      yield ne_hex;
    }
    const n_hex = this.getHexNeighbor(x, y, Direction.N);
    if (n_hex !== null) {
      yield n_hex;
    }
    const nw_hex = this.getHexNeighbor(x, y, Direction.NW);
    if (nw_hex !== null) {
      yield nw_hex;
    }
    const sw_hex = this.getHexNeighbor(x, y, Direction.SW);
    if (sw_hex !== null) {
      yield sw_hex;
    }
    const s_hex = this.getHexNeighbor(x, y, Direction.S);
    if (s_hex !== null) {
      yield s_hex;
    }
  }

  floodFill(
    firstHex: Hex,
    isConnected: (h1: Hex, h2: Hex) => boolean,
    visited: Set<Hex> = new Set(), 
  ) {
    const q = new Queue<Hex>();
    q.enqueue(firstHex);
    visited.add(firstHex);
    const region = new Set<Hex>();
    while (q.size() > 0) {
      const hex = q.dequeue();
      region.add(hex);
      for (const h of this.hexNeighbors(hex)) {
        if (visited.has(h) === false && isConnected(hex, h)) {
          q.enqueue(h);
          visited.add(h);
        }
      }
    }
    return region;
  }

  bfs(
    searchFunc: (hex: Hex) => boolean,
    initHex: Hex,
  ): Coord[] {
    const queue: [number, number][] = [];
    const visited: Set<Hex> = new Set<Hex>();
    queue.unshift([initHex.x, initHex.y]);
    let output = [];
    while(queue.length) {
      const [cx, cy] = queue.shift();
      // set cell to visited
      if (!visited.has(this.getHex(cx, cy))) {
        visited.add(this.getHex(cx, cy));
        output.push([cx, cy]);
      }
      const currHex = this.getHex(cx, cy);
      for (const n of this.hexNeighbors(currHex)) {
        if (!visited.has(this.getHex(n.x, n.y))) {
          visited.add(this.getHex(n.x, n.y));
          if (searchFunc(n)) {
            queue.unshift([n.x, n.y]);
            output.push([n.x, n.y]);
          }
        }
      }
    }
    return output;
  }

  getHexNeighbor(x: number, y: number, direction: Direction) {
    const coord = this.getHexNeighborCoord(x, y, direction);
    return this.getHex(coord[0], coord[1]);
  }

  getHexNeighborCoord(x: number, y: number, direction: Direction) {
    const parity = x & 1;
    const dir = oddq_directions[parity][direction];
    const coord = [x + dir[0], y + dir[1]];
    return coord;
  }

  getTerrain(hex: Hex) {
    return this.getTerrainForCoord(hex.x, hex.y);
  }

  getDistanceToCoast(hex: Hex) {
    return this.distanceToCoast.get(hex.x, hex.y);
  }

  getRainfall(hex: Hex) {
    return this.rainfall.get(hex.x, hex.y);
  }

  getSolarFluxJanuary(hex: Hex) : number {
    const { lat } = this.getHexCoordinate(hex);
    const effectiveLat = Math.abs(lat + this.axialTilt);
    // console.log(effectiveLat, (90 - (effectiveLat)) / 90)
    return Math.max((90 - (effectiveLat)) / 90, 0)
  }

  getSolarFluxJuly(hex: Hex) : number {
    const { lat } = this.getHexCoordinate(hex);
    const effectiveLat = Math.abs(lat - this.axialTilt);
    return Math.max((90 - (effectiveLat)) / 90, 0)
  }

  getTemperatureJanuary(hex: Hex) : number {
    return this.getSolarFluxJanuary(hex) * 51 - 11;
  }

  getTemperatureJuly(hex: Hex) : number {
    return this.getSolarFluxJuly(hex) * 51 - 11;
  }

  getTerrainForCoord(x: number, y: number): TerrainType {
    if (y === -1 || y === this.gridSize.height) {
      const half = Math.round(this.gridSize.width / 2);
      const nx = clamp(((half + (half - x)) - 1), 0, this.gridSize.width - 1);
      const ny = y === -1 ? 0 : this.gridSize.height - 1;
      return this.terrain.data[this.indexMap.get(`${nx},${ny}`)];
    } else if (x === -1) {
      return this.terrain.data[this.indexMap.get(`${this.gridSize.width - 1},${y}`)];
    } else if (x === this.gridSize.width) {
      return this.terrain.data[this.indexMap.get(`${0},${y}`)];
    }
    return this.terrain.data[this.indexMap.get(`${x},${y}`)];
  }

  getHexNeighborTerrain(x: number, y: number): DirectionMap<TerrainType> {
    const se_hex = this.getHexNeighborCoord(x, y, Direction.SE);
    const se_hex_terrain = this.getTerrainForCoord(se_hex[0], se_hex[1]);

    const ne_hex = this.getHexNeighborCoord(x, y, Direction.NE);
    const ne_hex_terrain = this.getTerrainForCoord(ne_hex[0], ne_hex[1]);

    const n_hex = this.getHexNeighborCoord(x, y, Direction.N);
    const n_hex_terrain = this.getTerrainForCoord(n_hex[0], n_hex[1]);

    const nw_hex = this.getHexNeighborCoord(x, y, Direction.NW);
    const nw_hex_terrain = this.getTerrainForCoord(nw_hex[0], nw_hex[1]);

    const sw_hex = this.getHexNeighborCoord(x, y, Direction.SW);
    const sw_hex_terrain = this.getTerrainForCoord(sw_hex[0], sw_hex[1]);

    const s_hex = this.getHexNeighborCoord(x, y, Direction.S);
    const s_hex_terrain = this.getTerrainForCoord(s_hex[0], s_hex[1]);

    return {
      [Direction.SE]: se_hex_terrain,
      [Direction.NE]: ne_hex_terrain,
      [Direction.N]: n_hex_terrain,
      [Direction.NW]: nw_hex_terrain,
      [Direction.SW]: sw_hex_terrain,
      [Direction.S]: s_hex_terrain,
    }
  }

  /**
   * Returns true if both hexes are neighbors
   * @param hex1 First Hex
   * @param hex2 Second Hex
   */
  areHexesNeighbors(hex1: Hex, hex2: Hex): boolean {
    return this.hexNeighborDirections.get(hex1).has(hex2);
  }

  setHexRoad(node: Hex, otherNode: Hex, direction: Direction) {
    if (!this.hexRoads.has(node)) {
      this.hexRoads.set(node, new Map());
    }
    this.hexRoads.get(node).set(direction, otherNode);
  }

  setRoadPath(path: Hex[]) {
    path.forEach((node, index) => {
      const lastNode = path[index - 1];
      const nextNode = path[index + 1];
      if (lastNode) {
        const direction = this.hexNeighborDirections.get(node).get(lastNode);
        this.setHexRoad(node, lastNode, direction);
      }

      if (nextNode) {
        const direction = this.hexNeighborDirections.get(node).get(nextNode);
        this.setHexRoad(node, nextNode, direction);
      }
    });
  }

  hasRoad(hex: Hex, direction?: Direction) {
    if (this.hexRoads.has(hex)) {
      if (direction === undefined) {
        return true;
      }
      return this.hexRoads.get(hex).has(direction);
    }
    return false;
  }

  isLand(hex: Hex) {
    return (
      this.getTerrainForCoord(hex.x, hex.y) !== TerrainType.OCEAN &&
      this.getTerrainForCoord(hex.x, hex.y) !== TerrainType.COAST
    );
  }

  debugNeighborTerrain(x: number, y: number) {
    const neighborTerrainTypes = this.getHexNeighborTerrain(x, y);
    const se_hex = this.getHexNeighbor(x, y, Direction.SE);
    const ne_hex = this.getHexNeighbor(x, y, Direction.NE);
    const n_hex = this.getHexNeighbor(x, y, Direction.N);
    const nw_hex = this.getHexNeighbor(x, y, Direction.NW);
    const sw_hex = this.getHexNeighbor(x, y, Direction.SW);
    const s_hex = this.getHexNeighbor(x, y, Direction.S);

    return {
      neighborCoords: {
        [directionTitles[Direction.SE]]: se_hex,
        [directionTitles[Direction.NE]]: ne_hex,
        [directionTitles[Direction.N]]: n_hex,
        [directionTitles[Direction.NW]]: nw_hex,
        [directionTitles[Direction.SW]]: sw_hex,
        [directionTitles[Direction.S]]: s_hex,
      },
      neighborTerrainTypes: {
        [directionTitles[Direction.SE]]: terrainTypeTitles[neighborTerrainTypes[Direction.SE]],
        [directionTitles[Direction.NE]]: terrainTypeTitles[neighborTerrainTypes[Direction.NE]],
        [directionTitles[Direction.N]]:  terrainTypeTitles[neighborTerrainTypes[Direction.N]],
        [directionTitles[Direction.NW]]: terrainTypeTitles[neighborTerrainTypes[Direction.NW]],
        [directionTitles[Direction.SW]]: terrainTypeTitles[neighborTerrainTypes[Direction.SW]],
        [directionTitles[Direction.S]]:  terrainTypeTitles[neighborTerrainTypes[Direction.S]],
      },
    }
  }
}

export function calculateCentroidForHexes(world: World, hexes: Hex[]): Coord {
  let x = 0;
  let y = 0;
  for (const hex of hexes) {
    const [nx, ny] = world.getHexPosition(hex.x, hex.y);
    x += nx + 32;
    y += ny + 30;
  }
  return [
    x / hexes.length,
    y / hexes.length,
  ];
}
