import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Text, VStack } from '@/design';
import { useUi } from '@/state/ui';

export type ConfirmOptions = {
  title: string;
  body?: string;
  /** Names what happens ("Yes, remove it"), never just "OK". */
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  testID?: string;
};

/**
 * Asks before a destructive action. Uses the app's own sheet (React Native's Alert does
 * nothing on the web), so it looks and reads the same everywhere.
 */
export function confirmAction(opts: ConfirmOptions) {
  useUi.getState().openSheet({ kind: 'custom', title: opts.title, render: () => <ConfirmBody {...opts} /> });
}

function ConfirmBody({ body, confirmLabel, danger, onConfirm, testID }: ConfirmOptions) {
  const { t } = useTranslation('common');
  const close = useUi((s) => s.closeSheet);
  const [busy, setBusy] = useState(false);
  return (
    <VStack gap="sm">
      {body ? <Text>{body}</Text> : null}
      <Button
        testID={testID ?? 'confirm-yes'}
        label={confirmLabel}
        variant={danger ? 'danger' : 'primary'}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            close();
          }
        }}
      />
      <Button testID="confirm-no" label={t('cancel')} variant="ghost" onPress={close} />
    </VStack>
  );
}
