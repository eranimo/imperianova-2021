import Alea from 'alea';

export class Random {
  rng: () => number;

  constructor(seed: string) {
    this.rng = Alea(seed);
  }

  randomInt(high: number) {
    return Math.round(this.rng() * high);
  }
}