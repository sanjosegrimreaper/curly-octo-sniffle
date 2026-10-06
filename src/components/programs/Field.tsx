import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { minTap, radius, spacing, Text, typeScale, useTheme } from '@/design';

/** Labeled text field (notes, reference number). Grows with the text; never a fixed text height. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  testID?: string;
}) {
  const { palette, fonts, textScale } = useTheme();
  const [focused, setFocused] = useState(false);
  const fontSize = typeScale.body.size * textScale;
  return (
    <View style={styles.wrap}>
      <Text variant="label" bold>
        {label}
      </Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        multiline={multiline}
        accessibilityLabel={label}
        accessibilityHint={placeholder}
        maxFontSizeMultiplier={2}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          {
            minHeight: multiline ? minTap * 2.5 : minTap,
            fontSize,
            lineHeight: Math.round(fontSize * typeScale.body.line),
            fontFamily: fonts.body,
            color: palette.text,
            backgroundColor: palette.surfaceSunken,
            borderColor: focused ? palette.accent : palette.border,
            borderWidth: focused ? 2 : 1,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xxs },
  input: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
});
