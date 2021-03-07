import React from 'react';
import { theme } from './theme';
import { GameView } from './ui/GameView';
import { BrowserRouter } from 'react-router-dom';
import { ChakraProvider } from "@chakra-ui/react"

export const App = () => {
  return (
    <BrowserRouter>
      <ChakraProvider theme={theme}>
        <GameView />
      </ChakraProvider>
    </BrowserRouter>
  );
}