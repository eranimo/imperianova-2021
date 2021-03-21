import React from 'react';
import { theme } from './theme';
import { GameView } from './ui/pages/GameView';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { ChakraProvider } from "@chakra-ui/react"
import { MainMenu } from './ui/pages/MainMenu';
import { NewGame } from './ui/pages/NewGame';
import { LoadGame } from './ui/pages/LoadGame';

export const App = () => {
  return (
    <ChakraProvider theme={theme}>
      <BrowserRouter>
        <Switch>
          <Route path="/" exact component={MainMenu} />
          <Route path="/new" component={NewGame} />
          <Route path="/load" component={LoadGame} />
          <Route path="/game" component={GameView} />
        </Switch>
      </BrowserRouter>
    </ChakraProvider>
  );
}