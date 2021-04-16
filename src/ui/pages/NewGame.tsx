import React from 'react';
import { Box, Heading, Stack } from "@chakra-ui/layout"
import { MenuContainer } from '../components/MenuContainer';
import { GameOptions } from '../../game/simulation/Game';
import { FormControl, FormErrorMessage, FormLabel } from '@chakra-ui/form-control';
import { Input } from '@chakra-ui/input';
import { NumberInput } from '@chakra-ui/number-input';
import { Button } from '@chakra-ui/button';
import * as yup from 'yup';
import { Formik, Field, Form, FieldAttributes, FieldProps } from 'formik';
import { useHistory } from 'react-router';
import { stringify } from 'query-string';

export const defaultOptions: GameOptions = {
  world: {
    size: 150,
    sealevel: 140,
    seed: 123,
    axialTilt: 23
  }
};

const schema: yup.SchemaOf<GameOptions> = yup.object().shape({
  world: yup.object().shape({
    size: yup.number().label('World size').required().min(0),
    sealevel: yup.number().label('Sea level').required().min(20).max(255),
    seed: yup.number().label('Seed').required(),
    axialTilt: yup.number().label('Axial tilt').required().min(-90).max(90),
  }),
});

const TextField = ({ name, label }) => (
  <Field name={name}>
    {({ field, meta }: FieldProps) => (
      <FormControl
        id={name}
        isRequired
        error={meta.error}
        isInvalid={!!meta.error}
      >
        <FormLabel>{label}</FormLabel>
        <Input type="text" value={field.value} {...field} />
        {meta.error && <FormErrorMessage isInvalid={true}>{meta.error}</FormErrorMessage>}
      </FormControl>
    )}
  </Field>
);

const NumberField = ({ name, label }) => (
  <Field name={name}>
    {({ field, meta }: FieldProps) => (
      <FormControl
        id={name}
        isRequired
        error={meta.error}
        isInvalid={!!meta.error}
      >
        <FormLabel>{label}</FormLabel>
        <Input type="number" value={field.value} {...field} />
        {meta.error && <FormErrorMessage isInvalid={true}>{meta.error}</FormErrorMessage>}
      </FormControl>
    )}
  </Field>
);


export const NewGame = () => {
  const history = useHistory();
  const onSubmit = (data: GameOptions) => {
    console.log('data', data);
    history.push('/game', {
      options: JSON.stringify(data),
    });
  };

  return (
    <MenuContainer title="New Game">
      <Box width="500px">
        <Formik
          initialValues={defaultOptions}
          validationSchema={schema}
          onSubmit={onSubmit}
        >
          {(({ errors }) => (
            <Form>
              <Stack spacing={5}>
                <NumberField label="World axial tilt" name="world.axialTilt" />
                <NumberField label="World size" name="world.size" />
                <NumberField label="World sealevel" name="world.sealevel" />
                <NumberField label="World seed" name="world.seed" />
              </Stack>
              <Box mt={5}>
                <Button type="submit">Start Game</Button>
                {/* <pre>
                  {JSON.stringify(errors, null, 2)}
                </pre> */}
              </Box>
            </Form>
          ))}
        </Formik>
      </Box>
    </MenuContainer>
  );
}