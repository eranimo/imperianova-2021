import React from 'react';
import { Box, Flex, Heading } from "@chakra-ui/layout"
import { IconButton, Tooltip } from '@chakra-ui/react';
import { BiArrowBack } from 'react-icons/bi';
import { Link } from 'react-router-dom';

export const MenuContainer = ({
  title,
  children,
}) => {
  return (
    <Flex >
      <Box
        m={5}
        bg="rgba(100, 100, 100, 0.10)"
        width="full"
        border="1px"
        borderColor="blue.600"
        borderRadius="lg"
      >
        <Flex p={5} borderBottom="1px" borderColor="blue.500" maxHeight="full">
          <Tooltip label="Back to main menu">
            <Link to="/">
              <IconButton
                aria-label="back"
                variant="ghost"
                icon={<BiArrowBack />}
                color="blue.100"
                mr={5}
              />
            </Link>
          </Tooltip>
          <Heading size="lg">{title}</Heading>
        </Flex>
        <Box p={5}>
          {children}
        </Box>
      </Box>
    </Flex>
  );
}