import React, { useEffect, useRef, useState } from 'react';
import Alea from 'alea';
import { World } from '../game/world/World';
import { WorldGeneratorOptions, WorldGenerator } from '../game/world/WorldGenerator';
import { WorldGrid } from '../game/world/WorldGrid';
import { times } from 'lodash';
import { AssetLoader } from '../WorldViewer/AssetLoader';
import { WorldViewer } from '../WorldViewer/WorldViewer';
import { GameHeader } from './GameHeader';
import { Game } from '../game/simulation/Game';

enum WorldSize {
  SMALL = 75,
  MEDIUM = 150,
  LARGE = 300,
}
const options: WorldGeneratorOptions = {
  size: WorldSize.SMALL,
  sealevel: 140,
  seed: 123,
};

function testRoads(world: World, worldGrid: WorldGrid) {
  const rng = Alea(options.seed);
  console.groupCollapsed('test roads');
  for (const landmass of world.landmasses) {
    if (landmass.size > 1) {
      const from = landmass.hexes[Math.round(rng() * (landmass.hexes.length - 1))];
      times(Math.round(rng() * 10)).forEach(() => {
        const to = landmass.hexes[Math.round(rng() * (landmass.hexes.length - 1))];
        const path = worldGrid.findPath(from, to);
        worldGrid.addRoadPath(path);
      });
    }
  }
  console.groupEnd();
}

const worldGen = new WorldGenerator();

export const GameView = () => {
  const [gameRef, setGame] = useState<Game>();
  const [worldRef, setWorld] = useState<World>();

  const onNewWorld = (world: World) => {
    console.log('world', world);
    setWorld(world);
    const game = new Game(world);
    console.log('game', game);
    setGame(game);

    // test data
    console.time('setup test data');
    testRoads(world, game.context.worldGrid);
    console.timeEnd('setup test data');

    console.log('done loading');
  };

  const regenerate = () => {
    const world = worldGen.generate({
      ...options,
      seed: Math.random(),
    });
    onNewWorld(world);
  };

  useEffect(() => {
    const world = worldGen.generate(options);
    onNewWorld(world);
  }, []);

  return (
    <AssetLoader>
      {gameRef && <GameHeader
        game={gameRef}
        regenerate={regenerate}
      />}
      <WorldViewer world={worldRef} />
    </AssetLoader>
  );
}