import { Size } from "src/types";
import ndarray from 'ndarray';
import { Point } from './Point';
import { Color } from './Color';

export class Image {
  private color: ndarray<number>;

  /**
   * Creates a 2D array of Colors, aka an image
   * @param size Size of image
   * @param initialData Uint8ClampedArray of 4 channel colors, 0 - 255
   */
  constructor(
    public size: Size,
    initialData?: Uint8ClampedArray,
  ) {
    const data = initialData ?? new Uint8ClampedArray(size.width * size.height * 4);
    data.fill(0);
    this.color = ndarray(data, [size.width, size.height, 4]);
  }

  set(point: Point, color: Color, alpha: number = 255) {
    this.color.set(point.x, point.y, 0, color[0]);
    this.color.set(point.x, point.y, 1, color[1]);
    this.color.set(point.x, point.y, 2, color[2]);
    this.color.set(point.x, point.y, 3, alpha);
  }

  get(point: Point) {
    return new Color([
      this.color.get(point.x, point.y, 0),
      this.color.get(point.x, point.y, 1),
      this.color.get(point.x, point.y, 2),
    ], this.color.get(point.x, point.y, 3));
  }

  isColor(point: Point, color: Color) {
    return this.get(point).equals(color);
  }

  *[Symbol.iterator]() {
    for (let x = 0; x < this.size.width; x++) {
      for (let y = 0; y < this.size.height; y++) {
        yield this.get(new Point(x, y));
      }
    }
  }
}