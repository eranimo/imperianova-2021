import { ColorArray } from '../types';

export class Color {
  constructor(
    private color: ColorArray,
    public alpha: number = 255,
  ) {}

  get r() {
    return this.color[0];
  }

  get g() {
    return this.color[1];
  }

  get b() {
    return this.color[2];
  }

  set(color: ColorArray) {
    this.color = color;
  }

  equals(color: Color) {
    return (
      color.r === this.r &&
      color.g === this.g &&
      color.b === this.b
    );
  }
}