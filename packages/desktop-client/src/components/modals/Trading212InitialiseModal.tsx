// @ts-strict-ignore
import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { type Modal as ModalType } from 'loot-core/client/modals/modalsSlice';
import { send } from 'loot-core/platform/client/fetch';
import { getSecretsError } from 'loot-core/shared/errors';

import { Error } from '../alerts';
import { Link } from '../common/Link';
import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
} from '../common/Modal';
import { FormField, FormLabel } from '../forms';

type Trading212InitialiseModalProps = Extract<
  ModalType,
  { name: 'trading212-init' }
>['options'];

export const Trading212InitialiseModal = ({
  onSuccess,
}: Trading212InitialiseModalProps) => {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(
    t('It is required to provide an API key.'),
  );

  const onSubmit = async (close: () => void) => {
    if (!apiKey) {
      setIsValid(false);
      return;
    }

    setIsLoading(true);

    const { error, reason } =
      (await send('secret-set', {
        name: 'trading212_apiKey',
        value: apiKey,
      })) || {};

    if (error) {
      setIsValid(false);
      setError(getSecretsError(error, reason));
    } else {
      onSuccess();
    }
    setIsLoading(false);
    close();
  };

  return (
    <Modal name="trading212-init" containerProps={{ style: { width: 300 } }}>
      {({ state: { close } }) => (
        <>
          <ModalHeader
            title={t('Set-up Trading 212')}
            rightContent={<ModalCloseButton onPress={close} />}
          />
          <View style={{ display: 'flex', gap: 10 }}>
            <Text>
              <Trans>
                To enable Trading 212 integration, you need to provide your
                Trading 212 API key. You can find more information in the{' '}
                <Link
                  variant="external"
                  to="https://t212public-api-docs.redoc.ly"
                  linkColor="purple"
                >
                  Trading 212 API documentation
                </Link>
                .
              </Trans>
            </Text>

            <FormField>
              <FormLabel
                title={t('API Key:')}
                htmlFor="trading212-api-key-field"
              />
              <Input
                id="trading212-api-key-field"
                type="password"
                value={apiKey}
                onChangeValue={value => {
                  setApiKey(value);
                  setIsValid(true);
                }}
              />
            </FormField>

            {!isValid && <Error>{error}</Error>}
          </View>

          <ModalButtons>
            <ButtonWithLoading
              variant="primary"
              autoFocus
              isLoading={isLoading}
              onPress={() => {
                onSubmit(close);
              }}
            >
              <Trans>Save and continue</Trans>
            </ButtonWithLoading>
          </ModalButtons>
        </>
      )}
    </Modal>
  );
};
