import { World, Hex } from './World';
import { Assets, ColorArray, Size, Coord, CornerMap } from './types';
import { GlowFilter, OutlineFilter } from 'pixi-filters';
import { Subject, BehaviorSubject } from 'rxjs';
import { Viewport } from 'pixi-viewport';
import { terrainColors } from './terrain';


export class WorldMinimap {
  container: PIXI.Container;
  map: PIXI.ParticleContainer;
  hexSprites: Map<Hex, PIXI.Sprite>;
  minimapPan: Subject<PIXI.Point>;

  constructor(
    app: PIXI.Application,
    public world: World,
    private assets: Assets,
    private size: Size,
    viewport$: BehaviorSubject<Viewport>,
  ) {
    this.container = new PIXI.Container();
    this.map = new PIXI.ParticleContainer(world.gridSize.width * world.gridSize.height, {
      tint: true,
    });
    this.container.addChild(this.map);
    app.stage.addChild(this.container);

    const templateImage = (assets.hexTemplate.texture.baseTexture.resource as any).source as HTMLImageElement;
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
    
    const worldWidth = world.hexgrid.pointWidth();
    const worldHeight = world.hexgrid.pointHeight();
    const scale = ([x, y]: Coord) => {
      return [
        (x / worldWidth) * size.width,
        (y / worldHeight) * size.height,
      ]
    }

    this.hexSprites = new Map();
    world.hexgrid.forEach(hex => {
      const position = scale(this.world.getHexPosition(hex.x, hex.y));
      const terrainType = this.world.getTerrainForCoord(hex.x, hex.y);
      const hexSprite = new PIXI.Sprite(texture);
      hexSprite.tint = terrainColors[terrainType];
      hexSprite.position.set(
        position[0],
        position[1],
      );
      hexSprite.width = (tileWidth / worldWidth) * size.width;
      hexSprite.height = (tileHeight / worldHeight) * size.height;
      this.map.addChild(hexSprite);
      this.hexSprites.set(hex, hexSprite);
    });

    const frame = new PIXI.Sprite(PIXI.Texture.WHITE);
    frame.interactive = false;
    const updateFrame = viewport => {
      frame.width = (viewport.worldScreenWidth / worldWidth) * size.width;
      frame.height = (viewport.worldScreenHeight / worldHeight) * size.height;
      frame.position.set(
        (viewport.left / worldWidth) * size.width,
        (viewport.top / worldHeight) * size.height,
      );
    }
    updateFrame(viewport$.value);
    frame.filters = [new GlowFilter({
      color: 0xFFFFFF,
      distance: devicePixelRatio,
      outerStrength: devicePixelRatio,
      innerStrength: devicePixelRatio,
      knockout: true,
    })];

    viewport$.subscribe(viewport => {
      updateFrame(viewport);
    });
    this.container.addChild(frame);

    let isDragging = false;
    this.minimapPan = new Subject();
    const getPoint = event => new PIXI.Point(
      (event.data.global.x / size.width) * worldWidth,
      (event.data.global.y / size.height) * worldHeight
    );
    app.renderer.plugins.interaction.on('pointerup', (event) => {
      isDragging = false;
      this.minimapPan.next(getPoint(event));
    });
    app.renderer.plugins.interaction.on('pointerdown', (event) => {
      isDragging = true;
      this.minimapPan.next(getPoint(event));
    });
    app.renderer.plugins.interaction.on('pointermove', (event) => {
      if (isDragging) {
        this.minimapPan.next(getPoint(event));
      }
    });
  }

  updateHexColors(
    getColor: (hex: Hex) => number,
  ) {
    console.log('update minimap hexes');
    this.world.hexgrid.forEach(hex => {
      const hexSprite = this.hexSprites.get(hex);
      hexSprite.tint = getColor(hex);
    });
  }
}