import { Viewport } from 'pixi-viewport';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { BehaviorSubject } from 'rxjs';
import { GridFactory, World } from './World';
import { WorldMinimap } from './WorldMinimap';
import { WorldRenderer } from './WorldRenderer';
import { AssetContext, Assets } from './AssetLoader';
import { Color } from './utils/Color';
import { random } from 'lodash';

class WorldManager {
  viewport$: BehaviorSubject<Viewport>;
  app: PIXI.Application;
  viewport: Viewport;

  constructor(
    private worldMapCanvas: HTMLCanvasElement,
    private minimapCanvas: HTMLCanvasElement,
  ) {
    const size = worldMapCanvas.getBoundingClientRect();
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
    this.app = new PIXI.Application({
      width: size.width,
      height: size.height,
      antialias: false,
      view: worldMapCanvas,
    });
    this.app.resizeTo = worldMapCanvas;

    this.viewport = new Viewport({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      worldWidth: 0,
      worldHeight: 0,
      interaction: this.app.renderer.plugins.interaction,
    });
    window.addEventListener('resize', () => {
      this.viewport.resize(window.innerWidth, window.innerHeight);
    });
    this.app.stage.addChild(this.viewport);
    this.viewport.drag().pinch().wheel().decelerate();
    
    this.viewport$ = new BehaviorSubject<Viewport>(this.viewport);
    this.viewport.on('moved', (event) => {
      this.viewport$.next(event.viewport);
    });
  }

  init(world: World, assets: Assets) {
    // render
    const renderer = new WorldRenderer(this.app, world, assets);
    renderer.setIcon(world.getHex(5, 5), 'castle');
    this.viewport.removeChildren();
    this.viewport.worldWidth = renderer.worldWidth;
    this.viewport.worldHeight = renderer.worldHeight;
    this.viewport.addChild(renderer.chunksLayer);
    this.viewport.addChild(renderer.overlayLayer);
    this.viewport.addChild(renderer.gridLayer);
    this.viewport.addChild(renderer.regionLayer);
    this.viewport.addChild(renderer.iconsLayer);
    this.viewport.addChild(renderer.debugGraphics);
    this.viewport.addChild(renderer.labelContainer);

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

      if (renderer.regionMap.getHexRegion(hex) == testRegion) {
        testRegion.remove(hex);
      } else {
        testRegion.add(hex);
      }
    });

    (window as any).moveToHex = (x: number, y: number) => {
      const hex = world.hexgrid.get({ x, y });
      const point = hex.toPoint();
      this.viewport.moveCenter(new PIXI.Point(point.x, point.y));
    }
  }
}

export const WorldViewer = ({
  world,
}: {
  world: World,
}) => {
  const worldMapRef = useRef<HTMLCanvasElement>();
  const minimapRef = useRef<HTMLCanvasElement>();
  const [isLoading, setLoading] = useState(true);
  const { isLoading: isAssetsLoading, assets } = useContext(AssetContext);

  const manager = useRef<WorldManager>();

  useEffect(() => {
    console.log('setup world manager');
    manager.current = new WorldManager(worldMapRef.current, minimapRef.current)    ;
  }, []);

  useEffect(() => {
    if (world && assets && manager.current) {
      console.log('setup world');
      manager.current.init(world, assets);
    }
  }, [world, assets]);

  return (
    <div>
      <canvas
        ref={worldMapRef}
        style={{
          position: 'fixed',
          width: '100%',
          height: '100%',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: 'fixed',
          right: 0,
          bottom: 0,
          width: 300,
          height: 150,
          zIndex: 10,
        }}
      >
        <canvas
          ref={minimapRef}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    </div>
  );
}
