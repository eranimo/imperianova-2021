import Alea from 'alea';
import ndarray from 'ndarray';
import SimplexNoise from 'simplex-noise';
import { PriorityQueue, Queue } from 'typescript-collections';
import { Size, Coord } from '../../types';
import { floodFill, logGroupTime, octaveNoise3D, ndarrayStats } from '../../utils';
import { TerrainType } from './terrain';
import { Edge, World, Hex } from './World';
import { Grid2D } from '../../utils/Grid2D';
import { inRange, sortBy } from 'lodash';


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
  distanceToCoast: Int32Array,
  pressureJanuary: Float32Array,
  pressureJuly: Float32Array,
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
    const { terrain, heightmap, distanceToCoast } = this.generateTerrain();
    const rivers = this.generateRivers();
    const rainfall = this.generateRainfall();
    const { pressureJanuary, pressureJuly } = this.generatePressure();
    const worldData: WorldData = {
      options,
      terrain,
      heightmap,
      rainfall,
      rivers,
      distanceToCoast,
      pressureJanuary,
      pressureJuly,
    };
    this.world.setWorldData(worldData);
    return this.world;
  }

  @logGroupTime('generate terrain')
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
      const raw = octaveNoise3D(noise.noise3D.bind(noise), nx, ny, nz, 7, 0.5, 0.5);
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

    for (const depression of depressions) {
      for (const [x, y] of depression) {
        terrain.set(x, y, TerrainType.LAKE);
      }
    }

    const distanceToCoastData = new Int32Array(new ArrayBuffer(Int32Array.BYTES_PER_ELEMENT * arraySize))
    const distanceToCoast = ndarray(distanceToCoastData, arrayDim);

    const queue = new Queue<[hex: Hex, count: number]>();
    const visited = new Grid2D(width, height);
    visited.fill(0);
    this.world.hexgrid.forEach((hex, index) => {
      if (heightmap.get(hex.x, hex.y) >= sealevel) {
        for (const neighbor of this.world.hexNeighbors(hex)) {
          if (heightmap.get(neighbor.x, neighbor.y) < sealevel) {
            queue.add([hex, 0]);
            visited.set(hex.x, hex.y, 1);
            return;
          }
        }
      }
    });
    console.log('coastal land cell count', queue.size());

    while (!queue.isEmpty()) {
      const [hex, count] = queue.dequeue();
      distanceToCoast.set(hex.x, hex.y, count);

      for (const neighbor of this.world.hexNeighbors(hex)) {
        if (visited.get(neighbor.x, neighbor.y) === 1) continue;
        visited.set(neighbor.x, neighbor.y, 1);
        queue.add([neighbor, count + 1]);
      }
    }
    console.log('distance to coast', distanceToCoast);
    console.log('distance to coast stats', ndarrayStats(distanceToCoast));

    this.world.setWorldTerrain(terrainData, heightmapData, distanceToCoastData);
    return {
      terrain: terrainData,
      heightmap: heightmapData,
      distanceToCoast: distanceToCoastData,
    };
  }

  @logGroupTime('generate pressure')
  generatePressure() {
    const { width, height } = this.size;
    const { sealevel } = this.options;
    const pressureJanuaryData = new Float32Array(new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * width * height))
    const pressureJanuary = ndarray(pressureJanuaryData, [width, height]);
    const pressureJulyData = new Float32Array(new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * width * height))
    const pressureJuly = ndarray(pressureJulyData, [width, height]);

    // pressure is from -30 to 30

    const getLatitudeGradient = (latitude: number, center: number, spread: number) => {
      const distanceToCenter = Math.abs(center - latitude);
      return 1 - (distanceToCenter / spread);
    };

    const decidePressure = (
      hex: Hex,
      decideColdSeason: (lat: number) => boolean
    ) => {
      const { lat } = this.world.getHexCoordinate(hex);
      const isInland = this.world.isLand(hex);
      const MAX_DIST_TO_COAST = 30;
      const distanceToCoastRaw = Math.min(30, this.world.distanceToCoast.get(hex.x, hex.y)) / MAX_DIST_TO_COAST;
      const distanceToCoast = MAX_DIST_TO_COAST * (1 - Math.pow(1 - distanceToCoastRaw, 3));
      let isColdSeason = decideColdSeason(lat);
      const absLat = Math.abs(lat);

      let pressure: number = 1004;
      const HIGH_PRESSURE_SPREAD = 15;
      const LOW_PRESSURE_SPREAD = 10;
      const LAND_HIGH_RESSURE_MAX = 10;
      const LAND_LOW_RESSURE_MAX = 2;
      const OCEAN_HIGH_PRESSURE_MAX = 10;
      const OCEAN_LOW_PRESSURE_MAX = 5;

      if (inRange(lat, -25, 25)) {
        // slightly high pressure around tropics
        // slightly less over land
        const latitudeComponent = 0.5 + ((absLat / 25) / 2);
        if (isInland) {
          // less pressure further inland
          const v = 1 - (distanceToCoast / MAX_DIST_TO_COAST);
          pressure += 5 * v * latitudeComponent;
        } else {
          // more pressure further out to sea
          const v = (distanceToCoast / MAX_DIST_TO_COAST);
          pressure += (5 + (10 * v)) * latitudeComponent;
        }
      }

      if (isInland) {
        // land
        const latitudeComponent = getLatitudeGradient(absLat, 45, 45);
        if (isColdSeason) {
          // High pressure systems develop over the continents (including the poles). Larger continent = higher pressure.
          // No low pressure overland.
          pressure += (latitudeComponent * distanceToCoast * 0.10) * (latitudeComponent * LAND_HIGH_RESSURE_MAX);
        } else {
          // hot temperatures prevent the formation of high pressure systems.
          // large landmasses become hot and the low pressure can cover most of the continent.
          pressure -= (latitudeComponent * distanceToCoast * 0.10) * (latitudeComponent * LAND_LOW_RESSURE_MAX);
        }
      } else {
        // // ocean
        if (isColdSeason) {
          // High pressure 30° in a more or less continuous line
          // Low pressure centered around 55°
          if (
            inRange(absLat, 30 - HIGH_PRESSURE_SPREAD, 30 + HIGH_PRESSURE_SPREAD)
          ) {
            const latitudeComponent = getLatitudeGradient(absLat, 30, HIGH_PRESSURE_SPREAD);
            pressure += (distanceToCoast * 0.10) * (latitudeComponent * OCEAN_HIGH_PRESSURE_MAX);
          } else if (
            inRange(absLat, 55 - LOW_PRESSURE_SPREAD, 55 + LOW_PRESSURE_SPREAD)
          ) {
            const latitudeComponent = getLatitudeGradient(absLat, 55, LOW_PRESSURE_SPREAD);
            pressure -= (distanceToCoast * 0.10) * (latitudeComponent * OCEAN_LOW_PRESSURE_MAX);
          }
        } else {
          // High pressure: 35° separated, mostly on the eastern side of the oceans
          // Tend to be located on the eastern side, close to the continents because it’s where the cold currents are flowing.
          // In summer, the high pressure system breaks apart as the continents are affected by low pressure systems due to hotter temperatures.

          // Low pressure centers move 5 to 10° closer to the poles. They tend to disappear over the land.
          if (
            inRange(absLat, 35 - HIGH_PRESSURE_SPREAD, 35 + HIGH_PRESSURE_SPREAD)
          ) {
            const latitudeComponent = getLatitudeGradient(absLat, 35, HIGH_PRESSURE_SPREAD);
            pressure += (distanceToCoast * 0.10) * (latitudeComponent * OCEAN_HIGH_PRESSURE_MAX);
          } else if (
            inRange(absLat, 60 - LOW_PRESSURE_SPREAD, 60 + LOW_PRESSURE_SPREAD)
          ) {
            const latitudeComponent = getLatitudeGradient(absLat, 60, LOW_PRESSURE_SPREAD);
            pressure -= (distanceToCoast * 0.10) * (latitudeComponent * OCEAN_LOW_PRESSURE_MAX);
          }
        }
      }

      return pressure;
    }

    this.world.hexgrid.forEach((hex, index) => {
      // in january it's cold season in the north
      const januaryPressure = decidePressure(hex, lat => lat > 0);
      // in july its cold season in the south
      const julyPressure = decidePressure(hex, lat => lat < 0);

      pressureJanuary.set(hex.x, hex.y, januaryPressure);
      pressureJuly.set(hex.x, hex.y, julyPressure);
    });

    // add randomness
    const noise = new SimplexNoise(this.rng);
    this.world.hexgrid.forEach((hex, index) => {
      const [nx, ny, nz] = this.hex3DCoords.get(hex);
      let january = pressureJanuary.get(hex.x, hex.y);
      let july = pressureJuly.get(hex.x, hex.y);
      january += 3 * octaveNoise3D(noise.noise3D.bind(noise), nx, ny, nz, 3, 0.5, 0.9);
      july += 3 * octaveNoise3D(noise.noise3D.bind(noise), nx, ny, nz, 3, 0.5, 0.9);
      pressureJanuary.set(hex.x, hex.y, january);
      pressureJuly.set(hex.x, hex.y, july);
    });

    // blur pressure maps
    for (let i = 0; i < 10; i++) {
      this.world.hexgrid.forEach((hex, index) => {
        let january = 0;
        let july = 0;
        let neighborCount = 0;
        for (const neighbor of this.world.hexNeighbors(hex)) {
          january += pressureJanuary.get(neighbor.x, neighbor.y);
          july += pressureJuly.get(neighbor.x, neighbor.y);
          neighborCount++;
        }
        pressureJanuary.set(hex.x, hex.y, january / neighborCount);
        pressureJuly.set(hex.x, hex.y, july / neighborCount);

      });
    }


    console.log('pressure january', ndarrayStats(pressureJanuary));
    console.log('pressure july', ndarrayStats(pressureJuly));

    this.world.setWorldPressure(pressureJanuaryData, pressureJulyData);

    return {
      pressureJanuary: pressureJanuaryData,
      pressureJuly: pressureJulyData,
    };
  }

  @logGroupTime('generate rainfall')
  generateRainfall() {
    const { width, height } = this.size;
    const rainfallBuffer = new ArrayBuffer(Int32Array.BYTES_PER_ELEMENT * width * height);
    const rainfallmapData = new Int32Array(rainfallBuffer)
    const rainfallmap = ndarray(rainfallmapData, [width, height]);

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