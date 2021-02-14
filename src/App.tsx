import React, { useEffect, useState, useRef } from 'react';
import { World } from './World';
import { WorldGenerator, WorldGeneratorOptions } from './WorldGenerator';
import { WorldViewer } from './WorldViewer';
import { Direction } from './types';
import { WorldGrid } from './WorldGrid';
import Alea from 'alea';
import { random, times } from 'lodash';
import { AssetLoader } from './AssetLoader';


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
        world.setRoadPath(path);
      });
    }
  }
  console.groupEnd();
}

const worldGen = new WorldGenerator();

export const App = () => {
  const [worldRef, setWorld] = useState<World>();

  useEffect(() => {
    const onNewWorld = (world) => {
      console.log('world', world);
      const worldGrid = new WorldGrid(world);
      worldGrid.buildGrid();

      // test data
      console.time('setup test data');
      testRoads(world, worldGrid);
      console.timeEnd('setup test data');

      setWorld(world);
      console.log('done loading');
    };
    onNewWorld(worldGen.generate(options));

    (window as any).regenerate = () => {
      const world = worldGen.generate({
        ...options,
        seed: Math.random(),
      });
      onNewWorld(world);
    }
  }, []);

  return (
    <AssetLoader>
      <WorldViewer world={worldRef} />
    </AssetLoader>
  );
}