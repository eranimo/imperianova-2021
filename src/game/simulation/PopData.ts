import { Game } from './Game';
import { World, Hex } from '../world/World';
// Pops
export type PopData = {
    size: number,
    growth: number,
    class: PopTypes,
    game: Game,
    hex: Hex,
}
  
export enum PopTypes {
    HUNTERGATHERER = 0
}
  
export const CarryingCapacityMap : Map<PopTypes, (world: World, hex: Hex) => number> =
    new Map<PopTypes, (world: World, hex: Hex) => number> ([
        [PopTypes.HUNTERGATHERER, (world: World, hex: Hex) => world.getHexHunterCarryCapacity(hex)]
]);
  
  export const MonthlyPopGrowthRate = 1.03 / 12;