import ndarray from 'ndarray';
import { CoordArray, Coord, ColorArray } from './types';


export function octaveNoise(
  noiseFunc: (x: number, y: number, z: number) => number,
  x: number,
  y: number,
  z: number,
  octaves: number,
  persistence: number,
  frequency: number = 1,
) {
  let total = 0;
  let frequency_ = frequency;
  let amplitude = 1;
  let maxValue = 0; // Used for normalizing result to 0.0 - 1.0
  for (let i = 0; i < octaves; i++) {
    total += noiseFunc(x * frequency_, y * frequency_, z * frequency_) * amplitude;
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

export function midpoint(p1: Coord, p2: Coord): Coord {
  return [
    (p1[0] + p2[0]) / 2,
    (p1[1] + p2[1]) / 2,
  ];
}

export function distance(p1: Coord, p2: Coord): number {
  return Math.sqrt(
    Math.pow(p1[0] - p2[0], 2) + 
    Math.pow(p1[1] - p2[1], 2)
  )
}

export function midpointPoints(points: CoordArray): Coord {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p[0];
    y += p[1];
  }
  return [
    Math.round(x / points.length),
    Math.round(y / points.length)
  ];
}

export function toRadians(deg: number) {
  return deg * (Math.PI / 180);
}

export function rotatePoint(center: Coord, point: Coord, angle: number): Coord {
  const [cx, cy] = center;
  const [x, y] = point;
  var radians = (Math.PI / 180) * angle,
    cos = Math.cos(radians),
    sin = Math.sin(radians),
    nx = (cos * (x - cx)) + (sin * (y - cy)) + cx,
    ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
  return [nx, ny];
}

export function roundPoint(point: Coord): Coord {
  return [
    Math.round(point[0]),
    Math.round(point[1]),
  ];
}

export function getPositionAlongTheLine(
  p1: Coord,
  p2: Coord,
  percentage: number
): Coord {
  return [
    p1[0] * (1.0 - percentage) + p2[0] * percentage,
    p1[1] * (1.0 - percentage) + p2[1] * percentage,
  ];
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

// https://dev.to/codeguppy/flood-fill-recursion-or-no-recursion-3fop
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

export function colorToNumber(color: ColorArray) {
  return (color[0] << 16) + (color[1] << 8) + (color[2]);
}

export function bresenhamLinePlot(x0: number, y0: number, x1: number, y1: number): CoordArray {
  let dots: CoordArray = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = (x0 < x1) ? 1 : -1;
  let sy = (y0 < y1) ? 1 : -1;
  let err = dx - dy;

  dots.push([x0, y0]);

  while(!((x0 == x1) && (y0 == y1))) {
    let e2 = err << 1;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
    dots.push([x0, y0]);
  }

  return dots;
}

class AssertionError extends Error {}
export function assert(condition: boolean, message?: string) {
  if (!condition) {
    throw new AssertionError(message);
  }
}

// http://members.chello.at/~easyfilter/bresenham.html
export function plotLine(
  x0: number, y0: number, x1: number, y1: number,
  setPixel: (x: number, y: number) => void,
){
  let dx =  Math.abs(x1 - x0);
  let sx = x0<x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  let sy = y0<y1 ? 1 : -1; 
  let err = dx + dy;
  let e2: number; // error value e_xy

  while (!(x0 == x1 && y0 == y1)) {  /* loop */
    setPixel(x0,y0);
    e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; } /* e_xy+e_x > 0 */
    if (e2 <= dx) { err += dx; y0 += sy; } /* e_xy+e_y < 0 */
  }
}

export function plotQuadBezierSeg(
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number,
  setPixel: (x: number, y: number) => void,
) {
  let sx = x2 - x1;
  let sy = y2 - y1;
  let xx = x0 - x1;
  let yy = y0-y1
  let xy: number; // relative values for checks
  let dx: number
  let dy: number;
  let err: number;
  let cur = xx * sy - yy * sx; // curvature

  assert(xx * sx <= 0 && yy * sy <= 0); // sign of gradient must not change

  if (sx * sx + sy * sy > xx * xx + yy * yy) {
    // begin with longer part
    x2 = x0;
    x0 = sx+x1;
    y2 = y0;
    y0 = sy+y1;
    cur = -cur;  // swap P0 P2
  }  
  if (cur != 0) {                                    /* no straight line */
    xx += sx; xx *= sx = x0 < x2 ? 1 : -1;           /* x step direction */
    yy += sy; yy *= sy = y0 < y2 ? 1 : -1;           /* y step direction */
    xy = 2*xx*yy; xx *= xx; yy *= yy;          /* differences 2nd degree */
    if (cur*sx*sy < 0) {                           /* negated curvature? */
      xx = -xx; yy = -yy; xy = -xy; cur = -cur;
    }
    dx = 4.0*sy*cur*(x1-x0)+xx-xy;             /* differences 1st degree */
    dy = 4.0*sx*cur*(y0-y1)+yy-xy;
    xx += xx; yy += yy; err = dx+dy+xy;                /* error 1st step */    
    do {                              
      setPixel(x0,y0);                                     /* plot curve */
      if (x0 == x2 && y0 == y2) return;  /* last pixel -> curve finished */
      y1 = Number(2*err < dx);                  /* save value for test of y step */
      if (2*err > dy) { x0 += sx; dx -= xy; err += dy += yy; } /* x step */
      if (    y1    ) { y0 += sy; dy -= xy; err += dx += xx; } /* y step */
    } while (dy < dx );           /* gradient negates -> algorithm fails */
  }
  plotLine(x0,y0, x2,y2, setPixel); //plot remaining part to end
}  

export function logGroupTime(label: string, closed: boolean = false) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      if (closed) {
        console.groupCollapsed(label);
      } else {
        console.group(label);
      }
      console.time(label);
      const result = originalMethod.apply(this, args);
      console.timeEnd(label);
      console.groupEnd();
      return result;
    }
  }
}

export function colorArrayMatches(color1: ColorArray, color2: ColorArray) {
  return (
    color1[0] === color2[0] &&
    color1[1] === color2[1] &&
    color1[2] === color2[2]
  )
}

export function getImageCoordFromIndex(index: number, width: number, height: number): Coord {
  const y = index / width;
  const x = index - y * width;
  return [x, y];
}

export function getImageIndexFromCoord(coord: Coord, width: number): number {
  return (coord[1] * width + coord[0]) * 4;
}

export function pickRandom<T>(array: Array<T>, rng: () => number = Math.random) {
  return array[Math.round(rng() * (array.length - 1))];
}

export class MultiMap<K, V> {
  private map: Map<K,V[]>;

  constructor() {
    this.map = new Map();
  }

  add(key: K, value: V) {
    if (this.map.has(key)) {
      this.map.get(key).push(value);
    } else {
      this.map.set(key, [value]);
    }
  }

  get(key: K): V[] {
    return this.map.get(key);
  }

  has(key: K) {
    return this.map.has(key);
  }

  *[Symbol.iterator](): Iterator<[K, V[]]> {
    for (const key of this.map.keys()) {
      yield [key, this.map.get(key)];
    }
  }
}