import { Viewport } from 'pixi-viewport';
import * as PIXI from 'pixi.js';
import { World } from './World';
import { WorldRenderer } from './WorldRenderer';
import './style.css';
import { WorldGenerator } from './WorldGenerator';


// setup
const app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
  antialias: false,
});
document.body.appendChild(app.view);

const viewport = new Viewport({
  screenWidth: window.innerWidth,
  screenHeight: window.innerHeight,
  worldWidth: 0,
  worldHeight: 0,
  interaction: app.renderer.plugins.interaction,
});
app.stage.addChild(viewport);
viewport.drag().pinch().wheel().decelerate();

// generate
const world = new World();
const worldGen = new WorldGenerator(world, {
  size: 50,
  sealevel: 100,
  seed: 123,
});
worldGen.generate();

// render
const renderer = new WorldRenderer(app, world);
viewport.worldWidth = renderer.worldWidth;
viewport.worldHeight = renderer.worldHeight;
viewport.addChild(renderer.chunksLayer);
viewport.addChild(renderer.debugGraphics);

console.log({ app, viewport, world, renderer, worldGen });
