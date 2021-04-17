import { Game } from './Game';
import { World, Hex, Landmass } from '../world/World';
import Alea from 'alea';
import { createTile, createPop } from './entities';
import { PopDataComponent, WorldTileDataComponent, PopTypes } from './components';
import { Random } from '../../utils/Random';
import { LandType } from '../world/terrain';
import { TerrainType, terrainTypeTitles } from './../world/terrain';
import { Coord } from '../../types';
import ndarray from 'ndarray';

export function setupGame(
  game: Game,
) {
  console.log('setup game');
  const random = new Random('123'); // TODO: game seed option
  /**
   * create initial pops
   */
  // const hexSet = new Set<Hex>();
  const landmassSet = [];
  game.world.landmasses.forEach((landmass) => {
    if (landmass.size > 50) {
      landmassSet.push(landmass);
    }
  });
  if (landmassSet.length == 0) {
    landmassSet.push(game.world.landmasses[0]);
  }
  const initLandmass: Landmass = landmassSet[random.randomInt(landmassSet.length - 1)];
  const isTraversable = (hex: Hex) : boolean => {
    return (game.world.getTerrain(hex) != TerrainType.OCEAN && game.world.getTerrain(hex) != TerrainType.COAST)
    || game.world.getDistanceToCoast(hex) <= 5;
  }
  const hexCoords : Coord[] = game.world.bfs(isTraversable, initLandmass.hexes[0]);
  hexCoords.push([initLandmass.hexes[0].x, initLandmass.hexes[0].y]);

  hexCoords.forEach((coord: Coord) => {
    const hex = game.world.getHex(coord[0], coord[1]);
    const tileEntity = createTile(game.entityManager, { coord: hex });
    const population = game.world.getHexHunterCarryCapacity(hex);
    const popEntity = createPop(game.entityManager, {
      size: Math.ceil(population * .25 + population * Math.random() * .75),
      growth: 1,
      class: PopTypes.HUNTERGATHERER,
      hex: hex,
      game: game,
    });
    tileEntity.getComponent(WorldTileDataComponent).value.pops.add(popEntity);
  })
}