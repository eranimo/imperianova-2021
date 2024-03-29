import Alea from 'alea';
import ndarray from 'ndarray';
import SimplexNoise from 'simplex-noise';
import { PriorityQueue, Queue } from 'typescript-collections';
import { Size, Coord, directionIndexOrder, Direction, oppositeDirections, directionAngle } from '../../types';
import { floodFill, logGroupTime, octaveNoise3D, ndarrayStats, meanAngle, meanAngleWeighted } from '../../utils';
import { TerrainType } from './terrain';
import { Edge, World, Hex } from './World';
import { Grid2D } from '../../utils/Grid2D';
import { inRange, sortBy, clamp, isArray } from 'lodash';
import { DebugTimer } from '../../utils/debug';


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
  windJanuaryDirection: Int16Array,
  windJanuarySpeed: Float32Array,
  windJulyDirection: Int16Array,
  windJulySpeed: Float32Array,
  oceanCurrentJanuaryDirection: Int16Array,
  oceanCurrentJanuarySpeed: Float32Array,
  oceanCurrentJulyDirection: Int16Array,
  oceanCurrentJulySpeed: Float32Array,
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

const directionSortedNorth = [
  Direction.N,
  Direction.NE,
  Direction.NW,
  Direction.SE,
  Direction.SW,
  Direction.S,
];

const directionSortedSouth = [
  Direction.S,
  Direction.SE,
  Direction.SW,
  Direction.NE,
  Direction.NW,
  Direction.N,
];


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
    const climateOutput = this.generateClimate();
    const worldData: WorldData = {
      options,
      terrain,
      heightmap,
      rainfall,
      rivers,
      distanceToCoast,
      ...climateOutput,
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

  /**
   * PRESSURE
   *    Determine areas of high and low pressure
   * WIND
   *    From high to low pressure, modulated by coriolis forces
   * OCEAN CURRENT
   *    Depending on wind direction
   * RAINFALL
   *    Winds moving from oceans and lakes deposit moisture as rainfall
   *    Moist winds 
   * TEMPERATURE
   *    Determine solar insolation in January and July
   *    Move temperature based on Ocean Current and Wind
   */
  @logGroupTime('generate climate')
  generateClimate() {
    const { width, height } = this.size;
    const { sealevel } = this.options;
    const pressureJanuaryData = new Float32Array(new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * width * height))
    const pressureJanuary = ndarray(pressureJanuaryData, [width, height]);
    const pressureJulyData = new Float32Array(new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * width * height))
    const pressureJuly = ndarray(pressureJulyData, [width, height]);

    // pressure is from -30 to 30

    const getLatitudeGradientCentered = (latitude: number, center: number, spread: number) => {
      const distanceToCenter = Math.abs(center - latitude);
      return 1 - (distanceToCenter / spread);
    };

    const RANDOMIZE_AMOUNT = 4;
    const BLUR_PASSES = 40;

    const northernLongitudeLandAmount = new Map<number, number>();
    const southernLongitudeLandAmount = new Map<number, number>();

    for (let x = 0; x < width; x++) {
      const center = Math.round(height / 2);
      let north = 0;
      let south = 0;
      for (let y = center; y >= 0; y--) {
        north += Number(this.world.heightmap.get(x, y) >= sealevel);
      }
      for (let y = center - 1; y < height; y++) {
        south += Number(this.world.heightmap.get(x, y) >= sealevel);
      }
      northernLongitudeLandAmount.set(x, clamp(north / center, 0, 1));
      southernLongitudeLandAmount.set(x, clamp(south / center, 0, 1));
    }
    console.log(northernLongitudeLandAmount, southernLongitudeLandAmount);

    const itczLatitude = new Map<number, number>();

    const AVG_PRESSURE = 1004;

    const decidePressure = (
      hex: Hex,
      isJanuary: boolean,
      decideColdSeason: (lat: number) => boolean
    ) => {
      const { lat } = this.world.getHexCoordinate(hex);
      const isInland = this.world.getHexHeight(hex) >= sealevel;
      const isNorth = lat > 0;
      const MAX_DIST_TO_COAST = 30;
      const distanceToCoastRaw = Math.min(30, this.world.distanceToCoast.get(hex.x, hex.y)) / MAX_DIST_TO_COAST;
      const distanceToCoast = MAX_DIST_TO_COAST * (1 - Math.pow(1 - distanceToCoastRaw, 3));
      const coastalRatio = distanceToCoast / MAX_DIST_TO_COAST;
      let isColdSeason = decideColdSeason(lat);
      const absLat = Math.abs(lat);

      let pressure: number = AVG_PRESSURE;

      const SPREAD = 15;
      let BELT_ITCZ = 0;
      // in january the ITCZ shifts SOUTH on longitudes with more land
      // in july the ITCZ shifts NORTH on longitudes with more land
      if (isJanuary) {
        BELT_ITCZ -= southernLongitudeLandAmount.get(hex.x) * 20;
      } else {
        BELT_ITCZ += northernLongitudeLandAmount.get(hex.x) * 20;
      }

      itczLatitude.set(hex.x, BELT_ITCZ);

      // add some high pressure around the equator because reasons
      if (
        inRange(lat, BELT_ITCZ - 45, BELT_ITCZ + 45)
      ) {
        const latitudeComponent = getLatitudeGradientCentered(lat, BELT_ITCZ, 45);
        pressure += 12 * latitudeComponent;
      }

      // absolute latitude of each pressure belt
      const BELT_STHZ_NORTH = BELT_ITCZ + (90 - BELT_ITCZ) / 3; // 1/3 from the ITCZ
      const BELT_STHZ_SOUTH = BELT_ITCZ + (BELT_ITCZ - 90) / 3; // 1/3 from the ITCZ
      const BELT_PF_NORTH = BELT_STHZ_NORTH + ((90 - BELT_STHZ_NORTH) / 2); // between STHZ and poles
      const BELT_PF_SOUTH = BELT_STHZ_SOUTH - ((BELT_STHZ_SOUTH + 90) / 2); // between STHZ and poles

      // ITCZ = low pressure band caused by hot tropical air
      if (
        inRange(lat, BELT_ITCZ - SPREAD, BELT_ITCZ + SPREAD)
      ) {
        const latitudeComponent = getLatitudeGradientCentered(lat, BELT_ITCZ, SPREAD);
        pressure -= 8 * latitudeComponent;
      }
      // STHZ = subtropical high pressure zone caused by air from the ITCZ cooling and sinking back to the ground
      else if (
        // northern hemisphere
        inRange(lat, BELT_STHZ_NORTH - SPREAD, BELT_STHZ_NORTH + SPREAD)
      ) {
        const latitudeComponent = getLatitudeGradientCentered(lat, BELT_STHZ_NORTH, SPREAD);
        pressure += 12 * latitudeComponent;
      } else if (
        // southern hemisphere
        inRange(lat, BELT_STHZ_SOUTH - SPREAD, BELT_STHZ_SOUTH + SPREAD)
      ) {
        const latitudeComponent = getLatitudeGradientCentered(lat, BELT_STHZ_SOUTH, SPREAD);
        pressure += 12 * latitudeComponent;
      }
      // PF = polar front, a band of low pressure where cold air from the poles meets warm air from the STHZ
      else if (
        // northern hemisphere
        inRange(lat, BELT_PF_NORTH - SPREAD, BELT_PF_NORTH + SPREAD)
      ) {
        const latitudeComponent = getLatitudeGradientCentered(lat, BELT_PF_NORTH, SPREAD);
        pressure -= 12 * latitudeComponent;
      } else if (
        // southern hemisphere
        inRange(lat, BELT_PF_SOUTH - SPREAD, BELT_PF_SOUTH + SPREAD)
      ) {
        const latitudeComponent = getLatitudeGradientCentered(lat, BELT_PF_SOUTH, SPREAD);
        pressure -= 12 * latitudeComponent;
      }
      // poles have high pressure because they're cold
      else if (
        lat >= BELT_PF_NORTH
      ) {
        const latitudeComponent = (lat - BELT_PF_NORTH) / (90 - BELT_PF_NORTH);
        pressure += 4 * latitudeComponent;
      } else if (
        lat < BELT_PF_SOUTH
      ) {
        const latitudeComponent = (lat - BELT_PF_NORTH) / (-90 - BELT_PF_NORTH);
        pressure += 4 * latitudeComponent;
      }

      // in winter over land, high pressure
      // in summer over land, low pressure

      const amount = lat > 0
        ? clamp(lat / BELT_STHZ_NORTH, 0, 1) * (((90 - absLat) / 90) * 20)
        : clamp(lat / BELT_STHZ_SOUTH, 0, 1) * (((90 - absLat) / 90) * 20)
      if (isInland) {
        if (isColdSeason) {
          pressure += amount * coastalRatio;
        } else {
          pressure -= amount * coastalRatio;
        }
      }

      return pressure;
    }

    this.world.hexgrid.forEach((hex, index) => {
      // in january it's cold season in the north
      const januaryPressure = decidePressure(hex, true, lat => lat > 0);
      // in july its cold season in the south
      const julyPressure = decidePressure(hex, false, lat => lat < 0);

      pressureJanuary.set(hex.x, hex.y, januaryPressure);
      pressureJuly.set(hex.x, hex.y, julyPressure);
    });

    // add randomness
    const noise = new SimplexNoise(this.rng);
    this.world.hexgrid.forEach((hex, index) => {
      const [nx, ny, nz] = this.hex3DCoords.get(hex);
      let january = pressureJanuary.get(hex.x, hex.y);
      let july = pressureJuly.get(hex.x, hex.y);
      january += RANDOMIZE_AMOUNT * octaveNoise3D(noise.noise3D.bind(noise), nx, ny, nz, 3, 0.5, 0.9);
      july += RANDOMIZE_AMOUNT * octaveNoise3D(noise.noise3D.bind(noise), nx, ny, nz, 3, 0.5, 0.9);
      pressureJanuary.set(hex.x, hex.y, january);
      pressureJuly.set(hex.x, hex.y, july);
    });

    // blur pressure maps
    for (let i = 0; i < BLUR_PASSES; i++) {
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

    // WIND
    /**
     * For both January and July pressure maps:
     * For each hex:
     *  Decide the downwind hex:
     *    Generally, the lowest hex with pressure less than the current hex is the downwind hex
     *    This is modulated by coriolis effect
     *      NORTH: clockwise around high pressure, anticlockwise around low pressure
     *      SOUTH: anticlockwise around high pressure, clockwise around low pressure
     *    Dominant winds:
     *      Close to equator: west
     *      Mid latitudes: east
     *      Near poles: west
     *  Decide wind intensity:
     *    Difference in pressure between the current hex and the downwind hex
     *      
     */
    const windJanuaryDirectionData = new Int16Array(new ArrayBuffer(Int16Array.BYTES_PER_ELEMENT * width * height))
    const windJanuaryDirection = ndarray(windJanuaryDirectionData, [width, height]);
    const windJanuarySpeedData = new Float32Array(new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * width * height))
    const windJanuarySpeed = ndarray(windJanuarySpeedData, [width, height]);

    const windJulyDirectionData = new Int16Array(new ArrayBuffer(Int16Array.BYTES_PER_ELEMENT * width * height))
    const windJulyDirection = ndarray(windJulyDirectionData, [width, height]);
    const windJulySpeedData = new Float32Array(new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * width * height))
    const windJulySpeed = ndarray(windJulySpeedData, [width, height]);

    const windTimer = new DebugTimer('wind');

    const getLatitudeGradientLinear = (lat: number, maxLat: number, minLat: number) => {
      // lat is from -90 to 90
      // when lat = maxLat return 1
      // when lat = midpoint(maxLat, minLat) return 0.5
      // when lat = minLat return 0
      return (((lat + 90) - (minLat + 90)) / ((maxLat + 90) - (minLat + 90)));
    }

    const decideSeasonWind = (inputPressure: ndarray, outputDirection: ndarray, outputSpeed: ndarray) => {
      this.world.hexgrid.forEach((hex, index) => {
        const thisPressure = inputPressure.get(hex.x, hex.y);
        let lowestNeighborPressure = Infinity;
        let highestNeighborPressure = -Infinity;
        let lowerAngles: Direction[] = [];
        for (const dir of directionIndexOrder) {
          const neighbor = this.world.getHexNeighbor(hex.x, hex.y, dir);
          if (neighbor === null) continue;
          const neighborPressure = inputPressure.get(neighbor.x, neighbor.y);
          if (neighborPressure < thisPressure) {
            lowerAngles.push(directionAngle[dir]);
          }
          if (neighborPressure < lowestNeighborPressure) {
            lowestNeighborPressure = neighborPressure;
          }
          if (neighborPressure > highestNeighborPressure) {
            highestNeighborPressure = neighborPressure;
          }
        }
        // average angle of all lower neighbors is the initial wind angle
        let windAngle = meanAngle(lowerAngles);
        // wind speed is directly proportional to the difference in pressure
        let windSpeed = Math.abs(highestNeighborPressure - lowestNeighborPressure) * 3;
        outputSpeed.set(hex.x, hex.y, windSpeed);

        const { lat } = this.world.getHexCoordinate(hex);
        const ratio = clamp(windSpeed / 10, 0, 1);

        // low wind speed = more randomness
        windAngle += (this.rng() * (1 - ratio) * 30) - 15;

        // low pressure gradients = more likely to be influenced by coriolis

        // NORTH:
        // clockwise around high pressure
        // counter-clockwise around low pressure

        // SOUTH:
        // counter-clockwise around high pressure
        // clockwise around low pressure
        
        if (lat > 0) {
          if (thisPressure > AVG_PRESSURE) {
            windAngle += (ratio * 45);
          } else {
            windAngle -= (ratio * 45);
          }
        } else {
          if (thisPressure > AVG_PRESSURE) {
            windAngle -= (ratio * 45);
          } else {
            windAngle += (ratio * 45);
          }
        }

        // prevailing winds
        const BELT_ITCZ = itczLatitude.get(hex.x);
        const BELT_STHZ_NORTH = BELT_ITCZ + (90 - BELT_ITCZ) / 3; // 1/3 from the ITCZ
        const BELT_STHZ_SOUTH = BELT_ITCZ + (BELT_ITCZ - 90) / 3; // 1/3 from the ITCZ
        const BELT_PF_NORTH = BELT_STHZ_NORTH + ((90 - BELT_STHZ_NORTH) / 2); // between STHZ and poles
        const BELT_PF_SOUTH = BELT_STHZ_SOUTH - ((BELT_STHZ_SOUTH + 90) / 2); // between STHZ and poles

        let prevailingWindAngle: number;
        // TRADE WINDS
        if (inRange(lat, BELT_ITCZ, BELT_STHZ_NORTH)) {
          const latitudeComponent = getLatitudeGradientLinear(lat, BELT_ITCZ, BELT_STHZ_NORTH);
          const weight = latitudeComponent;
          prevailingWindAngle = meanAngleWeighted([270, 180], [weight, 1 - weight]);
        }
        else if (inRange(lat, BELT_STHZ_SOUTH, BELT_ITCZ)) {
          const latitudeComponent = getLatitudeGradientLinear(lat, BELT_STHZ_SOUTH, BELT_ITCZ);
          const weight = 1 - latitudeComponent;
          prevailingWindAngle = meanAngleWeighted([270, 360], [weight, 1 - weight])
        }

        // WESTERLIES
        if (inRange(lat, BELT_STHZ_NORTH, BELT_PF_NORTH)) {
          const latitudeComponent = getLatitudeGradientLinear(lat, BELT_STHZ_NORTH, BELT_PF_NORTH);
          const weight = 1 - latitudeComponent;
          prevailingWindAngle = meanAngleWeighted([90, 0], [weight, 1 - weight]);
        }
        else if (inRange(lat, BELT_PF_SOUTH, BELT_STHZ_SOUTH)) {
          const latitudeComponent = getLatitudeGradientLinear(lat, BELT_PF_SOUTH, BELT_STHZ_SOUTH);
          const weight = latitudeComponent;
          prevailingWindAngle = meanAngleWeighted([90, 180], [weight, 1 - weight])
        }

        // // POLAR EASTERLIES
        if (lat >= BELT_PF_NORTH) {
          const latitudeComponent = getLatitudeGradientLinear(lat, BELT_PF_NORTH, 90);
          const weight = latitudeComponent;
          prevailingWindAngle = meanAngleWeighted([270, 180], [weight, 1 - weight]);
        } else if (lat < BELT_PF_SOUTH) {
          const latitudeComponent = getLatitudeGradientLinear(lat, 90, BELT_PF_SOUTH);
          const weight = 1 - latitudeComponent;
          prevailingWindAngle = meanAngleWeighted([270, 0], [weight, 1 - weight])
        }

        // windAngle = prevailingWindAngle;

        // low speed = more likely to be influenced by trade winds
        windAngle = meanAngleWeighted([windAngle, prevailingWindAngle], [ratio, 1 - ratio]);

        // or maybbe use pressure diff?
        // const pressureDiff = thisPressure - AVG_PRESSURE;
        // if (pressureDiff > 0) { // high pressure
        //   const pressureDiffRatio = clamp(pressureDiff / 10, 0, 1); // 1 at clost to mean, 0 at extremes
        //   windAngle = meanAngleWeighted([windAngle, prevailingWindAngle], [pressureDiffRatio, 1 - pressureDiffRatio]);
        // } else {
        //   const pressureDiffRatio = clamp(pressureDiff / -10, 0, 1); // 1 at clost to mean, 0 at extremes
        //   windAngle = meanAngleWeighted([windAngle, prevailingWindAngle], [pressureDiffRatio, 1 - pressureDiffRatio]);
        // }

        // windAngle = meanAngle([windAngle, prevailingWindAngle]);

        outputDirection.set(hex.x, hex.y, windAngle % 360);
      });
    };
    decideSeasonWind(pressureJanuary, windJanuaryDirection, windJanuarySpeed);
    decideSeasonWind(pressureJuly, windJulyDirection, windJulySpeed);

    console.log('wind january', windJanuaryDirection, windJanuarySpeed);
    console.log('wind july', windJulyDirection, windJulySpeed);

    windTimer.stopTimer();

    // OCEAN CURRENTS

    /**
     * Water flows from one hex to another, affected by wind, Coriolis effect, landmasses.
     * Warm currents come from the equator and move poleward, cold currents come from the poles and move to the equator (these are only relative terms)
     * Water speed is higher for currents originating near the equator (over 1 knots). At the equator, currents move eastward.
     */
    const oceanCurrentJanuaryDirectionData = new Int16Array(new ArrayBuffer(Int16Array.BYTES_PER_ELEMENT * width * height))
    const oceanCurrentJanuaryDirection = ndarray(oceanCurrentJanuaryDirectionData, [width, height]);
    const oceanCurrentJanuarySpeedData = new Float32Array(new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * width * height))
    const oceanCurrentJanuarySpeed = ndarray(oceanCurrentJanuarySpeedData, [width, height]);

    const oceanCurrentJulyDirectionData = new Int16Array(new ArrayBuffer(Int16Array.BYTES_PER_ELEMENT * width * height))
    const oceanCurrentJulyDirection = ndarray(oceanCurrentJulyDirectionData, [width, height]);
    const oceanCurrentJulySpeedData = new Float32Array(new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * width * height))
    const oceanCurrentJulySpeed = ndarray(oceanCurrentJulySpeedData, [width, height]);

    const oceanCurrentTimer = new DebugTimer('ocean currents');


    /**
     * a map of hexes to a list of tuples describing what direction is the current going and what percent should go there
     * e.g.:
     * windAngle = 0  -> [N, 1.0]
     * windAngle = 30 -> [N, 0.50], [NE, 0.50] 
     * windAngle = 15 -> [N, 0.75], [NE, 0.25]
     */
    let hexDownwindMap = new Map<Hex, [dir: Direction, percent: number][]>();

    // calculate hexDownwindMap
    const calculateSeason = (inputWindDirection: ndarray, inputWindSpeed: ndarray, outputDirection: ndarray, outputSpeed: ndarray) => {
      this.world.hexgrid.forEach((hex, index) => {
        if (this.world.getHexHeight(hex) >= sealevel) return;
        const windAngle = inputWindDirection.get(hex.x, hex.y);
        // find nearest two directions to windAngle
        const sortedDirectionAngles = directionIndexOrder
          .map(dir => [dir, windAngle - directionAngle[dir]])
          .sort((a, b) => a[1] - b[1]) as [dir: Direction, diff: number][];
        
        const [firstDirection, secondDirection] = sortedDirectionAngles;
        
        const currentDirection = windAngle;
        /**
         * TODO: implement
         * if any of the hexes windAngle is pointing to are land hexes, move the windAngle such that
         * it points towards the poles away from land, then recalculate direction
         * 
         * speed should be proportional to the amount of deflection
         * e.g. if the only ocean neighbor is 180 degrees from the windAngle, then the speed should be very low
         */

        // set initial speed
        outputSpeed.set(hex.x, hex.y, 0.1);

        // set direction
        outputDirection.set(hex.x, hex.y, currentDirection);
      });
    }
    // iterate over hexDownwindMap and create current, setting outputSpeed
    const step = (inputWindDirection: ndarray, inputWindSpeed: ndarray, outputDirection: ndarray, outputSpeed: ndarray) => {
      // this.world.hexgrid.forEach((hex, index) => {
      //   if (this.world.getHexHeight(hex) >= sealevel) return;
      //   const downwindHexes = hexDownwindMap.get(hex);
      // });
    };
    const MAX_OCEAN_CURRENT_SIM_TICKS = 50;

    calculateSeason(windJanuaryDirection, windJanuarySpeed, oceanCurrentJanuaryDirection, oceanCurrentJanuarySpeed);
    for (let t = 0; t < MAX_OCEAN_CURRENT_SIM_TICKS; t++) {
      step(windJanuaryDirection, windJanuarySpeed, oceanCurrentJanuaryDirection, oceanCurrentJanuarySpeed);
    }

    calculateSeason(windJulyDirection, windJulySpeed, oceanCurrentJulyDirection, oceanCurrentJulySpeed);
    for (let t = 0; t < MAX_OCEAN_CURRENT_SIM_TICKS; t++) {
      step(windJulyDirection, windJulySpeed, oceanCurrentJulyDirection, oceanCurrentJulySpeed);
    }


    console.log('ocean current january', ndarrayStats(oceanCurrentJanuaryDirection), ndarrayStats(oceanCurrentJanuarySpeed));
    console.log('ocean current july', ndarrayStats(oceanCurrentJulyDirection), ndarrayStats(oceanCurrentJulySpeed));

    oceanCurrentTimer.stopTimer();

    this.world.setWorldClimate(
      pressureJanuaryData,
      pressureJulyData,
      windJanuaryDirectionData,
      windJanuarySpeedData,
      windJulyDirectionData,
      windJulySpeedData,
      oceanCurrentJanuaryDirectionData,
      oceanCurrentJanuarySpeedData,
      oceanCurrentJulyDirectionData,
      oceanCurrentJulySpeedData,
    );

    return {
      pressureJanuary: pressureJanuaryData,
      pressureJuly: pressureJulyData,
      windJanuaryDirection: windJanuaryDirectionData,
      windJanuarySpeed: windJanuarySpeedData,
      windJulyDirection: windJulyDirectionData,
      windJulySpeed: windJulySpeedData,
      oceanCurrentJanuaryDirection: oceanCurrentJanuaryDirectionData,
      oceanCurrentJanuarySpeed: oceanCurrentJanuarySpeedData,
      oceanCurrentJulyDirection: oceanCurrentJulyDirectionData,
      oceanCurrentJulySpeed: oceanCurrentJulySpeedData,
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
