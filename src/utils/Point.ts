export class Point {
  constructor(
    public x: number,
    public y: number,
  ) {}

  round() {
    return new Point(
      Math.round(this.x),
      Math.round(this.y),
    );
  }

  randomize(range: number, rng: () => number = Math.random) {
    return new Point(
      this.x + (Math.round((rng() - 0.5) * range)),
      this.y + (Math.round((rng() - 0.5) * range)),
    );
  }

  midpoint(point: Point) {
    return new Point(
      (point.x + this.x) / 2,
      (point.y + this.y) / 2,
    );
  }

  pointOnLine(point: Point, percentage: number) {
    return new Point(
      this.x * (1.0 - percentage) + point.x * percentage,
      this.y * (1.0 - percentage) + point.y * percentage,
    );
  }

  distance(point: Point) {
    return Math.sqrt(
      Math.pow(this.x - point.x, 2) + 
      Math.pow(this.y - point.y, 2)
    );
  }

  rotate(center: Point, angle: number) {
    const radians = (Math.PI / 180) * angle;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const nx = (cos * (this.x - center.x)) + (sin * (this.y - center.y)) + center.x;
    const ny = (cos * (this.y - center.y)) - (sin * (this.x - center.x)) + center.y;
    return new Point(nx, ny);
  }
  
  equals(point: Point) {
    return (
      point.x === this.x &&
      point.y === this.y
    );
  }
}