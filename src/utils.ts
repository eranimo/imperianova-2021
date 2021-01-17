import ndarray from 'ndarray';
import { CoordArray, Coord } from './types';
export function octaveNoise(
  noiseFunc: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  frequency: number = 1,
) {
  let total = 0;
  let frequency_ = frequency;
  let amplitude = 1;
  let maxValue = 0; // Used for normalizing result to 0.0 - 1.0
  for (let i = 0; i < octaves; i++) {
    total += noiseFunc(x * frequency_, y * frequency_) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency_ *= 2;
  }

  return total / maxValue;
}

export function getNeighbors(
  x: number, y: number,
  diagonal?: boolean,
): CoordArray {
  const neighbors: CoordArray = [
    [x - 1, x],
    [x + 1, x],
    [x, x - 1],
    [x, x + 1],
  ]
  if (diagonal) {
    neighbors.push([x - 1, y - 1]);
    neighbors.push([x + 1, y + 1]);
    neighbors.push([x - 1, y + 1]);
    neighbors.push([x + 1, y - 1]);
  }

  return neighbors;
}

export function forEachNeighbor(
  matrix: ndarray,
  x: number, y: number,
  func: (value: number, x: number, y: number) => void,
) {
  // for (let ny = -1; ny <= 1; ny++) {
  //   for (let nx = -1; nx <= 1; nx++) {
  //     func(matrix.get(x + nx, y + ny), x + nx, y + ny);
  //   }
  // }
  func(matrix.get(x - 1, y), x - 1, y);
  func(matrix.get(x + 1, y), x + 1, y);
  func(matrix.get(x, y - 1), x, y - 1);
  func(matrix.get(x, y + 1), x, y + 1);

}

export function anyNeighbor(
  matrix: ndarray,
  x: number, y: number,
  func: (value: number) => boolean,
) {
  for (let ny = -1; ny <= 1; ny++) {
    for (let nx = -1; nx <= 1; nx++) {
      if (func(matrix.get(x + nx, y + ny))) {
        return true;
      }
    }
  }
  return false;
}

export function floodFill(
  matrix: ndarray,
  row: number, col: number,
  value: number,
  isValidCoordinates: (matrix: ndarray, x: number, y: number) => boolean
) {
  const fillStack: [x: number, y: number][] = [];
  fillStack.push([row, col]);

  while(fillStack.length > 0) {
    var [row, col] = fillStack.pop();

    if (!isValidCoordinates(matrix, row, col))
      continue;

    if (matrix.get(row, col) == value)
      continue;

    matrix.set(row, col, value);

    fillStack.push([row + 1, col]);
    fillStack.push([row - 1, col]);
    fillStack.push([row, col + 1]);
    fillStack.push([row, col - 1]);
  }
  return fillStack;
}