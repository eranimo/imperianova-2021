import { Point } from './Point';

export class PointSet {
  private data: Map<number, Map<number, Point>>;

  constructor() {
    this.data = new Map();
  }

  add(point: Point) {
    if (this.data.has(point.x)) {
      this.data.get(point.x).set(point.y, point);
    } else {
      this.data.set(point.x, new Map([
        [point.y, point]
      ]));
    }
  }

  has(point: Point) {
    if (this.data.has(point.x)) {
      return this.data.get(point.x).has(point.y);
    }
    return false;
  }

  *[Symbol.iterator]() {
    for (const [x, points] of this.data) {
      for (const [y, point] of points) {
        yield point;
      }
    }
  }
}