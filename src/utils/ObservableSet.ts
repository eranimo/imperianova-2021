import { merge, Observable, Subject } from 'rxjs';
import { mapTo } from 'rxjs/operators';

export class ObservableSet<T> {
  private set: Set<T>;
  public added$: Subject<T>;
  public deleted$: Subject<T>;

  constructor(values?: T[]) {
    this.set = new Set(values);
    this.added$ = new Subject();
    this.deleted$ = new Subject();
  }

  has(value: T) {
    return this.set.has(value);
  }

  add(value: T) {
    if (!this.has(value)) {
      this.added$.next(value);
    }
    this.set.add(value);
    return this;
  }

  delete(value: T) {
    this.deleted$.next(value);
    return this.set.delete(value);
  }

  get size() {
    return this.set.size;
  }

  *[Symbol.iterator]() {
    for (const item of this.set) {
      yield item;
    }
  }

  get values$() {
    return merge([this.added$, this.deleted$]).pipe(mapTo(this));
  }
}