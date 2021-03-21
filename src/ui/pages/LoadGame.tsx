import React from 'react';
import { Box, Heading, Link, List, ListItem, Stack } from "@chakra-ui/layout"
import { MenuContainer } from '../components/MenuContainer';
import { useAsync, usePromise } from 'react-use';
import { GameStore } from '../../game/simulation/GameStore';
import { Link as RouteLink } from 'react-router-dom';
import { Button } from '@chakra-ui/button';
import { SavedGameList } from '../components/SavedGameList';

export const LoadGame = () => {
  return (
    <MenuContainer title="Load Game">
      <SavedGameList />
    </MenuContainer>
  );
}