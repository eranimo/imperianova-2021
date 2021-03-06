import { CompositeRectTileLayer } from 'pixi-tilemap';
import * as PIXI from 'pixi.js';
import { cornerDirections, cornerIndexOrder, CornerMap, directionCorners, directionIndexOrder, DirectionMap, Coord, ColorArray, Direction, adjacentDirections } from './types';
import { Hex, World } from './World';
import { terrainColors, terrainTransitions, TerrainType } from './terrain';
import { HexTile, OFFSET_Y, tileSectionRenderOrder } from './hexTile';
import { Assets } from './AssetLoader';
import cull from 'pixi-cull';
import SimplexNoise from 'simplex-noise';
import { Viewport } from 'pixi-viewport';
import { chunk } from 'lodash';
import { rgbaToInt } from 'jimp/*';
import { colorToNumber } from './utils';
import { Color } from './utils/Color';
import { Subject } from 'rxjs';
import { Grid2D } from './utils/Grid2D';
import { ObservableSet } from './utils/ObservableSet';
import { map, mapTo, mergeAll, mergeMap } from 'rxjs/operators';

const CHUNK_WIDTH = 10;
const CHUNK_HEIGHT = 10;

const DEBUG_RIVER_COLOR = 0x0000FF;
const DEBUG_ROAD_COLOR = 0x80530b;

type RegionOptions = {
  name: string;
  hexes: Hex[],
  color: Color,
}

class Region {
  name: string;
  hexes: ObservableSet<Hex>;
  color: Color;

  constructor(
    private map: RegionMap,
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

  get labelPosition(): Coord {
    let x = 0;
    let y = 0;
    for (const hex of this.hexes) {
      const [nx, ny] = this.map.world.getHexPosition(hex.x, hex.y);
      x += nx + 32;
      y += ny + 30;
    }
    return [
      x / this.hexes.size,
      y / this.hexes.size,
    ]
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

class RegionMap {
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


class MapLabel extends PIXI.Container {
  labelText: PIXI.Text;

  constructor(
    label: string,
    fontSize: number,
  ) {
    super();
    this.labelText = new PIXI.Text(label, {
      font: '32px Tahoma',
      fill: '#FFF',
      align: 'center',
      stroke: '#111',
      strokeThickness: 3,
    });
    this.labelText.anchor.set(0.5);
    this.addChild(this.labelText);
  }
}


export class WorldRenderer {
  public world: World;
  public debugGraphics: PIXI.Graphics;
  public worldWidth: number;
  public worldHeight: number;

  chunkTileLayers: Map<string, CompositeRectTileLayer[]>;
  chunkLayerToChunk: Map<CompositeRectTileLayer, string>;
  chunkOffset: Map<string, Coord>;
  chunkDirty: Map<string, boolean>;
  hexChunk: Grid2D<string>;
  chunkHexes: Map<string, { x: number, y: number }[]>;
  chunkDrawTimes: Map<string, number>;
  chunksLayer: PIXI.Container;
  overlayLayer: PIXI.ParticleContainer;
  gridLayer: PIXI.ParticleContainer;
  regionLayer: PIXI.ParticleContainer;
  hexOverlaySprites: Map<Hex, PIXI.Sprite>;
  hexGridSprites: Map<Hex, PIXI.Sprite>;
  hexBorderSprites: Map<Hex, Map<Direction, PIXI.Sprite>>;
  cull: cull.Simple;
  labelContainer: PIXI.Container;
  regionLabels: Map<Region, MapLabel>;

  regionMap: RegionMap;

  constructor(
    private app: PIXI.Application,
    world: World,
    private assets: Assets
  ) {
    this.world = world;
    this.debugGraphics = new PIXI.Graphics();
    this.worldWidth = this.world.hexgrid.pointWidth();
    this.worldHeight = this.world.hexgrid.pointHeight();
    this.chunksLayer = new PIXI.Container();

    this.chunkDirty = new Map();
    this.chunkLayerToChunk = new Map();
    this.chunkOffset = new Map();
    
    this.chunkTileLayers = new Map();
    this.chunkDrawTimes = new Map();
    this.regionLabels = new Map();
    const { width, height } = world.gridSize;
    this.hexChunk = new Grid2D(width, height);
    this.chunkHexes = new Map();
    this.labelContainer = new PIXI.Container();

    this.hexOverlaySprites = new Map();
    this.hexGridSprites = new Map();
    this.hexBorderSprites = new Map();
    this.overlayLayer = new PIXI.ParticleContainer(width * height, { tint: true });
    this.gridLayer = new PIXI.ParticleContainer(width * height, { tint: true });
    this.regionLayer = new PIXI.ParticleContainer(width * height, { tint: true });

    this.regionMap = new RegionMap(this.world);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x += 2) {
        const { chunkX, chunkY } = this.getChunkForCoordinate(x, y);
        const chunkKey = `${chunkX},${chunkY}`;
        if (!this.chunkHexes.has(chunkKey)) {
          this.chunkHexes.set(chunkKey, []);
        }
        this.chunkHexes.get(chunkKey).push({ x, y });
        this.hexChunk.set(x, y, chunkKey);
      }

      for (let x = 1; x < width; x += 2) {
        const { chunkX, chunkY } = this.getChunkForCoordinate(x, y);
        const chunkKey = `${chunkX},${chunkY}`;
        if (!this.chunkHexes.has(chunkKey)) {
          this.chunkHexes.set(chunkKey, []);
        }
        this.chunkHexes.get(chunkKey).push({ x, y });
        this.hexChunk.set(x, y, chunkKey);
      }
    }

    this.cull = new cull.Simple();

    this.onNewWorld(world);
    this.cull.addList(this.chunksLayer.children);

    // setup events
    document.addEventListener('keyup', event => {
      if (event.key === 'd') {
        this.debugGraphics.visible = !this.debugGraphics.visible;
      } else if (event.key === 'o') {
        this.overlayLayer.visible = !this.overlayLayer.visible;
      } else if (event.key === 'g') {
        this.gridLayer.visible = !this.gridLayer.visible;
      }
    });

    const addRegionLabel = (region: Region) => {
      if (this.regionLabels.has(region)) return;
      const [x, y] = region.labelPosition;
      const label = new MapLabel(region.name, 16)
      label.position.set(x, y);
      this.regionLabels.set(region, label);
      this.labelContainer.addChild(label);
    }
  
    const updateRegionLabel = (region: Region) => {
      const [x, y] = region.labelPosition;
      if (this.regionLabels.has(region)) {
        this.regionLabels.get(region).position.set(x, y);
      }
    }

    const updateRegionMap = (region: Region) => {
      const chunks = new Set<string>();
      for (const hex of region.hexes) {
        const chunk = this.hexChunk.get(hex.x, hex.y);
        chunks.add(chunk);
      }
      for (const chunk of chunks) {
        this.drawChunk(chunk);
      }
    }
  
    const removeRegionLabel = (region: Region) => {
      const label = this.regionLabels.get(region)
      this.regionLabels.delete(region);
      this.labelContainer.removeChild(label);
    }

    this.regionMap.regions.added$.subscribe(region => {
      region.update();
      addRegionLabel(region);
    });
    this.regionMap.regionHexAdded$.subscribe(([region]) => {
      console.log('region hex added', region);
      region.update();
      addRegionLabel(region);
      updateRegionLabel(region);
      updateRegionMap(region);
    });
    this.regionMap.regionHexRemoved$.subscribe(([region, hex]) => {
      console.log('region hex removed', region);
      region.update();
      updateRegionLabel(region);
      updateRegionMap(region);
      const chunk = this.hexChunk.get(hex.x, hex.y);
      this.drawChunk(chunk);
    });
    this.regionMap.regions.deleted$.subscribe(region => removeRegionLabel(region));
  }

  onViewportMoved(viewport: Viewport) {
    const bounds = viewport.getVisibleBounds()
    bounds.x -= 1000;
    bounds.y -= 1000;
    bounds.width += 1000;
    bounds.height += 1000;
    this.cull.cull(bounds);
    const visibleChunkLayers = this.cull.query(bounds);

    for (const tilemapLayer of visibleChunkLayers) {
      if (tilemapLayer instanceof CompositeRectTileLayer) {
        const chunk = this.chunkLayerToChunk.get(tilemapLayer);
        if (this.chunkDirty.get(chunk)) {
          this.drawChunk(chunk);
        }
      }
    }
  }

  onNewWorld(world: World) {
    this.world = world;

    this.renderDebug();
    this.render();
  }

  private getChunkForCoordinate(x: number, y: number) {
    const y2 = x % 2 + y * 2;
    const chunkY = y2 / CHUNK_HEIGHT | 0;
    const chunkX = (x + (y2 % CHUNK_HEIGHT)) / CHUNK_WIDTH | 0;
    return { chunkX, chunkY };
  }

  private drawChunk(chunkKey: string) {
    const [terrainLayer] = this.chunkTileLayers.get(chunkKey);
    const timeStart = Date.now();
    const hexes = this.chunkHexes.get(chunkKey);
    const [minX, minY] = this.chunkOffset.get(chunkKey);
    hexes.forEach((pos, index) => {
      const terrainType = this.world.getTerrainForCoord(pos.x, pos.y);
      if (terrainType === TerrainType.NONE) return;
      const hex = this.world.getHex(pos.x, pos.y);
      const tileSections = this.assets.hexSectionTileset.getHexTileSections(this.world, hex);

      const textures = tileSections.map(tileSection => {
        const variants = this.assets.hexSectionTileset.getTexturesForTileSection(tileSection);
        if (variants.length === 0) {
          return null;
        }
        // TODO: pick random variant?
        return variants[0];
      });
      const [ x, y ] = this.world.getHexPosition(hex.x, hex.y);
      const tx = (x - minX);
      const ty = (y - OFFSET_Y - minY);
      for (const texture of textures) {
        if (texture) {
          terrainLayer.addFrame(texture, tx, ty);
        }
      }

      // overlay
      if (!this.hexOverlaySprites.has(hex)) {
        const overlaySprite = new PIXI.Sprite(this.assets.hexTemplate.fullHex);
        overlaySprite.tint = terrainColors[terrainType];
        overlaySprite.position.set(x, y);
        overlaySprite.width = this.assets.hexTemplate.size.width;
        overlaySprite.height = this.assets.hexTemplate.size.height;
        this.overlayLayer.addChild(overlaySprite);
        this.hexOverlaySprites.set(hex, overlaySprite);
      }

      if (!this.hexGridSprites.has(hex)) {
        const gridSprite = new PIXI.Sprite(this.assets.gridTexture);
        gridSprite.alpha = 0.25;
        gridSprite.position.set(x, y);
        gridSprite.width = this.assets.hexTemplate.size.width;
        gridSprite.height = this.assets.hexTemplate.size.height;
        this.gridLayer.addChild(gridSprite);
        this.hexGridSprites.set(hex, gridSprite);
      }

      if (this.hexBorderSprites.has(hex)) {
        for (const [dir, sprite] of this.hexBorderSprites.get(hex)) {
          sprite.destroy();
          this.regionLayer.removeChild(sprite);
          this.hexBorderSprites.get(hex).delete(dir);
        }
      }

      if (this.regionMap.hexHasRegion(hex)) {
        const region = this.regionMap.getHexRegion(hex);
        const tileIDMap = this.regionMap.borderTilesetID.get(hex);
        if (tileIDMap === undefined) {
          throw new Error('Tile border map not calculated');
        }
        const hexBorderSprites = new Map<Direction, PIXI.Sprite>();
        for (const dir of directionIndexOrder) {
          const tileID = tileIDMap.get(dir);
          if (tileID !== undefined) {
            const borderSprite = new PIXI.Sprite(this.assets.borderTileset.getTile(tileID));
            borderSprite.position.set(x, y);
            borderSprite.width = this.assets.hexTemplate.size.width;
            borderSprite.height = this.assets.hexTemplate.size.height;
            this.regionLayer.addChild(borderSprite);
            borderSprite.tint = region.color.toNumber();
            hexBorderSprites.set(dir, borderSprite);
          } else if (this.hexBorderSprites.has(hex)){
            const borderSprite = this.hexBorderSprites.get(hex).get(dir);
            if (borderSprite) {
              borderSprite.destroy();
              this.regionLayer.removeChild(borderSprite);
            }
          }
        }
        this.hexBorderSprites.set(hex, hexBorderSprites);
      }
    });
    this.chunkDirty.set(chunkKey, false);

    const timeEnd = Date.now();
    this.chunkDrawTimes.set(chunkKey, timeEnd - timeStart);
  }

  private setupChunk(chunkKey: string) {
    const [terrainLayer] = this.chunkTileLayers.get(chunkKey);
    this.chunkLayerToChunk.set(terrainLayer, chunkKey);
    const hexes = this.chunkHexes.get(chunkKey);
    const hexPosititions: [number, number][] = [];
    let minX = Infinity;
    let minY = Infinity;
    for (const pos of hexes) {
      const [ x, y ] = this.world.getHexPosition(pos.x, pos.y);
      const hex = this.world.getHex(pos.x, pos.y);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      hexPosititions.push([x, y]);
    }
    this.chunkOffset.set(chunkKey, [minX, minY]);
    this.chunkDirty.set(chunkKey, true);
    // TODO: why casting is required
    (terrainLayer as any).position.set((minX), (minY));
  }

  async render() {
    console.groupCollapsed('draw chunks');
    console.time('draw chunks');
    console.log(`Drawing ${this.chunkHexes.size} chunks`);
    for (const chunkKey of this.chunkHexes.keys()) {
      const terrainLayer = new CompositeRectTileLayer(0, [
        new PIXI.Texture(this.assets.hexSectionTileset.tilesetTexture),
      ]);
      this.chunkTileLayers.set(chunkKey, [terrainLayer]);
      this.chunksLayer.addChild(terrainLayer as any);
      this.setupChunk(chunkKey);
    }
    // await Promise.all(chunkPromises);
    console.timeEnd('draw chunks');
    console.groupEnd();
  }

  renderDebug() {
    // debug
    this.world.hexgrid.forEach(hex => {
      const point = hex.toPoint()
      const corners = hex.round().corners().map(corner => corner.add(point));
      const center = {
        x: hex.center().x + point.x,
        y: hex.center().y + point.y,
      };
      const [firstCorner, ...otherCorners] = corners

      // // terrain type indicator
      // const color = terrainColors[this.world.terrain.get(hex.x, hex.y)];
      // if (color) {
      //   this.debugGraphics.lineStyle(1, color);
      //   this.debugGraphics.beginFill(color);
      //   for (const direction of directionIndexOrder) {
      //     const [c1, c2] = directionCorners[direction];
      //     this.debugGraphics.drawPolygon([
      //       new PIXI.Point(corners[c1].x, corners[c1].y),
      //       new PIXI.Point(center.x, center.y),
      //       new PIXI.Point(corners[c2].x, corners[c2].y),
      //     ])
      //   }
      //   this.debugGraphics.endFill();
      // }

      // // draw grid lines
      // this.debugGraphics.lineStyle(1, 0xFFFFFF);
      // this.debugGraphics.moveTo(firstCorner.x, firstCorner.y)
      // otherCorners.forEach(({ x, y }) => this.debugGraphics.lineTo(x, y))
      // this.debugGraphics.lineTo(firstCorner.x, firstCorner.y)

      // rivers
      if (this.world.hexRiverEdges.containsKey(hex)) {
        this.debugGraphics.lineStyle(5, DEBUG_RIVER_COLOR);
        for (const [p1, p2] of this.world.hexRiverPoints.getValue(hex)) {
          this.debugGraphics.moveTo(p1.x, p1.y);
          this.debugGraphics.lineTo(p2.x, p2.y);
        }
      }

      // roads
      if (this.world.hexRoads.has(hex)) {
        this.debugGraphics.lineStyle(3, DEBUG_ROAD_COLOR);
        for (const direction of directionIndexOrder) {
          if (this.world.hexRoads.get(hex).get(direction)) {
            const [c1, c2] = directionCorners[direction];
            const x = (corners[c1].x + corners[c2].x) / 2;
            const y = (corners[c1].y + corners[c2].y) / 2;
            this.debugGraphics.moveTo(center.x, center.y);
            this.debugGraphics.lineTo(x, y);
          }
        }
      }
    });
  }
}