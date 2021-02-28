import { CompositeRectTileLayer } from 'pixi-tilemap';
import * as PIXI from 'pixi.js';
import { cornerDirections, cornerIndexOrder, CornerMap, directionCorners, directionIndexOrder, DirectionMap } from './types';
import { Hex, World } from './World';
import { terrainColors, terrainTransitions, TerrainType } from './terrain';
import { HexTile, OFFSET_Y, tileSectionRenderOrder } from './hexTile';
import { Assets } from './AssetLoader';

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
  hexChunk: Map<string, string>;
  chunkHexes: Map<string, { x: number, y: number }[]>;
  chunkDrawTimes: Map<string, number>;
  chunksLayer: PIXI.Container;
  hexTiles: Map<Hex, HexTile>;

  constructor(private app: PIXI.Application, world: World, private assets: Assets) {
    this.world = world;
    this.debugGraphics = new PIXI.Graphics();
    this.worldWidth = this.world.hexgrid.pointWidth();
    this.worldHeight = this.world.hexgrid.pointHeight();
    this.chunksLayer = new PIXI.Container();

    this.hexTiles = new Map();
    
    this.chunkTileLayers = new Map();
    this.chunkDrawTimes = new Map();
    this.hexChunk = new Map();
    this.chunkHexes = new Map();
    const { width, height } = world.gridSize;

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

    this.onNewWorld(world);

    // setup events
    document.addEventListener('keyup', event => {
      if (event.key === 'g') {
        this.debugGraphics.visible = !this.debugGraphics.visible;
      }
    });
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

  private async drawChunk(chunkKey: string) {
    // console.log('draw chunk', chunkKey);
    const timeStart = Date.now();
    const [terrainLayer] = this.chunkTileLayers.get(chunkKey);
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
    // TODO: why casting is required
    (terrainLayer as any).position.set((minX), (minY));

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
      const [ x, y ] = hexPosititions[index];
      for (const texture of textures) {
        if (texture) {
          terrainLayer.addFrame(
            texture,
            (x - minX),
            (y - OFFSET_Y - minY),
          );
        }
      }

    });

    const timeEnd = Date.now();
    this.chunkDrawTimes.set(chunkKey, timeEnd - timeStart);
  }

  async render() {
    // this.worldTileset.updateTileset();

    console.groupCollapsed('draw chunks');
    console.time('draw chunks');
    console.log(`Drawing ${this.chunkHexes.size} chunks`);
    const bitmaps = [
      new PIXI.Texture(this.assets.hexSectionTileset.tilesetTexture),
    ];

    const chunkPromises: Promise<void>[] = [];
    for (const chunkKey of this.chunkHexes.keys()) {
      const terrainLayer = new CompositeRectTileLayer(0, bitmaps);
      this.chunkTileLayers.set(chunkKey, [terrainLayer]);
      this.chunksLayer.addChild(terrainLayer as any);
      // chunkPromises.push(this.drawChunk(chunkKey));
      await this.drawChunk(chunkKey);
      // this.worldTileset.updateTileset();
    }
    // await Promise.all(chunkPromises);
    console.timeEnd('draw chunks');
    // this.worldTileset.updateTileset();
    // this.worldTileset.saveTileStore();
    console.groupEnd();

    // const sprite = new PIXI.Sprite(this.worldTileset.renderTexture);
    // this.debugGraphics.addChild(sprite)
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

      // terrain type indicator
      this.debugGraphics.lineStyle(1, 0xFFFFFF);
      const color = terrainColors[this.world.terrain.get(hex.x, hex.y)];
      if (color) {
        this.debugGraphics.beginFill(color);
        this.debugGraphics.drawCircle(center.x, center.y, 5);
        this.debugGraphics.endFill();
      }
    });
  }
}