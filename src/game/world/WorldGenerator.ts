import Alea from 'alea';
import * as Honeycomb from 'honeycomb-grid';
import { orderBy } from 'lodash';
import SimplexNoise from 'simplex-noise';
import { MultiDictionary } from 'typescript-collections';
import { adjacentDirections, Direction, directionIndexOrder, DirectionMap, oppositeDirections, Size } from '../../types';
import { logGroupTime, octaveNoise3D } from '../../utils';
import { TerrainType } from './terrain';
import { Edge, Hex, World } from './World';
import ndarray from 'ndarray';
import { parseToHsl } from 'polished';


export type WorldGeneratorOptions = {
  size: number,
  sealevel: number,
  seed: number,
}

export type WorldData = {
  options: WorldGeneratorOptions,
  terrain: Uint32Array,
  heightmap: Float32Array,
  rivers: number[][],
}

export class WorldGenerator {
  size: Size;
  seed: number;
  world: World;
  options: WorldGeneratorOptions;

  @logGroupTime('generate', true)
  generate(
    options: WorldGeneratorOptions
  ) {
    this.world = new World();
    this.options = options;
    this.world.setWorldSize(options.size);
    this.size = this.world.gridSize;
    this.seed = options.seed;
    const { terrain, heightmap } = this.generateTerrain();
    const rivers = this.generateRivers();
    const worldData: WorldData = {
      options,
      terrain,
      heightmap,
      rivers,
    };
    this.world.setWorldData(worldData);
    return this.world;
  }

  @logGroupTime('generateTerrain')
  generateTerrain() {
    const arraySize = this.size.width * this.size.height;
    const arrayDim = [this.size.width, this.size.height];
    const terrainBuffer = new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * arraySize);
    const terrainData = new Uint32Array(terrainBuffer);
    const terrain = ndarray(terrainData, arrayDim);

    const heightBuffer = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * arraySize);
    const heightmapData = new Float32Array(heightBuffer)
    const heightmap = ndarray(heightmapData, arrayDim);

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
      const raw = octaveNoise3D(noise.noise3D.bind(noise), nx, ny, nz, 7, 0.5);
      const value = (raw + 1) / 2;
      const height = value * 255;
      heightmap.set(hex.x, hex.y, height);
      if (Math.abs(lat) > 75) {
        const isGlacial = (octaveNoise3D(noise.noise3D.bind(noise), nx, ny, nz, 7, 2) + 1) / 2;
        const chance = (Math.abs(lat) - 75) / (90 - 75);
        if (isGlacial < chance) {
          terrain.set(hex.x, hex.y, TerrainType.GLACIAL);
          return;
        }
      }
      const deg = (octaveNoise3D(noise.noise3D.bind(noise), nx, ny, nz, 7, 2) + 1) / 2;
      if (height < (sealevel - 20)) {
        terrain.set(hex.x, hex.y, TerrainType.OCEAN);
      } else if (height < sealevel) {
        terrain.set(hex.x, hex.y, TerrainType.COAST);
      } else {
        if (Math.abs(lat) > 50 + (deg * 20)) {
          if (height < (sealevel + 25)) {
            const isTaiga = (octaveNoise3D(noise.noise3D.bind(noise), nx, ny, nz, 7, 0.5) + 1) / 2;
            terrain.set(hex.x, hex.y, isTaiga < 0.55 ? TerrainType.TUNDRA : TerrainType.TAIGA);
          } else {
            terrain.set(hex.x, hex.y, TerrainType.TUNDRA);
          }
        } else if (Math.abs(lat) > 40 + (deg * 20)) {
          terrain.set(hex.x, hex.y, TerrainType.TAIGA);
        } else if (Math.abs(lat) > 30 +(deg * 20)) {
          terrain.set(hex.x, hex.y, TerrainType.FOREST);
        } else {
          if (height < (sealevel + 10)) {
            const isForested = (octaveNoise3D(noise.noise3D.bind(noise), nx, ny, nz, 7, 0.5) + 1) / 2;
            terrain.set(hex.x, hex.y, isForested < 0.5 ? TerrainType.GRASSLAND : TerrainType.FOREST);
          } else if (height < (sealevel + 35)) {
            terrain.set(hex.x, hex.y, TerrainType.GRASSLAND);
          } else {
            terrain.set(hex.x, hex.y, TerrainType.DESERT);
          }
        }
      }
    });
    // any ocean hex with land neighbors is a coast hex
    this.world.hexgrid.forEach((hex, index) => {
      if (!this.world.isLand(hex)) {
        for (const neighbor of this.world.hexNeighbors(hex)) {
          if (this.world.isLand(neighbor)) {
            terrain.set(hex.x, hex.y, TerrainType.COAST);
            break;
          }
        }
      }
    });

    this.world.setWorldTerrain(terrainData, heightmapData);
    return {
      terrain: terrainData,
      heightmap: heightmapData,
    };
  }

  @logGroupTime('generateRivers')
  generateRivers() {
    const edgeHeightMap = new Map<Edge, number>();

    // calculate upstream edge and heights
    console.time('find edge height');
    for (const edge of this.world.hexEdges) {
      if (edge.o1 && edge.o2) {
        edgeHeightMap.set(edge, Math.max((this.world.getHexHeight(edge.h1) + this.world.getHexHeight(edge.h2)) / 2));
      }
    }
    console.timeEnd('find edge height');
    
    // find coastline
    const coastlineEdges: Edge[] = [];
    console.time('find coastlines');
    for (const edge of this.world.hexEdges) {
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
        if (edge && edgeHeightMap.get(edge) > highestEdgeHeight) {
          highestEdge = edge;
          highestEdgeHeight = edgeHeightMap.get(edge);
        }
      }
      if (highestEdgeHeight > edgeHeightMap.get(currentEdge)) {
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
    const rivers = coastlineEdges
      .filter(i => rng() < 0.33)
      .map(edge => buildRiver(edge))
      .filter(edges => edges.length > 0);
    const riverData = rivers.map(riverEdges => riverEdges.map(edge => edge.id));
    console.timeEnd('build rivers');

    this.world.setWorldRivers(riverData);

    return riverData;
  }
}