import ndarray from 'ndarray';
import * as PIXI from 'pixi.js';
import { Direction, directionIndexOrder } from './types';
import { bresenhamLinePlot, floodFill } from './utils';
import { EdgeFeature, HexFeature, TerrainType, terrainTransitions } from './World';

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
  FOREST = 10,
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
  [CellType.FOREST]: [57, 117, 47],
}

const terrainCenterCellTypes = {
  [TerrainType.OCEAN]: CellType.WATER,
  [TerrainType.GRASSLAND]: CellType.GRASS,
  [TerrainType.FOREST]: CellType.FOREST,
}

const TILE_WIDTH = 64;
const TILE_HEIGHT = 60;
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

class TileGrid {
  public grid: ndarray;

  constructor(
    public hexTile: HexTile,
    public width: number,
    public height: number,
  ) {
    this.grid = ndarray(new Uint8Array(width * height), [width, height]);
  }

  /**
   * Changes cells from one CellType to another, if the cell is of a target cell type
   * and if the number of neighbors of a given type is met.
   * @param targetCellType CellType to change
   * @param neighborCellType CellType to check neighbors for
   * @param validNeighborCount Number of neighbors of neighborCellType required for this cell to transform
   * @param toCellType CellType to transform to
   * @param chance Percent chance (float) of changing
   */
  changeRule(
    targetCellType: CellType,
    neighborCellType: CellType,
    validNeighborCount: number,
    toCellType: CellType,
    chance: number = 1,
  ) {
    let validCells = [];
    this.forEachCell((x, y) => {
      if (this.get(x, y) === targetCellType) {
        const neighborCount = this.countNeighborsOfType(x, y, neighborCellType);
        if (neighborCount >= validNeighborCount && Math.random() < chance) {
          validCells.push([x, y]);
        }
      }
    });

    for (const [x, y] of validCells) {
      this.set(x, y, toCellType);
    }
  }

  /**
   * Transforms cells from one CellType to another, with a higher chance the more neighbors
   * of toCellType a cell of fromCellType has
   * @param fromCellType CellType of cells to "grow" into
   * @param toCellType CellType to transform to
   */
  grow(
    fromCellType: CellType,
    toCellType: CellType,
  ) {
    let validCells = [];
    this.forEachCell((x, y) => {
      if (this.get(x, y) === fromCellType) {
        const neighborCount = this.countNeighborsOfType(x, y, toCellType);
        if (Math.random() < (neighborCount / 4)) {
          validCells.push([x, y]);
        }
      }
    });

    for (const [x, y] of validCells) {
      this.set(x, y, toCellType);
    }
  }

  countNeighborsOfType(
    x: number,
    y: number,
    cellType: CellType,
  ) {
    let count = 0;
    if (this.get(x - 1, y) === cellType) count++;
    if (this.get(x + 1, y) === cellType) count++;
    if (this.get(x, y - 1) === cellType) count++;
    if (this.get(x, y + 1) === cellType) count++;
    return count;
  }

  forEachCell(
    func: (x: number, y: number) => void
  ) {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        func(x, y);
      }
    }
  }

  floodFill(
    x: number,
    y: number,
    value: CellType,
    isValidCell: (value: CellType) => boolean,
  ) {
    floodFill(
      this.grid,
      x,
      y,
      value,
      (matrix, x, y) => isValidCell(matrix.get(x, y)),
    );
  }

  get(x: number, y: number): CellType {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return null;
    }
    return this.grid.get(x, y);
  }

  set(x: number, y: number, value: CellType) {
    return this.grid.set(x, y, value);
  }
}

function drawHexTile(hexTile: HexTile): PIXI.Texture {
  const width = TILE_WIDTH;
  const height = TILE_HEIGHT;
  const grid = new TileGrid(hexTile, width, height);

  let coastlineCellTypes: Set<CellType> = new Set();
  corners.forEach((corner, i) => {
    const points = bresenhamLinePlot(
      Math.round(corner[0][0]), Math.round(corner[0][1]),
      Math.round(corner[1][0]), Math.round(corner[1][1]),
    );
    for (let [x, y] of points) {
      // const cellType = directionToCellType[directionIndexOrder[i]];
      const edgeTerrainType = hexTile.terrainTransitions[i];
      let cellType = terrainCenterCellTypes[hexTile.terrainType];
      if (terrainTransitions[hexTile.terrainType] && terrainTransitions[hexTile.terrainType].includes(edgeTerrainType)) {
        cellType = terrainCenterCellTypes[edgeTerrainType];
        coastlineCellTypes.add(cellType);
      }
      grid.set(x, y, cellType);
    }
  });

  const centerCellType = terrainCenterCellTypes[hexTile.terrainType];

  // flood fill center of tile
  grid.floodFill(
    Math.round(width / 2),
    Math.round(height / 2),
    centerCellType,
    value => value === 0,
  );

  // expand coastlines
  for (let count = 0; count < 15; count++) {
    for (const cellType of coastlineCellTypes) {
      grid.grow(
        centerCellType,
        cellType,
      );
    }
  }

  // clean up coastline
  for (const cellType of coastlineCellTypes) {
    // remove island cells
    grid.changeRule(
      centerCellType,
      cellType,
      3,
      cellType,
    );
    // remove single-cell peninsulas
    grid.changeRule(
      cellType,
      centerCellType,
      3,
      centerCellType,
    );
  }


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

  return PIXI.Texture.fromBuffer(buffer, width, height);
}

export class WorldTileset {
  public renderTexture: PIXI.RenderTexture;
  public texture: PIXI.Texture;
  private container: PIXI.Container;
  private hexTileMap: Map<number, HexTile>;
  private hexTileSprite: Map<number, PIXI.Sprite>;
  private hexTileTexture: Map<number, PIXI.Texture>;
  private tileIDToIndex: Map<number, number>;
  public numTiles: number;

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
    this.tileIDToIndex = new Map();
    this.numTiles = 0;
  }

  static COLUMNS = 200;
  static PADDING = 10;
  static MAX_TILES = 20_000;

  get pixelWidth() {
    return WorldTileset.COLUMNS * (TILE_WIDTH + WorldTileset.PADDING);
  }

  get pixelHeight() {
    return this.rows * (TILE_HEIGHT + TILE_Y_OFFSET + WorldTileset.PADDING);
  }

  get rows() {
    return Math.ceil(WorldTileset.MAX_TILES / WorldTileset.COLUMNS);
  }

  /**
   * (re)generates a HexTile
   * @param hexTile HexTile
   * @returns HexTile ID
   */
  private generateTile(hexTile: HexTile): number {
    console.log('generating', hexTile);
    const id = getHexTileID(hexTile);
    const index = this.numTiles;
    this.numTiles++;
    this.tileIDToIndex.set(id, index);
    console.time(`generating hex ID ${id}`);
    const texture = drawHexTile(hexTile);
    const sprite = new PIXI.Sprite(texture);
    this.hexTileMap.set(id, hexTile);
    sprite.position.set(
      (index % WorldTileset.COLUMNS) * (TILE_WIDTH + WorldTileset.PADDING),
      (Math.floor(index / WorldTileset.COLUMNS)) * (TILE_HEIGHT + TILE_Y_OFFSET + WorldTileset.PADDING),
    );
    this.container.addChild(sprite);
    this.hexTileSprite.set(id, sprite);
    console.timeEnd(`generating hex ID ${id}`);
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
    const index = this.tileIDToIndex.get(id);
    const texture = new PIXI.Texture(this.renderTexture.baseTexture, new PIXI.Rectangle(
      (index % WorldTileset.COLUMNS) * (TILE_WIDTH + WorldTileset.PADDING),
      (Math.floor(index / WorldTileset.COLUMNS)) * (TILE_HEIGHT + TILE_Y_OFFSET + WorldTileset.PADDING),
      TILE_WIDTH + WorldTileset.PADDING,
      TILE_HEIGHT + TILE_Y_OFFSET + WorldTileset.PADDING,
    ));
    this.hexTileTexture.set(id, texture);
    return texture;
  }

  public updateTileset() {
    this.renderer.render(this.container, this.renderTexture);
  }
}