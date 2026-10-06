import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '../Text';
import { spacing } from '../tokens';
import { Card } from './Card';
import { Illustration, type IllustrationName } from './Illustration';

/** Honest empty state: what we know, why it's empty, and what to do next. Never a dead end. */
export function EmptyState({
  illustration,
  title,
  body,
  action,
  testID,
}: {
  illustration: IllustrationName;
  title: string;
  body?: string;
  action?: ReactNode;
  testID?: string;
}) {
  return (
    <Card testID={testID} style={{ alignItems: 'stretch', paddingVertical: spacing.lg }}>
      <Illustration name={illustration} size={104} />
      <Text variant="heading" center>
        {title}
      </Text>
      {body ? (
        <Text tone="muted" center>
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.xs }}>{action}</View> : null}
    </Card>
  );
}
