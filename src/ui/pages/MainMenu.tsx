import React, { useEffect, useRef, useState } from 'react';
import { Flex, Box, Heading, Stack } from "@chakra-ui/layout"
import { Button } from '@chakra-ui/button';
import { Link } from 'react-router-dom';

export const MainMenu = () => {
  return (
    <Flex
      width="full"
      height="full"
      align="center"
      justify="center"
      mt={20}
    >
      <Flex
        direction="column"
        width="300px"
        align="center"

      >
        <Heading mb={2}>ImperiaNova</Heading>
        <Stack
          width="full"
          borderColor="gray.700"
          borderRadius="md"
        >
          <Button as={Link} to="/new" width="full">New Game</Button>
          <Button as={Link} to="/load" width="full">Load Game</Button>
        </Stack>
      </Flex>
    </Flex>
  )
}