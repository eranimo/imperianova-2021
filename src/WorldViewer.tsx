import React, { useEffect, useRef, useState } from 'react';
import { World, GridFactory } from './World';
import { Assets } from './types';
import { Viewport } from 'pixi-viewport';
import { WorldGenerator } from './WorldGenerator';
import { WorldRenderer } from './WorldRenderer';
import { WorldMinimap } from './WorldMinimap';
import { BehaviorSubject, Subject } from 'rxjs';
import { Grid } from 'honeycomb-grid';

export const WorldViewer = ({
  world,
}: {
  world: World,
}) => {
  const worldMapRef = useRef<HTMLCanvasElement>();
  const minimapRef = useRef<HTMLCanvasElement>();
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    console.log(world);
    
    const loader = new PIXI.Loader();
    loader.add('hexTemplate', require('./assets/hex-template.png'))
    loader.onError.add(error => {
      console.error(error);
    });
    loader.load(({ resources }) => {
      const size = worldMapRef.current.getBoundingClientRect();
      const app = new PIXI.Application({
        width: size.width,
        height: size.height,
        antialias: false,
        view: worldMapRef.current,
      });
      setLoading(false);
      app.resizeTo = worldMapRef.current;
      console.log('resources', resources);

      const assets = resources as Assets;

      const viewport = new Viewport({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        worldWidth: 0,
        worldHeight: 0,
        interaction: app.renderer.plugins.interaction,
      });
      app.stage.addChild(viewport);
      viewport.drag().pinch().wheel().decelerate();
      
      const viewport$ = new BehaviorSubject<Viewport>(viewport);
      viewport.on('moved', (event) => {
        viewport$.next(event.viewport);
      });
      
      // render
      const renderer = new WorldRenderer(app, world, assets);
      viewport.worldWidth = renderer.worldWidth;
      viewport.worldHeight = renderer.worldHeight;
      viewport.addChild(renderer.chunksLayer);
      viewport.addChild(renderer.debugGraphics);


      const minimapSize = minimapRef.current.getBoundingClientRect();
      const minimapApp = new PIXI.Application({
        width: minimapSize.width,
        height: minimapSize.height,
        antialias: false,
        view: minimapRef.current,
      });
      setLoading(false);
      const minimap = new WorldMinimap(minimapApp, world, assets, { width: minimapSize.width, height: minimapSize.height }, viewport$);
      minimap.minimapPan.subscribe(point => {
        viewport.moveCenter(point);
        viewport$.next(viewport);
      });

      viewport.on('clicked', (event) => {
        const hexPosition = GridFactory.pointToHex(event.world);
        const hex = world.getHex(hexPosition.x, hexPosition.y);
        console.log('clicked on hex', hex);
        console.log({
          hexRoads: world.hexRoads.get(hex),
          hexRivers: world.riverHexPairs.get(hex),
          hexTile: renderer.hexTiles.get(hex),
        });
      });

      (window as any).moveToHex = (x: number, y: number) => {
        const hex = world.hexgrid.get({ x, y });
        const point = hex.toPoint();
        viewport.moveCenter(new PIXI.Point(point.x, point.y));
      }
      console.log({ app, viewport, world, renderer });
    });
  }, [world]);

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
