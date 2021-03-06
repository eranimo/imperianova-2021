import { World, Hex } from '../game/world/World';
import { ColorArray, Size, Coord, CornerMap } from '../types';
import { GlowFilter, OutlineFilter } from 'pixi-filters';
import { Subject, BehaviorSubject } from 'rxjs';
import { Viewport } from 'pixi-viewport';
import { terrainColors } from '../game/world/terrain';
import { Assets } from './AssetLoader';


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
      const hexSprite = new PIXI.Sprite(assets.hexTemplate.fullHex);
      hexSprite.tint = terrainColors[terrainType];
      hexSprite.position.set(
        position[0],
        position[1],
      );
      hexSprite.width = (assets.hexTemplate.size.width / worldWidth) * size.width;
      hexSprite.height = (assets.hexTemplate.size.height / worldHeight) * size.height;
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
      distance: 2,
      outerStrength: 2,
      innerStrength: 2,
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