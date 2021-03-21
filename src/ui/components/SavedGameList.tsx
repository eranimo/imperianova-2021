import { Button } from '@chakra-ui/button';
import { Box, Flex, Stack, Text } from '@chakra-ui/layout';
import React from 'react';
import { Link, useHistory } from 'react-router-dom';
import { useAsync, useAsyncRetry } from 'react-use';
import { SavedGameEntry, GameStore } from '../../game/simulation/GameStore';

const SavedGameEntryItem = ({
  entry,
  onLoad,
  onDelete,
}: {
  entry: SavedGameEntry,
  onLoad?: () => void,
  onDelete: () => void,
}) => {
  const history = useHistory();

  const onClickLoad = () => {
    history.push('/game', {
      saveID: entry.id,
    });
    if (onLoad) onLoad();
  }

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
          <Button size="sm" colorScheme="red" onClick={onClickDelete}>Delete</Button>
          <Button size="sm" onClick={onClickLoad}>Load</Button>
        </Stack>
      </Flex>
    </Flex>
  )
}

export const SavedGameList = ({ onLoad }: { onLoad?: () => void }) => {
  const { loading, error, value, retry } = useAsyncRetry(GameStore.getSavedGames);

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
        {value.map(item => (
          <SavedGameEntryItem
            entry={item}
            key={item.id}
            onLoad={onLoad}
            onDelete={() => retry()}
          />
        ))}
      </Stack>
    );
  }

  return content;
}