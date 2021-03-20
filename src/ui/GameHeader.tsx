import { Flex, HStack, IconButton, Tooltip, Wrap } from '@chakra-ui/react';
import { World as ECS, Entity, System, Component } from 'ape-ecs';
import { values } from 'lodash';
import React, { useEffect, useState } from 'react';
import { BiPause, BiPlay, BiRefresh } from 'react-icons/bi';
import { useObservable } from 'react-use';
import { Game } from '../game/simulation/Game';
import { observer } from 'mobx-react-lite';
import { GameInfoComponent } from '../game/simulation/components';

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

export const GameHeader = ({
  regenerate,
  game,
}: {
  regenerate: () => void,
  game: Game
}) => {
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
        <Tooltip
          label="Reload map"
        >
          <IconButton
            onClick={regenerate}
            size="sm"
            aria-label="refresh"
            icon={<BiRefresh size="1.2rem" />}
          />
        </Tooltip>
      </HStack>
    </Flex>
  )
}