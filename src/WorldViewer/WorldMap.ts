import cull from 'pixi-cull';
import { CompositeRectTileLayer } from 'pixi-tilemap';
import { Viewport } from 'pixi-viewport';
import * as PIXI from 'pixi.js';
import { Subject } from 'rxjs';
import { OFFSET_Y } from '../game/world/hexTile';
import { terrainColors, TerrainType } from '../game/world/terrain';
import { calculateCentroidForHexes, Hex, World } from '../game/world/World';
import { adjacentDirections, Coord, CoordArray, Direction, directionCorners, directionIndexOrder } from '../types';
import { Color } from '../utils/Color';
import { Grid2D } from '../utils/Grid2D';
import { ObservableSet } from '../utils/ObservableSet';
import { Assets } from './AssetLoader';
import { Region, WorldMapRegions } from './WorldMapRegions';

const CHUNK_WIDTH = 10;
const CHUNK_HEIGHT = 10;

const DEBUG_RIVER_COLOR = 0x0000FF;
const DEBUG_ROAD_COLOR = 0x80530b;

class MapIcon extends PIXI.Container{
  sprite: PIXI.Sprite;

  constructor(filename: string) {
    super();

    // const t = PIXI.Texture.WHITE;
    // const s = new PIXI.Sprite(t);
    // s.width = 64;
    // s.height = 60;
    // s.anchor.set(0.5);
    // this.addChild(s);

    import(
      /* webpackMode: "lazy-once" */
      `../assets/icons/${filename}.svg`
    ).then((src) => {
      PIXI.Texture.fromURL(src.default).then(texture => {
        const sprite = new PIXI.Sprite(texture);
        this.sprite = sprite;
        sprite.width = 48;
        sprite.height = 48;
        sprite.tint = 0xC0C0C0;
        sprite.anchor.set(0.5);
        this.addChild(sprite);
      });
    });
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

export class WorldMap {
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
  regionLabels: Map<Region, MapLabel[]>;
  regionMap: WorldMapRegions;

  hexMapIcons: Map<Hex, string>;
  hexMapIconsSprites: Map<Hex, MapIcon>;
  iconsLayer: PIXI.Container;

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

    this.regionMap = new WorldMapRegions(this.world);

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
    this.iconsLayer = new PIXI.Container();
    this.hexMapIcons = new Map();
    this.hexMapIconsSprites = new Map();

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

    const updateRegionLabel = (region: Region) => {
      const labelPositions = region.calculateLabels();
      if (this.regionLabels.has(region)) {
        const labels = this.regionLabels.get(region);
        for (const label of labels) {
          this.labelContainer.removeChild(label);
        }
      }
      this.regionLabels.set(region, labelPositions.map(([x, y]) => {
        const label = new MapLabel(region.name, 16)
        label.position.set(x, y);
        this.labelContainer.addChild(label);
        return label;
      }));
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
      const labels = this.regionLabels.get(region)
      this.regionLabels.delete(region);
      for (const label of labels) {
        this.labelContainer.removeChild(label);
      }
    }

    this.regionMap.regions.added$.subscribe(region => {
      region.update();
      updateRegionLabel(region);
    });
    this.regionMap.regionHexAdded$.subscribe(([region]) => {
      console.log('region hex added', region);
      region.update();
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

  setIcon(hex: Hex, icon: string) {
    this.hexMapIcons.set(hex, icon);
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

      const hexSize = this.assets.hexTemplate.size;

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

      // icons
      if (this.hexMapIcons.has(hex)) {
        const iconName = this.hexMapIcons.get(hex);
        const mapIcon = new MapIcon(iconName);
        mapIcon.width = hexSize.width;
        mapIcon.height = hexSize.height;
        mapIcon.position.set(
          x + (hexSize.width / 2),
          y + (hexSize.height / 2),
        );
        this.hexMapIconsSprites.set(hex, mapIcon);
        this.iconsLayer.addChild(mapIcon);
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