import { Grommet } from 'grommet';
import React from 'react';
import { theme } from './theme';
import { GameView } from './ui/GameView';
import { BrowserRouter } from 'react-router-dom';


export const App = () => {
  return (
    <BrowserRouter>
      <Grommet theme={theme}>
        <GameView />
      </Grommet>
    </BrowserRouter>
  );
}