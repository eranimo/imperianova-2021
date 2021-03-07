import { Flex, IconButton, Tooltip, Wrap } from '@chakra-ui/react';
import React from 'react';
import { BiRefresh } from 'react-icons/bi';


export const GameHeader = ({
  regenerate,
}: {
  regenerate: () => void,
}) => {
  return (
    <Flex
      bgColor="gray.900"
      width="full"
      p={2}
      position="fixed"
      top={0}
      zIndex={100}
    >
      <Wrap w={2}>
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
      </Wrap>
    </Flex>
  )
}