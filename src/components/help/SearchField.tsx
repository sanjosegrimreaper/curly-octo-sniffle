import { Search, X } from 'lucide-react-native';
import { StyleSheet, TextInput, View } from 'react-native';

import { minTap, radius, spacing, Tappable, typeScale, useTheme } from '@/design';

/** A large search box (≥48dp) with a clear button. Text scales with the in-app text size. */
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  clearLabel,
  testID,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  clearLabel: string;
  testID?: string;
}) {
  const { palette, fonts, textScale } = useTheme();
  const size = typeScale.body.size * textScale;
  return (
    <View style={[styles.box, { backgroundColor: palette.surface, borderColor: palette.borderStrong }]}>
      <Search size={22} color={palette.textMuted} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        maxFontSizeMultiplier={2}
        style={[styles.input, { color: palette.text, fontFamily: fonts.body, fontSize: size, minHeight: minTap }]}
      />
      {value ? (
        <Tappable
          onPress={() => onChange('')}
          accessibilityLabel={clearLabel}
          style={[styles.clear, { backgroundColor: palette.surfaceSunken }]}>
          <X size={20} color={palette.text} />
        </Tappable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 2,
    borderRadius: radius.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xxs,
  },
  input: { flex: 1, paddingVertical: spacing.xs },
  clear: { width: minTap, height: minTap, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
