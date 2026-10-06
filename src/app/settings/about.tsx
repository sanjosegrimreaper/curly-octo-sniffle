import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { BadgeCheck, Scale, ShieldCheck, Type } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { getPack } from '@/data/pack';
import { Card, HStack, Illustration, ReadAloud, Screen, spacing, Text, useTheme, VStack } from '@/design';

const RULES = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5'] as const;

/** About: version, what RxBridge is, privacy, honesty rules, not-affiliated note and font licenses. */
export default function AboutScreen() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { palette } = useTheme();
  const pack = getPack();
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? null;
  const build = Application.nativeBuildVersion;

  return (
    <Screen back title={t('about.title')} testID="about-screen">
      <Card style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
        <Illustration name="bridge" size={96} />
        <Text variant="title" center>
          {tc('appName')}
        </Text>
        {version ? (
          <Text variant="label" tone="muted" center tabular>
            {t('about.version', { version })}
            {build ? ` · ${t('about.build', { build })}` : ''}
          </Text>
        ) : null}
        <Text variant="label" tone="muted" center tabular>
          {t('about.dataVersion', { version: pack.manifest.version })}
        </Text>
      </Card>

      <Card>
        <Text variant="heading">{t('about.what.title')}</Text>
        <Text>{t('about.what.body')}</Text>
        <ReadAloud text={`${t('about.what.title')}. ${t('about.what.body')}`} />
      </Card>

      <Card signal="mint" treatment="outline" testID="about-privacy">
        <HStack gap="xs">
          <ShieldCheck size={22} color={palette.signals.mint.ink} />
          <Text variant="heading" style={{ flexShrink: 1 }}>
            {t('about.privacy.title')}
          </Text>
        </HStack>
        <Text bold>{t('about.privacy.body')}</Text>
        <Text>{t('about.privacy.detail')}</Text>
      </Card>

      <Card testID="about-honesty">
        <Text variant="heading">{t('about.honesty.title')}</Text>
        <VStack gap="sm">
          {RULES.map((r) => (
            <View key={r} style={styles.rule}>
              <BadgeCheck size={20} color={palette.signals.mint.ink} />
              <Text style={{ flex: 1 }}>{t(`about.honesty.${r}`)}</Text>
            </View>
          ))}
        </VStack>
      </Card>

      <Card signal="slate" treatment="outline" testID="about-affiliation">
        <HStack gap="xs">
          <Scale size={22} color={palette.signals.slate.ink} />
          <Text variant="heading" style={{ flexShrink: 1 }}>
            {t('about.affiliation.title')}
          </Text>
        </HStack>
        <Text>{t('about.affiliation.body')}</Text>
      </Card>

      <Card testID="about-licenses">
        <HStack gap="xs">
          <Type size={22} color={palette.textMuted} />
          <Text variant="heading" style={{ flexShrink: 1 }}>
            {t('about.licenses.title')}
          </Text>
        </HStack>
        <Text>{t('about.licenses.fredoka')}</Text>
        <Text>{t('about.licenses.atkinson')}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rule: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
});
