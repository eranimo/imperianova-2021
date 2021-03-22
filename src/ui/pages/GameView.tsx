import React, { useContext, useEffect, useRef, useState } from 'react';
import Alea from 'alea';
import { World } from '../../game/world/World';
import { WorldGeneratorOptions, WorldGenerator } from '../../game/world/WorldGenerator';
import { WorldGrid } from '../../game/world/WorldGrid';
import { times } from 'lodash';
import { WorldViewer } from '../../WorldViewer/WorldViewer';
import { GameHeader } from '../components/GameHeader';
import { Game, GameOptions } from '../../game/simulation/Game';
import { defaultOptions } from './NewGame';
import { parse } from 'query-string';
import { useLocation } from 'react-router';
import { GameStore } from '../../game/simulation/GameStore';

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

export const GameContext = React.createContext<Game>(null);

export const GameView = ({ location }) => {
  const [gameRef, setGame] = useState<Game>();

  let options = defaultOptions;
  if (location.state?.options) {
    options = JSON.parse(location.state.options as any) as GameOptions;
  }

  useEffect(() => {
    const saveID = location.state?.saveID
    console.log('[GameView]', options, saveID);
    setGame(null);
    if (saveID) {
      GameStore.load(saveID).then(saveData => {
        console.log('[GameView] loaded game state', saveData);
        setGame(Game.load(saveData, saveID));
      });
    } else {
      console.log('[GameView] new game with options', options);
      const game = Game.create(options);
      testRoads(game.world, game.context.worldGrid);
      setGame(game);
    }
  }, [location]);

  return (
    <>
      {gameRef && <GameContext.Provider value={gameRef}>
        <GameHeader />
        <WorldViewer />
      </GameContext.Provider>}
    </>
  );
}