import { ColorArray, Coord, Size } from '../src/types';
import { randomizeColorBrightness, colorShiftLightness, distance } from '../src/utils';
import SimplexNoise from 'simplex-noise';

export type PatternGenerator = (coord: Coord, color: ColorArray) => ColorArray | null;


/**
 * Creates a pattern by shifting color lightness using randomness
 */
export const randomizedPattern = (): PatternGenerator => {
  return (coord: Coord, color: ColorArray) => {
    return randomizeColorBrightness(color, 10);
  }
}


/**
 * Creates a pattern by shifting color lightness using noise
 * @param rng 
 * @param frequency 
 */
export const noisyPattern = (
  rng: () => number,
  frequency: number = 1,
): PatternGenerator => {
  const noise = new SimplexNoise(rng || Math.random);
  return (coord: Coord, color: ColorArray) => {
    const v = noise.noise2D(coord[0] * frequency, coord[1] * frequency) * 10;
    return colorShiftLightness(color, v);
  };
}

/**
 * Generates wavy patterns
 * Code from https://lodev.org/cgtutor/randomnoise.html
 * 
 * xPeriod and yPeriod together define the angle of the lines
 * xPeriod and yPeriod both 0 ==> it becomes a normal clouds or turbulence pattern 
 * @param rng rng function
 * @param size Size of pattern area
 * @param xPeriod defines repetition of wavy lines in x direction
 * @param yPeriod defines repetition of wavy lines in y direction
 * @param turbPower makes twists
 * @param turbSize initial size of turbulence
 */
export const wavyPattern = (
  rng: () => number,
  size: Size,
  xPeriod: number = 0,
  yPeriod: number = 10,
  turbPower: number = 1,
  turbSize: number = 32,
): PatternGenerator => {
  const noise = new SimplexNoise(rng);

  function turbulence(coord: Coord, turbSize: number){
    let value = 0.0;
    const initialSize = turbSize;

    while(turbSize >= 1) {
      value += noise.noise2D(coord[0] / turbSize, coord[1] / turbSize) * turbSize;
      turbSize /= 2.0;
    }

    return 128.0 * value / initialSize;
  }

  return (coord: Coord, color: ColorArray) => {
    const xyValue = coord[0] * xPeriod / size.width + coord[1] * yPeriod / size.height + turbPower * turbulence(coord, turbSize) / 256.0;
    const v = Math.abs(Math.sin(xyValue * Math.PI));
    return colorShiftLightness(color, v * 25);
  };
}