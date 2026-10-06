import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { fontsFor, motion, radius, spacing, Tappable, Text, typeScale, useTheme } from '@/design';
import { LANGUAGES, type Lang } from '@/i18n/languages';

/** A sample letter in each script, so people who don't read English spot their language at a glance. No flags. */
const SCRIPT_SAMPLE: Record<Lang, string> = { en: 'Aa', es: 'Ñ', 'zh-Hans': '中', hi: 'अ' };

/** One big language choice, labeled in its own script (radio semantics). */
export function LanguageTile({
  code,
  selected,
  wide,
  onPress,
}: {
  code: Lang;
  selected: boolean;
  /** Full-width row (large text) instead of a half-width tile. */
  wide?: boolean;
  onPress: () => void;
}) {
  const { palette, reduceMotion, textScale } = useTheme();
  const { t } = useTranslation('onboarding');
  const info = LANGUAGES[code];
  // Each name is set in its own script's face and line height (Devanagari matras need extra room).
  const own = fontsFor(code);
  const lineFor = (v: 'subheading') =>
    Math.round(typeScale[v].size * textScale * typeScale[v].line * own.lineHeightBoost);
  const nameStyle = { fontFamily: own.heading, fontWeight: own.headingWeight };

  return (
    <Tappable
      testID={`lang-${code}`}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, selected }}
      accessibilityLabel={t('welcome.languageA11y', { native: info.nativeName, english: info.englishName })}
      accessibilityHint={t('welcome.languageHint')}
      accessibilityLanguage={info.intlTag}
      style={[
        styles.tile,
        wide ? styles.wide : styles.half,
        {
          backgroundColor: selected ? palette.accentSoft : palette.surface,
          borderColor: selected ? palette.accent : palette.border,
          shadowColor: palette.shadow,
        },
      ]}>
      <View style={[styles.badge, { backgroundColor: selected ? palette.accent : palette.accentSoft }]}>
        <Text
          variant="subheading"
          style={[
            nameStyle,
            { lineHeight: lineFor('subheading'), color: selected ? palette.onAccent : palette.accentInk },
          ]}
          importantForAccessibility="no"
          accessibilityElementsHidden>
          {SCRIPT_SAMPLE[code]}
        </Text>
      </View>
      <Text
        variant="subheading"
        style={[
          nameStyle,
          styles.name,
          { lineHeight: lineFor('subheading') },
          selected ? { color: palette.accentInk } : null,
        ]}>
        {info.nativeName}
      </Text>
      {selected ? (
        <Animated.View
          entering={reduceMotion ? undefined : ZoomIn.springify().damping(motion.spring.damping).stiffness(260)}
          style={[styles.check, { backgroundColor: palette.accent }]}>
          <Check size={16} color={palette.onAccent} strokeWidth={3} />
        </Animated.View>
      ) : null}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 2,
    padding: spacing.sm,
    gap: spacing.sm,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  half: { flexBasis: '45%', flexGrow: 1, alignItems: 'flex-start' },
  wide: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  badge: {
    minWidth: 40,
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  name: { flexShrink: 1 },
  check: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
