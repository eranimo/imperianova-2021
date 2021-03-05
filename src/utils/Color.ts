import {
  ColorArray
} from '../types';

function normalize_rgb_value(color: number, m: number) {
  color = Math.floor((color + m) * 255);
  if (color < 0) {
    color = 0;
  }
  return color;
}

export class Color {
  constructor(
    private rgb: ColorArray,
    public alpha: number = 255,
  ) {}

  static fromHSL(h: number, s: number, l: number) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r: number;
    let g: number;
    let b: number;

    if (h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      g = 0;
      b = c;
    } else {
      r = c;
      g = 0;
      b = x;
    }

    r = normalize_rgb_value(r, m);
    g = normalize_rgb_value(g, m);
    b = normalize_rgb_value(b, m);
    return new Color([r, g, b], 255);
  }

  get r() {
    return this.rgb[0];
  }

  get g() {
    return this.rgb[1];
  }

  get b() {
    return this.rgb[2];
  }

  set(color: ColorArray) {
    this.rgb = color;
  }

  getHSL() {

  }

  equals(color: Color) {
    return (
      color.r === this.r &&
      color.g === this.g &&
      color.b === this.b
    );
  }

  [Symbol.toPrimitive]() {
    return this.toNumber();
  }

  toNumber() {
    return (this.r << 16) + (this.g << 8) + (this.b);
  }
}