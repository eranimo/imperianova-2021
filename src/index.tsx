import { Viewport } from 'pixi-viewport';
import * as PIXI from 'pixi.js';
import * as Honeycomb from 'honeycomb-grid';
import ndarray from 'ndarray';
import pointsInPolygon from 'points-in-polygon';
import pointInPolygon from 'point-in-polygon';
import pointsInTriangle from 'points-in-triangle';
import Alea from 'alea';
import SimplexNoise from 'simplex-noise';
import './style.css';
import { octaveNoise } from './utils';

enum TerrainType {
  OCEAN,
  LAND,
}
const terrainTypeColor = {
  [TerrainType.OCEAN]: [37, 140, 219],
  [TerrainType.LAND]: [29, 179, 39],
}

const HEX_SIZE = 10;
const SEALEVEL = 100;
const rng = Alea(123);
const simplexNoise = new SimplexNoise(rng);

const app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
  antialias: false,
});
document.body.appendChild(app.view);

// setup

const viewport = new Viewport({
  screenWidth: window.innerWidth,
  screenHeight: window.innerHeight,
  worldHeight: 0,
  worldWidth: 0,
  interaction: app.renderer.plugins.interaction,
});
app.stage.addChild(viewport);

viewport.drag().pinch().wheel().decelerate();

// draw hex grid
const graphics = new PIXI.Graphics()
const Hex = Honeycomb.extendHex({ size: HEX_SIZE })
const Grid = Honeycomb.defineGrid(Hex)

const gridWidth = 100;
const gridHeight = 100;
const grid = Grid.rectangle({ width: gridWidth, height: gridHeight })

viewport.worldWidth = grid.pointWidth();
viewport.worldHeight = grid.pointHeight();

// rasterize
const worldWidth = Math.ceil(grid.pointWidth());
const worldHeight = Math.ceil(grid.pointHeight());
const hexHeightmap = ndarray(new Uint8Array(gridWidth * gridHeight), [gridWidth, gridHeight]);
const worldHeightmap = ndarray(new Uint8Array(worldWidth * worldHeight), [worldWidth, worldHeight]);
console.log('world size', worldWidth, worldHeight);

grid.forEach(hex => {
  const hexHeightValue = octaveNoise(
    simplexNoise.noise2D.bind(simplexNoise),
    hex.x, hex.y,
    2,
    0.30,
    0.02,
  ) * 250;
  hexHeightmap.set(hex.x, hex.y, hexHeightValue);
  const point = hex.toPoint();
  const center = {
    x: hex.center().x + point.x,
    y: hex.center().y + point.y,
  };
  const corners = hex.corners().map(corner => corner.add(point));

  for (let i = 0; i < 6; i++) {
    const oi = i == 5 ? 0 : i + 1;
    const triangle = [
      [(corners[oi].x), (corners[oi].y)],
      [(corners[i].x), (corners[i].y)],
      [(center.x), (center.y)],
    ];
    pointsInTriangle(triangle, (x, y) => {
      worldHeightmap.set(Math.ceil(x), Math.ceil(y), hexHeightValue);
    })
  }
});

function getHexColor(x, y) {
  const value = worldHeightmap.get(x, y);
  let color = [value, value, value];
  if (value < SEALEVEL) {
    color = terrainTypeColor[TerrainType.OCEAN];
  } else {
    color = terrainTypeColor[TerrainType.LAND]
  }
  return color;
}

// draw map
const dim = 4;
const imageArray = new Float32Array(worldWidth * worldHeight * dim);
let i = 0;
for (let y = 0; y < worldHeight; y++) {
  for (let x = 0; x < worldWidth; x++) {
    const color = getHexColor(x, y);
    let [r, g, b] = color;

    imageArray[(i * dim) + 0] = r / 255;
    imageArray[(i * dim) + 1] = g / 255;
    imageArray[(i * dim) + 2] = b / 255;
    imageArray[(i * dim) + 3] = 1;
    i++;
  }
}

console.log('heightmap', worldHeightmap);
console.log('imageArray', imageArray);

const texture = PIXI.Texture.fromBuffer(imageArray, worldWidth, worldHeight);

console.log('texture', texture);
const terrainMap = new PIXI.Sprite(texture);
viewport.addChild(terrainMap);

function colorToNumber(color) {
  return (color[0] << 16) + (color[1] << 8) + (color[2]);
 }

graphics.lineStyle(0.25, 0x000)
grid.forEach(hex => {
  const point = hex.toPoint()
  const corners = hex.corners().map(corner => corner.add(point))
  const center = {
    x: hex.center().x + point.x,
    y: hex.center().y + point.y,
  };
  const [firstCorner, ...otherCorners] = corners

  graphics.moveTo(firstCorner.x, firstCorner.y)
  otherCorners.forEach(({ x, y }) => graphics.lineTo(x, y))
  graphics.lineTo(firstCorner.x, firstCorner.y)

  let value = hexHeightmap.get(hex.x, hex.y);
  let color;
  if (value < SEALEVEL) {
    color = terrainTypeColor[TerrainType.OCEAN];
  } else {
    color = terrainTypeColor[TerrainType.LAND]
  }
  graphics.beginFill(colorToNumber(color));
  graphics.drawCircle(center.x, center.y, HEX_SIZE / 4);
  graphics.endFill();
});
viewport.addChild(graphics);



document.addEventListener('keyup', event => {
  if (event.key === 'g') {
    graphics.visible = !graphics.visible;
  }
});