import { expose } from 'threads/worker';
import './patch';
import { Viewport } from 'pixi-viewport';
import { Tileset } from './Tileset';
import { HexSectionTileset } from './HexSectionTileset';
import { decode } from 'fast-png';
import tilesetJson from '../assets/tileset.json';
import { Application, Sprite, Texture } from './pixi';

export type Assets = {
  borderTileset: Tileset,
  gridTexture: Texture,
  hexMask: Texture,
  hexSectionTileset: HexSectionTileset,
};

interface IAssetContext {
  isLoading: boolean,
  assets: Assets | null
}

function setup(
  worldMapCanvas: OffscreenCanvas,
  minimapCanvas: OffscreenCanvas,
  assets: Assets,
) {
  const app = new Application({
    width: worldMapCanvas.width,
    height: worldMapCanvas.height,
    antialias: false,
    resolution: 2,
    view: worldMapCanvas as any,
  });

  const divWheelMock = {
    addEventListener: (type, callback) => {

    },
  }

  const viewport = new Viewport({
    screenWidth: worldMapCanvas.width,
    screenHeight: worldMapCanvas.height,
    worldWidth: 0,
    worldHeight: 0,
    divWheel: divWheelMock as any,
  });
  app.stage.addChild(viewport as any);

  const sprite = new Sprite(assets.hexMask);
  sprite.position.set(100, 100);
  viewport.addChild(sprite as any);

  // render
  // const renderer = new WorldMap(app, assets);
  // renderer.setIcon(world.getHex(5, 5), 'castle');
  // this.viewport.removeChildren();
  // this.viewport.worldWidth = renderer.worldWidth;
  // this.viewport.worldHeight = renderer.worldHeight;
  // this.viewport.addChild(renderer.chunksLayer);
  // this.viewport.addChild(renderer.overlayLayer);
  // this.viewport.addChild(renderer.gridLayer);
  // this.viewport.addChild(renderer.regionLayer);
  // this.viewport.addChild(renderer.iconsLayer);
  // this.viewport.addChild(renderer.debugGraphics);
  // this.viewport.addChild(renderer.labelContainer);

  /*
  const testRegion = renderer.regionMap.createRegion({
    name: 'One',
    hexes: [
      world.getHex(5, 5),
      world.getHex(6, 5),
    ],
    // color: Color.fromHSL(random(0, 360), .90, .90),
    color: new Color([0, 255, 0], 255),
  });
  renderer.regionMap.createRegion({
    name: 'Two',
    hexes: [
      world.getHex(6, 6),
      world.getHex(6, 7),
    ],
    color: Color.fromHSL(random(0, 360), .70, .50),
  });

  this.viewport$.subscribe(viewport => renderer.onViewportMoved(viewport));

  const minimapSize = this.minimapCanvas.getBoundingClientRect();
  const minimapApp = new PIXI.Application({
    width: minimapSize.width,
    height: minimapSize.height,
    antialias: false,
    view: this.minimapCanvas,
  });
  const minimap = new WorldMinimap(minimapApp, world, assets, { width: minimapSize.width, height: minimapSize.height }, this.viewport$);
  minimap.minimapPan.subscribe(point => {
    this.viewport.moveCenter(point);
    this.viewport$.next(this.viewport);
  });

  this.viewport.on('clicked', (event) => {
    const hexPosition = GridFactory.pointToHex(event.world);
    const hex = world.getHex(hexPosition.x, hexPosition.y);
    console.log('clicked on hex', hex);
    console.log({
      hexRoads: world.hexRoads.get(hex),
      hexRivers: world.riverHexPairs.get(hex),
    });
    const tileSections = assets.hexSectionTileset.getHexTileSections(world, hex);
    console.log(tileSections.map(tileSection => assets.hexSectionTileset.debugTileSection(tileSection)));
    console.log('regions', renderer.regionMap.borderTilesetID.get(hex));

    if (hex) {
      // if (renderer.regionMap.getHexRegion(hex) == testRegion) {
      //   testRegion.remove(hex);
      // } else {
      //   testRegion.add(hex);
      // }
      world.setHexRoad(hex, world.getHexNeighbor(hex.x, hex.y, Direction.N), Direction.N);
    }
  });

  (window as any).moveToHex = (x: number, y: number) => {
    const hex = world.hexgrid.get({ x, y });
    const point = hex.toPoint();
    this.viewport.moveCenter(new PIXI.Point(point.x, point.y));
  }
  */
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

const worker = {
  async init(
    worldMapCanvas: OffscreenCanvas,
    minimapCanvas: OffscreenCanvas,
  ) {
    const loader = new Loader();
    loader.add('hexMask', 'png', require('../assets/hex-mask.png'))
    loader.add('autogenObjectsPNG', 'png', require('../assets/autogen-objects.png'))
    loader.add('tilesetPNG', 'png', require('../assets/tileset.png'))
    loader.add('gridTexture', 'png', require('../assets/grid.png'))
    loader.add('borderTileset', 'png', require('../assets/borders.png'))
    loader.add('tilesetJson', 'json', tilesetJson as any)
    console.log(tilesetJson);
    const resources = await loader.load();
    console.log('resources', resources);
    const assets: Assets = {
      borderTileset: new Tileset(resources.borderTileset.baseTexture, {
        tileSize: { width: 64, height: 60 },
        columns: 6,
        tilePadding: 0,
      }),
      gridTexture: resources.gridTexture,
      hexMask: resources.hexMask,
      hexSectionTileset: new HexSectionTileset(resources.tilesetJson, resources.tilesetPNG.baseTexture),
    };
    console.log('assets', assets);
    setup(worldMapCanvas, minimapCanvas, assets);
  }
};
expose(worker);

export type WorldViewerClient = typeof worker;