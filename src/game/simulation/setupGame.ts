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
  const random = new Random('123'); // TODO: game seed option
  /**
   * create initial pops
   */
  const initialPopHexes = new Set<Hex>();
  for (const landmass of game.world.landmasses) {
    if (landmass.size > 1) {
      for (let i = 0; i < 10; i++) {
        const randomHex = landmass.hexes[random.randomInt(landmass.hexes.length - 1)];
        initialPopHexes.add(randomHex);
      }
    }
  }

  for (const hex of initialPopHexes) {
    const tileEntity = createTile(game.entityManager, { coord: hex });
    const popEntity = createPop(game.entityManager, {
      size: random.randomInt(500),
      growth: 1,
    });
    tileEntity.getComponent(WorldTileDataComponent).value.pops.add(popEntity);
  }

}