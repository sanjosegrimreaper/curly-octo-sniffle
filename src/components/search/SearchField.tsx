import { Search, X } from 'lucide-react-native';
import { forwardRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TextInput, View, type TextStyle } from 'react-native';

import { minTap, radius, spacing, Tappable, typeScale, useTheme } from '@/design';

// The whole field shows focus with its accent border, so the browser's inner outline is redundant.
const WEB_NO_OUTLINE = (Platform.OS === 'web' ? { outlineStyle: 'none' } : null) as TextStyle | null;

/** Big, friendly search field with a clear button (48dp). */
export const SearchField = forwardRef<TextInput, { value: string; onChange: (v: string) => void; onSubmit?: () => void; autoFocus?: boolean }>(
  function SearchField({ value, onChange, onSubmit, autoFocus }, ref) {
    const { t } = useTranslation('search');
    const { palette, textScale, fonts } = useTheme();
    const [focused, setFocused] = useState(false);
    const fontSize = typeScale.subheading.size * 1.1 * textScale;

    return (
      <View
        style={[
          styles.wrap,
          {
            backgroundColor: palette.surface,
            borderColor: focused ? palette.accent : palette.borderStrong,
            shadowColor: palette.shadow,
          },
        ]}>
        <Search size={24} color={focused ? palette.accentInk : palette.textMuted} />
        <TextInput
          ref={ref}
          testID="search-input"
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          returnKeyType="search"
          enterKeyHint="search"
          inputMode="search"
          accessibilityLabel={t('inputLabel')}
          placeholder={t('placeholder')}
          placeholderTextColor={palette.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxFontSizeMultiplier={2}
          style={[styles.input, WEB_NO_OUTLINE, { color: palette.text, fontSize, fontFamily: fonts.body }]}
        />
        {value ? (
          <Tappable
            testID="search-clear"
            onPress={() => onChange('')}
            accessibilityLabel={t('clear')}
            style={[styles.clear, { backgroundColor: palette.surfaceSunken, borderColor: palette.border }]}>
            <X size={22} color={palette.text} />
          </Tappable>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 64,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  input: { flex: 1, minHeight: minTap + 8, paddingVertical: spacing.xs },
  clear: {
    width: minTap,
    height: minTap,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
