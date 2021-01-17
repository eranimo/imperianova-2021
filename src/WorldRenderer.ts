import * as PIXI from 'pixi.js';
import { Size } from './types';
import { TerrainType, World, HEX_SIZE } from './World';
import { colorToNumber } from './utils';


const terrainTypeColor = {
  [TerrainType.OCEAN]: [37, 140, 219],
  [TerrainType.LAND]: [29, 179, 39],
}

enum CellType {
  NONE = 0,
  WATER = 1,
  GRASS = 2,
  BEACH = 3,
};

const cellTypeColor = {
  [CellType.WATER]: [37, 140, 219],
  [CellType.GRASS]: [29, 179, 39],
  [CellType.BEACH]: [240, 217, 48],
}

// function drawHex(): PIXI.Texture {

// }

export class WorldRenderer {
  public world: World;
  public debugGraphics: PIXI.Graphics;
  public worldWidth: number;
  public worldHeight: number;


  constructor(world: World) {
    this.world = world;
    this.debugGraphics = new PIXI.Graphics();
    this.worldWidth = this.world.grid.pointWidth();
    this.worldHeight = this.world.grid.pointHeight();
    
    this.render();

    // setup events
    document.addEventListener('keyup', event => {
      if (event.key === 'g') {
        this.debugGraphics.visible = !this.debugGraphics.visible;
      }
    });
  }

  render() {
    this.debugGraphics.lineStyle(1, 0xFFFFFF)
    this.world.grid.forEach(hex => {
      const point = hex.toPoint()
      const corners = hex.corners().map(corner => corner.add(point))
      const center = {
        x: hex.center().x + point.x,
        y: hex.center().y + point.y,
      };
      const [firstCorner, ...otherCorners] = corners

      // draw grid lines
      this.debugGraphics.moveTo(firstCorner.x, firstCorner.y)
      otherCorners.forEach(({ x, y }) => this.debugGraphics.lineTo(x, y))
      this.debugGraphics.lineTo(firstCorner.x, firstCorner.y)

      // draw terrain type indicator
      const color = terrainTypeColor[this.world.hexTerrainType.get(hex.x, hex.y)];
      if (color) {
        this.debugGraphics.beginFill(colorToNumber(color));
        this.debugGraphics.drawCircle(center.x, center.y, HEX_SIZE / 4);
        this.debugGraphics.endFill();
      }
    });
  }
}