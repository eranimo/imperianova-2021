import { Game } from './Game';
import { World, Hex } from '../world/World';
import Alea from 'alea';
import { createTile, createPop } from './entities';
import { PopDataComponent, WorldTileDataComponent } from './components';

export function setupGame(
  game: Game,
) {
  const rng = Alea(123); // TODO: game seed option
  /**
   * create initial pops
   */
  const initialPopHexes = new Set<Hex>();
  for (const landmass of game.world.landmasses) {
    if (landmass.size > 1) {
      for (let i = 0; i < 10; i++) {
        const randomHex = landmass.hexes[Math.round(rng() * (landmass.hexes.length - 1))];
        initialPopHexes.add(randomHex);
      }
    }
  }

  for (const hex of initialPopHexes) {
    const tileEntity = createTile(game.entityManager, { coord: hex });
    const popEntity = createPop(game.entityManager, {
      size: 0,
      growth: 0,
    });
    tileEntity.getComponent(WorldTileDataComponent).value.pops.add(popEntity);
  }

}