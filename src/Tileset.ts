import { Size, ExportedTileset } from './types';

export type TilesetTile<T> =  {
  id: number;
  properties: T,
}

export class Tileset<T> {
  tileSize: Size;
  columns: number;
  baseTexture: PIXI.BaseTexture;
  tiles: Map<number, TilesetTile<T>>;
  tileFrame: Map<number, PIXI.Rectangle>;
  tileTexture: Map<number, PIXI.Texture>;
  imageData: ImageData;

  constructor(
    protected resourceTexture: PIXI.Texture,
    protected def: any,
    parseTile: (rawTileData: { [name: string]: string }) => T,
  ) {
    this.tileSize = {
      width: parseInt(def.tileset.$.tilewidth, 10),
      height: parseInt(def.tileset.$.tileheight, 10),
    };
    this.columns = parseInt(def.tileset.$.columns, 10);
    this.baseTexture = resourceTexture.baseTexture;

    const templateImage = (resourceTexture.baseTexture.resource as any).source as HTMLImageElement;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.drawImage(templateImage, 0, 0);
    this.imageData = ctx.getImageData(0, 0, this.baseTexture.width, this.baseTexture.height);

    // load tiles
    this.tiles = new Map();
    this.tileFrame = new Map();
    this.tileTexture = new Map();

    for (const tileDef of def.tileset.tile) {
      const id = parseInt(tileDef.$.id, 10);
      let properties = {};
      for (const prop of tileDef.properties[0].property) {
        properties[prop.$.name] = prop.$.value;
      }
      const tile: TilesetTile<T> = {
        id,
        properties: parseTile(properties), 
      };
      this.tiles.set(id, tile);
      const x = (id % this.columns) * this.tileSize.width;
      const y = (Math.floor(id / this.columns)) * this.tileSize.height;
      const frame = new PIXI.Rectangle(
        x, y,
        this.tileSize.width,
        this.tileSize.height,
      );
      this.tileFrame.set(id, frame);
      this.tileTexture.set(id, new PIXI.Texture(this.baseTexture, frame));
    }
  }

  export(): ExportedTileset {
    const buffer = this.imageData.data;
    const tiles = {};
    for (const [tileID, frame] of this.tileFrame) {
      tiles[tileID] = {
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
      };
    }
    return { buffer, tiles, size: { width: this.imageData.width, height: this.imageData.height } };
  }
}