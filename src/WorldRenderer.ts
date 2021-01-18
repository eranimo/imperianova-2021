import * as PIXI from 'pixi.js';
import { Direction, Size, directionIndexOrder } from './types';
import { TerrainType, World, EdgeFeature, HexFeature } from './World';
import { colorToNumber, bresenhamLinePlot, floodFill } from './utils';
import ndarray from 'ndarray';
import { CompositeRectTileLayer } from 'pixi-tilemap';


const terrainTypeColor = {
  [TerrainType.OCEAN]: [37, 140, 219],
  [TerrainType.LAND]: [29, 179, 39],
}

export type HexTile = {
  terrainType: TerrainType,
  terrainTransitions: Partial<Record<Direction, TerrainType | null>>,
  edgeFeatures: Partial<Record<Direction, EdgeFeature>>,
  hexFeature: HexFeature,
}

enum CellType {
  NONE = 0,

  DEBUG_SE = 1,
  DEBUG_NE = 2,
  DEBUG_N = 3,
  DEBUG_NW = 4,
  DEBUG_SW = 5,
  DEBUG_S = 6,

  WATER = 7,
  GRASS = 8,
  BEACH = 9,
};

const directionToCellType = {
  [Direction.SE]: CellType.DEBUG_SE,
  [Direction.NE]: CellType.DEBUG_NE,
  [Direction.N]: CellType.DEBUG_N,
  [Direction.NW]: CellType.DEBUG_NW,
  [Direction.SW]: CellType.DEBUG_SW,
  [Direction.S]: CellType.DEBUG_S,
}

const cellTypeColor = {
  [CellType.DEBUG_SE]: [0, 255, 255],
  [CellType.DEBUG_NE]: [255, 0, 255],
  [CellType.DEBUG_N]: [255, 0, 0],
  [CellType.DEBUG_NW]: [0, 0, 255],
  [CellType.DEBUG_SW]: [255, 255, 0],
  [CellType.DEBUG_S]: [0, 255, 0],

  [CellType.WATER]: [37, 140, 219],
  [CellType.GRASS]: [29, 179, 39],
  [CellType.BEACH]: [240, 217, 48],
}

const terrainCenterCellTypes = {
  [TerrainType.OCEAN]: CellType.WATER,
  [TerrainType.LAND]: CellType.GRASS,
}

const TILE_WIDTH = 64;
const TILE_HEIGHT = 64;
const TILE_Y_OFFSET = 10;
// 64 x 64
const HALF_W = (TILE_WIDTH / 2);
const HALF_H = (TILE_HEIGHT / 2);
const QUARTER_W = (TILE_WIDTH / 4);
const corners = [
  [[TILE_WIDTH - 1, HALF_H], [HALF_W + QUARTER_W, TILE_HEIGHT - 1]], // SE
  [[TILE_WIDTH - 1, HALF_H - 1], [HALF_W + QUARTER_W, 0]], // NE
  [[HALF_W + QUARTER_W - 1, 0], [QUARTER_W, 0]], // N
  [[QUARTER_W - 1, 0], [0, HALF_H - 1]], // NW
  [[0, HALF_H], [QUARTER_W - 1, TILE_HEIGHT - 1]], // SW
  [[QUARTER_W, TILE_HEIGHT - 1], [HALF_W + QUARTER_W - 1, TILE_HEIGHT - 1]], // S
];

function getHexTileID(hexTile: HexTile) {
  return (
    // terrain type
    (((TerrainType.__LENGTH - 1) ** 0) * hexTile.terrainType) +

    // terrain transitions
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.SE)) * hexTile.terrainTransitions[Direction.SE]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.NE)) * hexTile.terrainTransitions[Direction.NE]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.N)) * hexTile.terrainTransitions[Direction.N]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.NW)) * hexTile.terrainTransitions[Direction.NW]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.SW)) * hexTile.terrainTransitions[Direction.SW]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.S)) * hexTile.terrainTransitions[Direction.S]) +

    // edge fatures
    ((EdgeFeature.__LENGTH ** (7 + Direction.SE)) * hexTile.edgeFeatures[Direction.SE]) +
    ((EdgeFeature.__LENGTH ** (7 + Direction.NE)) * hexTile.edgeFeatures[Direction.NE]) +
    ((EdgeFeature.__LENGTH ** (7 + Direction.N)) * hexTile.edgeFeatures[Direction.N]) +
    ((EdgeFeature.__LENGTH ** (7 + Direction.NW)) * hexTile.edgeFeatures[Direction.NW]) +
    ((EdgeFeature.__LENGTH ** (7 + Direction.SW)) * hexTile.edgeFeatures[Direction.SW]) +
    ((EdgeFeature.__LENGTH ** (7 + Direction.S)) * hexTile.edgeFeatures[Direction.S]) +

    // hex features
    ((HexFeature.__LENGTH ** 13) * hexTile.hexFeature)
  );
}

function drawHexTile(hexTile: HexTile): PIXI.Texture {
  const width = TILE_WIDTH;
  const height = TILE_HEIGHT;
  const grid = ndarray(new Uint8Array(width * height), [width, height]);

  corners.forEach((corner, i) => {
    const points = bresenhamLinePlot(
      Math.round(corner[0][0]), Math.round(corner[0][1]),
      Math.round(corner[1][0]), Math.round(corner[1][1]),
    );
    for (let [x, y] of points) {
      grid.set(x, y, directionToCellType[directionIndexOrder[i]]);
    }
  });

  floodFill(
    grid,
    Math.round(width / 2),
    Math.round(height / 2),
    terrainCenterCellTypes[hexTile.terrainType],
    (matrix, x, y) => matrix.get(x, y) === 0,
  );

  // convert to image
  const buffer = new Float32Array(width * height * 4);
  let i = 0;
  const dim = 4;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cellType = grid.get(x, y);
      const color = cellTypeColor[cellType];
      if (color) {
        let [r, g, b] = color;
        buffer[(i * dim) + 0] = r / 255;
        buffer[(i * dim) + 1] = g / 255;
        buffer[(i * dim) + 2] = b / 255;
        buffer[(i * dim) + 3] = 1;
      } else {
        buffer[(i * dim) + 0] = 0;
        buffer[(i * dim) + 1] = 0;
        buffer[(i * dim) + 2] = 0;
        buffer[(i * dim) + 3] = 0;
      }
      i++;
    }
  }
  console.log(buffer);

  return PIXI.Texture.fromBuffer(buffer, width, height);
}

class WorldTileset {
  public renderTexture: PIXI.RenderTexture;
  public texture: PIXI.Texture;
  private container: PIXI.Container;
  private hexTileMap: Map<number, HexTile>;
  private hexTileSprite: Map<number, PIXI.Sprite>;
  private hexTileTexture: Map<number, PIXI.Texture>;

  constructor(
    private renderer: PIXI.Renderer,
  ) {
    console.time('geenrate world tileset');
    console.timeEnd('geenrate world tileset');
    this.hexTileMap = new Map();
    this.hexTileSprite = new Map();
    this.hexTileTexture = new Map();
    this.container = new PIXI.Container();
    const rt = new PIXI.BaseRenderTexture({
      width: this.pixelWidth,
      height: this.pixelHeight,
      scaleMode: PIXI.SCALE_MODES.NEAREST,
      resolution: 1
    })
    this.renderTexture = new PIXI.RenderTexture(rt);
  }

  static COLUMNS = 100;
  static PADDING = 10;

  get pixelWidth() {
    return WorldTileset.COLUMNS * (TILE_WIDTH + WorldTileset.PADDING);
  }

  get pixelHeight() {
    return this.rows * (TILE_HEIGHT + TILE_Y_OFFSET + WorldTileset.PADDING);
  }

  get rows() {
    return Math.ceil(this.totalTileCount / WorldTileset.COLUMNS);
  }

  /**
   * (re)generates a HexTile
   * @param hexTile HexTile
   * @returns HexTile ID
   */
  private generateTile(hexTile: HexTile): number {
    console.log('generating', hexTile);
    const id = getHexTileID(hexTile);
    const texture = drawHexTile(hexTile);
    const sprite = new PIXI.Sprite(texture);
    this.hexTileMap.set(id, hexTile);
    sprite.position.set(
      (id % WorldTileset.COLUMNS) * (TILE_WIDTH + WorldTileset.PADDING),
      (Math.floor(id / WorldTileset.COLUMNS)) * (TILE_HEIGHT + TILE_Y_OFFSET + WorldTileset.PADDING),
    );
    this.container.addChild(sprite);
    this.hexTileSprite.set(id, sprite);
    return id;
  }

  /**
   * Gets a HexTile, cached
   * @param hexTile HexTile
   * @returns HexTile ID
   */
  public getTile(hexTile: HexTile): number {
    const id = getHexTileID(hexTile);
    if (!this.hexTileMap.has(id)) {
      return this.generateTile(hexTile);
    }
    return id;
  }

  /**
   * Gets the texture for a HexTile (used in pixi-tilemap)
   * @param id HexTile ID
   * @returns Texture of HexTile (may or may not be rendered)
   */
  public getTextureForID(id: number): PIXI.Texture {
    if (this.hexTileTexture.has(id)) {
      return this.hexTileTexture.get(id);
    }
    const texture = new PIXI.Texture(this.renderTexture.baseTexture, new PIXI.Rectangle(
      (id % WorldTileset.COLUMNS) * (TILE_WIDTH + WorldTileset.PADDING),
      (Math.floor(id / WorldTileset.COLUMNS)) * (TILE_HEIGHT + TILE_Y_OFFSET + WorldTileset.PADDING),
      TILE_WIDTH + WorldTileset.PADDING,
      TILE_HEIGHT + TILE_Y_OFFSET + WorldTileset.PADDING,
    ));
    this.hexTileTexture.set(id, texture);
    return texture;
  }

  get totalTileCount() {
    return (
      (TerrainType.__LENGTH - 1) *
      ((TerrainType.__LENGTH - 1) ** (Direction.__LENGTH)) *
      ((EdgeFeature.__LENGTH) ** (Direction.__LENGTH)) *
      (HexFeature.__LENGTH)
    ) + 1000; // TODO: find out why this nunber is wrong
  }
  
  public updateTileset() {
    this.renderer.render(this.container, this.renderTexture);
  }
}

const CHUNK_WIDTH = 10;
const CHUNK_HEIGHT = 10;

export class WorldRenderer {
  public world: World;
  public debugGraphics: PIXI.Graphics;
  public worldWidth: number;
  public worldHeight: number;

  chunkTileLayers: Map<string, CompositeRectTileLayer[]>;
  hexChunk: Map<string, string>;
  chunkHexes: Map<string, { x: number, y: number }[]>;
  worldTileset: WorldTileset;
  chunksLayer: PIXI.Container;

  constructor(private app: PIXI.Application, world: World) {
    this.world = world;
    this.debugGraphics = new PIXI.Graphics();
    this.worldWidth = this.world.grid.pointWidth();
    this.worldHeight = this.world.grid.pointHeight();
    this.chunksLayer = new PIXI.Container();
    this.worldTileset = new WorldTileset(this.app.renderer);
    console.log(this.worldTileset);
    
    this.chunkTileLayers = new Map();
    this.hexChunk = new Map();
    this.chunkHexes = new Map();
    const { width, height } = world.gridSize;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x += 2) {
        const { chunkX, chunkY } = this.getChunkForCoordinate(x, y);
        const chunkKey = `${chunkX},${chunkY}`;
        if (!this.chunkHexes.has(chunkKey)) {
          this.chunkHexes.set(chunkKey, []);
        }
        this.chunkHexes.get(chunkKey).push({ x, y });
        this.hexChunk.set(`${x},${y}`, chunkKey);
      }

      for (let x = 1; x < width; x += 2) {
        const { chunkX, chunkY } = this.getChunkForCoordinate(x, y);
        const chunkKey = `${chunkX},${chunkY}`;
        if (!this.chunkHexes.has(chunkKey)) {
          this.chunkHexes.set(chunkKey, []);
        }
        this.chunkHexes.get(chunkKey).push({ x, y });
        this.hexChunk.set(`${x},${y}`, chunkKey);
      }
    }

    this.render();

    // setup events
    document.addEventListener('keyup', event => {
      if (event.key === 'g') {
        this.debugGraphics.visible = !this.debugGraphics.visible;
      }
    });
  }

  private getChunkForCoordinate(x: number, y: number) {
    const y2 = x % 2 + y * 2;
    const chunkY = y2 / CHUNK_HEIGHT | 0;
    const chunkX = (x + (y2 % CHUNK_HEIGHT)) / CHUNK_WIDTH | 0;
    return { chunkX, chunkY };
  }

  private drawChunk(chunkKey: string) {
    const [terrainLayer] = this.chunkTileLayers.get(chunkKey);
    const hexes = this.chunkHexes.get(chunkKey);
    const hexPosititions: [number, number][] = [];
    let minX = Infinity;
    let minY = Infinity;
    for (const hex of hexes) {
      const [ x, y ] = this.world.getHexPosition(hex.x, hex.y);
      // const x = hex.x * (TILE_WIDTH * 3/4 + 1);
      // const y = hex.x % 2 === 0
      //   ? TILE_HEIGHT * hex.y
      //   : TILE_HEIGHT * hex.y + (TILE_HEIGHT / 2);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      hexPosititions.push([x, y]);
    }
    // TODO: why casting is required
    (terrainLayer as any).position.set((minX), (minY));

    hexes.forEach((hex, index) => {
      const terrainType = this.world.getTerrainForCoord(hex.x, hex.y);
      if (terrainType === TerrainType.NONE) return;
      const hexTileID = this.worldTileset.getTile({
        terrainType,
        terrainTransitions: this.world.getHexNeighborTerrain(hex.x, hex.y),
        edgeFeatures: {
          [Direction.SE]: EdgeFeature.NONE,
          [Direction.NE]: EdgeFeature.NONE,
          [Direction.N]: EdgeFeature.NONE,
          [Direction.NW]: EdgeFeature.NONE,
          [Direction.SW]: EdgeFeature.NONE,
          [Direction.S]: EdgeFeature.NONE,
        },
        hexFeature: HexFeature.NONE,
      });
      const texture = this.worldTileset.getTextureForID(hexTileID);
      const [ x, y ] = hexPosititions[index];
      if (texture) {
        terrainLayer.addFrame(
          texture,
          (x - minX),
          (y - minY),
        );
      }
    });
  }

  render() {
    console.time('drawHexTile');
    
    this.worldTileset.updateTileset();
    console.timeEnd('drawHexTile');

    console.groupCollapsed('draw chunks');
    console.time('draw chunks');
    console.log(`Drawing ${this.chunkHexes.size} chunks`);
    const bitmaps = [
      new PIXI.Texture(this.worldTileset.renderTexture.baseTexture),
    ];
    for (const chunkKey of this.chunkHexes.keys()) {
      const terrainLayer = new CompositeRectTileLayer(0, bitmaps);
      this.chunkTileLayers.set(chunkKey, [terrainLayer]);
      this.chunksLayer.addChild(terrainLayer as any);
      this.drawChunk(chunkKey);
    }
    this.worldTileset.updateTileset();
    console.timeEnd('draw chunks');
    console.groupEnd();


    // debug
    this.debugGraphics.lineStyle(1, 0xFFFFFF)
    this.world.grid.forEach(hex => {
      const point = hex.toPoint()
      const corners = hex.round().corners().map(corner => corner.add(point));
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
        this.debugGraphics.drawCircle(center.x, center.y, 5);
        this.debugGraphics.endFill();
      }
    });
  }
}