import ndarray from 'ndarray';
import { floodFill, plotLine, getPositionAlongTheLine, midpoint, bresenhamLinePlot, roundPoint } from './utils';
import { HexTile, CellType } from './WorldTileset';
import { Coord, CoordArray } from './types';

export class TileGrid {
  public grid: ndarray;

  constructor(
    public hexTile: HexTile,
    public width: number,
    public height: number,
    buffer?: Uint8Array,
  ) {
    if (buffer) {
      this.grid = ndarray(buffer);
    } else {
      this.grid = ndarray(new Uint8Array(width * height), [width, height]);
    }
  }

  removeIslandNeighbors(
    cells: CoordArray,
    neighborCellType: CellType,
    checkCellType: CellType,
    toCellType: CellType,
  ) {
    for (const [x, y] of cells) {
      for (let nx = -1; nx <= 1; nx++) {
        for (let ny = -1; ny <= 1; ny++) {
          if (nx === 0 && ny === 0) continue;
          if (this.get(x + nx, y + ny) === neighborCellType) {
            const neighborCount = this.countNeighborsOfType(x + nx, y + ny, checkCellType, false);
            if (neighborCount >= 3) {
              this.set(x + nx, y + ny, toCellType);
            }
          }
        }
      }
    }
  }

  plotLine(p1: Coord, p2: Coord, cellType: CellType) {
    plotLine(
      p1[0],
      p1[1],
      p2[0],
      p2[1],
      (x, y) => this.set(x, y, cellType),
    );
  }

  getLines(line: CoordArray, cellType: CellType): CoordArray {
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

  getNoisyLine(
    p1: Coord,
    p2: Coord,
    c1: Coord,
    c2: Coord,
    cellType: CellType,
    subdivisions: number = 1,
    range: number = 0.5,
  ) {
    const line = [
      p1,
      ...this.subdivideLine(p1, p2, c1, c2, subdivisions, range),
      p2,
    ];
    if (line) {
      return this.getLines(line, cellType);
    }
  }

  // from https://www.redblobgames.com/maps/noisy-edges/
  private subdivideLine(
    p1: Coord,
    p2: Coord,
    c1: Coord,
    c2: Coord,
    subdivisions: number = 1,
    range: number = 0.5,
  ): CoordArray | null {
    if (subdivisions === 0) {
      return null;
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
    useDiagonals = false,
    chance: number = 1,
  ) {
    let validCells = [];
    this.forEachCell((x, y) => {
      if (this.get(x, y) === targetCellType) {
        const neighborCount = this.countNeighborsOfType(x, y, neighborCellType, useDiagonals);
        if (neighborCount >= validNeighborCount && Math.random() < chance) {
          validCells.push([x, y]);
        }
      }
    });

    for (const [x, y] of validCells) {
      this.set(x, y, toCellType);
    }
  }

  expand(
    cells: Coord[],
    isValidCell: (value: CellType) => boolean,
    toCellType: CellType,
    times: number = 1,
    chance: number = 1,
  ) {
    for (let count = 0; count < times; count++) {
      const newCells: CoordArray = [];
      let validCells: CoordArray = [];
      for (const [x, y] of cells) {
        validCells = [];
        for (let nx = -1; nx <= 1; nx++) {
          for (let ny = -1; ny <= 1; ny++) {
            if (nx === 0 && ny === 0) continue;
            if (isValidCell(this.get(x + nx, y + ny))) {
              validCells.push([x + nx, y + ny]);
            }
          }
        }
        for (const cell of validCells) {
          if (Math.random() < chance) {
            newCells.push(cell);
            this.set(cell[0], cell[1], toCellType);
          }
        }
      }
      cells = newCells;
      if (cells.length === 0) return [];
    }
    return cells;
  }

  expandNaturally(
    cells: Coord[],
    isValidCell: (value: CellType) => boolean,
    toCellType: CellType,
    times: number = 1,
    chance: number = 1,
  ) {
    for (let count = 0; count < times; count++) {
      const newCells: CoordArray = [];
      let validCells: CoordArray = [];
      for (const [x, y] of cells) {
        validCells = [];
        for (let nx = -1; nx <= 1; nx++) {
          for (let ny = -1; ny <= 1; ny++) {
            if (nx === 0 && ny === 0) continue;
            if (isValidCell(this.get(x + nx, y + ny))) {
              validCells.push([x + nx, y + ny]);
            }
          }
        }
        for (const cell of validCells) {
          const neighborCount = this.countNeighborsOfType(cell[0], cell[1], toCellType);
          if (Math.random() < (neighborCount / 7) && Math.random() < chance) {
            newCells.push(cell);
            this.set(cell[0], cell[1], toCellType);
          }
        }
      }
      cells = newCells;
      if (cells.length === 0) return [];
    }
    return cells;
  }


  /**
   * Transforms cells from one CellType to another, with a higher chance the more neighbors
   * of toCellType a cell of fromCellType has
   * @param fromCellType CellType of cells to "grow" into
   * @param toCellType CellType to transform to
   */
  grow(
    toCellType: CellType,
    isValidCell: (value: CellType) => boolean,
  ) {
    let validCells = [];
    this.forEachCell((x, y) => {
      if (isValidCell(this.get(x, y))) {
        const neighborCount = this.countNeighborsOfType(x, y, toCellType);
        if (Math.random() < (neighborCount / 7)) {
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
    diagonals: boolean = true
  ) {
    let count = 0;
    if (!diagonals) {
      if (this.get(x - 1, y) === cellType)
        count++;
      if (this.get(x + 1, y) === cellType)
        count++;
      if (this.get(x, y - 1) === cellType)
        count++;
      if (this.get(x, y + 1) === cellType)
        count++;
    } else {
      for (let nx = -1; nx <= 1; nx++) {
        for (let ny = -1; ny <= 1; ny++) {
          if (nx === 0 && ny === 0) continue;
          if (this.get(x + nx, y + ny) === cellType) {
            count++;
          }
        }
      }
    }
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

  replaceAll(fromCellType: CellType, toCellType: CellType) {
    this.forEachCell((x, y) => {
      if (this.get(x, y) === fromCellType) {
        this.set(x, y, toCellType);
      }
    });
  }

  floodFill(
    x: number,
    y: number,
    value: CellType,
    isValidCell: (value: CellType) => boolean
  ) {
    floodFill(
      this.grid,
      x,
      y,
      value,
      (matrix, x, y) => isValidCell(matrix.get(x, y))
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
