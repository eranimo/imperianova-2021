import { CompositeRectTileLayer } from 'pixi-tilemap';
import * as PIXI from 'pixi.js';
import { cornerDirections, cornerIndexOrder, CornerMap, directionCorners, directionIndexOrder, DirectionMap, Coord } from './types';
import { Hex, World } from './World';
import { terrainColors, terrainTransitions, TerrainType } from './terrain';
import { HexTile, OFFSET_Y, tileSectionRenderOrder } from './hexTile';
import { Assets } from './AssetLoader';
import cull from 'pixi-cull';
import SimplexNoise from 'simplex-noise';
import { Viewport } from 'pixi-viewport';
import { chunk } from 'lodash';

const CHUNK_WIDTH = 10;
const CHUNK_HEIGHT = 10;

const DEBUG_RIVER_COLOR = 0x0000FF;
const DEBUG_ROAD_COLOR = 0x80530b;


export class WorldRenderer {
  public world: World;
  public debugGraphics: PIXI.Graphics;
  public worldWidth: number;
  public worldHeight: number;

  chunkTileLayers: Map<string, CompositeRectTileLayer[]>;
  chunkLayerToChunk: Map<CompositeRectTileLayer, string>;
  chunkOffset: Map<string, Coord>;
  chunkDirty: Map<string, boolean>;
  hexChunk: Map<string, string>;
  chunkHexes: Map<string, { x: number, y: number }[]>;
  chunkDrawTimes: Map<string, number>;
  chunksLayer: PIXI.Container;
  overlayLayer: PIXI.ParticleContainer;
  hexOverlaySprites: Map<Hex, PIXI.Sprite>;
  cull: cull.Simple;

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
    this.hexChunk = new Map();
    this.chunkHexes = new Map();
    const { width, height } = world.gridSize;

    this.hexOverlaySprites = new Map();
    this.overlayLayer = new PIXI.ParticleContainer(width * height, { tint: true });

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x += 2) {
        const { chunkX, chunkY } = this.getChunkForCoordinate(x, y);
        const chunkKey = `${chunkX},${chunkY}`;
        if (!this.chunkHexes.has(chunkKey)) {
          this.chunkHexes.set(chunkKey, []);
        }
        this.chunkHexes.get(chunkKey).push({ x, y });
        this.hexChunk.set(`${x},${y}`, chunkKey);
      }

      for (let x = 1; x < width; x += 2) {
        const { chunkX, chunkY } = this.getChunkForCoordinate(x, y);
        const chunkKey = `${chunkX},${chunkY}`;
        if (!this.chunkHexes.has(chunkKey)) {
          this.chunkHexes.set(chunkKey, []);
        }
        this.chunkHexes.get(chunkKey).push({ x, y });
        this.hexChunk.set(`${x},${y}`, chunkKey);
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
      }
    });
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
      const overlaySprite = new PIXI.Sprite(this.assets.hexTemplate.fullHex);
      overlaySprite.tint = terrainColors[terrainType];
      overlaySprite.position.set(x, y);
      overlaySprite.width = this.assets.hexTemplate.size.width;
      overlaySprite.height = this.assets.hexTemplate.size.height;
      this.overlayLayer.addChild(overlaySprite);
      this.hexOverlaySprites.set(hex, overlaySprite);
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
    for (const hex of hexes) {
      const [ x, y ] = this.world.getHexPosition(hex.x, hex.y);
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

      // draw grid lines
      this.debugGraphics.lineStyle(1, 0xFFFFFF);
      this.debugGraphics.moveTo(firstCorner.x, firstCorner.y)
      otherCorners.forEach(({ x, y }) => this.debugGraphics.lineTo(x, y))
      this.debugGraphics.lineTo(firstCorner.x, firstCorner.y)

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