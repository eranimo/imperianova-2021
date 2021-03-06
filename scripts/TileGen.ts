import { Size, Coord, CoordArray, ColorArray } from '../src/types';
import Jimp from 'jimp';
import ndarray from 'ndarray';
import { colorToNumber, getPositionAlongTheLine, midpoint, roundPoint, bresenhamLinePlot, floodFill } from '../src/utils';
import { isArray } from 'lodash';
import { boolean } from 'yargs';
import { TerrainType } from '../src/game/world/terrain';
import { PatternGenerator } from './patternGenerator';


function getCellsBetweenPoints(line: CoordArray): CoordArray {
  let points = [];
  line.forEach((point, index) => {
    const nextPoint = line[index + 1];
    if (nextPoint) {
      const p1 = roundPoint(point);
      const p2 = roundPoint(nextPoint);
      points.push(...bresenhamLinePlot(
        p1[0],
        p1[1],
        p2[0],
        p2[1],
      ));
    }
  });
  return points;
}

export class TileQuery {
  constructor(
    private gen: TileGen,
    public cells: CoordArray = []
  ) {
    
  }

  clear() {
    this.cells = [];
    return this;
  }

  /**
   * Gets the cells in a noisy line from two points, using two control points
   * @param p1 First point
   * @param p2 Second point
   * @param c1 First control point
   * @param c2 Second control point
   * @param subdivisions Number of times to divide the line
   * @param range Range, in percent, between line and control points to be noisy
   */
  noisyLine(
    p1: Coord,
    p2: Coord,
    c1: Coord,
    c2: Coord,
    subdivisions: number = 1,
    range: number = 0.5,
  ) {
    const line = [
      p1,
      ...this.subdivideLine(p1, p2, c1, c2, subdivisions, range),
      p2,
    ];
    if (line) {
      this.add(getCellsBetweenPoints(line));
    }
    return this;
  }

  private subdivideLine(
    p1: Coord,
    p2: Coord,
    c1: Coord,
    c2: Coord,
    subdivisions: number = 1,
    range: number = 0.5,
  ) {
    if (subdivisions === 0) {
      return [];
    }
    const r = Math.random() * range;
    const p = (0.50 - (range / 2)) + r;
    const center = getPositionAlongTheLine(c1, c2, p);
    const result: CoordArray = [];
    const d1 = this.subdivideLine(p1, center, midpoint(p1, c1), midpoint(p1, c2), subdivisions - 1, range);
    if (d1) {
      result.push(...d1);
    }
    result.push(center);
    const d2 = this.subdivideLine(center, p2, midpoint(p2, c1), midpoint(p2, c2), subdivisions - 1, range);
    if (d2) {
      result.push(...d2);
    }
    return result;
  }

  /**
   * Gets the cells in a line from two points
   * @param p1 First point
   * @param p2 Second point
   */
  line(p1: Coord, p2: Coord): TileQuery {
    const cells = getCellsBetweenPoints([p1, p2]);
    this.add(cells);
    return this;
  }

  // add all neighbors of the current cells to the query
  expand(
    canExpand: (pos: Coord) => boolean,
    query: TileQuery = this,
  ) {
    const newCells = [];
    const cells = query.cells;
    for (const cell of cells) {
      const w: Coord = [cell[0] - 1, cell[1]];
      const e: Coord = [cell[0] + 1, cell[1]];
      const n: Coord = [cell[0], cell[1] - 1];
      const s: Coord = [cell[0], cell[1] + 1];
      if (this.gen.isValidCell(w) && canExpand(w)) {
        newCells.push(w);
      }
      if (this.gen.isValidCell(e) && canExpand(e)) {
        newCells.push(e);
      }
      if (this.gen.isValidCell(n) && canExpand(n)) {
        newCells.push(n);
      }
      if (this.gen.isValidCell(s) && canExpand(s)) {
        newCells.push(s);
      }
    }
    this.add(newCells);
    return this;
  }

  /**
   * Merges two TileQuery instances
   * @param query Other TileQuery instance
   */
  merge(query: TileQuery): TileQuery {
    this.cells = [
      ...this.cells,
      ...query.cells,
    ];
    return this;
  }

  filter(func: (cell: Coord) => boolean) {
    this.cells = this.cells.filter(func);
    return this;
  }

  add(cells: CoordArray) {
    for (const pos of cells) {
      if (this.gen.isValidCell(pos)) {
        this.cells.push(pos);
      }
    }
  }

  applyPattern(patternGen: PatternGenerator) {
    for (const cell of this.cells) {
      const color = this.gen.getCellColor(cell);
      const newColor = patternGen(cell, color);
      if (newColor) {
        this.gen.setCellColor(cell, newColor);
      }
    }
  }

  has(cell: Coord) {
    for (const [x, y] of this.cells) {
      if (cell[0] === x && cell[1] === y) {
        return true;
      }
    }
    return false;
  }

  /**
   * Sets the color of each cell in this query
   * @param color Color to set
   */
  paint(color: ColorArray) {
    if (!isArray(color)) {
      throw new Error(`Paint requires a valid color, given ${color}`);
    }
    for (const pos of this.cells) {
      this.gen.setCellColor(pos, color);
    }
    return this;
  }
}

export class TileGen {
  color: ndarray<number>;

  constructor(
    public size: Size,
    public isValidCell: (pos: Coord) => boolean = () => true,
  ) {
    const { width, height } = size;
    const colorBuffer = new Uint8ClampedArray(width * height * 4);
    colorBuffer.fill(0);
    this.color = ndarray(colorBuffer, [width, height, 4]);
  }

  forEachCell(func: (cell: Coord) => void) {
    for (let x = 0; x < this.size.width; x++) {
      for (let y = 0; y < this.size.height; y++) {
        func([x, y]);
      }
    }
  }

  setCellColor(pos: Coord, color: ColorArray, alpha: number = 255) {
    this.color.set(pos[0], pos[1], 0, color[0]);
    this.color.set(pos[0], pos[1], 1, color[1]);
    this.color.set(pos[0], pos[1], 2, color[2]);
    this.color.set(pos[0], pos[1], 3, alpha);
  }

  getCellColor(pos: Coord): ColorArray {
    return [
      this.color.get(pos[0], pos[1], 0),
      this.color.get(pos[0], pos[1], 1),
      this.color.get(pos[0], pos[1], 2),
    ];
  }

  isCellColor(pos: Coord, color: ColorArray) {
    const posColor = this.getCellColor(pos);
    return (
      posColor[0] === color[0] &&
      posColor[1] === color[1] &&
      posColor[2] === color[2]
    )
  }

  getAlpha(pos: Coord) {
    return this.color.get(pos[0], pos[1], 3);
  }

  query() {
    return new TileQuery(this);
  }

  getMatchingCells(
    color: ColorArray,
  ) {
    let cells: CoordArray = [];
    this.forEachCell(cell => {
      if (this.isCellColor(cell, color)) {
        cells.push(cell);
      }
    });
    return new TileQuery(this, cells);
  }

  queryCells(
    func: (cell: Coord) => boolean,
  ) {
    let cells: CoordArray = [];
    this.forEachCell(cell => {
      if (func(cell)) {
        cells.push(cell);
      }
    });
    return new TileQuery(this, cells);
  }

  someNeighbor(pos: Coord, func: (cell: Coord) => boolean) {
    return (
      func([pos[0] - 1, pos[1]]) ||
      func([pos[0] + 1, pos[1]]) ||
      func([pos[0], pos[1] - 1]) ||
      func([pos[0], pos[1] + 1])
    );
  }

  someDiagonal(pos: Coord, func: (cell: Coord) => boolean) {
    return (
      func([pos[0] - 1, pos[1] - 1]) ||
      func([pos[0] + 1, pos[1] + 1]) ||
      func([pos[0] - 1, pos[1] + 1]) ||
      func([pos[0] + 1, pos[1] - 1])
    );
  }

  paintCells(func: (cell: Coord) => ColorArray) {
    const ops: [cell: Coord, color: ColorArray][] = [];
    this.forEachCell(cell => {
      const color = func(cell);
      if (color) {
        ops.push([cell, color]);
      }
    });
    for (const [cell, color] of ops) {
      this.setCellColor(cell, color);
    }
  }

  floodfill(
    pos: Coord,
    color: ColorArray,
    canFill?: (pos: Coord) => boolean,
    useDiagonals: boolean = false,
  ) {
    const fillStack: CoordArray = [];
    fillStack.push(pos);

    while(fillStack.length > 0) {
      var newPos = fillStack.pop();
      var [x, y] = newPos;

      if (!this.isValidCell(newPos)) continue;
      if (canFill && !canFill(newPos)) continue;
      if (this.isCellColor(newPos, color)) continue;
      this.setCellColor(newPos, color);
      fillStack.push([x + 1, y]);
      fillStack.push([x - 1, y]);
      fillStack.push([x, y + 1]);
      fillStack.push([x, y - 1]);
      if (useDiagonals) {
        fillStack.push([x + 1, y + 1]);
        fillStack.push([x - 1, y - 1]);
        fillStack.push([x + 1, y - 1]);
        fillStack.push([x - 1, y + 1]);
      }
    }
    return new TileQuery(this, fillStack);
  }

  apply(gen: TileGen, pos: Coord) {
    for (let x = pos[0]; x < pos[0] + gen.size.width; x++) {
      for (let y = pos[1]; y < pos[1] + gen.size.height; y++) {
        const nx = x - pos[0];
        const ny = y - pos[1];
        if (gen.isValidCell([nx, ny])) {
          const color = gen.getCellColor([nx, ny]);
          this.setCellColor([x, y], color);
        }
      }
    }
  }

  /**
   * Adds this tile to the given image at the given coordinate
   * @param image Jimp instance
   * @param coord
   */
  addToImage(image: Jimp, topLeftCoord: Coord) {
    image.scan(topLeftCoord[0], topLeftCoord[1], this.size.width, this.size.height, (x, y) => {
      const pos: Coord = [x - topLeftCoord[0], y - topLeftCoord[1]];
      const [r, g, b] = this.getCellColor(pos);
      const a = this.getAlpha(pos);
      image.setPixelColor(Jimp.rgbaToInt(r, g, b, a), x, y);
    });
  }
}