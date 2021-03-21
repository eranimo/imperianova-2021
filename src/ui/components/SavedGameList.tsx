import { Button } from '@chakra-ui/button';
import { Box, Flex, Stack, Text } from '@chakra-ui/layout';
import React from 'react';
import { Link, useHistory } from 'react-router-dom';
import { useAsync, useAsyncRetry } from 'react-use';
import { SavedGameEntry, GameStore } from '../../game/simulation/GameStore';
import { Game } from '../../game/simulation/Game';

const SavedGameEntryItem = ({
  entry,
  actionLabel,
  onClickAction,
  onDelete,
}: {
  entry: SavedGameEntry,
  actionLabel: string,
  onClickAction?: () => void,
  onDelete: () => void,
}) => {
  const onClickDelete = async () => {
    await GameStore.delete(entry.id);
    onDelete();
  };

  return (
    <Flex
      justifyContent="space-between"
      border="1px"
      borderColor="blue.500"
      borderRadius="md"
      p={2}
    >
      <Box>
        <Text>{entry.name}</Text>
        <Text color="gray.500">{new Date(entry.date).toLocaleString()}</Text>
      </Box>
      <Flex justifyContent="center" alignItems="center" mr={2}>
        <Stack direction="row">
          <Button size="sm" variant="ghost" colorScheme="red" onClick={onClickDelete}>Delete</Button>
          <Button size="sm" onClick={onClickAction}>{actionLabel}</Button>
        </Stack>
      </Flex>
    </Flex>
  )
}

export const LoadGameList = ({ onLoad, }: { onLoad?: () => void }) => {
  const { loading, error, value, retry } = useAsyncRetry(GameStore.getSavedGames);
  const history = useHistory();

  let content;
  if (loading) {
    content = 'Loading...';
  } else if (value.length === 0) {
    content = (
      <Box>
        <Box mb={5}>No saved games.</Box>
        <Button size="sm" as={Link} to="/new">New Game</Button>
      </Box>
    );
  } else {
    content = (
      <Stack>
        {value.map(entry => (
          <SavedGameEntryItem
            entry={entry}
            key={entry.id}
            actionLabel="Load"
            onClickAction={() => {
              history.push('/game', {
                saveID: entry.id,
              });
              onLoad();
            }}
            onDelete={() => retry()}
          />
        ))}
      </Stack>
    );
  }

  return content;
}

export const SaveGameList = ({
  game,
  onLoad
}: {
  game: Game,
  onLoad?: () => void
}) => {
  const { loading, error, value, retry } = useAsyncRetry(GameStore.getSavedGames);
  const history = useHistory();

  let content;
  if (loading) {
    content = 'Loading...';
  } else if (value.length === 0) {
    content = (
      <Box>
        <Box mb={5}>No saved games.</Box>
      </Box>
    );
  } else {
    content = (
      <Stack>
        {value.map(entry => (
          <SavedGameEntryItem
            entry={entry}
            key={entry.id}
            actionLabel="Overwrite"
            onClickAction={() => {
              GameStore.overwrite(game.export(), entry.id)
                .then(() => {
                  onLoad();
                });
            }}
            onDelete={() => retry()}
          />
        ))}
      </Stack>
    );
  }

  return content;
}