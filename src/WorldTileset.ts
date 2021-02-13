import localForage from 'localforage';
import ndarray from 'ndarray';
import * as PIXI from 'pixi.js';
import { CellType, cellTypeColor, cornerCellTypes, cornerSideCellTypes, directionCellTypes, getHexTileID, HexTile, OFFSET_Y } from './hexTile';
import { Assets, ColorArray, cornerIndexOrder, directionIndexOrder } from './types';
import { colorArrayMatches } from './utils';
import { spawn, Pool, Worker } from 'threads';
import { ExportedTileset } from './Tileset';
import TileRendererWorker from 'worker-loader!./workers/tileRenderer.worker';
import { reject } from 'lodash';


const ENABLE_TILE_CACHE = false;
const TILE_RENDERER_POOL_SIZE = 8;

localForage.config({
  driver: localForage.INDEXEDDB,
  name: 'tileStore',
});

export class WorldTileset {
  public renderTexture: PIXI.RenderTexture;
  public texture: PIXI.Texture;
  private container: PIXI.Container;
  private hexTileMap: Map<number, HexTile>;
  private hexTileSprite: Map<number, PIXI.Sprite>;
  private hexTileTexture: Map<number, PIXI.Texture>;
  private tileIDToIndex: Map<number, number>;
  tileBufferStore: { [tileID: number]: Float32Array };
  public numTiles: number;
  templateGrid: ndarray;
  tileRenderWorkerPool: any;
  autogenObjectTilesetExport: ExportedTileset;
  templateGridBuffer: SharedArrayBuffer;

  constructor(
    private renderer: PIXI.Renderer,
    private assets: Assets,
  ) {
    console.time('geenrate world tileset');
    console.timeEnd('geenrate world tileset');
    this.hexTileMap = new Map();
    this.hexTileSprite = new Map();
    this.hexTileTexture = new Map();
    this.container = new PIXI.Container();
    const rt = new PIXI.BaseRenderTexture({
      width: this.pixelWidth,
      height: this.pixelHeight,
      scaleMode: PIXI.SCALE_MODES.NEAREST,
      resolution: 1
    })
    this.renderTexture = new PIXI.RenderTexture(rt);
    this.tileIDToIndex = new Map();
    this.tileBufferStore = {};
    this.numTiles = 0;
    this.tileRenderWorkerPool = Pool(() => spawn(new TileRendererWorker()), TILE_RENDERER_POOL_SIZE);

    // generate template grid buffer
    this.templateGridBuffer = new SharedArrayBuffer(this.tileWidth * this.tileHeight * Uint8Array.BYTES_PER_ELEMENT);
    this.templateGrid = ndarray(new Uint8Array(this.templateGridBuffer), [this.tileWidth, this.tileHeight]);
    const templateImage = (assets.hexTemplate.texture.baseTexture.resource as any).source as HTMLImageElement;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.drawImage(templateImage, 0, 0);
    const imageData = ctx.getImageData(0, 0, this.tileWidth, this.tileHeight);
    for (let x = 0; x < this.tileWidth; x++) {
      for (let y = 0; y < this.tileWidth; y++) {
        const index = (x + y * this.tileWidth) * 4;
        this.templateGrid.set(x, y, CellType.NONE);
        const thisColor: ColorArray = [
          imageData.data[index],
          imageData.data[index + 1],
          imageData.data[index + 2],
        ];
       
        for (const direction of directionIndexOrder) {
          const cellType = directionCellTypes[direction];
          const color = cellTypeColor[cellType];
          if (colorArrayMatches(color, thisColor)) {
            this.templateGrid.set(x, y, cellType);
          }
        }

        for (const corner of cornerIndexOrder) {
          const cellType = cornerCellTypes[corner];
          const color = cellTypeColor[cellType];
          if (colorArrayMatches(color, thisColor)) {
            this.templateGrid.set(x, y, cellType);
          }

          for (let i = 0; i <= 1; i++) {
            const cellType = cornerSideCellTypes[corner][i];
            const color = cellTypeColor[cellType];
            if (colorArrayMatches(color, thisColor)) {
              this.templateGrid.set(x, y, cellType);
            }
          }
        }
      }
    }
    console.log('template grid', this.templateGrid);
    this.autogenObjectTilesetExport = this.assets.autogenObjects.export();
  }

  async load() {
    if (ENABLE_TILE_CACHE) {
      this.tileBufferStore = (await localForage.getItem('tileBufferStore')) || {};
    }
  }

  static COLUMNS = 200;
  static PADDING = 10;
  static MAX_TILES = 20_000;

  get tileWidth() {
    return this.assets.hexTemplate.texture.baseTexture.width;
  }

  get tileHeight() {
    return this.assets.hexTemplate.texture.baseTexture.width;
  }

  get tileOffset() {
    return 0;
  }

  get pixelWidth() {
    return WorldTileset.COLUMNS * (this.tileWidth + WorldTileset.PADDING);
  }

  get pixelHeight() {
    return this.rows * (this.tileHeight + this.tileOffset + WorldTileset.PADDING);
  }

  get rows() {
    return Math.ceil(WorldTileset.MAX_TILES / WorldTileset.COLUMNS);
  }

  private async renderHexTile(hexTile: HexTile): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      try {
        this.tileRenderWorkerPool.queue(async worker => {
          const tileBuffer: ArrayBuffer = await worker(
            hexTile,
            this.tileWidth,
            this.tileHeight + OFFSET_Y,
            this.templateGridBuffer,
            { width: this.tileWidth, height: this.tileHeight },
            this.autogenObjectTilesetExport,
          );
          // console.log('render worker returned', tileBuffer);
          resolve(new Float32Array(tileBuffer));
        });
      } catch (err) {
        console.error(err);
        reject(err);
      }
    });
  }

  /**
   * (re)generates a HexTile
   * @param hexTile HexTile
   * @returns HexTile ID
   */
  private async generateTile(hexTile: HexTile): Promise<number> {
    // console.log('generating', hexTile);
    const id = getHexTileID(hexTile);
    const index = this.numTiles;
    this.numTiles++;
    this.tileIDToIndex.set(id, index);
    // console.time(`generating hex ID ${id}`);
    let tileBuffer = this.tileBufferStore[id];
    if (!tileBuffer) {
      tileBuffer = await this.renderHexTile(hexTile);
      this.tileBufferStore[id] = tileBuffer;
    }

    const texture = PIXI.Texture.fromBuffer(tileBuffer, this.tileWidth, this.tileHeight + OFFSET_Y);
    const sprite = new PIXI.Sprite(texture);
    this.hexTileMap.set(id, hexTile);
    sprite.position.set(
      (index % WorldTileset.COLUMNS) * (this.tileWidth + WorldTileset.PADDING),
      (Math.floor(index / WorldTileset.COLUMNS)) * (this.tileHeight + this.tileOffset + WorldTileset.PADDING),
    );
    this.container.addChild(sprite);
    this.hexTileSprite.set(id, sprite);
    // console.timeEnd(`generating hex ID ${id}`);
    return id;
  }

  /**
   * Gets a HexTile, cached
   * @param hexTile HexTile
   * @returns HexTile ID
   */
  public async getTile(hexTile: HexTile): Promise<number> {
    const id = getHexTileID(hexTile);
    if (!this.hexTileMap.has(id)) {
      return this.generateTile(hexTile);
    }
    return id;
  }

  getTileID(hexTile: HexTile) {
    return getHexTileID(hexTile);
  }

  /**
   * Gets the texture for a HexTile (used in pixi-tilemap)
   * @param id HexTile ID
   * @returns Texture of HexTile (may or may not be rendered)
   */
  public getTextureForID(id: number): PIXI.Texture {
    if (this.hexTileTexture.has(id)) {
      return this.hexTileTexture.get(id);
    }
    const index = this.tileIDToIndex.get(id);
    const texture = new PIXI.Texture(this.renderTexture.baseTexture, new PIXI.Rectangle(
      (index % WorldTileset.COLUMNS) * (this.tileWidth + WorldTileset.PADDING),
      (Math.floor(index / WorldTileset.COLUMNS)) * (this.tileHeight + this.tileOffset + WorldTileset.PADDING),
      this.tileWidth + WorldTileset.PADDING,
      this.tileHeight + this.tileOffset + WorldTileset.PADDING,
    ));
    this.hexTileTexture.set(id, texture);
    return texture;
  }

  public updateTileset() {
    localForage.setItem('tileBufferStore', this.tileBufferStore);
    this.renderer.render(this.container, this.renderTexture);
  }
}