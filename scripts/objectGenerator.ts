import { TileGen } from './TileGen';
import { ColorArray, Range, Coord } from '../src/types';


export function makeTree(
  rng: () => number,
  gen: TileGen,
  barkColor: ColorArray,
  leafColor: ColorArray,
  shadowColor: ColorArray,
) {
  const treeGen = new TileGen({ width: 20, height: 20 });
}

export function makeBush(
  rng: () => number,
  leafColor: ColorArray,
  shadowColor: ColorArray,
) {

}

export function makeRock(
  rng: () => number,
  width: number,
  rockColor: ColorArray,
  shadowColor: ColorArray,
) {
  
}