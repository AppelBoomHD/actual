// @ts-strict-ignore
import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import type { Modal as ModalType } from 'loot-core/client/modals/modalsSlice';
import { send } from 'loot-core/platform/client/fetch';
import { getSecretsError } from 'loot-core/shared/errors';

import { Error as ErrorAlert } from '../alerts';
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
  const [oerAppId, setOerAppId] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(
    t('It is required to provide an API key.'),
  );

  const onSubmit = async (close: () => void) => {
    if (!apiKey || !oerAppId) {
      setIsValid(false);
      setError(t('Both API Key and OER App ID are required.'));
      return;
    }

    setIsLoading(true);

    const apiKeyResult =
      (await send('secret-set', {
        name: 'trading212_apiKey',
        value: apiKey,
      })) || {};

    const oerAppIdResult =
      (await send('secret-set', {
        name: 'trading212_oerAppId',
        value: oerAppId,
      })) || {};

    const error = apiKeyResult.error || oerAppIdResult.error;
    const reason = apiKeyResult.reason || oerAppIdResult.reason;

    if (error) {
      setIsValid(false);
      setError(getSecretsError(error, reason));
    } else {
      onSuccess();
      close();
    }
    setIsLoading(false);
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
                Trading 212 API key. You can find this by logging in to Trading 212 and going to Settings -&gt; API -&gt; Generate API key.
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

            <Text>
              <Trans>
                The OER App ID is required to convert Trading 212 data into your local currency. You can obtain a free App ID by registering at{' '}
                <Link
                  variant="external"
                  to="https://openexchangerates.org/signup/free"
                  linkColor="purple"
                >
                  Open Exchange Rates
                </Link>
                .
              </Trans>
            </Text>

            <FormField>
              <FormLabel
                title={t('OER App ID:')}
                htmlFor="trading212-oer-app-id-field"
              />
              <Input
                id="trading212-oer-app-id-field"
                type="text"
                value={oerAppId}
                onChangeValue={value => {
                  setOerAppId(value);
                  setIsValid(true);
                }}
              />
            </FormField>

            {!isValid && <ErrorAlert>{error}</ErrorAlert>}
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
