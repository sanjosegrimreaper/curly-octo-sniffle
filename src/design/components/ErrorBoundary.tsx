import { Component, type ReactNode } from 'react';
import { View } from 'react-native';

import { i18next } from '@/i18n';

import { Text } from '../Text';
import { spacing } from '../tokens';
import { Button } from './Button';
import { Card } from './Card';
import { Illustration } from './Illustration';

type Props = { children: ReactNode; onRetry?: () => void };
type State = { error: Error | null };

/** Friendly per-screen error state with Retry. Never a white screen. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error) {
    if (__DEV__) console.warn('[RxBridge] screen error', error);
  }

  retry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  override render() {
    if (!this.state.error) return this.props.children;
    const t = i18next.getFixedT(null, 'common');
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.md }}>
        <Card style={{ gap: spacing.sm, paddingVertical: spacing.lg }}>
          <Illustration name="bridge" size={96} />
          <Text variant="heading" center>
            {t('error.title')}
          </Text>
          <Text tone="muted" center>
            {t('error.body')}
          </Text>
          <Button label={t('error.retry')} onPress={this.retry} />
        </Card>
      </View>
    );
  }
}
