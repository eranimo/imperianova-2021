export function octaveNoise(
  noiseFunc: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  frequency: number = 1,
) {
  let total = 0;
  let frequency_ = frequency;
  let amplitude = 1;
  let maxValue = 0; // Used for normalizing result to 0.0 - 1.0
  for (let i = 0; i < octaves; i++) {
    total += noiseFunc(x * frequency_, y * frequency_) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency_ *= 2;
  }

  return total / maxValue;
}