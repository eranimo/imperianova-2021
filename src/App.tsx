import React from 'react';
import { theme } from './theme';
import { GameView } from './ui/GameView';
import { BrowserRouter } from 'react-router-dom';
import { createGlobalStyle, ThemeProvider } from 'styled-components';
import reset from 'styled-reset';


const GlobalStyle = createGlobalStyle<any>`
  ${reset}
  body {
    font-family: 'Helvetica';
    font-size: 12px;
    color: ${props => props.theme.colors.light}
  }
`;

export const App = () => {
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <React.Fragment>
          <GlobalStyle />
          <GameView />
        </React.Fragment>
      </ThemeProvider>
    </BrowserRouter>
  );
}