import { usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { HandHeart, Home, Pill, Search, type LucideIcon } from 'lucide-react-native';
import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type View as RNView,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONTENT_MAX_WIDTH, minTap, motion, radius, spacing, Tappable, Text, useTheme } from '@/design';

const TABS = [
  { name: 'home', href: '/home', icon: Home, labelKey: 'tabs.plan', testID: 'tab-plan' },
  { name: 'find', href: '/find', icon: Search, labelKey: 'tabs.find', testID: 'tab-find' },
  { name: 'medicines', href: '/medicines', icon: Pill, labelKey: 'tabs.medicines', testID: 'tab-medicines' },
  { name: 'help', href: '/help', icon: HandHeart, labelKey: 'tabs.help', testID: 'tab-help' },
] as const;

const BAR_PADDING = 6;

function activeIndex(pathname: string): number {
  const i = TABS.findIndex((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
  return i === -1 ? 0 : i;
}

/**
 * Four tabs in a floating bar. `TabList` must be a direct child of `Tabs` so Expo Router can
 * read the triggers; the floating chrome is the TabList's `asChild` view.
 */
export default function TabsLayout() {
  const { t } = useTranslation('common');
  const pathname = usePathname();
  const index = activeIndex(pathname);
  const label = t(TABS[index]?.labelKey ?? 'tabs.plan');

  // Tell screen readers which tab is now showing (not on first launch).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    AccessibilityInfo.announceForAccessibility(label);
  }, [label]);

  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <FloatingBar activeIndex={index}>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon} label={t(tab.labelKey)} testID={tab.testID} />
            </TabTrigger>
          ))}
        </FloatingBar>
      </TabList>
    </Tabs>
  );
}

function FloatingBar({
  children,
  activeIndex: index,
  style,
}: {
  children: ReactNode;
  activeIndex: number;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { palette, reduceMotion, highContrast } = useTheme();
  const [width, setWidth] = useState(0);
  const segment = width > 0 ? (width - BAR_PADDING * 2) / TABS.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    if (segment <= 0) return;
    x.value = reduceMotion ? index * segment : withSpring(index * segment, motion.spring);
  }, [index, segment, reduceMotion, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View pointerEvents="box-none" style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View
        accessibilityRole="tablist"
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={[
          style,
          styles.bar,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderWidth: highContrast ? 2 : 1,
            shadowColor: palette.shadow,
          },
        ]}>
        {segment > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                width: segment,
                backgroundColor: palette.accentSoft,
                borderColor: highContrast ? palette.accent : 'transparent',
                borderWidth: highContrast ? 2 : 0,
              },
              indicator,
            ]}
          />
        ) : null}
        {children}
      </View>
    </View>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon: LucideIcon; label: string; testID?: string };

const TabButton = forwardRef<RNView, TabButtonProps>(function TabButton(
  { icon: Icon, label, isFocused, testID, ...props },
  ref,
) {
  const { palette } = useTheme();
  const color = isFocused ? palette.accentInk : palette.textMuted;
  return (
    <Tappable
      ref={ref}
      {...props}
      testID={testID}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!isFocused }}
      style={styles.tab}>
      <Icon size={24} color={color} strokeWidth={isFocused ? 2.5 : 2} />
      <Text
        variant="caption"
        bold={isFocused}
        center
        numberOfLines={2}
        maxFontSizeMultiplier={1.4}
        style={{ color }}>
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
    padding: BAR_PADDING,
    borderRadius: radius.lg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  indicator: {
    position: 'absolute',
    top: BAR_PADDING,
    bottom: BAR_PADDING,
    left: BAR_PADDING,
    borderRadius: radius.md,
  },
  tab: {
    flex: 1,
    minHeight: minTap + 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
    paddingHorizontal: 2,
    paddingVertical: spacing.xxs,
  },
});
