import { Size } from '../types';


export class HexTemplate {
  baseTexture: PIXI.BaseTexture;
  fullHex: PIXI.Texture;
  size: Size;

  constructor(
    template: PIXI.LoaderResource,
  ) {
    this.size = { width: 64, height: 60 };
    const templateImage = (template.texture.baseTexture.resource as any).source as HTMLImageElement;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.drawImage(templateImage, 0, 0);
    const tileWidth = templateImage.width;
    const tileHeight = templateImage.height;
    const textureBuffer = new Float32Array(tileWidth * tileHeight * 4);
    const imageData = ctx.getImageData(0, 0, tileWidth, tileHeight);
    for (let x = 0; x < tileWidth; x++) {
      for (let y = 0; y < tileWidth; y++) {
        const index = (x + y * tileWidth) * 4;
        if (
          imageData.data[index] === 0 &&
          imageData.data[index + 1] === 0 &&
          imageData.data[index + 2] === 0 &&
          imageData.data[index + 3] === 0
        ) {
          textureBuffer[index] = 0;
          textureBuffer[index + 1] = 0;
          textureBuffer[index + 2] = 0;
          textureBuffer[index + 3] = 0;
        } else {
          textureBuffer[index] = 1.0;
          textureBuffer[index + 1] = 1.0;
          textureBuffer[index + 2] = 1.0;
          textureBuffer[index + 3] = 1.0;
        }
      }
    }
    const texture = PIXI.Texture.fromBuffer(textureBuffer, tileWidth, tileHeight);
    this.baseTexture = texture.baseTexture;

    this.fullHex = new PIXI.Texture(this.baseTexture, new PIXI.Rectangle(
      0, 0, this.size.width, this.size.height,
    ));
  }
}