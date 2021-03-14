import { Flex, HStack, IconButton, Tooltip, Wrap } from '@chakra-ui/react';
import { World as ECS, Entity, System, Component } from 'ape-ecs';
import { values } from 'lodash';
import React, { useEffect, useState } from 'react';
import { BiPause, BiPlay, BiRefresh } from 'react-icons/bi';
import { useObservable } from 'react-use';
import { Game } from '../game/simulation/Game';


function useEntityChanges(
  game: Game,
  entity: Entity,
  getter: (entity: Entity) => any
) {
  const [data, setData] = useState(getter(entity));

  useEffect(() => {
    const [subject, unsubscribe] = game.watchEntityChanges(entity)
    subject.subscribe(changedEntity => {
      setData(getter(changedEntity));
    })
    return () => unsubscribe();
  }, []);

  return data;
}

const EntityValue = ({
  game, entity, getter,
}: {
  game: Game,
  entity: Entity,
  getter: (entity: Entity) => any
}) => {
  const value = useEntityChanges(game, entity, getter);
  return value;
}

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
        <EntityValue game={game} entity={game.gameinfo} getter={e => e.c.date.dateTicks} />
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