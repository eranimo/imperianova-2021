export class Grid2D<T> {
  protected value: T[];

  constructor(
    public width: number,
    public height: number,
    initialValue: T[] = [],
  ) {
    this.value = initialValue;
  }

  private getIndex(x: number, y: number) {
    return x + this.width * y;
  }

  set(x: number, y: number, value: T) {
    this.value[this.getIndex(x, y)] = value;
  }

  get(x: number, y: number) {
    return this.value[this.getIndex(x, y)];
  }

  fill(value: T) {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        this.set(x, y, value);
      }
    }
    return this;
  }

  *[Symbol.iterator](): Iterator<[number, number, T]> {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        yield [x, y, this.get(x, y)];
      }
    }
  }
}