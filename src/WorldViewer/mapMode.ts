import { WorldMapStateHex } from './worldMapState';
import { terrainColors } from '../game/world/terrain';
import { colorToNumber } from '../utils';
import colormap from 'colormap';
import { MapView } from 'structurae';
import { WorldMapManager } from './WorldMapManager';
import { ColorArray } from '../types';
import { clamp } from 'lodash';

export type TileStates = Map<number, WorldMapStateHex>;

type MapSettings = {
  displayRivers: boolean;
  showCoastlineBorder: boolean;
  enableArrows?: boolean;
}

export interface MapMode {
  title: string;
  mapSettings: MapSettings;
  init?(manager: WorldMapManager): void;
  setTile(index: number, manager: WorldMapManager): number;
  setArrowDir?(index: number, manager: WorldMapManager): number;
}

class TerrainMapMode implements MapMode {
  title = 'Terrain';
  mapSettings = {
    displayRivers: true,
    showCoastlineBorder: false,
  };
  setTile(index: number, manager: WorldMapManager) {
    return terrainColors[manager.getHexField(index, 'terrainType')];
  }
}

class DistanceToCoastMapMode implements MapMode {
  title = 'Distance to coast';
  mapSettings = {
    displayRivers: false,
    showCoastlineBorder: true,
  };
  colors: [number, number, number, number][];
  maxDistance: number;
  manager: WorldMapManager;

  init(manager: WorldMapManager) {
    this.manager = manager;
    this.maxDistance = 0;
    for (let i = 0; i < manager.hexLength; i++) {
      const distanceToCoast = manager.getHexField(i, 'distanceToCoast');
      if (distanceToCoast !== undefined) {
        this.maxDistance = Math.max(this.maxDistance, distanceToCoast);
      }
    }
    this.colors = colormap({
      colormap: 'jet',
      format: 'float',
      nshades: 50,
    });
  }

  setTile(index: number, manager: WorldMapManager) {
    const distanceToCoast = this.manager.getHexField(index, 'distanceToCoast');
    const v = Math.round((distanceToCoast / this.maxDistance) * 50);
    const color = this.colors[v];

    if (!color) {
      return 0x000000;
    }
    
    return colorToNumber([
      Math.round(color[0] * 255),
      Math.round(color[1] * 255),
      Math.round(color[2] * 255),
    ]);
  }
}

class HeightMapMode implements MapMode {
  title = 'Height';
  mapSettings = {
    displayRivers: false,
    showCoastlineBorder: true,
  };

  colorsWater: [number, number, number, number][];
  colorsLand: [number, number, number, number][];
  manager: WorldMapManager;

  init(manager: WorldMapManager) {
    this.manager = manager;
    this.colorsWater = colormap({
      colormap: 'freesurface-blue',
      format: 'float',
      nshades: 50,
    }).reverse();
    this.colorsLand = colormap({
      colormap: 'greens',
      format: 'float',
      nshades: 50,
    });
  }

  setTile(index: number, manager: WorldMapManager) {
    const height = manager.getHexField(index, 'height');
    const sealevel = this.manager.worldMapState.get('sealevel');
    let color: [number, number, number, number];
    if (height < sealevel) {
      const index = Math.round(((sealevel - height) / sealevel) * 50);
      color = this.colorsWater[index];
    } else {
      const index = Math.round(((height - sealevel) / (255 - sealevel)) * 50);
      color = this.colorsLand[index];
    }

    if (!color) {
      return 0x000000;
    }
    
    return colorToNumber([
      Math.round(color[0] * 255),
      Math.round(color[1] * 255),
      Math.round(color[2] * 255),
    ]);
  }
}

class RainfallMapMode implements MapMode {
  title = 'Rainfall';
  mapSettings = {
    displayRivers: true,
    showCoastlineBorder: true,
  };
  colors: [number, number, number, number][];

  init(manager: WorldMapManager) {
    this.colors = colormap({
      colormap: 'YiGnBu',
      format: 'float',
      nshades: 50,
    });
  }

  setTile(index: number, manager: WorldMapManager) {
    const rainfall = manager.getHexField(index, 'rainfall');
    const v = Math.round((rainfall / 9000) * 50);
    const color = this.colors[v];
    if (!color) return 0x000000;
    return colorToNumber([
      Math.round(color[0] * 255),
      Math.round(color[1] * 255),
      Math.round(color[2] * 255),
    ]);
  }
}

class PopulationMapMode implements MapMode {
  title = 'Population';
  mapSettings = {
    displayRivers: false,
    showCoastlineBorder: false,
  };
  maxPopulation: number;
  colors: [number, number, number, number][];

  init(manager: WorldMapManager) {
    this.maxPopulation = 0;
    for (let i = 0; i < manager.hexLength; i++) {
      const population = manager.getHexField(i, 'population');
      if (population !== undefined) {
        this.maxPopulation = Math.max(this.maxPopulation, population);
      }
    }
    this.colors = colormap({
      colormap: 'density',
      format: 'float',
      nshades: 51,
    });
  }

  setTile(index: number, manager: WorldMapManager) {
    const sealevel = manager.worldMapState.get('sealevel');
    const height = manager.getHexField(index, 'height');
    if (height < sealevel) {
      return 0x111111;
    }
    const population = manager.getHexField(index, 'population');
    const v = Math.round((population / this.maxPopulation) * 50);
    const color = isNaN(v) ? this.colors[0] : this.colors[v];
    if (!color) return 0x000000;
    return colorToNumber([
      Math.round(color[0] * 255),
      Math.round(color[1] * 255),
      Math.round(color[2] * 255),
    ]);
  }
}

const COLOR_N6: ColorArray = [251, 0, 255];
const COLOR_N5: ColorArray = [140, 0, 254];
const COLOR_N4: ColorArray = [42, 18, 254];
const COLOR_N3: ColorArray = [85, 75, 254];
const COLOR_N2: ColorArray = [134, 128, 255];
const COLOR_N1: ColorArray = [191, 188, 255];
const COLOR_00: ColorArray = [247, 247, 254];
const COLOR_P1: ColorArray = [253, 193, 194];
const COLOR_P2: ColorArray = [253, 135, 137];
const COLOR_P3: ColorArray = [252, 82, 88];
const COLOR_P4: ColorArray = [252, 33, 48];
const COLOR_P5: ColorArray = [253, 141, 9];
const COLOR_P6: ColorArray = [255, 255, 9];

class PressureMapMode implements MapMode {
  mapSettings = {
    displayRivers: false,
    showCoastlineBorder: true,
  };
  colors: [number, number, number, number][];

  constructor(
    private key: keyof WorldMapStateHex,
    public title: string,
  ) {}

  setTile(index: number, manager: WorldMapManager) {
    const pressure = manager.getHexField(index, this.key) as number;
    if (pressure < 980) {
      return colorToNumber(COLOR_N6);
    } else if (pressure < 984) {
      return colorToNumber(COLOR_N5);
    } else if (pressure < 988) {
      return colorToNumber(COLOR_N4);
    } else if (pressure < 992) {
      return colorToNumber(COLOR_N3);
    } else if (pressure < 996) {
      return colorToNumber(COLOR_N2);
    } else if (pressure < 1000) {
      return colorToNumber(COLOR_N1);
    } else if (pressure < 1008) {
      return colorToNumber(COLOR_00);
    } else if (pressure < 1012) {
      return colorToNumber(COLOR_P1);
    } else if (pressure < 1012) {
      return colorToNumber(COLOR_P2);
    } else if (pressure < 1016) {
      return colorToNumber(COLOR_P3);
    } else if (pressure < 1020) {
      return colorToNumber(COLOR_P4);
    } else if (pressure < 1024) {
      return colorToNumber(COLOR_P5);
    } else {
      return colorToNumber(COLOR_P6);
    }
  }
}

class WindMapMode implements MapMode {
  mapSettings = {
    displayRivers: false,
    showCoastlineBorder: true,
    enableArrows: true,
  };
  colors: [number, number, number, number][];

  constructor(
    private directionKey: keyof WorldMapStateHex,
    private speedKey: keyof WorldMapStateHex,
    public title: string,
  ) {}

  init(manager: WorldMapManager) {
    this.colors = colormap({
      colormap: 'jet',
      format: 'float',
      nshades: 100,
    });
  }

  setTile(index: number, manager: WorldMapManager) {
    const windSpeed = manager.getHexField(index, this.speedKey) as number;
    const v = Math.round(((windSpeed * 10) / 100) * 100);
    const color = this.colors[clamp(v, 0, 99)];
    if (!color) return 0x000000;
    return colorToNumber([
      Math.round(color[0] * 255),
      Math.round(color[1] * 255),
      Math.round(color[2] * 255),
    ]);
  }

  setArrowDir(index: number, manager: WorldMapManager) {
    return manager.getHexField(index, this.directionKey) as number;
  }
}

class OceanCurrentMapMode implements MapMode {
  mapSettings = {
    displayRivers: false,
    showCoastlineBorder: true,
    enableArrows: true,
  };
  manager: WorldMapManager;
  maxSpeed: number;
  colors: [number, number, number, number][];

  constructor(
    private directionKey: keyof WorldMapStateHex,
    private speedKey: keyof WorldMapStateHex,
    public title: string,
  ) {}

  init(manager: WorldMapManager) {
    this.maxSpeed = 0;
    for (let i = 0; i < manager.hexLength; i++) {
      const speed = manager.getHexField(i, this.speedKey) as number;
      if (speed !== undefined) {
        this.maxSpeed = Math.max(this.maxSpeed, speed);
      }
    }
    this.manager = manager;
    this.colors = colormap({
      colormap: 'jet',
      format: 'float',
      nshades: 100,
    });
  }

  setTile(index: number, manager: WorldMapManager) {
    const height = manager.getHexField(index, 'height') as number;
    const sealevel = this.manager.worldMapState.get('sealevel');
    if (height >= sealevel) return 0x000000;
    const currentSpeed = manager.getHexField(index, this.speedKey) as number;
    const v = Math.round(clamp(currentSpeed / this.maxSpeed, 0, 1) * 100);
    const color = this.colors[clamp(v, 0, 99)];
    if (!color) return 0x000000;
    return colorToNumber([
      Math.round(color[0] * 255),
      Math.round(color[1] * 255),
      Math.round(color[2] * 255),
    ]);
  }

  setArrowDir(index: number, manager: WorldMapManager) {
    const height = manager.getHexField(index, 'height') as number;
    const sealevel = this.manager.worldMapState.get('sealevel');
    if (height >= sealevel) return null;
    return manager.getHexField(index, this.directionKey) as number;
  }
}

class TempMapMode implements MapMode {
  mapSettings = {
    displayRivers: false,
    showCoastlineBorder: true,
    enableArrows: true,
  };
  colors: [number, number, number, number][];

  constructor(
    private tempKey: keyof WorldMapStateHex,
    public title: string,
  ) {}

  init(manager: WorldMapManager) {
    this.colors = colormap({
      colormap: 'jet',
      format: 'float',
      nshades: 100,
    });
  }

  setTile(index: number, manager: WorldMapManager) {
    const temp = manager.getHexField(index, this.tempKey) as number;
    const v = Math.round((temp + 11) * 2);

    const color = this.colors[clamp(v, 0, 99)];
    if (!color) return 0x000000;
    return colorToNumber([
      Math.round(color[0] * 255),
      Math.round(color[1] * 255),
      Math.round(color[2] * 255),
    ]);
  }
}

class FluxMapMode implements MapMode {
  mapSettings = {
    displayRivers: false,
    showCoastlineBorder: true,
    enableArrows: true,
  };
  colors: [number, number, number, number][];

  constructor(
    private fluxKey: keyof WorldMapStateHex,
    public title: string,
  ) {}

  init(manager: WorldMapManager) {
    this.colors = colormap({
      colormap: 'jet',
      format: 'float',
      nshades: 100,
    });
  }

  setTile(index: number, manager: WorldMapManager) {
    const flux = manager.getHexField(index, this.fluxKey) as number;
    const v = Math.round(flux * 100);
    
    const color = this.colors[clamp(v, 0, 99)];
    if (!color) return 0x000000;
    return colorToNumber([
      Math.round(color[0] * 255),
      Math.round(color[1] * 255),
      Math.round(color[2] * 255),
    ]);
  }
}

class NPPMapMode implements MapMode {
  title = 'Net Primary Production';
  mapSettings = {
    displayRivers: false,
    showCoastlineBorder: true,
    enableArrows: true,
  };
  colors: [number, number, number, number][];

  init(manager: WorldMapManager) {
    this.colors = colormap({
      colormap: 'jet',
      format: 'float',
      nshades: 100,
    });
  }

  setTile(index: number, manager: WorldMapManager) {
    const flux = manager.getHexField(index, 'npp') as number;
    const v = Math.round(flux / 27);
    
    const color = this.colors[clamp(v, 0, 99)];
    if (!color) return 0x000000;
    return colorToNumber([
      Math.round(color[0] * 255),
      Math.round(color[1] * 255),
      Math.round(color[2] * 255),
    ]);
  }
}

class HunterCapacityMapMode implements MapMode {
  title = 'Hunter Carrying Capacity';
  mapSettings = {
    displayRivers: false,
    showCoastlineBorder: false,
  };
  maxPopulation: number;
  colors: [number, number, number, number][];

  init(manager: WorldMapManager) {
    this.maxPopulation = 0;
    for (let i = 0; i < manager.hexLength; i++) {
      const population = manager.getHexField(i, 'hunterCapacity');
      if (population !== undefined) {
        this.maxPopulation = Math.max(this.maxPopulation, population);
      }
    }
    this.colors = colormap({
      colormap: 'density',
      format: 'float',
      nshades: 51,
    });
  }

  setTile(index: number, manager: WorldMapManager) {
    const sealevel = manager.worldMapState.get('sealevel');
    const height = manager.getHexField(index, 'height');
    if (height < sealevel) {
      return 0x111111;
    }
    const population = manager.getHexField(index, 'hunterCapacity');
    const v = Math.round((population / this.maxPopulation) * 50);
    const color = isNaN(v) ? this.colors[0] : this.colors[v];
    if (!color) return 0x000000;
    return colorToNumber([
      Math.round(color[0] * 255),
      Math.round(color[1] * 255),
      Math.round(color[2] * 255),
    ]);
  }
}

export enum MapModeType {
  Terrain,
  DistanceToCoast,
  PressureJanuary,
  PressureJuly,
  TempJanuary,
  TempJuly,
  FluxJanuary,
  FluxJuly,
  WindJanuary,
  WindJuly,
  OceanCurrentJanuary,
  OceanCurrentJuly,
  Height,
  Rainfall,
  Population,
  NPP,
  HunterCapacity
}

export const mapModes: Map<MapModeType, MapMode> = new Map([
  [MapModeType.Terrain, new TerrainMapMode()],
  [MapModeType.DistanceToCoast, new DistanceToCoastMapMode()],
  [MapModeType.PressureJanuary, new PressureMapMode('pressureJanuary', 'Pressure (January)')],
  [MapModeType.PressureJuly, new PressureMapMode('pressureJuly', 'Pressure (July)')],
  [MapModeType.TempJanuary, new TempMapMode('tempJanuary', 'Temperature (January)')],
  [MapModeType.TempJuly, new TempMapMode('tempJuly', 'Temperature (July)')],
  [MapModeType.FluxJanuary, new FluxMapMode('fluxJanuary', 'Solar Flux (January)')],
  [MapModeType.FluxJuly, new FluxMapMode('fluxJuly', 'Solar Flux (July)')],
  [MapModeType.WindJanuary, new WindMapMode('windDirectionJanuary', 'windSpeedJanuary', 'Wind (January)')],
  [MapModeType.WindJuly, new WindMapMode('windDirectionJuly', 'windSpeedJuly', 'Wind (July)')],
  [MapModeType.OceanCurrentJanuary, new OceanCurrentMapMode('oceanCurrentDirectionJanuary', 'oceanCurrentSpeedJanuary', 'Ocean Current (January)')],
  [MapModeType.OceanCurrentJuly, new OceanCurrentMapMode('oceanCurrentDirectionJuly', 'oceanCurrentSpeedJuly', 'Ocean Current (July)')],
  [MapModeType.Height, new HeightMapMode()],
  [MapModeType.Rainfall, new RainfallMapMode()],
  [MapModeType.Population, new PopulationMapMode()],
  [MapModeType.NPP, new NPPMapMode()],
  [MapModeType.HunterCapacity, new HunterCapacityMapMode()],
]);
