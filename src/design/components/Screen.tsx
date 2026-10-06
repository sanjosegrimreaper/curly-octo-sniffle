import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../Text';
import { useTheme } from '../theme';
import { minTap, radius, spacing } from '../tokens';
import { GraphPaper } from './GraphPaper';
import { Tappable } from './Tappable';

export const CONTENT_MAX_WIDTH = 640;
/** Space the floating tab bar covers at the bottom of tab screens. */
export const TAB_BAR_SPACE = 104;

export type ScreenProps = {
  title?: string;
  /** Small label above the title (e.g. "Step 2 of 5"). */
  eyebrow?: string;
  back?: boolean | (() => void);
  right?: ReactNode;
  /** Rendered above the title, full-bleed (e.g. the Bridge). */
  top?: ReactNode;
  children: ReactNode;
  /** Sticky area at the bottom (primary action). */
  footer?: ReactNode;
  scroll?: boolean;
  inTabs?: boolean;
  testID?: string;
};

export function Screen({ title, eyebrow, back, right, top, children, footer, scroll = true, inTabs, testID }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { t } = useTranslation('common');

  const onBack = typeof back === 'function' ? back : () => (router.canGoBack() ? router.back() : router.replace('/'));

  const header =
    back || right ? (
      <View style={styles.headerRow}>
        {back ? (
          <Tappable
            testID="back"
            onPress={onBack}
            accessibilityLabel={t('back')}
            style={[styles.iconButton, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <ChevronLeft size={26} color={palette.text} />
          </Tappable>
        ) : null}
        <View style={{ flex: 1 }} />
        {right}
      </View>
    ) : null;

  const body = (
    <View style={styles.content}>
      {header}
      {top}
      {eyebrow ? (
        <Text variant="label" tone="accent" bold>
          {eyebrow}
        </Text>
      ) : null}
      {title ? <Text variant="title">{title}</Text> : null}
      {children}
    </View>
  );

  return (
    <View style={styles.root} testID={testID}>
      <GraphPaper />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingTop: insets.top + spacing.sm,
              paddingBottom: (footer ? spacing.md : insets.bottom + spacing.xl) + (inTabs ? TAB_BAR_SPACE : 0),
              alignItems: 'center',
            }}>
            {body}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, paddingTop: insets.top + spacing.sm, alignItems: 'center' }}>{body}</View>
        )}
        {footer ? (
          <View
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, spacing.md) + (inTabs ? TAB_BAR_SPACE : 0),
                backgroundColor: palette.bg,
                borderTopColor: palette.border,
              },
            ]}>
            <View style={styles.footerInner}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, paddingHorizontal: spacing.md, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: minTap },
  iconButton: {
    width: minTap,
    height: minTap,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { paddingTop: spacing.sm, paddingHorizontal: spacing.md, borderTopWidth: 1, alignItems: 'center' },
  footerInner: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, gap: spacing.xs },
});

/** Round icon button for screen headers (share, save, settings). */
export function HeaderButton({
  icon: Icon,
  label,
  onPress,
  active,
  testID,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; fill?: string }>;
  label: string;
  onPress: () => void;
  active?: boolean;
  testID?: string;
}) {
  const { palette } = useTheme();
  return (
    <Tappable
      testID={testID}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={active !== undefined ? { selected: active } : undefined}
      style={[styles.iconButton, { backgroundColor: active ? palette.accentSoft : palette.surface, borderColor: active ? palette.accent : palette.border }]}>
      <Icon size={22} color={active ? palette.accentInk : palette.text} fill={active ? palette.accentInk : 'transparent'} />
    </Tappable>
  );
}
