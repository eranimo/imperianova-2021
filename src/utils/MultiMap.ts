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