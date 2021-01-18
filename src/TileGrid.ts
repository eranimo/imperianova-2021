import ndarray from 'ndarray';
import { floodFill } from './utils';
import { HexTile, CellType } from './WorldTileset';

export class TileGrid {
  public grid: ndarray;

  constructor(
    public hexTile: HexTile,
    public width: number,
    public height: number
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
    chance: number = 1
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
    toCellType: CellType
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
    cellType: CellType
  ) {
    let count = 0;
    if (this.get(x - 1, y) === cellType)
      count++;
    if (this.get(x + 1, y) === cellType)
      count++;
    if (this.get(x, y - 1) === cellType)
      count++;
    if (this.get(x, y + 1) === cellType)
      count++;
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
