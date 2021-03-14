export class MapSet<K, V> {
  private map: Map<K, Set<V>>;

  constructor() {
    this.map = new Map();
  }

  add(key: K, value: V) {
    if (this.map.has(key)) {
      this.map.get(key).add(value);
    } else {
      this.map.set(key, new Set([value]));
    }
  }

  delete(key: K, value?: V) {
    if (this.map.has(key)) {
      this.map.get(key).delete(value);
    }
  }

  get(key: K): Set<V> {
    return this.map.get(key);
  }

  has(key: K) {
    return this.map.has(key);
  }

  *[Symbol.iterator](): Iterator<[K, Set<V>]> {
    for (const key of this.map.keys()) {
      yield [key, this.map.get(key)];
    }
  }
}