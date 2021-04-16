import React, { useEffect, useState } from 'react';
import { MapModeType } from './mapMode';
import { GameMap } from '../game/simulation/GameMap';
import { Coordinate } from '../types';
import { Box, Text } from '@chakra-ui/react';
import { terrainTypeTitles } from '../game/world/terrain';
import { WorldMapStateHex } from './worldMapState';
import { round } from 'lodash';

type MapModeTooltipProps = {
  hexIndex: number,
  gameMap: GameMap,
};

const useGameMapState = <K extends keyof WorldMapStateHex>(gameMap: GameMap, hexIndex: number, field: K) => {
  const [value, setValue] = useState(gameMap.getHexState(hexIndex, field));
  useEffect(() => {
    setValue(gameMap.getHexState(hexIndex, field));
    const sub = gameMap.hexFieldUpdates.subscribe(update => {
      if (update.index === hexIndex && update.field === field) {
        setValue(update.value);
      }
    });
    return () => sub.unsubscribe();
  }, [hexIndex]); 
  return value;
}

const TooltipValue = ({
  label,
  value,
}: {
  label: string,
  value: any,
}) => (
  <>
    <Text color="gray.400" as="span">
      {label}:
    </Text>
    {' '}
    <Text color="gray.100" as="span">
      {value}
    </Text>
  </>
);

const tooltipData: Map<Partial<MapModeType>, React.FC<MapModeTooltipProps>> = new Map([
  [MapModeType.Terrain, ({ hexIndex, gameMap }) => {
    const terrainType = useGameMapState(gameMap, hexIndex, 'terrainType');
    return (
      <TooltipValue label="Terrain" value={terrainTypeTitles[terrainType]} />
    );
  }],
  [MapModeType.Height, ({ hexIndex, gameMap }) => {
    const height = useGameMapState(gameMap, hexIndex, 'height');
    return (
      <TooltipValue label="Height" value={height} />
    );
  }],
  [MapModeType.DistanceToCoast, ({ hexIndex, gameMap }) => {
    const distanceToCoast = useGameMapState(gameMap, hexIndex, 'distanceToCoast');
    return (
      <TooltipValue label="Distance to coast" value={distanceToCoast} />
    );
  }],
  [MapModeType.PressureJanuary, ({ hexIndex, gameMap }) => {
    const pressure = useGameMapState(gameMap, hexIndex, 'pressureJanuary');
    return (
      <TooltipValue label="Pressure in January" value={round(pressure, 2)} />
    );
  }],
  [MapModeType.PressureJuly, ({ hexIndex, gameMap }) => {
    const pressure = useGameMapState(gameMap, hexIndex, 'pressureJuly');
    return (
      <TooltipValue label="Pressure in July" value={round(pressure, 2)} />
    );
  }],
  [MapModeType.WindJanuary, ({ hexIndex, gameMap }) => {
    const windSpeed = useGameMapState(gameMap, hexIndex, 'windSpeedJanuary');
    return (
      <TooltipValue label="Wind speed in January" value={round(windSpeed, 2)} />
    );
  }],
  [MapModeType.WindJuly, ({ hexIndex, gameMap }) => {
    const windSpeed = useGameMapState(gameMap, hexIndex, 'windSpeedJuly');
    return (
      <TooltipValue label="Wind speed in July" value={round(windSpeed, 2)} />
    );
  }],
  [MapModeType.OceanCurrentJanuary, ({ hexIndex, gameMap }) => {
    const currentSpeed = useGameMapState(gameMap, hexIndex, 'oceanCurrentSpeedJanuary');
    return (
      <TooltipValue label="Ocean current in January" value={round(currentSpeed, 2)} />
    );
  }],
  [MapModeType.OceanCurrentJuly, ({ hexIndex, gameMap }) => {
    const currentSpeed = useGameMapState(gameMap, hexIndex, 'oceanCurrentSpeedJuly');
    return (
      <TooltipValue label="Ocean current in July" value={round(currentSpeed, 2)} />
    );
  }],
  [MapModeType.Rainfall, ({ hexIndex, gameMap }) => {
    const height = useGameMapState(gameMap, hexIndex, 'rainfall');
    return (
      <TooltipValue label="Rainfall" value={height} />
    );
  }],
  [MapModeType.Population, ({ hexIndex, gameMap }) => {
    const population = useGameMapState(gameMap, hexIndex, 'population');
    return (
      <TooltipValue label="Population" value={population.toLocaleString()} />
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
      bgColor="rgba(20, 20, 20, 0.70)"
      px={2}
      py={1}
      borderRadius={1}
      zIndex={100}
      pointerEvents="none"
    >
      <TooltipData hexIndex={hexIndex} gameMap={gameMap} />
    </Box>
  );
}
