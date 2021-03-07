import { Direction, directionIndexOrder, adjacentDirections, CoordArray } from '../types';
import { Hex, calculateCentroidForHexes, World } from '../game/world/World';
import { ObservableSet } from '../utils/ObservableSet';
import { Color } from '../utils/Color';
import { Subject } from 'rxjs';


export type RegionOptions = {
  name: string;
  hexes: Hex[],
  color: Color,
}

export class Region {
  name: string;
  hexes: ObservableSet<Hex>;
  color: Color;

  constructor(
    private map: WorldMapRegions,
    options: RegionOptions
  ) {
    this.hexes = new ObservableSet(options.hexes);
    this.name = options.name;
    this.color = options.color;

    for (const hex of this.hexes) {
      this.map.setHexRegion(hex, this);
    }
  }

  add(hex: Hex) {
    this.hexes.add(hex);
    this.map.setHexRegion(hex, this);
  }

  remove(hex: Hex) {
    this.hexes.delete(hex);
    this.map.removeHexRegion(hex, this);
  }

  calculateLabels() {
    const visited = new Set<Hex>();
    const labels: CoordArray = [];
    for (const hex of this.hexes) {
      if (!visited.has(hex)) {
        const part = this.map.world.floodFill(
          hex,
          (hex, neighbor) => this.map.getHexRegion(neighbor) == this,
          visited,
        );
        labels.push(calculateCentroidForHexes(this.map.world, Array.from(part)));
      }
    }
    return labels;
  }

  update() {
    for (const hex of this.hexes) {
      const neighbors = this.map.world.getHexNeighbors(hex);
      for (const dir of directionIndexOrder) {
        this.map.calculateHexTilesetID(neighbors[dir]);
      }
      this.map.calculateHexTilesetID(hex);
    }
  }
}

export class WorldMapRegions {
  public regions: ObservableSet<Region>;
  private hexRegions: Map<Hex, Region>;
  borderTilesetID: Map<Hex, Map<Direction, number>>;
  public regionHexAdded$: Subject<[region: Region, hex: Hex]>;
  public regionHexRemoved$: Subject<[region: Region, hex: Hex]>;

  constructor(public world: World) {
    this.regions = new ObservableSet();
    this.hexRegions = new Map();
    this.borderTilesetID = new Map();
    this.regionHexAdded$ = new Subject();
    this.regionHexRemoved$ = new Subject();
  }

  createRegion(options: RegionOptions) {
    const region = new Region(this, options);
    this.regions.add(region);
    return region;
  }

  deleteRegion(region: Region) {
    this.regions.delete(region); 
  }

  setHexRegion(hex: Hex, region: Region) {
    if (this.getHexRegion(hex) == region) return;
    if (this.hexHasRegion(hex)) {
      const oldRegion = this.getHexRegion(hex);
      oldRegion.remove(hex);
      this.regionHexAdded$.next([oldRegion, hex]);
    }
    this.hexRegions.set(hex, region);
    this.regionHexAdded$.next([region, hex]);
  }

  removeHexRegion(hex: Hex, region: Region) {
    if (this.hexRegions.get(hex) == region) {
      this.hexRegions.delete(hex);
      this.regionHexRemoved$.next([region, hex]);
      if (region.hexes.size === 0) {
        this.deleteRegion(region);
      }
    }
  }

  update() {
    for (const region of this.regions) {
      region.update();
    }
  }

  calculateHexTilesetID(hex: Hex) {
    const neighbors = this.world.getHexNeighbors(hex);
    let idMap = new Map();
    const directionToColumn = {
      [Direction.SE]: 0,
      [Direction.S]: 1,
      [Direction.SW]: 2,
      [Direction.NW]: 3,
      [Direction.N]: 4,
      [Direction.NE]: 5,
    }
    for (const dir of directionIndexOrder) {
      const neighbor = neighbors[dir] as Hex;
      const [adj1, adj2] = adjacentDirections[dir];
      const adj1Neighbor = neighbors[adj1] as Hex;
      const adj2Neighbor = neighbors[adj2] as Hex;
      if (this.getHexRegion(neighbor) != this.getHexRegion(hex)) {
        idMap.set(dir, directionToColumn[dir]);
      } else if (
        this.getHexRegion(adj1Neighbor) != this.getHexRegion(hex) &&
        this.getHexRegion(adj2Neighbor) != this.getHexRegion(hex)
      ) {
        idMap.set(dir, 18 + directionToColumn[dir]);
      } else if (this.getHexRegion(adj1Neighbor) != this.getHexRegion(hex)) {
        idMap.set(dir, 12 + directionToColumn[dir]);
      } else if (this.getHexRegion(adj2Neighbor) != this.getHexRegion(hex)) {
        idMap.set(dir, 6 + directionToColumn[dir]);
      }
    }
    this.borderTilesetID.set(hex, idMap);
  }

  hexHasRegion(hex: Hex) {
    return this.hexRegions.has(hex);
  }

  getHexRegion(hex: Hex): Region {
    return this.hexRegions.get(hex);
  }
}