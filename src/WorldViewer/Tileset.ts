import { Size } from 'src/types';
import { Texture, BaseTexture, Rectangle, } from 'pixi.js';

export type TilesetOptions = {
  tileSize: Size,
  columns: number,
  tilePadding: number,
}

export class Tileset {
  tileSize: Size;
  columns: number;
  tilePadding: number;
  private textureCache: Map<number, Texture>;

  constructor(
    public baseTexture: BaseTexture,
    options: TilesetOptions
  ) {
    this.tileSize = options.tileSize;
    this.columns = options.columns;
    this.tilePadding = options.tilePadding;

    this.textureCache = new Map();
  }

  getTile(index: number) {
    if (this.textureCache.has(index)) {
      return this.textureCache.get(index);
    }
    const { columns, tileSize, tilePadding } = this;
    const x = Math.round((index % columns) * (tileSize.width + tilePadding));
    const y = Math.round((Math.floor(index / columns)) * (tileSize.height + tilePadding))
    const texture = new Texture(
      this.baseTexture,
      new Rectangle(x, y, tileSize.width, tileSize.height)
    );
    this.textureCache.set(index, texture);
    return texture;
  }
}