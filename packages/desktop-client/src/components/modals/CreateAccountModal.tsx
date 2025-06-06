import React, { useEffect, useState } from 'react';
import { Dialog, DialogTrigger } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button, ButtonWithLoading } from '@actual-app/components/button';
import { SvgDotsHorizontalTriple } from '@actual-app/components/icons/v1';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { Menu } from '@actual-app/components/menu';
import { Paragraph } from '@actual-app/components/paragraph';
import { Popover } from '@actual-app/components/popover';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import {
  type Modal as ModalType,
  pushModal,
} from 'loot-core/client/modals/modalsSlice';
import { addNotification } from 'loot-core/client/notifications/notificationsSlice';
import { send } from 'loot-core/platform/client/fetch';

import { useAuth } from '../../auth/AuthProvider';
import { Permissions } from '../../auth/types';
import { authorizeBank } from '../../gocardless';
import { useDispatch } from '../../redux';
import { Warning } from '../alerts';
import { Link } from '../common/Link';
import { Modal, ModalCloseButton, ModalHeader } from '../common/Modal';
import { useMultiuserEnabled } from '../ServerContext';

import { useFeatureFlag } from '@desktop-client/hooks/useFeatureFlag';
import { useGoCardlessStatus } from '@desktop-client/hooks/useGoCardlessStatus';
import { usePluggyAiStatus } from '@desktop-client/hooks/usePluggyAiStatus';
import { useSimpleFinStatus } from '@desktop-client/hooks/useSimpleFinStatus';
import { useSyncServerStatus } from '@desktop-client/hooks/useSyncServerStatus';
import { useTrading212Status } from '@desktop-client/hooks/useTrading212Status';

type CreateAccountModalProps = Extract<
  ModalType,
  { name: 'add-account' }
>['options'];

export function CreateAccountModal({
  upgradingAccountId,
}: CreateAccountModalProps) {
  const { t } = useTranslation();

  const isPluggyAiEnabled = useFeatureFlag('pluggyAiBankSync');

  const syncServerStatus = useSyncServerStatus();
  const dispatch = useDispatch();
  const [isGoCardlessSetupComplete, setIsGoCardlessSetupComplete] = useState<
    boolean | null
  >(null);
  const [isSimpleFinSetupComplete, setIsSimpleFinSetupComplete] = useState<
    boolean | null
  >(null);
  const [isPluggyAiSetupComplete, setIsPluggyAiSetupComplete] = useState<
    boolean | null
  >(null);
  const [isTrading212SetupComplete, setIsTrading212SetupComplete] = useState<
    boolean | null
  >(null);
  const { hasPermission } = useAuth();
  const multiuserEnabled = useMultiuserEnabled();

  const onConnectGoCardless = () => {
    if (!isGoCardlessSetupComplete) {
      onGoCardlessInit();
      return;
    }

    if (upgradingAccountId == null) {
      authorizeBank(dispatch);
    } else {
      authorizeBank(dispatch);
    }
  };

  const onConnectSimpleFin = async () => {
    if (!isSimpleFinSetupComplete) {
      onSimpleFinInit();
      return;
    }

    if (loadingSimpleFinAccounts) {
      return;
    }

    setLoadingSimpleFinAccounts(true);

    try {
      const results = await send('simplefin-accounts');
      if (results.error_code) {
        throw new Error(results.reason);
      }

      const newAccounts = [];

      type NormalizedAccount = {
        account_id: string;
        name: string;
        institution: string;
        orgDomain: string;
        orgId: string;
        balance: number;
      };

      for (const oldAccount of results.accounts ?? []) {
        const newAccount: NormalizedAccount = {
          account_id: oldAccount.id,
          name: oldAccount.name,
          institution: oldAccount.org.name,
          orgDomain: oldAccount.org.domain,
          orgId: oldAccount.org.id,
          balance: oldAccount.balance,
        };

        newAccounts.push(newAccount);
      }

      dispatch(
        pushModal({
          modal: {
            name: 'select-linked-accounts',
            options: {
              externalAccounts: newAccounts,
              syncSource: 'simpleFin',
            },
          },
        }),
      );
    } catch (err) {
      console.error(err);
      dispatch(
        pushModal({
          modal: {
            name: 'simplefin-init',
            options: {
              onSuccess: () => setIsSimpleFinSetupComplete(true),
            },
          },
        }),
      );
    }

    setLoadingSimpleFinAccounts(false);
  };

  const onConnectPluggyAi = async () => {
    if (!isPluggyAiSetupComplete) {
      onPluggyAiInit();
      return;
    }

    try {
      const results = await send('pluggyai-accounts');
      if (results.error_code) {
        throw new Error(results.reason);
      } else if ('error' in results) {
        throw new Error(results.error);
      }

      const newAccounts = [];

      type NormalizedAccount = {
        account_id: string;
        name: string;
        institution: string;
        orgDomain: string | null;
        orgId: string;
        balance: number;
      };

      for (const oldAccount of results.accounts) {
        const newAccount: NormalizedAccount = {
          account_id: oldAccount.id,
          name: `${oldAccount.name.trim()} - ${oldAccount.type === 'BANK' ? oldAccount.taxNumber : oldAccount.owner}`,
          institution: oldAccount.name,
          orgDomain: null,
          orgId: oldAccount.id,
          balance:
            oldAccount.type === 'BANK'
              ? oldAccount.bankData.automaticallyInvestedBalance +
                oldAccount.bankData.closingBalance
              : oldAccount.balance,
        };

        newAccounts.push(newAccount);
      }

      dispatch(
        pushModal({
          modal: {
            name: 'select-linked-accounts',
            options: {
              externalAccounts: newAccounts,
              syncSource: 'pluggyai',
            },
          },
        }),
      );
    } catch (err) {
      console.error(err);
      addNotification({
        notification: {
          type: 'error',
          title: t('Error when trying to contact Pluggy.ai'),
          message: (err as Error).message,
          timeout: 5000,
        },
      });
      dispatch(
        pushModal({
          modal: {
            name: 'pluggyai-init',
            options: {
              onSuccess: () => setIsPluggyAiSetupComplete(true),
            },
          },
        }),
      );
    }
  };

  const onConnectTrading212 = async () => {
    if (!isTrading212SetupComplete) {
      onTrading212Init();
      return;
    }
    if (loadingTrading212Accounts) {
      return;
    }
    setLoadingTrading212Accounts(true);
    try {
      const results = await send('trading212-accounts');

      const newAccounts = [];
      if (
        results &&
        typeof results.total === 'number' &&
        typeof results.free === 'number' &&
        typeof results.pieCash === 'number'
      ) {
        newAccounts.push({
          account_id: `${results.id}-cash`,
          name: 'Trading 212 Cash',
          institution: 'Trading 212',
          orgDomain: 'trading212.com',
          orgId: 'trading212',
          balance: results.free - results.pieCash,
        });

        newAccounts.push({
          account_id: `${results.id}-investments`,
          name: 'Trading 212 Investments',
          institution: 'Trading 212',
          orgDomain: 'trading212.com',
          orgId: 'trading212',
          balance: results.total - results.free + results.pieCash,
        });
      }
      dispatch(
        pushModal({
          modal: {
            name: 'select-linked-accounts',
            options: {
              externalAccounts: newAccounts,
              syncSource: 'trading212',
            },
          },
        }),
      );
    } catch (err) {
      console.error(err);
      addNotification({
        notification: {
          type: 'error',
          title: t('Error when trying to contact Trading 212'),
          message: (err as Error).message,
          timeout: 5000,
        },
      });
      onTrading212Init();
    }
    setLoadingTrading212Accounts(false);
  };

  const onGoCardlessInit = () => {
    dispatch(
      pushModal({
        modal: {
          name: 'gocardless-init',
          options: {
            onSuccess: () => setIsGoCardlessSetupComplete(true),
          },
        },
      }),
    );
  };

  const onSimpleFinInit = () => {
    dispatch(
      pushModal({
        modal: {
          name: 'simplefin-init',
          options: {
            onSuccess: () => setIsSimpleFinSetupComplete(true),
          },
        },
      }),
    );
  };

  const onPluggyAiInit = () => {
    dispatch(
      pushModal({
        modal: {
          name: 'pluggyai-init',
          options: {
            onSuccess: () => setIsPluggyAiSetupComplete(true),
          },
        },
      }),
    );
  };

  const onTrading212Init = () => {
    dispatch(
      pushModal({
        modal: {
          name: 'trading212-init',
          options: {
            onSuccess: () => setIsTrading212SetupComplete(true),
          },
        },
      }),
    );
  };

  const onGoCardlessReset = () => {
    send('secret-set', {
      name: 'gocardless_secretId',
      value: null,
    }).then(() => {
      send('secret-set', {
        name: 'gocardless_secretKey',
        value: null,
      }).then(() => {
        setIsGoCardlessSetupComplete(false);
      });
    });
  };

  const onSimpleFinReset = () => {
    send('secret-set', {
      name: 'simplefin_token',
      value: null,
    }).then(() => {
      send('secret-set', {
        name: 'simplefin_accessKey',
        value: null,
      }).then(() => {
        setIsSimpleFinSetupComplete(false);
      });
    });
  };

  const onPluggyAiReset = () => {
    send('secret-set', {
      name: 'pluggyai_clientId',
      value: null,
    }).then(() => {
      send('secret-set', {
        name: 'pluggyai_clientSecret',
        value: null,
      }).then(() => {
        send('secret-set', {
          name: 'pluggyai_itemIds',
          value: null,
        }).then(() => {
          setIsPluggyAiSetupComplete(false);
        });
      });
    });
  };

  const onTrading212Reset = () => {
    send('secret-set', {
      name: 'trading212_apiKey',
      value: null,
    }).then(() => {
      setIsTrading212SetupComplete(false);
    });
  };

  const onCreateLocalAccount = () => {
    dispatch(pushModal({ modal: { name: 'add-local-account' } }));
  };

  const { configuredGoCardless } = useGoCardlessStatus();
  useEffect(() => {
    setIsGoCardlessSetupComplete(configuredGoCardless);
  }, [configuredGoCardless]);

  const { configuredSimpleFin } = useSimpleFinStatus();
  useEffect(() => {
    setIsSimpleFinSetupComplete(configuredSimpleFin);
  }, [configuredSimpleFin]);

  const { configuredPluggyAi } = usePluggyAiStatus();
  useEffect(() => {
    setIsPluggyAiSetupComplete(configuredPluggyAi);
  }, [configuredPluggyAi]);

  const { configuredTrading212 } = useTrading212Status();
  useEffect(() => {
    setIsTrading212SetupComplete(configuredTrading212);
  }, [configuredTrading212]);

  let title = t('Add account');
  const [loadingSimpleFinAccounts, setLoadingSimpleFinAccounts] =
    useState(false);

  const [loadingTrading212Accounts, setLoadingTrading212Accounts] =
    useState(false);

  if (upgradingAccountId != null) {
    title = t('Link account');
  }

  const canSetSecrets =
    !multiuserEnabled || hasPermission(Permissions.ADMINISTRATOR);

  return (
    <Modal name="add-account">
      {({ state: { close } }) => (
        <>
          <ModalHeader
            title={title}
            rightContent={<ModalCloseButton onPress={close} />}
          />
          <View style={{ maxWidth: 500, gap: 30, color: theme.pageText }}>
            {upgradingAccountId == null && (
              <View style={{ gap: 10 }}>
                <InitialFocus>
                  <Button
                    variant="primary"
                    style={{
                      padding: '10px 0',
                      fontSize: 15,
                      fontWeight: 600,
                    }}
                    onPress={onCreateLocalAccount}
                  >
                    {t('Create a local account')}
                  </Button>
                </InitialFocus>
                <View style={{ lineHeight: '1.4em', fontSize: 15 }}>
                  <Text>
                    <Trans>
                      <strong>Create a local account</strong> if you want to add
                      transactions manually. You can also{' '}
                      <Link
                        variant="external"
                        to="https://actualbudget.org/docs/transactions/importing"
                        linkColor="muted"
                      >
                        import QIF/OFX/QFX files into a local account
                      </Link>
                      .
                    </Trans>
                  </Text>
                </View>
              </View>
            )}
            <View style={{ gap: 10 }}>
              {syncServerStatus === 'online' ? (
                <>
                  {canSetSecrets && (
                    <>
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 10,
                          alignItems: 'center',
                        }}
                      >
                        <ButtonWithLoading
                          isDisabled={syncServerStatus !== 'online'}
                          style={{
                            padding: '10px 0',
                            fontSize: 15,
                            fontWeight: 600,
                            flex: 1,
                          }}
                          onPress={onConnectGoCardless}
                        >
                          {isGoCardlessSetupComplete
                            ? t('Link bank account with GoCardless')
                            : t('Set up GoCardless for bank sync')}
                        </ButtonWithLoading>
                        {isGoCardlessSetupComplete && (
                          <DialogTrigger>
                            <Button
                              variant="bare"
                              aria-label={t('GoCardless menu')}
                            >
                              <SvgDotsHorizontalTriple
                                width={15}
                                height={15}
                                style={{ transform: 'rotateZ(90deg)' }}
                              />
                            </Button>

                            <Popover>
                              <Dialog>
                                <Menu
                                  onMenuSelect={item => {
                                    if (item === 'reconfigure') {
                                      onGoCardlessReset();
                                    }
                                  }}
                                  items={[
                                    {
                                      name: 'reconfigure',
                                      text: t('Reset GoCardless credentials'),
                                    },
                                  ]}
                                />
                              </Dialog>
                            </Popover>
                          </DialogTrigger>
                        )}
                      </View>
                      <Text style={{ lineHeight: '1.4em', fontSize: 15 }}>
                        <Trans>
                          <strong>
                            Link a <em>European</em> bank account
                          </strong>{' '}
                          to automatically download transactions. GoCardless
                          provides reliable, up-to-date information from
                          hundreds of banks.
                        </Trans>
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 10,
                          marginTop: '18px',
                          alignItems: 'center',
                        }}
                      >
                        <ButtonWithLoading
                          isDisabled={syncServerStatus !== 'online'}
                          isLoading={loadingSimpleFinAccounts}
                          style={{
                            padding: '10px 0',
                            fontSize: 15,
                            fontWeight: 600,
                            flex: 1,
                          }}
                          onPress={onConnectSimpleFin}
                        >
                          {isSimpleFinSetupComplete
                            ? t('Link bank account with SimpleFIN')
                            : t('Set up SimpleFIN for bank sync')}
                        </ButtonWithLoading>
                        {isSimpleFinSetupComplete && (
                          <DialogTrigger>
                            <Button
                              variant="bare"
                              aria-label={t('SimpleFIN menu')}
                            >
                              <SvgDotsHorizontalTriple
                                width={15}
                                height={15}
                                style={{ transform: 'rotateZ(90deg)' }}
                              />
                            </Button>
                            <Popover>
                              <Dialog>
                                <Menu
                                  onMenuSelect={item => {
                                    if (item === 'reconfigure') {
                                      onSimpleFinReset();
                                    }
                                  }}
                                  items={[
                                    {
                                      name: 'reconfigure',
                                      text: t('Reset SimpleFIN credentials'),
                                    },
                                  ]}
                                />
                              </Dialog>
                            </Popover>
                          </DialogTrigger>
                        )}
                      </View>
                      <Text style={{ lineHeight: '1.4em', fontSize: 15 }}>
                        <Trans>
                          <strong>
                            Link a <em>North American</em> bank account
                          </strong>{' '}
                          to automatically download transactions. SimpleFIN
                          provides reliable, up-to-date information from
                          hundreds of banks.
                        </Trans>
                      </Text>
                      {isPluggyAiEnabled && (
                        <>
                          <View
                            style={{
                              flexDirection: 'row',
                              gap: 10,
                              alignItems: 'center',
                            }}
                          >
                            <ButtonWithLoading
                              isDisabled={syncServerStatus !== 'online'}
                              style={{
                                padding: '10px 0',
                                fontSize: 15,
                                fontWeight: 600,
                                flex: 1,
                              }}
                              onPress={onConnectPluggyAi}
                            >
                              {isPluggyAiSetupComplete
                                ? t('Link bank account with Pluggy.ai')
                                : t('Set up Pluggy.ai for bank sync')}
                            </ButtonWithLoading>
                            {isPluggyAiSetupComplete && (
                              <DialogTrigger>
                                <Button
                                  variant="bare"
                                  aria-label={t('Pluggy.ai menu')}
                                >
                                  <SvgDotsHorizontalTriple
                                    width={15}
                                    height={15}
                                    style={{ transform: 'rotateZ(90deg)' }}
                                  />
                                </Button>

                                <Popover>
                                  <Dialog>
                                    <Menu
                                      onMenuSelect={item => {
                                        if (item === 'reconfigure') {
                                          onPluggyAiReset();
                                        }
                                      }}
                                      items={[
                                        {
                                          name: 'reconfigure',
                                          text: t(
                                            'Reset Pluggy.ai credentials',
                                          ),
                                        },
                                      ]}
                                    />
                                  </Dialog>
                                </Popover>
                              </DialogTrigger>
                            )}
                          </View>
                          <Text style={{ lineHeight: '1.4em', fontSize: 15 }}>
                            <Trans>
                              <strong>
                                Link a <em>Brazilian</em> bank account
                              </strong>{' '}
                              to automatically download transactions. Pluggy.ai
                              provides reliable, up-to-date information from
                              hundreds of banks.
                            </Trans>
                          </Text>
                        </>
                      )}
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 10,
                          marginTop: '18px',
                          alignItems: 'center',
                        }}
                      >
                        <ButtonWithLoading
                          isDisabled={syncServerStatus !== 'online'}
                          isLoading={loadingTrading212Accounts}
                          style={{
                            padding: '10px 0',
                            fontSize: 15,
                            fontWeight: 600,
                            flex: 1,
                          }}
                          onPress={onConnectTrading212}
                        >
                          {isTrading212SetupComplete
                            ? t('Link Trading 212 account')
                            : t('Set up Trading 212 for sync')}
                        </ButtonWithLoading>
                        {isTrading212SetupComplete && (
                          <DialogTrigger>
                            <Button
                              variant="bare"
                              aria-label={t('Trading 212 menu')}
                            >
                              <SvgDotsHorizontalTriple
                                width={15}
                                height={15}
                                style={{ transform: 'rotateZ(90deg)' }}
                              />
                            </Button>
                            <Popover>
                              <Dialog>
                                <Menu
                                  onMenuSelect={item => {
                                    if (item === 'reconfigure') {
                                      onTrading212Reset();
                                    }
                                  }}
                                  items={[
                                    {
                                      name: 'reconfigure',
                                      text: t('Reset Trading 212 credentials'),
                                    },
                                  ]}
                                />
                              </Dialog>
                            </Popover>
                          </DialogTrigger>
                        )}
                      </View>
                      <Text style={{ lineHeight: '1.4em', fontSize: 15 }}>
                        <Trans>
                          <strong>Link your Trading 212 account</strong> to
                          automatically download your cash and portfolio data.
                          Trading 212 provides investment account sync via their
                          public API.
                        </Trans>
                      </Text>
                    </>
                  )}
                  {(!isGoCardlessSetupComplete ||
                    !isSimpleFinSetupComplete ||
                    !isPluggyAiSetupComplete) &&
                    !canSetSecrets && (
                      <Warning>
                        <Trans>
                          You don&apos;t have the required permissions to set up
                          secrets. Please contact an Admin to configure
                        </Trans>{' '}
                        {[
                          isGoCardlessSetupComplete ? '' : 'GoCardless',
                          isSimpleFinSetupComplete ? '' : 'SimpleFin',
                          isPluggyAiSetupComplete ? '' : 'Pluggy.ai',
                        ]
                          .filter(Boolean)
                          .join(' or ')}
                        .
                      </Warning>
                    )}
                </>
              ) : (
                <>
                  <Button
                    isDisabled
                    style={{
                      padding: '10px 0',
                      fontSize: 15,
                      fontWeight: 600,
                    }}
                  >
                    <Trans>Set up bank sync</Trans>
                  </Button>
                  <Paragraph style={{ fontSize: 15 }}>
                    <Trans>
                      Connect to an Actual server to set up{' '}
                      <Link
                        variant="external"
                        to="https://actualbudget.org/docs/advanced/bank-sync"
                        linkColor="muted"
                      >
                        automatic syncing
                      </Link>
                      .
                    </Trans>
                  </Paragraph>
                </>
              )}
            </View>
          </View>
        </>
      )}
    </Modal>
  );
}
