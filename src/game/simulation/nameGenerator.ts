import { MarkovString } from "ts-markov";
import greekNamelist from './namelists/greek.txt';


export class NameGenerator {
  gen: MarkovString;

  constructor() {
    this.gen = new MarkovString();
    this.gen.addTextUnsplit(greekNamelist, '\n', '');
    this.gen.train();
  }

  generateName(maxLength: number = 15) {
    return this.gen.generate(maxLength).join('');
  }
};
