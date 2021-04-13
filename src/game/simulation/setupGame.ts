import { Game } from './Game';
import { World, Hex } from '../world/World';
import Alea from 'alea';
import { createTile, createPop } from './entities';
import { PopDataComponent, WorldTileDataComponent } from './components';
import { Random } from '../../utils/Random';

export function setupGame(
  game: Game,
) {
  console.log('setup game');
  /**
   * create initial pops
   */
  for (const landmass of game.world.landmasses) {
    landmass.hexes.forEach((hex) => {
      const tileEntity = createTile(game.entityManager, { coord: hex });
      const population = game.world.getHexHunterCarryCapacity(hex);
      const popEntity = createPop(game.entityManager, {
        size: Math.ceil(population * .25 + population * Math.random() * .75),
        growth: 1,
      });
      tileEntity.getComponent(WorldTileDataComponent).value.pops.add(popEntity);
    })
  }
}