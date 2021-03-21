import { Alert, Box, Breadcrumb, BreadcrumbItem, BreadcrumbLink, Button, Flex, FormControl, FormLabel, Heading, HStack, IconButton, Input, MenuItem, MenuList, Modal, ModalBody, ModalContent, ModalOverlay, Stack, Tooltip, Wrap } from '@chakra-ui/react';
import { World as ECS, Entity, System, Component } from 'ape-ecs';
import { values } from 'lodash';
import React, { useEffect, useState } from 'react';
import { BiMenu, BiPause, BiPlay, BiRefresh } from 'react-icons/bi';
import { useAsync, useObservable } from 'react-use';
import { Game } from '../../game/simulation/Game';
import { observer } from 'mobx-react-lite';
import { GameInfoComponent } from '../../game/simulation/components';
import { Link } from 'react-router-dom';
import { GameStore } from '../../game/simulation/GameStore';
import { LoadGameList, SaveGameList } from './SavedGameList';

const DateDisplay = observer<{
  game: Game
}>(({ game }) => {
  const [date] = useState(() => game.gameInfo.getComponent(GameInfoComponent).value);
  return (
    <>
      {date.date}
    </>
  );
});

type MenuPageProps = {
  game: Game,
  setPage: (page: GameMenuPage) => void,
  closeMenu: () => void,
}

const SaveMenu = ({ game, setPage, closeMenu }: MenuPageProps) => {
  const [name, setName] = useState('');
  const [isSaved, setSaved] = useState(false);

  const handleSubmit = (e) => {
    if (!name) {
      return;
    }
    GameStore.save(game.export(), name).then(() => {
      setSaved(true);
    });
    e.preventDefault();
  }

  if (isSaved) {
    return (
      <Box>
        Game is saved
      </Box>
    )
  } 

  return (
    <Box>
      <form onSubmit={handleSubmit}>
        <Flex justifyContent="space-between">
          <Heading size="md">Save Game</Heading>
          <Button size="sm" variant="ghost" onClick={() => setPage('main')}>Back</Button>
        </Flex>
        <Box mt={5}>
          <SaveGameList game={game} onLoad={closeMenu} />
        </Box>
        <Box>
          <FormControl
            id="name"
            isRequired
            mt={3}
            mb={5}
          >
            <FormLabel>New save name</FormLabel>
            <Input autoFocus isRequired value={name} onChange={e => setName(e.target.value)} name="name" />
          </FormControl>
          <Button isDisabled={!name?.trim()} type="submit">Save</Button>
        </Box>
      </form>
    </Box>
  )
}

const LoadMenu = ({
  game,
  setPage,
  closeMenu,
}: MenuPageProps) => {
  return (
    <Box>
      <Flex justifyContent="space-between">
          <Heading size="md">Load Game</Heading>
          <Button size="sm" variant="ghost" onClick={() => setPage('main')}>Back</Button>
        </Flex>
      <Stack mt={5}>
        <LoadGameList onLoad={closeMenu} />
      </Stack>
    </Box>
  );
}

type GameMenuPage = 'main' | 'save' | 'load';
const GameMenu = ({
  game,
  closeMenu
}: {
  game: Game,
  closeMenu: () => void,
}) => {
  const [page, setPage] = useState<GameMenuPage>('main');

  if (page === 'save') {
    return <SaveMenu game={game} setPage={setPage} closeMenu={closeMenu} />;
  } else if (page === 'load') {
    return <LoadMenu game={game} setPage={setPage} closeMenu={closeMenu} />;
  }

  return (
    <Stack>
      <Box>Game is paused</Box>
      <Button onClick={closeMenu}>
        Continue
      </Button>
      <Button onClick={() => setPage('save')}>
        Save Game
      </Button>
      <Button onClick={() => setPage('load')}>
        Load Game
      </Button>
      <Button as={Link} to="/">
        Main Menu
      </Button>
    </Stack>
  );
}

export const GameHeader = ({
  game,
}: {
  game: Game
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isPlaying = useObservable(game.isPlaying$, game.isPlaying$.value);
  return (
    <Flex
      bgColor="gray.900"
      width="full"
      p={2}
      position="fixed"
      top={0}
      zIndex={100}
    >
      <HStack>
        <Modal
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
        >
          <ModalOverlay />
          <ModalContent p={5}>
            <GameMenu game={game} closeMenu={() => setMenuOpen(false)} />
          </ModalContent>
        </Modal>
        <IconButton
          aria-label="game menu"
          size="sm"
          icon={<BiMenu />}
          onClick={() => {
            setMenuOpen(true);
            game.pause();
          }}
        />
        {isPlaying
          ? <IconButton
            onClick={() => game.pause()}
            size="sm"
            aria-label="pause"
            icon={<BiPause size="1.2rem" />}
          />
          : <IconButton
            onClick={() => game.play()}
            size="sm"
            aria-label="play"
            icon={<BiPlay size="1.2rem" />}
          />
        }
        <DateDisplay game={game} />
        {/* <Tooltip
          label="Reload map"
        >
          <IconButton
            onClick={regenerate}
            size="sm"
            aria-label="refresh"
            icon={<BiRefresh size="1.2rem" />}
          />
        </Tooltip> */}
      </HStack>
    </Flex>
  )
}