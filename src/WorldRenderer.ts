import { CompositeRectTileLayer } from 'pixi-tilemap';
import * as PIXI from 'pixi.js';
import { Direction } from './types';
import { colorToNumber } from './utils';
import { EdgeFeature, HexFeature, TerrainType, World, terrainColors } from './World';
import { WorldTileset } from './WorldTileset';

const CHUNK_WIDTH = 10;
const CHUNK_HEIGHT = 10;

export class WorldRenderer {
  public world: World;
  public debugGraphics: PIXI.Graphics;
  public worldWidth: number;
  public worldHeight: number;

  chunkTileLayers: Map<string, CompositeRectTileLayer[]>;
  hexChunk: Map<string, string>;
  chunkHexes: Map<string, { x: number, y: number }[]>;
  worldTileset: WorldTileset;
  chunksLayer: PIXI.Container;

  constructor(private app: PIXI.Application, world: World) {
    this.world = world;
    this.debugGraphics = new PIXI.Graphics();
    this.worldWidth = this.world.hexgrid.pointWidth();
    this.worldHeight = this.world.hexgrid.pointHeight();
    this.chunksLayer = new PIXI.Container();
    this.worldTileset = new WorldTileset(this.app.renderer);
    console.log(this.worldTileset);
    
    this.chunkTileLayers = new Map();
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

    this.render();

    // setup events
    document.addEventListener('keyup', event => {
      if (event.key === 'g') {
        this.debugGraphics.visible = !this.debugGraphics.visible;
      }
    });
  }

  private getChunkForCoordinate(x: number, y: number) {
    const y2 = x % 2 + y * 2;
    const chunkY = y2 / CHUNK_HEIGHT | 0;
    const chunkX = (x + (y2 % CHUNK_HEIGHT)) / CHUNK_WIDTH | 0;
    return { chunkX, chunkY };
  }

  private drawChunk(chunkKey: string) {
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

    hexes.forEach((hex, index) => {
      const terrainType = this.world.getTerrainForCoord(hex.x, hex.y);
      if (terrainType === TerrainType.MAP_EDGE) return;
      const hexTileID = this.worldTileset.getTile({
        terrainType,
        terrainTransitions: this.world.getHexNeighborTerrain(hex.x, hex.y),
        edgeFeatures: {
          [Direction.SE]: EdgeFeature.NONE,
          [Direction.NE]: EdgeFeature.NONE,
          [Direction.N]: EdgeFeature.NONE,
          [Direction.NW]: EdgeFeature.NONE,
          [Direction.SW]: EdgeFeature.NONE,
          [Direction.S]: EdgeFeature.NONE,
        },
        hexFeature: HexFeature.NONE,
      });
      const texture = this.worldTileset.getTextureForID(hexTileID);
      const [ x, y ] = hexPosititions[index];
      if (texture) {
        terrainLayer.addFrame(
          texture,
          (x - minX),
          (y - minY),
        );
      }
    });
  }

  render() {
    console.time('drawHexTile');
    
    this.worldTileset.updateTileset();
    console.timeEnd('drawHexTile');

    console.groupCollapsed('draw chunks');
    console.time('draw chunks');
    console.log(`Drawing ${this.chunkHexes.size} chunks`);
    const bitmaps = [
      new PIXI.Texture(this.worldTileset.renderTexture.baseTexture),
    ];
    for (const chunkKey of this.chunkHexes.keys()) {
      const terrainLayer = new CompositeRectTileLayer(0, bitmaps);
      this.chunkTileLayers.set(chunkKey, [terrainLayer]);
      this.chunksLayer.addChild(terrainLayer as any);
      this.drawChunk(chunkKey);
    }
    this.worldTileset.updateTileset();
    console.timeEnd('draw chunks');
    console.groupEnd();

    // const sprite = new PIXI.Sprite(this.worldTileset.renderTexture);
    // this.debugGraphics.addChild(sprite);


    // debug
    this.debugGraphics.lineStyle(1, 0xFFFFFF)
    this.world.hexgrid.forEach(hex => {
      const point = hex.toPoint()
      const corners = hex.round().corners().map(corner => corner.add(point));
      const center = {
        x: hex.center().x + point.x,
        y: hex.center().y + point.y,
      };
      const [firstCorner, ...otherCorners] = corners

      // draw grid lines
      this.debugGraphics.moveTo(firstCorner.x, firstCorner.y)
      otherCorners.forEach(({ x, y }) => this.debugGraphics.lineTo(x, y))
      this.debugGraphics.lineTo(firstCorner.x, firstCorner.y)

      // draw terrain type indicator
      const color = terrainColors[this.world.terrain.get(hex.x, hex.y)];
      if (color) {
        this.debugGraphics.beginFill(color);
        this.debugGraphics.drawCircle(center.x, center.y, 5);
        this.debugGraphics.endFill();
      }
    });
  }
}