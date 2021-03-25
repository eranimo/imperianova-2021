import { Viewport } from 'pixi-viewport';
import { BehaviorSubject, Subject } from 'rxjs';
import { MapView } from 'structurae';
import { terrainColors } from '../game/world/terrain';
import { Coord, Size } from '../types';
import { Application, Container, ParticleContainer, Point, Sprite, Texture } from 'pixi.js';
import { WorldMapStateHex } from './worldMapState';
import { Assets, WorkerPointerEvent } from './WorldViewer.worker';
import { GlowFilter } from 'pixi-filters';
import { WorldMapManager } from './WorldMapManager';

export class WorldMinimap {
  container: Container;
  map: ParticleContainer;
  hexSprites: Map<number, Sprite>;
  minimapPan$: Subject<Point>;
  isDragging: boolean;
  getPoint: (event: WorkerPointerEvent) => Point;

  constructor(
    app: Application,
    public worldMapManager: WorldMapManager,
    private assets: Assets,
    private size: Size,
    viewport$: BehaviorSubject<Viewport>,
  ) {
    this.container = new Container();
    const width = worldMapManager.worldMapState.get('hexWidth');
    const height = worldMapManager.worldMapState.get('hexHeight');
    const maxSize = width * height;
    console.log('maxSize', maxSize);
    this.map = new ParticleContainer(maxSize, {
      tint: true,
    });
    this.container.addChild(this.map);
    app.stage.addChild(this.container);
    
    const worldWidth = worldMapManager.worldMapState.get('pointWidth');
    const worldHeight = worldMapManager.worldMapState.get('pointHeight');
    const scale = ([x, y]: Coord) => {
      return [
        (x / worldWidth) * size.width,
        (y / worldHeight) * size.height,
      ]
    }

    this.hexSprites = new Map();
    for (const hex of worldMapManager.hexes()) {
      const terrainType = hex.terrainType
      const hexSprite = new Sprite(assets.hexMask);
      hexSprite.tint = terrainColors[terrainType];
      const pos = scale([hex.posX, hex.posY]);
      hexSprite.position.set(pos[0], pos[1]);
      hexSprite.width = (assets.hexMask.width / worldWidth) * size.width;
      hexSprite.height = (assets.hexMask.height / worldHeight) * size.height;
      this.map.addChild(hexSprite);
      this.hexSprites.set(hex.index, hexSprite);
    }

    const frame = new Sprite(Texture.WHITE);
    const updateFrame = (viewport: Viewport) => {
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
    } as any) as any];

    viewport$.subscribe(viewport => {
      updateFrame(viewport);
    });
    this.container.addChild(frame);

    this.isDragging = false;
    this.minimapPan$ = new Subject();
    console.log(this);
    this.getPoint = (event: WorkerPointerEvent) => new Point(
      (event.x / size.width) * worldWidth,
      (event.y / size.height) * worldHeight
    );

    worldMapManager.dirty$.subscribe(() => {
      for (let i = 0; i < worldMapManager.hexLength; i++) {
        const hexSprite = this.hexSprites.get(i);
        hexSprite.tint = worldMapManager.mapMode$.value.setTile(i, worldMapManager);
      }
    });
  }

  pointerUp(event: WorkerPointerEvent) {
    this.isDragging = false;
    this.minimapPan$.next(this.getPoint(event));
  }

  pointerDown(event: WorkerPointerEvent) {
    this.isDragging = true;
    this.minimapPan$.next(this.getPoint(event));
  }

  pointerMove(event: WorkerPointerEvent) {
    if (this.isDragging) {
      this.minimapPan$.next(this.getPoint(event));
    }
  }

  pointerOut() {
    this.isDragging = false;
  }
}