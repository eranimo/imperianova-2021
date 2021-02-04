import ndarray from 'ndarray';
import * as PIXI from 'pixi.js';
import { TileGrid } from './TileGrid';
import { Assets, ColorArray, CoordArray, Corner, cornerDirections, cornerIndexOrder, CornerMap, Direction, directionIndexOrder, DirectionMap, directionCorners, Coord, adjacentDirections, AutogenObjectTile } from './types';
import { colorArrayMatches, midpointPoints, midpoint, rotatePoint, getImageIndexFromCoord } from './utils';
import { terrainTransitions, TerrainType } from './World';
import FastPoissonDiskSampling from 'fast-2d-poisson-disk-sampling';
import { Tileset } from './Tileset';

export type HexTile = {
  terrainType: TerrainType,
  edgeTerrainTypes: DirectionMap<TerrainType | null>,
  cornerTerrainTypes: CornerMap<TerrainType | null>,
  edgeRoads: DirectionMap<boolean | null>;
}

export enum CellType {
  NONE = 0,

  DEBUG_SE,
  DEBUG_NE,
  DEBUG_N,
  DEBUG_NW,
  DEBUG_SW,
  DEBUG_S,
  DEBUG_CENTER,

  DEBUG_RIGHT,
  DEBUG_BOTTOM_RIGHT,
  DEBUG_BOTTOM_LEFT,
  DEBUG_LEFT,
  DEBUG_TOP_LEFT,
  DEBUG_TOP_RIGHT,

  DEBUG_RIGHT_0,
  DEBUG_RIGHT_1,
  DEBUG_BOTTOM_RIGHT_0,
  DEBUG_BOTTOM_RIGHT_1,
  DEBUG_BOTTOM_LEFT_0,
  DEBUG_BOTTOM_LEFT_1,
  DEBUG_LEFT_0,
  DEBUG_LEFT_1,
  DEBUG_TOP_LEFT_0,
  DEBUG_TOP_LEFT_1,
  DEBUG_TOP_RIGHT_0,
  DEBUG_TOP_RIGHT_1,

  OCEAN,
  GRASS,
  BEACH,
  FOREST,
  ICE,
  SAND,
  TUNDRA,
  RIVER,
  RIVER_MOUTH,
  RIVER_SOURCE,

  TREE,
  ROAD,
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

  [CellType.DEBUG_RIGHT]: [0, 125, 125],
  [CellType.DEBUG_BOTTOM_RIGHT]: [0, 0, 125],
  [CellType.DEBUG_BOTTOM_LEFT]: [0, 125, 0],
  [CellType.DEBUG_LEFT]: [125, 0, 0],
  [CellType.DEBUG_TOP_LEFT]: [125, 0, 125],
  [CellType.DEBUG_TOP_RIGHT]: [125, 125, 0],

  [CellType.DEBUG_RIGHT_0]: [100, 0, 100],
  [CellType.DEBUG_RIGHT_1]: [0, 200, 200],
  [CellType.DEBUG_BOTTOM_RIGHT_0]: [0, 100, 100],
  [CellType.DEBUG_BOTTOM_RIGHT_1]: [0, 200, 0],
  [CellType.DEBUG_BOTTOM_LEFT_0]: [0, 100, 0],
  [CellType.DEBUG_BOTTOM_LEFT_1]: [200, 200, 0],
  [CellType.DEBUG_LEFT_0]: [100, 100, 0],
  [CellType.DEBUG_LEFT_1]: [0, 0, 200],
  [CellType.DEBUG_TOP_LEFT_0]: [0, 0, 100],
  [CellType.DEBUG_TOP_LEFT_1]: [200, 0, 0],
  [CellType.DEBUG_TOP_RIGHT_0]: [100, 0, 0],
  [CellType.DEBUG_TOP_RIGHT_1]: [200, 0, 200],
  
  [CellType.OCEAN]: [37, 140, 219],
  [CellType.GRASS]: [29, 179, 39],
  [CellType.BEACH]: [240, 217, 48],
  [CellType.FOREST]: [57, 117, 47],
  [CellType.ICE]: [250, 250, 250],
  [CellType.SAND]: [217, 191, 140],
  [CellType.TUNDRA]: [150, 209, 195],

  [CellType.RIVER]: [26, 118, 189],
  [CellType.RIVER_MOUTH]: [16, 108, 179],
  [CellType.RIVER_SOURCE]: [36, 128, 199],

  [CellType.TREE]: [7, 59, 21],
  [CellType.ROAD]: [128, 83, 11],
}

const renderOrder: CellType[] = [
  CellType.RIVER,
  CellType.RIVER_MOUTH,
  CellType.RIVER_SOURCE,
  CellType.OCEAN,
  CellType.GRASS,
  CellType.BEACH,
  CellType.FOREST,
  CellType.ICE,
  CellType.SAND,
  CellType.TUNDRA,
]

const directionCellTypes = {
  [Direction.SE]: CellType.DEBUG_SE,
  [Direction.NE]: CellType.DEBUG_NE,
  [Direction.N]: CellType.DEBUG_N,
  [Direction.NW]: CellType.DEBUG_NW,
  [Direction.SW]: CellType.DEBUG_SW,
  [Direction.S]: CellType.DEBUG_S,
}

const cornerCellTypes = {
  [Corner.RIGHT]: CellType.DEBUG_RIGHT,
  [Corner.BOTTOM_RIGHT]: CellType.DEBUG_BOTTOM_RIGHT,
  [Corner.BOTTOM_LEFT]: CellType.DEBUG_BOTTOM_LEFT,
  [Corner.LEFT]: CellType.DEBUG_LEFT,
  [Corner.TOP_LEFT]: CellType.DEBUG_TOP_LEFT,
  [Corner.TOP_RIGHT]: CellType.DEBUG_TOP_RIGHT,
}

const cornerSideCellTypes = {
  [Corner.RIGHT]: [CellType.DEBUG_RIGHT_0, CellType.DEBUG_RIGHT_1],
  [Corner.BOTTOM_RIGHT]: [CellType.DEBUG_BOTTOM_RIGHT_0, CellType.DEBUG_BOTTOM_RIGHT_1],
  [Corner.BOTTOM_LEFT]: [CellType.DEBUG_BOTTOM_LEFT_0, CellType.DEBUG_BOTTOM_LEFT_1],
  [Corner.LEFT]: [CellType.DEBUG_LEFT_0, CellType.DEBUG_LEFT_1],
  [Corner.TOP_LEFT]: [CellType.DEBUG_TOP_LEFT_0, CellType.DEBUG_TOP_LEFT_1],
  [Corner.TOP_RIGHT]: [CellType.DEBUG_TOP_RIGHT_0, CellType.DEBUG_TOP_RIGHT_1],
}

const terrainPrimaryCellTypes: Partial<Record<TerrainType, CellType>> = {
  [TerrainType.OCEAN]: CellType.OCEAN,
  [TerrainType.GRASSLAND]: CellType.GRASS,
  [TerrainType.FOREST]: CellType.FOREST,
  [TerrainType.GLACIAL]: CellType.ICE,
  [TerrainType.TAIGA]: CellType.FOREST,
  [TerrainType.TUNDRA]: CellType.TUNDRA,
  [TerrainType.DESERT]: CellType.SAND,
  [TerrainType.RIVER]: CellType.RIVER,
  [TerrainType.RIVER_MOUTH]: CellType.RIVER_MOUTH,
  [TerrainType.RIVER_SOURCE]: CellType.RIVER_SOURCE,
};

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

    // hex edge features
    ((2 ** (13 + Direction.SE)) * Number(hexTile.edgeRoads[Direction.SE])) +
    ((2 ** (13 + Direction.NE)) * Number(hexTile.edgeRoads[Direction.NE])) +
    ((2 ** (13 + Direction.N)) * Number(hexTile.edgeRoads[Direction.N])) +
    ((2 ** (13 + Direction.NW)) * Number(hexTile.edgeRoads[Direction.NW])) +
    ((2 ** (13 + Direction.SW)) * Number(hexTile.edgeRoads[Direction.SW])) +
    ((2 ** (13 + Direction.S)) * Number(hexTile.edgeRoads[Direction.S]))
  );
}

const edgeCenterPoints: DirectionMap<Coord> = {
  [Direction.SE]: [56, 44],
  [Direction.NE]: [56, 15],
  [Direction.N]: [31, 0],
  [Direction.NW]: [7, 15],
  [Direction.SW]: [7, 44],
  [Direction.S]: [31, 59],
};

export const OFFSET_Y = 10;

function placeObject(
  autogenLayer: ndarray,
  autogenObjects: Tileset<AutogenObjectTile>,
  tileID: number,
  pos: Coord,
) {
  const { x: tx, y: ty, width, height } = autogenObjects.tileFrame.get(tileID);
  for (let x = tx; x < (tx + width); x++) {
    for (let y = ty; y < (ty + height); y++) {
      const index = getImageIndexFromCoord([x, y], autogenObjects.imageData.width);
      const r = autogenObjects.imageData.data[index] / 255;
      const g = autogenObjects.imageData.data[index + 1] / 255;
      const b = autogenObjects.imageData.data[index + 2] / 255;
      const a = autogenObjects.imageData.data[index + 3] / 255;
      if (a > 0) {
        const ax = ((x - tx) + pos[0]) - 7;
        const ay = ((y - ty) + pos[1]) - 14;
        autogenLayer.set(ax, ay, 0, r);
        autogenLayer.set(ax, ay, 1, g);
        autogenLayer.set(ax, ay, 2, b);
        autogenLayer.set(ax, ay, 3, a);
      }
    }
  }
}

function drawHexTile(
  hexTile: HexTile,
  width: number,
  height: number,
  templateGrid: ndarray,
  autogenObjects: Tileset<AutogenObjectTile>,
): PIXI.Texture {
  const grid = new TileGrid(hexTile, width, height);
  const centerPoint: Coord = [32, 32 + OFFSET_Y];
  let cellTypePoints = new Map();

  // replace template grid with correct cell types
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < (height - OFFSET_Y); y++) {
      grid.set(x, y + OFFSET_Y, templateGrid.get(x, y));
    }
  }

  const cellTypeReplacements = new Map<CellType, CellType>();
  for (const direction of directionIndexOrder) {
    const edgeTerrainType = hexTile.edgeTerrainTypes[direction] as TerrainType;
    cellTypeReplacements.set(
      directionCellTypes[direction],
      terrainPrimaryCellTypes[edgeTerrainType]
    );
  }

  for (const corner of cornerIndexOrder) {
    const cornerTerrainType = hexTile.cornerTerrainTypes[corner] as TerrainType;
    cellTypeReplacements.set(
      cornerCellTypes[corner],
      terrainPrimaryCellTypes[cornerTerrainType]
    );

    for (let i = 0; i <= 1; i++) {
      const dir = cornerDirections[corner][i];
      let cornerSideTerrainType = hexTile.edgeTerrainTypes[dir] as TerrainType;
      if (
        // cornerTerrainType === TerrainType.RIVER || 
        cornerTerrainType === TerrainType.RIVER_MOUTH || 
        (terrainTransitions[hexTile.edgeTerrainTypes[dir]] &&
          terrainTransitions[hexTile.edgeTerrainTypes[dir]].includes(cornerTerrainType))
      ) {
        cornerSideTerrainType = cornerTerrainType;
      }
      
      cellTypeReplacements.set(
        cornerSideCellTypes[corner][i],
        terrainPrimaryCellTypes[cornerSideTerrainType],
      );
    }
  }

  // replace debug cell types with real cell types
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const cellType = grid.get(x, y);
      if (cellTypeReplacements.has(cellType)) {
        grid.set(x, y, cellTypeReplacements.get(cellType));
      }
    }
  }

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const cellType = grid.get(x, y);
      if (cellType !== CellType.NONE && cellType !== CellType.DEBUG_CENTER) {
        if (cellTypePoints.has(cellType)) {
          cellTypePoints.get(cellType).push([x, y]);
        } else {
          cellTypePoints.set(cellType, [[x, y]]);
        }
      }
    }
  }

  // flood fill center of tile
  grid.floodFill(
    Math.round(width / 2),
    Math.round(height / 2),
    CellType.DEBUG_CENTER,
    value => value === 0,
  );

  // terrain transitions
  for (let count = 1; count <= 4; count++) {
    for (const cellType of renderOrder) {
      const cells = cellTypePoints.get(cellType);
      if (!cells) continue;
      let newCells: CoordArray;
      if (cellType === CellType.RIVER && count >= 3) {
        continue;
      }
      newCells = grid.expandNaturally(
        cells,
        value => value == CellType.DEBUG_CENTER,
        cellType,
        1,
        cellType === CellType.RIVER ? 0.85 : 0.60,
      );
      grid.removeIslandNeighbors(
        cells,
        CellType.DEBUG_CENTER,
        cellType,
        cellType,
      );
      grid.removeIslandNeighbors(
        cells,
        cellType,
        CellType.DEBUG_CENTER,
        CellType.DEBUG_CENTER,
      );
      cellTypePoints.set(cellType, newCells);
    }
  }

  // roads
  let roadCenter = centerPoint;
  let roadPoints: CoordArray = [];
  for (const direction of directionIndexOrder) {
    if (hexTile.edgeRoads[direction]) {
      roadPoints.push(edgeCenterPoints[direction]);
    }
  }
  if (roadPoints.length > 1) {
    roadCenter = midpointPoints(roadPoints);
  }

  const randomizePoint = (point: Coord, range: number): Coord => {
    return [
      point[0] + (Math.round((Math.random() - 0.5) * 5)),
      point[1] + (Math.round((Math.random() - 0.5) * 5)),
    ];
  }
  roadCenter = randomizePoint(roadCenter, 5);

  let roadCells = [];
  for (const direction of directionIndexOrder) {
    if (hexTile.edgeRoads[direction]) {
      const [x, y] = edgeCenterPoints[direction];
      const center = randomizePoint(midpoint(roadCenter, [x, y]), 5);
      const c1 = rotatePoint(
        center,
        roadCenter,
        90,
      );
      const c2 = rotatePoint(
        center,
        roadCenter,
        -90,
      );
      const cells = grid.getNoisyLine(
        roadCenter,
        [x, y],
        c1,
        c2,
        CellType.ROAD,
        3,
        0.30
      );
      for (const [cx, cy] of cells) {
        grid.set(cx, cy, CellType.ROAD);
        roadCells.push([cx, cy]);
      }
    }
  }
  grid.expand(
    roadCells,
    value => value !== CellType.NONE,
    CellType.ROAD,
    1,
  )

  // features
  let features: Coord[] = [];
  const poissonDisk = new FastPoissonDiskSampling({
    shape: [width, height],
    radius: 5,
    tries: 10,
  }, Math.random);
  poissonDisk.fill();
  const points = poissonDisk.getAllPoints() as CoordArray;
  if (points.length > 0) {
    for (const [x, y] of points) {
      const cx = Math.round(x);
      const cy = Math.round(y);
      if (grid.get(cx, cy) !== CellType.NONE) {
        // grid.set(cx, cy, CellType.TREE);
        features.push([cx, cy]);
      }
    }
  }

  const centerCellType = terrainPrimaryCellTypes[hexTile.terrainType];
  grid.replaceAll(CellType.DEBUG_CENTER, centerCellType);
  
  const autogenLayer = ndarray(new Float32Array(width * height * 4), [width, height, 4]);
  for (const feature of features) {
    placeObject(autogenLayer, autogenObjects, 20, feature);
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
      const r_o = autogenLayer.get(x, y, 0);
      const g_o = autogenLayer.get(x, y, 1);
      const b_o = autogenLayer.get(x, y, 2);
      const a_o = autogenLayer.get(x, y, 3);
      if (a_o !== 0) {
        buffer[(i * dim) + 0] = r_o;
        buffer[(i * dim) + 1] = g_o;
        buffer[(i * dim) + 2] = b_o;
        buffer[(i * dim) + 3] = a_o;
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
  templateGrid: ndarray;

  constructor(
    private renderer: PIXI.Renderer,
    private assets: Assets,
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

    // generate template grid buffer
    const templateGridBuffer = new Uint8Array(this.tileWidth * this.tileHeight);
    this.templateGrid = ndarray(templateGridBuffer, [this.tileWidth, this.tileHeight]);
    const templateImage = (assets.hexTemplate.texture.baseTexture.resource as any).source as HTMLImageElement;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.drawImage(templateImage, 0, 0);
    const imageData = ctx.getImageData(0, 0, this.tileWidth, this.tileHeight);
    for (let x = 0; x < this.tileWidth; x++) {
      for (let y = 0; y < this.tileWidth; y++) {
        const index = (x + y * this.tileWidth) * 4;
        this.templateGrid.set(x, y, CellType.NONE);
        const thisColor: ColorArray = [
          imageData.data[index],
          imageData.data[index + 1],
          imageData.data[index + 2],
        ];
       
        for (const direction of directionIndexOrder) {
          const cellType = directionCellTypes[direction];
          const color = cellTypeColor[cellType];
          if (colorArrayMatches(color, thisColor)) {
            this.templateGrid.set(x, y, cellType);
          }
        }

        for (const corner of cornerIndexOrder) {
          const cellType = cornerCellTypes[corner];
          const color = cellTypeColor[cellType];
          if (colorArrayMatches(color, thisColor)) {
            this.templateGrid.set(x, y, cellType);
          }

          for (let i = 0; i <= 1; i++) {
            const cellType = cornerSideCellTypes[corner][i];
            const color = cellTypeColor[cellType];
            if (colorArrayMatches(color, thisColor)) {
              this.templateGrid.set(x, y, cellType);
            }
          }
        }
      }
    }
    console.log('template grid', this.templateGrid);
  }

  static COLUMNS = 200;
  static PADDING = 10;
  static MAX_TILES = 20_000;

  get tileWidth() {
    return this.assets.hexTemplate.texture.baseTexture.width;
  }

  get tileHeight() {
    return this.assets.hexTemplate.texture.baseTexture.width;
  }

  get tileOffset() {
    return 0;
  }

  get pixelWidth() {
    return WorldTileset.COLUMNS * (this.tileWidth + WorldTileset.PADDING);
  }

  get pixelHeight() {
    return this.rows * (this.tileHeight + this.tileOffset + WorldTileset.PADDING);
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
    const texture = drawHexTile(
      hexTile,
      this.tileWidth,
      this.tileHeight + OFFSET_Y,
      this.templateGrid,
      this.assets.autogenObjects,
    );
    const sprite = new PIXI.Sprite(texture);
    this.hexTileMap.set(id, hexTile);
    sprite.position.set(
      (index % WorldTileset.COLUMNS) * (this.tileWidth + WorldTileset.PADDING),
      (Math.floor(index / WorldTileset.COLUMNS)) * (this.tileHeight + this.tileOffset + WorldTileset.PADDING),
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
      (index % WorldTileset.COLUMNS) * (this.tileWidth + WorldTileset.PADDING),
      (Math.floor(index / WorldTileset.COLUMNS)) * (this.tileHeight + this.tileOffset + WorldTileset.PADDING),
      this.tileWidth + WorldTileset.PADDING,
      this.tileHeight + this.tileOffset + WorldTileset.PADDING,
    ));
    this.hexTileTexture.set(id, texture);
    return texture;
  }

  public updateTileset() {
    this.renderer.render(this.container, this.renderTexture);
  }
}