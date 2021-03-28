export class PairSet<T, V> {
  private data: Map<T, Map<T, V>> = new Map();

  add(first: T, second: T, value: V) {
    if (this.data.has(first)) {
      this.data.get(first).set(second, value);
    } else {
      this.data.set(first, new Map([
        [second, value],
      ]));
    }

    if (this.data.has(second)) {
      this.data.get(second).set(first, value);
    } else {
      this.data.set(second, new Map([
        [first, value],
      ]));
    }
  }

  has(first: T, second: T): boolean {
    return (
      this.data.has(first) && this.data.get(first).has(second)
      && this.data.has(second) && this.data.get(second).has(first)
    );
  }
}