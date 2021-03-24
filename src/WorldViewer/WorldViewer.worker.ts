import { expose } from 'threads/worker';
import './patch';
import { Viewport, Plugin } from 'pixi-viewport';
import { Tileset } from './Tileset';
import { HexSectionTileset } from './HexSectionTileset';
import { decode } from 'fast-png';
import tilesetJson from '../assets/tileset.json';
import { Application, Sprite, Texture, Point, Container } from 'pixi.js';
import { WorldMapState } from './worldMapState';
import { WorldMinimap } from './WorldMinimap';
import { MapView } from 'structurae';
import { BehaviorSubject } from 'rxjs';
import { WorldMapManager } from './WorldMapManager';
import { WorldMap } from './WorldMap';
import { MapModeType } from './mapMode';

export type Assets = {
  borderTileset: Tileset,
  gridTexture: Texture,
  hexMask: Texture,
  hexTemplate: Tileset,
  hexSectionTileset: HexSectionTileset,
};

interface IAssetContext {
  isLoading: boolean,
  assets: Assets | null
}

export type KeyDirection = 'up' | 'down' | 'left' | 'right';

let app: Application;
let worldMapManager: WorldMapManager;
let worldMap: WorldMap;
let minimap: WorldMinimap;
let viewport: Viewport & Container;
let canvases: {
  worldmap: OffscreenCanvas,
  minimap: OffscreenCanvas,
};
let zoomCallback: Function;
let worldMapState: MapView;
let viewport$: BehaviorSubject<Viewport>;

function setupState(
  worldMapStateBuffer: SharedArrayBuffer,
) {
  worldMapState = new WorldMapState(worldMapStateBuffer);

  console.log('worldMapState', worldMapState);
  console.log(worldMapState.get('hexes').length);
  console.log(worldMapState.get('hexes')[0]);
  console.log(worldMapState.toJSON());
}

function setupApp(
  worldMapCanvas: OffscreenCanvas,
  minimapCanvas: OffscreenCanvas,
  assets: Assets,
  resolution: number,
) {
  canvases = {
    worldmap: worldMapCanvas,
    minimap: minimapCanvas,
  };
  app = new Application({
    width: worldMapCanvas.width,
    height: worldMapCanvas.height,
    antialias: false,
    resolution: 1,
    view: worldMapCanvas as any,
  });

  const divWheelMock = {
    addEventListener: (type, callback) => {
      zoomCallback = callback;
    },
  }

  viewport = new Viewport({
    screenWidth: worldMapCanvas.width,
    screenHeight: worldMapCanvas.height,
    worldWidth: worldMapState.get('pointWidth'),
    worldHeight: worldMapState.get('pointHeight'),
    divWheel: divWheelMock as any,
  }) as any;
  viewport.wheel().drag().decelerate();
  app.stage.addChild(viewport as any);

  viewport.on('moved', event => {
    viewport$.next(viewport);
  })
  viewport$ = new BehaviorSubject<Viewport>(viewport);

  // setup worldmap
  worldMapManager = new WorldMapManager(worldMapState);
  worldMap = new WorldMap(worldMapManager, assets);
  viewport.removeChildren();
  viewport.addChild(worldMap.chunksLayer as any);
  viewport.addChild(worldMap.overlayLayer as any);
  viewport.addChild(worldMap.riversLayer as any);
  viewport.addChild(worldMap.roadsLayer as any);
  viewport.addChild(worldMap.gridLayer as any);
  viewport.addChild(worldMap.regionLayer as any);
  viewport.addChild(worldMap.iconsLayer as any);
  viewport.addChild(worldMap.debugGraphics as any);
  viewport.addChild(worldMap.labelContainer as any);

  viewport$.subscribe(() => {
    worldMap.onViewportMoved(viewport);
  });

  // setup minimap
  const minimapApp = new Application({
    width: minimapCanvas.width,
    height: minimapCanvas.height,
    antialias: false,
    resolution,
    view: minimapCanvas as any,
  });
  minimap = new WorldMinimap(minimapApp, worldMapState, assets, {
    width: minimapCanvas.width / resolution,
    height: minimapCanvas.height / resolution,
  }, viewport$);

  minimap.minimapPan$.subscribe(point => {
    viewport.moveCenter(point);
    viewport$.next(viewport);
  });

  // const bg = new Sprite(Texture.WHITE);
  // bg.width = worldMapState.get('pointWidth');
  // bg.height = worldMapState.get('pointHeight');
  // bg.position.set(0, 0);
  // bg.tint = 0x333333;
  // viewport.addChild(bg as any);
  // const sprite = new Sprite(assets.hexMask);
  // sprite.position.set(0, 0);
  // viewport.addChild(sprite as any);
}

type LoaderType = 'png' | 'json';

class Loader {
  promises: Array<Promise<string | ArrayBuffer>> = [];
  assets: { name: string, type: LoaderType }[] = [];

  add(name: string, type: LoaderType, url: string) {
    if (type === 'png') {
      this.promises.push(
        fetch(url).then(resp => resp.arrayBuffer())
      );
    } else if (type === 'json') {
      this.promises.push(
        fetch(url).then(resp => resp.json())
      );
    }
    this.assets.push({ name, type });
  }

  async load(): Promise<Record<string, any>> {
    const response = await Promise.all(this.promises);
    const resources = {};
    for (const [index, asset] of this.assets.entries()) {
      const assetValue = response[index];
      if (assetValue instanceof ArrayBuffer) {
        const { data, width, height } = decode(assetValue);
        const texture = Texture.fromBuffer(data as any, width, height);
        resources[asset.name] = texture;
      } else {
        resources[asset.name] = assetValue;
      }
    }
    return resources;
  }
}

export type WorkerPointerEvent = {
  pointerId: number,
  pointerType: string,
  button: number,
  x: number,
  y: number,
};

const createMockPointerEvent = (event: WorkerPointerEvent) => ({
  data: {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    global: new Point(event.x, event.y),
    button: event.button,
  }
});

const worker = {
  async init(
    worldMapCanvas: OffscreenCanvas,
    minimapCanvas: OffscreenCanvas,
    worldMapStateBuffer: SharedArrayBuffer,
    resolution: number,
  ) {
    const loader = new Loader();
    loader.add('hexMask', 'png', require('../assets/hex-mask.png'))
    loader.add('hexTemplate', 'png', require('../assets/hex-template.png'))
    loader.add('autogenObjectsPNG', 'png', require('../assets/autogen-objects.png'))
    loader.add('tilesetPNG', 'png', require('../assets/tileset.png'))
    loader.add('gridTexture', 'png', require('../assets/grid.png'))
    loader.add('borderTileset', 'png', require('../assets/borders.png'))
    loader.add('tilesetJson', 'json', tilesetJson as any)
    const resources = await loader.load();
    console.log('resources', resources);
    const assets: Assets = {
      borderTileset: new Tileset(resources.borderTileset.baseTexture, {
        tileSize: { width: 64, height: 60 },
        columns: 6,
        tilePadding: 0,
      }),
      hexTemplate: new Tileset(resources.hexTemplate, {
        tileSize: { width: 64, height: 60 },
        columns: 6,
        tilePadding: 0,
      }),
      gridTexture: resources.gridTexture,
      hexMask: resources.hexMask,
      hexSectionTileset: new HexSectionTileset(resources.tilesetJson, resources.tilesetPNG.baseTexture),
    };
    console.log('assets', assets);
    setupState(worldMapStateBuffer);
    setupApp(worldMapCanvas, minimapCanvas, assets, resolution);
  },

  viewportResize(width: number, height: number) {
    console.log('(worker) window resize', width, height);
    canvases.worldmap.width = width;
    canvases.worldmap.height = height;
    app.renderer.resize(width, height);
    viewport.resize(width, height);
  },

  viewportMove(keys: Record<KeyDirection, boolean>) {
    const SPEED = 100;
    const pos = new Point(0, 0);

    if (keys.up) {
      pos.y -= SPEED;
    }
    if (keys.down) {
      pos.y += SPEED;
    }
    if (keys.left) {
      pos.x -= SPEED;
    }
    if (keys.right) {
      pos.x += SPEED;
    }
    viewport.animate({
      time: 100,
      position: new Point(
        viewport.center.x + pos.x,
        viewport.center.y + pos.y,
      ),
    })
  },

  viewportZoom(event: {
    deltaX: number,
    deltaY: number,
    deltaZ: number,
    deltaMode: number,
    x: number,
    y: number,
  }) {
    const eventMocked = event as any;
    eventMocked.preventDefault = () => {};
    eventMocked.clientX = event.x;
    eventMocked.clientY = event.y;
    (viewport.plugins as any).wheel(eventMocked);
  },

  viewportPointerDown(event: WorkerPointerEvent) {
    viewport.emit('pointerdown', createMockPointerEvent(event));
  },

  viewportPointerMove(event: WorkerPointerEvent) {
    viewport.emit('pointermove', createMockPointerEvent(event));
  },

  viewportPointerUp(event: WorkerPointerEvent) {
    viewport.emit('pointerup', createMockPointerEvent(event));
  },

  viewportPointerCancel(event: WorkerPointerEvent) {
    viewport.emit('pointercancel', createMockPointerEvent(event));
  },

  viewportPointerOut(event: WorkerPointerEvent) {
    viewport.emit('pointerout', createMockPointerEvent(event));
  },

  minimapPointerUp(event: WorkerPointerEvent) {
    minimap.pointerUp(event);
  },

  minimapPointerDown(event: WorkerPointerEvent) {
    minimap.pointerDown(event);
  },

  minimapPointerMove(event: WorkerPointerEvent) {
    minimap.pointerMove(event);
  },

  minimapPointerOut(event: WorkerPointerEvent) {
    minimap.pointerOut();
  },

  changeMapMode(mapModeType: MapModeType) {
    worldMapManager.setMapMode(mapModeType);
  },
};
expose(worker);

export type WorldViewerClient = typeof worker;