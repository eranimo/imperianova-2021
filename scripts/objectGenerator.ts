import { TileGen } from './TileGen';
import { ColorArray, Range, Coord, RNGFunction } from '../src/types';
import { Image } from '../src/utils/Image';

export type ObjectGenerator = (
  rng: RNGFunction,
) => Image;

export function makeTree(
  rng: RNGFunction,
  barkColor: ColorArray,
  leafColor: ColorArray,
  shadowColor: ColorArray,
) {
  
}

export function makeBush(
  rng: RNGFunction,
  leafColor: ColorArray,
  shadowColor: ColorArray,
) {

}

export function makeRock(
  rng: RNGFunction,
  width: number,
  rockColor: ColorArray,
  shadowColor: ColorArray,
) {
  
}

export const makeHill = (
  width: number,
  height: number,
  color: ColorArray,
): ObjectGenerator => {
  return (rng) => {
    const img = new Image({ width, height });
    return img;
  }
}