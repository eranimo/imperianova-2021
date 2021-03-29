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
  rainfall: Int32Array,
}

function removeDepressions(
  world: World,
  heightmap: ndarray,
  waterheight: ndarray,
  size: Size,
  sealevel: number,
) {
  const { width, height } = size;
  // copy heightmap into watermap
  world.hexgrid.forEach(hex => {
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
  const closed = new Grid2D<boolean>(width, height);
  closed.fill(false);

  // add hexes on edge of map to open queue
  world.hexgrid.forEach((hex, index) => {
    if (world.isMapEdge(hex)) {
      open.add({ x: hex.x, y: hex.y, height: heightmap.get(hex.x, hex.y) });
      closed.set(hex.x, hex.y, true);
    }
  });

  // create waterheight grid
  while (!open.isEmpty() || !pit.isEmpty()) {
    let cell: Item;
    if (!pit.isEmpty()) {
      cell = pit.dequeue();
    } else {
      cell = open.dequeue();
    }

    const { x: cx, y: cy } = cell;

    for (const neighbor of world.hexNeighbors(world.getHex(cx, cy))) {
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

  // identify depressions
  const depressionCellsGrid = ndarray(new Uint8ClampedArray(width * height), [width, height]);
  depressionCellsGrid.data.fill(0);
  let countDepressionCells = 0;
  world.hexgrid.forEach((hex, index) => {
    if (
      waterheight.get(hex.x, hex.y) > heightmap.get(hex.x, hex.y)
      && waterheight.get(hex.x, hex.y) >= sealevel
    ) {
      depressionCellsGrid.set(hex.x, hex.y, 1);
      countDepressionCells++;
    }
  });
  // console.log('countDepressionCells', countDepressionCells);

  const visited = new Set<Hex>();
  let depressions: Coord[][] = [];
  world.hexgrid.forEach((hex, index) => {
    if (depressionCellsGrid.get(hex.x, hex.y) === 1 && visited.has(hex) === false) {
      const depression = world.floodFill(
        hex,
        (h1, h2) => depressionCellsGrid.get(h2.x, h2.y) === 1,
        visited,
      )
      depressions.push(Array.from(depression).map(hex => [hex.x, hex.y]));
    }
  });

  // console.log('depressions', sortBy(depressions, i => i.length));
  return depressions;
}

export class WorldGenerator {
  size: Size;
  seed: number;
  world: World;
  options: WorldGeneratorOptions;
  hex3DCoords: Map<Hex, [x: number, y: number, z: number]>;
  rng: () => number;

  @logGroupTime('generate', true)
  generate(options: WorldGeneratorOptions) {
    this.world = new World();
    this.options = options;
    this.world.setWorldSize(options.size);
    this.size = this.world.gridSize;
    this.seed = options.seed;
    this.rng = Alea(this.seed);
    const { terrain, heightmap } = this.generateTerrain();
    const rivers = this.generateRivers();
    const rainfall = this.generateRainfall();
    const worldData: WorldData = {
      options,
      terrain,
      heightmap,
      rainfall,
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

    const noise = new SimplexNoise(this.rng);
    const { sealevel } = this.options;
    const hex3DCoords = new Map<Hex, [x: number, y: number, z: number]>();
    this.hex3DCoords = hex3DCoords;
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
    const waterheight = ndarray(new Uint8ClampedArray(width * height), arrayDim);
    let depressions = removeDepressions(this.world, heightmap, waterheight, this.size, sealevel);

    const fillDepression = (depression: Coord[]) => {
      for (const [x, y] of depression) {
        const newHeight = waterheight.get(x, y);
        heightmap.set(x, y, newHeight);
      }
    }

    const reverseDepression = (depression: Coord[]) => {
      for (const [x, y] of depression) {
        const newHeight = waterheight.get(x, y) + (waterheight.get(x, y) - heightmap.get(x, y));
        heightmap.set(x, y, newHeight);
      }
    }

    for (const depression of depressions) {
      if (depression.length > 1) {
        reverseDepression(depression);
      } else {
        fillDepression(depression);
      }
    }

    depressions = removeDepressions(this.world, heightmap, waterheight, this.size, sealevel);


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

    for (const depression of depressions) {
      for (const [x, y] of depression) {
        terrain.set(x, y, TerrainType.LAKE);
      }
    }

    this.world.setWorldTerrain(terrainData, heightmapData);
    return {
      terrain: terrainData,
      heightmap: heightmapData,
    };
  }

  @logGroupTime('generate rainfall')
  generateRainfall() {
    const { width, height } = this.size;
    const arraySize = width * height;
    const arrayDim = [width, height];
    const rainfallBuffer = new ArrayBuffer(Int32Array.BYTES_PER_ELEMENT * arraySize);
    const rainfallmapData = new Int32Array(rainfallBuffer)
    const rainfallmap = ndarray(rainfallmapData, arrayDim);

    const noise = new SimplexNoise(this.rng);

    this.world.hexgrid.forEach((hex, index) => {
      if (this.world.isLand(hex)) {
        const { lat, long } = this.world.getHexCoordinate(hex);
        const [nx, ny, nz] = this.hex3DCoords.get(hex);
        const rainfall = (octaveNoise3D(noise.noise3D.bind(noise), nx, ny, nz, 5, 0.75) + 1) / 2;
        rainfallmap.set(hex.x, hex.y, (rainfall * rainfall * rainfall) * 9000);
      } else {
        rainfallmap.set(hex.x, hex.y, 0);
      }
    });
    console.log('rainfall', rainfallmap);

    this.world.setWorldRainfall(rainfallmapData);

    return rainfallmapData;
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
      // .filter(i => rng() < 0.33)
      .map(edge => buildRiver(edge))
      .filter(edges => edges.length > 0);
    const riverData = rivers.map(riverEdges => riverEdges.map(edge => edge.id));
    console.timeEnd('build rivers');

    this.world.setWorldRivers(riverData);

    return riverData;
  }
}