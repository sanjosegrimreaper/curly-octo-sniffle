import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { HandHeart, Home, Pill, Search, type LucideIcon } from 'lucide-react-native';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONTENT_MAX_WIDTH, minTap, radius, spacing, Tappable, Text, useTheme } from '@/design';

export default function TabsLayout() {
  const { t } = useTranslation('common');
  return (
    <Tabs>
      <TabSlot />
      <FloatingBar>
        <TabTrigger name="home" href="/home" asChild>
          <TabButton icon={Home} label={t('tabs.plan')} testID="tab-plan" />
        </TabTrigger>
        <TabTrigger name="find" href="/find" asChild>
          <TabButton icon={Search} label={t('tabs.find')} testID="tab-find" />
        </TabTrigger>
        <TabTrigger name="medicines" href="/medicines" asChild>
          <TabButton icon={Pill} label={t('tabs.medicines')} testID="tab-medicines" />
        </TabTrigger>
        <TabTrigger name="help" href="/help" asChild>
          <TabButton icon={HandHeart} label={t('tabs.help')} testID="tab-help" />
        </TabTrigger>
      </FloatingBar>
    </Tabs>
  );
}

function FloatingBar({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  return (
    <View pointerEvents="box-none" style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <TabList asChild>
        <View
          accessibilityRole="tablist"
          style={[styles.bar, { backgroundColor: palette.surface, borderColor: palette.border, shadowColor: palette.shadow }]}>
          {children}
        </View>
      </TabList>
    </View>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon: LucideIcon; label: string; testID?: string };

const TabButton = forwardRef<RNView, TabButtonProps>(function TabButton({ icon: Icon, label, isFocused, testID, ...props }, ref) {
  const { palette } = useTheme();
  return (
    <Tappable
      ref={ref}
      {...props}
      testID={testID}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!isFocused }}
      style={[styles.tab, isFocused && { backgroundColor: palette.accentSoft }]}>
      <Icon size={24} color={isFocused ? palette.accentInk : palette.textMuted} strokeWidth={isFocused ? 2.5 : 2} />
      <Text
        variant="caption"
        bold={isFocused}
        numberOfLines={1}
        maxFontSizeMultiplier={1.4}
        style={{ color: isFocused ? palette.accentInk : palette.textMuted }}>
        {label}
      </Text>
    </Tappable>
  );
});

const styles = StyleSheet.create({
  barWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: spacing.sm },
  bar: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    flexDirection: 'row',
    padding: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  tab: {
    flex: 1,
    minHeight: minTap + 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
    paddingHorizontal: 2,
  },
});
