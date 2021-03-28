import Alea from 'alea';
import ndarray from 'ndarray';
import SimplexNoise from 'simplex-noise';
import { PriorityQueue, Queue } from 'typescript-collections';
import { Size, Coord } from '../../types';
import { floodFill, logGroupTime, octaveNoise3D } from '../../utils';
import { TerrainType } from './terrain';
import { Edge, World, Hex } from './World';
import { Grid2D } from '../../utils/Grid2D';
import { sortBy } from 'lodash';


export type WorldGeneratorOptions = {
  size: number,
  sealevel: number,
  seed: number,
}

export type WorldData = {
  options: WorldGeneratorOptions,
  terrain: Uint32Array,
  heightmap: Uint8ClampedArray,
  rivers: number[][],
}

export class WorldGenerator {
  size: Size;
  seed: number;
  world: World;
  options: WorldGeneratorOptions;

  @logGroupTime('generate', true)
  generate(options: WorldGeneratorOptions) {
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
    const { width, height } = this.size;
    const arraySize = width * height;
    const arrayDim = [width, height];
    const terrainBuffer = new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * arraySize);
    const terrainData = new Uint32Array(terrainBuffer);
    const terrain = ndarray(terrainData, arrayDim);

    const heightBuffer = new ArrayBuffer(Uint8ClampedArray.BYTES_PER_ELEMENT * arraySize);
    const heightmapData = new Uint8ClampedArray(heightBuffer)
    const heightmap = ndarray(heightmapData, arrayDim);

    const rng = Alea(this.seed);
    const noise = new SimplexNoise(rng);
    const { sealevel } = this.options;
    const hex3DCoords = new Map<Hex, [x: number, y: number, z: number]>();
    this.world.hexgrid.forEach((hex, index) => {
      const { lat, long } = this.world.getHexCoordinate(hex);
      const inc = ((lat + 90) / 180) * Math.PI;
      const azi = ((long + 180) / 360) * (2 * Math.PI);
      const nx = 1 * Math.sin(inc) * Math.cos(azi);
      const ny = 1 * Math.sin(inc) * Math.sin(azi);
      const nz = 1 * Math.cos(inc);
      hex3DCoords.set(hex, [nx, ny, nz]);
      const raw = octaveNoise3D(noise.noise3D.bind(noise), nx, ny, nz, 7, 0.5);
      const value = (raw + 1) / 2;
      const height = value * 255;
      heightmap.set(hex.x, hex.y, height);
    });

    // REMOVE DEPRESSIONS

    // copy heightmap into watermap
    const waterheight = ndarray(new Uint8ClampedArray(width * height), arrayDim);
    this.world.hexgrid.forEach(hex => {
      waterheight.set(hex.x, hex.y, heightmap.get(hex.x, hex.y));
    });

    type Item = { x: number, y: number, height: number };
    const open = new PriorityQueue<Item>((a, b) => {
      if (a.height < b.height) {
        return 1;
      } else if (a.height > b.height) {
        return -1;
      }
      return 0;
    });
    const pit = new Queue<Item>();
    const closed = new Grid2D<boolean>(this.size.width, this.size.height);
    closed.fill(false);

    // add hexes on edge of map to open queue
    this.world.hexgrid.forEach((hex, index) => {
      if (this.world.isMapEdge(hex)) {
        open.add({ x: hex.x, y: hex.y, height: heightmap.get(hex.x, hex.y) });
        closed.set(hex.x, hex.y, true);
      }
    });
    console.log('map edge cells', open.size());

    // create waterheight grid
    while (!open.isEmpty() || !pit.isEmpty()) {
      let cell: Item;
      if (!pit.isEmpty()) {
        cell = pit.dequeue();
      } else {
        cell = open.dequeue();
      }

      const { x: cx, y: cy } = cell;

      for (const neighbor of this.world.hexNeighbors(this.world.getHex(cx, cy))) {
        const { x: nx, y: ny } = neighbor;
        if (closed.get(nx, ny) === true) continue;
        closed.set(nx, ny, true);
        if (waterheight.get(nx, ny) <= waterheight.get(cx, cy)) {
          waterheight.set(nx, ny, waterheight.get(cx, cy));
          pit.add({ x: nx, y: ny, height: waterheight.get(nx, ny) });
        } else {
          open.add({ x: nx, y: ny, height: waterheight.get(nx, ny) });
        }
      }
    }
    console.log('waterheight', waterheight);

    // this.world.hexgrid.forEach(hex => {
    //   heightmap.set(hex.x, hex.y, waterheight.get(hex.x, hex.y));
    // });

    // identify depressions
    const depressionCellsGrid = ndarray(new Uint8ClampedArray(width * height), [width, height]);
    depressionCellsGrid.data.fill(0);
    let countDepressionCells = 0;
    this.world.hexgrid.forEach((hex, index) => {
      if (
        waterheight.get(hex.x, hex.y) > heightmap.get(hex.x, hex.y)
        && waterheight.get(hex.x, hex.y) >= sealevel
      ) {
        depressionCellsGrid.set(hex.x, hex.y, 1);
        countDepressionCells++;
      }
    });
    console.log('depressionCellsGrid', depressionCellsGrid);
    console.log('countDepressionCells', countDepressionCells);

    const visited = ndarray(new Uint8ClampedArray(width * height), [width, height]);
    visited.data.fill(0);
    // let visited = new Set<Hex>();
    let depressions: Coord[][] = [];
    this.world.hexgrid.forEach((hex, index) => {
      if (depressionCellsGrid.get(hex.x, hex.y) === 1 && visited.get(hex.x, hex.y) === 0) {
        const depression = this.world.bfs(
          visited,
          (i) => depressionCellsGrid.get(i.x, i.y) === 1,
          hex,
        );
        // if (depression.size > 1000) return;
        // for (const hex of depression) {
        //   heightmap.set(hex.x, hex.y, 244);
        // }
        depressions.push(depression);
      }
    });

    function fillDepression(depression: number[][]) {
      for (const [x, y] of depression) {
        const newHeight = waterheight.get(x, y) + (waterheight.get(x, y) - heightmap.get(x, y));
        heightmap.set(x, y, newHeight);
      }
    }
    console.log('depressions', sortBy(depressions, i => i.length));

    for (const depression of depressions) {
      fillDepression(depression);
    }

    // CALCULATE TERRAIN
    this.world.hexgrid.forEach((hex, index) => {
      const { lat, long } = this.world.getHexCoordinate(hex);
      const [nx, ny, nz] = hex3DCoords.get(hex);
      const height = heightmap.get(hex.x, hex.y);
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