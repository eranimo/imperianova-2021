import Alea from 'alea';
import * as Honeycomb from 'honeycomb-grid';
import { orderBy } from 'lodash';
import ndarray from 'ndarray';
import { Subject } from 'rxjs';
import SimplexNoise from 'simplex-noise';
import { MultiDictionary, Queue } from 'typescript-collections';
import { adjacentDirections, Direction, directionIndexOrder, DirectionMap, oppositeDirections, Size } from './types';
import { logGroupTime, octaveNoise } from './utils';
import { Edge, Hex, World, GridFactory, TerrainType, terrainTypeTitles } from './World';


export type WorldGeneratorOptions = {
  size: number,
  sealevel: number,
  seed: number,
}

export class WorldGenerator {
  size: Size;
  seed: number;

  constructor(
    public world: World,
    public options: WorldGeneratorOptions
  ) {
    world.setWorldSize(options.size);
    const gridSize = {
      width: options.size * 2,
      height: options.size,
    };
    this.size = gridSize;
    this.seed = options.seed;
  }

  @logGroupTime('generate', true)
  generate() {
    this.generateTerrain();
    this.generateRivers();
  }

  @logGroupTime('generateTerrain')
  generateTerrain() {
    const rng = Alea(this.seed);
    const noise = new SimplexNoise(rng);
    const { sealevel } = this.options;
    this.world.hexgrid.forEach((hex, index) => {
      const { lat, long } = this.world.getHexCoordinate(hex);
      const inc = ((lat + 90) / 180) * Math.PI;
      const azi = ((long + 180) / 360) * (2 * Math.PI);
      const nx = 1 * Math.sin(inc) * Math.cos(azi);
      const ny = 1 * Math.sin(inc) * Math.sin(azi);
      const nz = 1 * Math.cos(inc);
      const raw = octaveNoise(noise.noise3D.bind(noise), nx, ny, nz, 7, 0.5);
      const value = (raw + 1) / 2;
      const height = value * 255;
      this.world.heightmap.set(hex.x, hex.y, height);
      if (Math.abs(lat) > 75) {
        const isGlacial = (octaveNoise(noise.noise3D.bind(noise), nx, ny, nz, 7, 2) + 1) / 2;
        const chance = (Math.abs(lat) - 75) / (90 - 75);
        if (isGlacial < chance) {
          this.world.terrain.set(hex.x, hex.y, TerrainType.GLACIAL);
          return;
        }
      }
      const deg = (octaveNoise(noise.noise3D.bind(noise), nx, ny, nz, 7, 2) + 1) / 2;
      if (height < (sealevel - 20)) {
        this.world.terrain.set(hex.x, hex.y, TerrainType.OCEAN);
      } else if (height < sealevel) {
        this.world.terrain.set(hex.x, hex.y, TerrainType.COAST);
      } else {
        if (Math.abs(lat) > 50 + (deg * 20)) {
          if (height < (sealevel + 25)) {
            const isTaiga = (octaveNoise(noise.noise3D.bind(noise), nx, ny, nz, 7, 0.5) + 1) / 2;
            this.world.terrain.set(hex.x, hex.y, isTaiga < 0.55 ? TerrainType.TUNDRA : TerrainType.TAIGA);
          } else {
            this.world.terrain.set(hex.x, hex.y, TerrainType.TUNDRA);
          }
        } else if (Math.abs(lat) > 40 + (deg * 20)) {
          this.world.terrain.set(hex.x, hex.y, TerrainType.TAIGA);
        } else if (Math.abs(lat) > 30 +(deg * 20)) {
          this.world.terrain.set(hex.x, hex.y, TerrainType.FOREST);
        } else {
          if (height < (sealevel + 10)) {
            const isForested = (octaveNoise(noise.noise3D.bind(noise), nx, ny, nz, 7, 0.5) + 1) / 2;
            this.world.terrain.set(hex.x, hex.y, isForested < 0.5 ? TerrainType.GRASSLAND : TerrainType.FOREST);
          } else if (height < (sealevel + 35)) {
            this.world.terrain.set(hex.x, hex.y, TerrainType.GRASSLAND);
          } else {
            this.world.terrain.set(hex.x, hex.y, TerrainType.DESERT);
          }
        }
      }
    });
    // any ocean hex with land neighbors is a coast hex
    this.world.hexgrid.forEach((hex, index) => {
      if (!this.world.isLand(hex)) {
        for (const neighbor of this.world.hexNeighbors(hex)) {
          if (this.world.isLand(neighbor)) {
            this.world.terrain.set(hex.x, hex.y, TerrainType.COAST);
            break;
          }
        }
      }
    });

    // identify landmasses
    console.time('identify landmasses');
    this.world.landmasses = [];
    let visited = new Set<Hex>();
    this.world.hexgrid.forEach(hex => {
      if (this.world.isLand(hex) && !visited.has(hex)) {
        const region = this.world.floodFill(
          hex,
          (h1, h2) => this.world.isLand(h2),
          visited,
        );
        const hexes = Array.from(region);
        this.world.landmasses.push({
          id: this.world.landmasses.length,
          size: region.size,
          hexes,
        });
      }
    });
    console.log('landmasses:', orderBy(this.world.landmasses, 'size', 'desc'));
    console.timeEnd('identify landmasses');

    // identify landmasses
    console.time('identify ecoregions');
    this.world.ecoregions = [];
    visited = new Set<Hex>();
    this.world.hexgrid.forEach(hex => {
      if (!visited.has(hex)) {
        const region = this.world.floodFill(
          hex,
          (h1, h2) => this.world.getTerrain(h1) === this.world.getTerrain(h2),
          visited,
        );
        const hexes = Array.from(region);
        const terrainType = this.world.getTerrain(hexes[0]);
        this.world.ecoregions.push({
          id: this.world.ecoregions.length,
          size: region.size,
          hexes,
          terrainType,
        });
      }
    });
    console.log('ecoregions:', orderBy(this.world.ecoregions, 'size', 'desc'));
    console.timeEnd('identify ecoregions');
  }

  @logGroupTime('generateRivers')
  generateRivers() {
    // build a list of hex edges, calculate slope
    let hexEdges: Edge[] = [];
    let hexIDs: Map<number, Edge> = new Map();
    let hexEdgesMap: Map<Hex, DirectionMap<Edge | null>> = new Map();
    const getEmptyEdgeMap = (): DirectionMap<Edge> => ({
      [Direction.SE]: null,
      [Direction.NE]: null,
      [Direction.N]: null,
      [Direction.NW]: null,
      [Direction.SW]: null,
      [Direction.S]: null,
    });
    console.time('build edge map');
    this.world.hexgrid.forEach((hex, index) => {
      const neighbors = this.world.getHexNeighbors(hex);
      const edges = hexEdgesMap.get(hex) || getEmptyEdgeMap();
      const corners = hex.corners().map(p => p.add(this.world.getHexPosition(hex.x, hex.y)));
      // console.log(corners);
      const directionEdgeCoords: DirectionMap<Honeycomb.Point[]> = {
        [Direction.SE]: [corners[0], corners[1]],
        [Direction.NE]: [corners[5], corners[0]],
        [Direction.N]: [corners[4], corners[5]],
        [Direction.NW]: [corners[3], corners[4]],
        [Direction.SW]: [corners[2], corners[3]],
        [Direction.S]: [corners[1], corners[2]],
      }
      for (const dir of directionIndexOrder) {
        if (neighbors[dir]) {
          if (!hexEdgesMap.has(neighbors[dir])) {
            hexEdgesMap.set(neighbors[dir], getEmptyEdgeMap());
          }
          const [adj1Dir, adj2Dir ] = adjacentDirections[dir];
          const id = (
            ((this.size.width * this.size.height ** 0) * hex.index) + 
            ((this.size.width * this.size.height ** 1) * neighbors[dir].index) +
            ((directionIndexOrder.length ** 3) * dir)
          );
          if (hexIDs.has(id)) {
            edges[dir] = hexEdgesMap.get(neighbors[dir])[oppositeDirections[dir]];
          } else {
            const edge: Edge = {
              direction: dir,
              id,
              h1: hex,
              h2: neighbors[dir],
              p1: directionEdgeCoords[dir][0],
              p2: directionEdgeCoords[dir][1],
              o1: neighbors[adj1Dir],
              o2: neighbors[adj2Dir],
            }
            edges[dir] = edge;
            hexEdges.push(edge);
            hexEdgesMap.get(neighbors[dir])[oppositeDirections[dir]] = edge;
          }
          
        }
      }
      hexEdgesMap.set(hex, edges);
    });
    console.timeEnd('build edge map');

    // find adjacent edges for each edge
    console.time('find adjacent edges');
    this.world.hexgrid.forEach((hex, index) => {
      const edges = hexEdgesMap.get(hex);
      for (const dir of directionIndexOrder) {
        if (edges[dir]) {
          const edge = edges[dir];
          const [adj1, adj2] = adjacentDirections[dir];
          const opposite_hex = edge.h2;
          const opposite_dir = oppositeDirections[dir];
          const opposite_dir_adj = adjacentDirections[opposite_dir];
          const o1_edge = hexEdgesMap.get(opposite_hex)[opposite_dir_adj[0]];
          const o2_edge = hexEdgesMap.get(opposite_hex)[opposite_dir_adj[1]];
          edge.p1_edges = [edges[adj1], o1_edge];
          edge.p2_edges = [edges[adj2], o2_edge];
        }
      }
      hexEdgesMap.set(hex, edges);
    });
    console.timeEnd('find adjacent edges');
    console.log('hexEdges', hexEdges);
    console.log('hexEdgesMap', hexEdgesMap);

    // calculate upstream edge and heights
    console.time('find edge height');
    const getEdgeHeight = (edge: Edge) => Math.max((this.world.heightmap.get(edge.h1.x, edge.h1.y) + this.world.heightmap.get(edge.h2.x, edge.h2.y)) / 2);
    for (const edge of hexEdges) {
      if (
        edge.o1 && edge.o2
      ) {
        edge.upstream = this.world.heightmap.get(edge.o1.x, edge.o1.y) < this.world.heightmap.get(edge.o2.x, edge.o2.y)
          ? 2
          : 1;
        edge.height = getEdgeHeight(edge);
      }
    }
    console.timeEnd('find edge height');

    const coastlineEdges: Edge[] = [];

    // find coastline
    console.time('find coastlines');
    for (const edge of hexEdges) {
      if (
        edge.o1 && edge.o2 &&
        this.world.isLand(edge.h1) &&
        this.world.isLand(edge.h2) &&
        this.world.getTerrainForCoord(edge.h1.x, edge.h1.y) !== TerrainType.GLACIAL &&
        this.world.getTerrainForCoord(edge.h2.x, edge.h2.y) !== TerrainType.GLACIAL &&
        (
          (!this.world.isLand(edge.o1) && this.world.isLand(edge.o2))
          ||
          (this.world.isLand(edge.o1) && !this.world.isLand(edge.o2))
        )
      ) {
        coastlineEdges.push(edge);
      }
    }
    console.timeEnd('find coastlines');

    console.log('coastlineEdges', coastlineEdges);

    // build rivers
    const edgeHasRiver: Map<number, boolean> = new Map();

    const buildRiver = (currentEdge: Edge, lastEdges: Edge[] = []): Edge[] => {
      let highestEdge: Edge = null;
      let highestEdgeHeight = -Infinity;
      const edges = [
        ...(currentEdge.p1_edges || []),
        ...(currentEdge.p2_edges || []),
      ];
      if (
        edges.length === 0 ||
        edgeHasRiver.has(currentEdge.id) ||
        (
          lastEdges.length > 0
          ? (!this.world.isLand(currentEdge.o1) || !this.world.isLand(currentEdge.o2))
          : false
        )
      ) {
        return lastEdges;
      }
      for (const edge of edges) {
        if (edge && edge.height > highestEdgeHeight) {
          highestEdge = edge;
          highestEdgeHeight = edge.height;
        }
      }
      if (highestEdgeHeight > currentEdge.height) {
        edgeHasRiver.set(currentEdge.id, true);
        if (edgeHasRiver.get(highestEdge.id)) {
          return lastEdges;
        }
        return buildRiver(highestEdge, [...lastEdges, currentEdge]);
      }
      return lastEdges;
    }

    console.time('build rivers');
    const rng = Alea(this.seed);
    this.world.rivers = coastlineEdges
      .filter(i => rng() < 0.33)
      .map(edge => buildRiver(edge))
      .filter(edges => edges.length > 0);
    console.timeEnd('build rivers');
    console.log('rivers', this.world.rivers);

    console.time('build river data structures');
    this.world.hexRiverEdges = new MultiDictionary();
    this.world.hexRiverPoints = new MultiDictionary();
    this.world.riverHexPairs = new Map();
    for (const riverEdges of this.world.rivers) {
      for (const edge of riverEdges) {
        if (this.world.riverHexPairs.has(edge.h1)) {
          this.world.riverHexPairs.get(edge.h1).add(edge.h2);
        } else {
          this.world.riverHexPairs.set(edge.h1, new Set([edge.h2]));
        }
        if (this.world.riverHexPairs.has(edge.h2)) {
          this.world.riverHexPairs.get(edge.h2).add(edge.h1);
        } else {
          this.world.riverHexPairs.set(edge.h2, new Set([edge.h1]));
        }
        this.world.hexRiverEdges.setValue(edge.h1, edge.direction);
        this.world.hexRiverEdges.setValue(edge.h2, oppositeDirections[edge.direction]);
        this.world.hexRiverPoints.setValue(edge.h1, [edge.p1, edge.p2]);
        this.world.hexRiverPoints.setValue(edge.h2, [edge.p1, edge.p2]);
      }
    }
    console.timeEnd('build river data structures');
    console.log('hexRiverEdges', this.world.hexRiverEdges);
  }
}