import React, { useEffect, useState, useRef } from 'react';
import { TerrainType, World } from './World';
import { WorldGenerator, WorldGeneratorOptions } from './WorldGenerator';
import { WorldViewer } from './WorldViewer';
import { Direction } from './types';
import { WorldGrid } from './WorldGrid';
import Alea from 'alea';
import { random, times } from 'lodash';

const options: WorldGeneratorOptions = {
  size: 75,
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

export const App = () => {
  const [isLoading, setLoading] = useState(true);
  const worldRef = useRef<World>();

  useEffect(() => {
    const world = new World();
    const worldGen = new WorldGenerator(world, options);
    setLoading(true);
    worldGen.generate();
    console.log('world', world);
    const worldGrid = new WorldGrid(world);
    worldGrid.buildGrid();

    // test data
    console.time('setup test data');
    testRoads(world, worldGrid);
    console.timeEnd('setup test data');

    worldRef.current = world;
    console.log('done loading');
    setLoading(false);
  }, []);

  if (isLoading) {
    return <>Loading...</>;
  }

  return (
    <WorldViewer world={worldRef.current} />
  );
}