import React, { useEffect, useState } from 'react';
import { MapModeType } from './mapMode';
import { GameMap } from '../game/simulation/GameMap';
import { Coordinate } from '../types';
import { Box } from '@chakra-ui/react';
import { terrainTypeTitles } from '../game/world/terrain';
import { WorldMapStateHex } from './worldMapState';

type MapModeTooltipProps = {
  hexIndex: number,
  gameMap: GameMap,
};

const useGameMapState = <K extends keyof WorldMapStateHex>(gameMap: GameMap, hexIndex: number, field: K) => {
  const [value, setValue] = useState(gameMap.getHexState(hexIndex, field));
  useEffect(() => {
    const sub = gameMap.hexFieldUpdates.subscribe(update => {
      if (update.field === field) {
        setValue(update.value);
      }
    });
    return () => sub.unsubscribe();
  }, []); 
  return value;
}

const tooltipData: Map<Partial<MapModeType>, React.FC<MapModeTooltipProps>> = new Map([
  [MapModeType.Terrain, ({ hexIndex, gameMap }) => {
    const terrainType = useGameMapState(gameMap, hexIndex, 'terrainType');
    return (
      <>Terrain: {terrainTypeTitles[terrainType]}</>
    );
  }],
  [MapModeType.Height, ({ hexIndex, gameMap }) => {
    const height = useGameMapState(gameMap, hexIndex, 'height');
    return (
      <>Height: {height}</>
    );
  }],
  [MapModeType.Population, ({ hexIndex, gameMap }) => {
    const population = useGameMapState(gameMap, hexIndex, 'population');
    return (
      <>Population: {population.toLocaleString()}</>
    );
  }],
]);



export const MapModeTooltip = ({
  mapMode,
  gameMap,
  hexIndex,
  position,
}: {
  mapMode: MapModeType,
  gameMap: GameMap,
  hexIndex: number,
  position: Coordinate,
}) => {
  if (!tooltipData.has(mapMode)) {
    return null;
  }
  const TooltipData = tooltipData.get(mapMode);
  return (
    <Box
      position="absolute"
      top={position.y + 10}
      left={position.x + 10}
      bgColor="gray.900"
      color="blue.100"
      p={1}
      zIndex={100}
    >
      <TooltipData hexIndex={hexIndex} gameMap={gameMap} />
    </Box>
  );
}