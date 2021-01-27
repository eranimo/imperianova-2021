import React, { useEffect, useState, useRef } from 'react';
import { World } from './World';
import { WorldGenerator } from './WorldGenerator';
import { WorldViewer } from './WorldViewer';

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