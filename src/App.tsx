import React, { useEffect, useState, useRef } from 'react';
import { TerrainType, World } from './World';
import { WorldGenerator } from './WorldGenerator';
import { WorldViewer } from './WorldViewer';
import { Direction } from './types';
import { WorldGrid } from './WorldGrid';

function testRoads(world: World, worldGrid: WorldGrid) {
  const roadHeads = [];
  world.hexgrid.forEach(hex => {
    if (Math.random() < 0.02 && world.isLand(hex) && Math.abs(world.getHexCoordinate(hex).lat) < 60) {
      roadHeads.push(hex);
    }
  });
  console.log(`Generating ${roadHeads.length} roads`);

  for (const head of roadHeads) {
    world.setHexRoad(head, world.getHexNeighbor(head.x, head.y, Direction.N));
    
  }
}

export const App = () => {
  const [isLoading, setLoading] = useState(true);
  const worldRef = useRef<World>();

  useEffect(() => {
    const world = new World();
    const worldGen = new WorldGenerator(world, {
      size: 75,
      sealevel: 100,
      seed: 123,
    });
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