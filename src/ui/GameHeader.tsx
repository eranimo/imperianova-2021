import React from 'react';
import styled from 'styled-components';
import { BiRefresh } from 'react-icons/bi';


const Container = styled.div`
  position: fixed;
  top: 0;
  padding: 0.5rem;
  background-color: ${props => props.theme.colors.overlay};
  z-index: 100;
  width: 100%;
`;

const Header = styled.div`
  display: flex;
`;

const HeaderButton = styled.button`
  background: none;
  border: none;
  color: inherit;
  display: flex;
  justify-content: center;
  align-items: center;
`;
HeaderButton.defaultProps = {
  type: 'button',
};

export const GameHeader = ({
  regenerate,
}: {
  regenerate: () => void,
}) => {
  return (
    <Container>
      <Header>
        <HeaderButton onClick={regenerate}>
          Refresh
          <BiRefresh size="1.2rem" />
        </HeaderButton>
      </Header>
    </Container>
  )
}