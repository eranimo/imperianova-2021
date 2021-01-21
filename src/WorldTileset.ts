import * as PIXI from 'pixi.js';
import { TileGrid } from './TileGrid';
import { Direction, directionIndexOrder, DirectionMap, CoordArray, CornerMap, directionCorners, cornerDirections, Corner } from './types';
import { bresenhamLinePlot } from './utils';
import { EdgeFeature, HexFeature, TerrainType, terrainTransitions, CornerFeature } from './World';

export type HexTile = {
  terrainType: TerrainType,
  edgeTerrainTypes: DirectionMap<TerrainType | null>,
  cornerTerrainTypes: CornerMap<TerrainType | null>,
  edgeFeatures: DirectionMap<EdgeFeature>,
  hexFeature: HexFeature,
}

export enum CellType {
  NONE = 0,

  DEBUG_SE = 1,
  DEBUG_NE = 2,
  DEBUG_N = 3,
  DEBUG_NW = 4,
  DEBUG_SW = 5,
  DEBUG_S = 6,
  DEBUG_CENTER = 7,

  OCEAN = 8,
  GRASS = 9,
  BEACH = 10,
  FOREST = 11,
  ICE = 12,
  SAND = 13,
  TUNDRA = 14,
  RIVER = 15,
  RIVER_MOUTH = 16,
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
  [CellType.DEBUG_CENTER]: [0, 0, 0],
  
  [CellType.OCEAN]: [37, 140, 219],
  [CellType.GRASS]: [29, 179, 39],
  [CellType.BEACH]: [240, 217, 48],
  [CellType.FOREST]: [57, 117, 47],
  [CellType.ICE]: [250, 250, 250],
  [CellType.SAND]: [217, 191, 140],
  [CellType.TUNDRA]: [150, 209, 195],
  [CellType.RIVER]: [26, 118, 189],
  [CellType.RIVER_MOUTH]: [26, 118, 189],
}

const terrainPrimaryCellTypes = {
  [TerrainType.OCEAN]: CellType.OCEAN,
  [TerrainType.GRASSLAND]: CellType.GRASS,
  [TerrainType.FOREST]: CellType.FOREST,
  [TerrainType.GLACIAL]: CellType.ICE,
  [TerrainType.TAIGA]: CellType.FOREST,
  [TerrainType.TUNDRA]: CellType.TUNDRA,
  [TerrainType.DESERT]: CellType.SAND,
  [TerrainType.RIVER]: CellType.RIVER,
  [TerrainType.RIVER_MOUTH]: CellType.RIVER_MOUTH,
}

const TILE_WIDTH = 64;
const TILE_HEIGHT = 60;
const TILE_Y_OFFSET = 10;
// 64 x 64
const HALF_W = (TILE_WIDTH / 2);
const HALF_H = (TILE_HEIGHT / 2);
const QUARTER_W = (TILE_WIDTH / 4);
const directionCornerPoints = [
  [[HALF_W + QUARTER_W, TILE_HEIGHT - 1], [TILE_WIDTH - 1, HALF_H]], // SE
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

    // edge terrain types
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.SE)) * hexTile.edgeTerrainTypes[Direction.SE]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.NE)) * hexTile.edgeTerrainTypes[Direction.NE]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.N)) * hexTile.edgeTerrainTypes[Direction.N]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.NW)) * hexTile.edgeTerrainTypes[Direction.NW]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.SW)) * hexTile.edgeTerrainTypes[Direction.SW]) +
    (((TerrainType.__LENGTH - 1) ** (1 + Direction.S)) * hexTile.edgeTerrainTypes[Direction.S]) +

    // corner terrain types
    (((TerrainType.__LENGTH - 1) ** (7 + Corner.RIGHT)) * hexTile.cornerTerrainTypes[Corner.RIGHT]) +
    (((TerrainType.__LENGTH - 1) ** (7 + Corner.BOTTOM_RIGHT)) * hexTile.cornerTerrainTypes[Corner.BOTTOM_RIGHT]) +
    (((TerrainType.__LENGTH - 1) ** (7 + Corner.BOTTOM_LEFT)) * hexTile.cornerTerrainTypes[Corner.BOTTOM_LEFT]) +
    (((TerrainType.__LENGTH - 1) ** (7 + Corner.LEFT)) * hexTile.cornerTerrainTypes[Corner.LEFT]) +
    (((TerrainType.__LENGTH - 1) ** (7 + Corner.TOP_LEFT)) * hexTile.cornerTerrainTypes[Corner.TOP_LEFT]) +
    (((TerrainType.__LENGTH - 1) ** (7 + Corner.TOP_RIGHT)) * hexTile.cornerTerrainTypes[Corner.TOP_RIGHT]) +

    // edge fatures
    ((EdgeFeature.__LENGTH ** (13 + Direction.SE)) * hexTile.edgeFeatures[Direction.SE]) +
    ((EdgeFeature.__LENGTH ** (13 + Direction.NE)) * hexTile.edgeFeatures[Direction.NE]) +
    ((EdgeFeature.__LENGTH ** (13 + Direction.N)) * hexTile.edgeFeatures[Direction.N]) +
    ((EdgeFeature.__LENGTH ** (13 + Direction.NW)) * hexTile.edgeFeatures[Direction.NW]) +
    ((EdgeFeature.__LENGTH ** (13 + Direction.SW)) * hexTile.edgeFeatures[Direction.SW]) +
    ((EdgeFeature.__LENGTH ** (13 + Direction.S)) * hexTile.edgeFeatures[Direction.S]) +

    // hex features
    ((HexFeature.__LENGTH ** 18) * hexTile.hexFeature)
  );
}

function drawHexTile(hexTile: HexTile): PIXI.Texture {
  const width = TILE_WIDTH;
  const height = TILE_HEIGHT;
  const grid = new TileGrid(hexTile, width, height);

  let edgeTypes: Set<CellType> = new Set();
  let shouldDrawRiverMouth = false;
  let edgePoints: Partial<DirectionMap<CoordArray>> = {};
  directionCornerPoints.forEach((directionPoint, directionIndex) => {
    const points = bresenhamLinePlot(
      Math.round(directionPoint[0][0]), Math.round(directionPoint[0][1]),
      Math.round(directionPoint[1][0]), Math.round(directionPoint[1][1]),
    );
    edgePoints[directionIndex] = points;
    for (let [x, y] of points) {
      // const cellType = directionToCellType[directionIndexOrder[i]];
      const edgeTerrainType = hexTile.edgeTerrainTypes[directionIndex] as TerrainType;
      let cellType: CellType = terrainPrimaryCellTypes[hexTile.terrainType];
      if (hexTile.edgeFeatures[directionIndex] === EdgeFeature.RIVER) {
        cellType = CellType.RIVER;
        edgeTypes.add(cellType);
      } else if (terrainTransitions[hexTile.terrainType] && terrainTransitions[hexTile.terrainType].includes(edgeTerrainType)) {
        cellType = terrainPrimaryCellTypes[edgeTerrainType];
        edgeTypes.add(cellType);
      } else if (terrainTransitions[hexTile.terrainType]) {
        cellType = terrainPrimaryCellTypes[hexTile.terrainType];
        edgeTypes.add(cellType);
      }
      grid.set(x, y, cellType);

      for (let corner of directionCorners[directionIndex]) {
        const dir1: Direction = cornerDirections[corner][1];
        const dir2: Direction = cornerDirections[corner][0];
        const p1 = directionCornerPoints[dir1][1];
        const p2 = directionCornerPoints[dir2][0];
        const cornerTerrain = hexTile.cornerTerrainTypes[corner];
        grid.set(p1[0], p1[1], terrainPrimaryCellTypes[cornerTerrain]);
        grid.set(p2[0], p2[1], terrainPrimaryCellTypes[cornerTerrain]);
        const cornerType = terrainPrimaryCellTypes[cornerTerrain];
        if (cornerType === CellType.RIVER_MOUTH) {
          shouldDrawRiverMouth = true;
        } else {
          edgeTypes.add(cornerType);
        }
      }
    }
  });


  // flood fill center of tile
  grid.floodFill(
    Math.round(width / 2),
    Math.round(height / 2),
    CellType.DEBUG_CENTER,
    value => value === 0,
  );

  if (shouldDrawRiverMouth) {
    for (let count = 0; count < 12; count++) {
      grid.grow(
        CellType.RIVER_MOUTH,
        value => value !== CellType.RIVER_MOUTH && value !== CellType.NONE,
      );
    }
  }

  // expand coastlines
  for (let count = 0; count < 7; count++) {
    for (const cellType of edgeTypes) {
      if (cellType === CellType.RIVER && count > 5) {
        continue;
      }
      grid.grow(
        cellType,
        value => value !== cellType && value !== CellType.RIVER_MOUTH,
      );
    }
  }

  // clean up coastline
  for (const cellType of edgeTypes) {
    if (cellType === CellType.RIVER) {
      for (let count = 0; count < 3; count++) {
        grid.changeRule(
          CellType.DEBUG_CENTER,
          cellType,
          3,
          cellType,
        );
        grid.changeRule(
          cellType,
          CellType.DEBUG_CENTER,
          3,
          CellType.DEBUG_CENTER,
        );
      }
    } else {
      for (let count = 0; count < 3; count++) {
        // remove island cells
        grid.changeRule(
          CellType.DEBUG_CENTER,
          cellType,
          3,
          cellType,
        );
        // remove single-cell peninsulas
        grid.changeRule(
          cellType,
          CellType.DEBUG_CENTER,
          3,
          CellType.DEBUG_CENTER,
        );
      }
    }
  }

  const centerCellType = terrainPrimaryCellTypes[hexTile.terrainType];
  grid.replaceAll(CellType.DEBUG_CENTER, centerCellType);

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
    // console.log('generating', hexTile);
    const id = getHexTileID(hexTile);
    const index = this.numTiles;
    this.numTiles++;
    this.tileIDToIndex.set(id, index);
    // console.time(`generating hex ID ${id}`);
    const texture = drawHexTile(hexTile);
    const sprite = new PIXI.Sprite(texture);
    this.hexTileMap.set(id, hexTile);
    sprite.position.set(
      (index % WorldTileset.COLUMNS) * (TILE_WIDTH + WorldTileset.PADDING),
      (Math.floor(index / WorldTileset.COLUMNS)) * (TILE_HEIGHT + TILE_Y_OFFSET + WorldTileset.PADDING),
    );
    this.container.addChild(sprite);
    this.hexTileSprite.set(id, sprite);
    // console.timeEnd(`generating hex ID ${id}`);
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