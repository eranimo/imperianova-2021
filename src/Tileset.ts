import { Size } from './types';

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
    protected def: XMLDocument,
    parseTile: (rawTileData: { [name: string]: string }) => T,
  ) {
    const tileset = def.children[0];
    this.tileSize = {
      width: parseInt(tileset.attributes['tilewidth'].value, 10),
      height: parseInt(tileset.attributes['tileheight'].value, 10),
    };
    this.columns = parseInt(tileset.attributes['columns'].value, 10);
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

    for (const childNode of Array.from(tileset.children)) {
      if (childNode.nodeName === 'tile') {
        const id = parseInt(childNode.id, 10);
        let properties = {};
        for (const prop of Array.from(childNode.children[0].children)) {
          properties[prop.attributes['name'].value] = prop.attributes['value'].value;
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
  }
}