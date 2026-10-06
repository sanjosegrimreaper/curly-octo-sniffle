import * as LocalAuthentication from 'expo-local-authentication';
import { router, type Href } from 'expo-router';
import {
  Contrast,
  Database,
  Eraser,
  Flag,
  Info,
  Lock,
  UserRoundPlus,
  Users,
  Vibrate,
  WifiOff,
  EyeOff,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { confirmAction } from '@/components/home/confirm';
import { confirmNewClient } from '@/components/home/NavigatorBar';
import { wipeEverything } from '@/components/home/wipe';
import { SettingsBlock, SettingsGroup } from '@/components/settings/SettingsGroup';
import { ToggleRow } from '@/components/settings/ToggleRow';
import { getPack } from '@/data/pack';
import {
  Button,
  Card,
  Chip,
  HStack,
  ListRow,
  ReadAloud,
  Screen,
  Segmented,
  spacing,
  Text,
  VStack,
} from '@/design';
import { LANGUAGES, LAUNCH_LANGUAGES, type Lang } from '@/i18n/languages';
import { openExternal } from '@/services/links';
import { useSettings, type MotionPref, type TextSize, type ThemeMode } from '@/state/settings';
import { useUi } from '@/state/ui';
import { startFresh } from '@/navigation';

type Speed = 'slow' | 'normal' | 'fast';
const SPEED_RATE: Record<Speed, number> = { slow: 0.8, normal: 0.95, fast: 1.1 };

function speedOf(rate: number): Speed {
  const entries = Object.entries(SPEED_RATE) as [Speed, number][];
  return entries.reduce((best, cur) => (Math.abs(cur[1] - rate) < Math.abs(best[1] - rate) ? cur : best))[0];
}

const isWeb = Platform.OS === 'web';

export default function SettingsScreen() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const s = useSettings();
  const set = s.set;
  const toast = useUi((u) => u.showToast);
  const region = getPack().region;

  const toggleAppLock = async (next: boolean) => {
    if (!next) {
      set('appLock', false);
      return;
    }
    try {
      if (!(await LocalAuthentication.hasHardwareAsync())) {
        toast(t('appLock.noHardware'), 'caution');
        return;
      }
      if (!(await LocalAuthentication.isEnrolledAsync())) {
        toast(t('appLock.notEnrolled'), 'caution');
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: t('appLock.prompt'),
        cancelLabel: tc('cancel'),
        disableDeviceFallback: false,
      });
      if (res.success) {
        set('appLock', true);
        toast(t('appLock.turnedOn'), 'success');
      } else {
        toast(t('appLock.failed'), 'caution');
      }
    } catch {
      toast(t('appLock.failed'), 'caution');
    }
  };

  const toggleNavigator = (next: boolean) => {
    if (next) {
      set('navigatorMode', true);
      return;
    }
    // Turning helper mode off would start saving the current client's answers: clear them first.
    confirmAction({
      title: t('navigatorMode.offTitle'),
      body: t('navigatorMode.offBody'),
      confirmLabel: t('navigatorMode.offConfirm'),
      danger: true,
      onConfirm: async () => {
        await wipeEverything();
        set('navigatorMode', false);
        set('clientLanguage', null);
      },
    });
  };

  const clearData = () =>
    confirmAction({
      title: t('clear.title'),
      body: t('clear.body'),
      confirmLabel: t('clear.confirm'),
      danger: true,
      testID: 'clear-data-confirm',
      onConfirm: async () => {
        await wipeEverything();
        toast(t('clear.done'), 'success');
        startFresh('/welcome' as Href);
      },
    });

  return (
    <Screen back title={t('title')} testID="settings-screen">
      <SettingsGroup title={t('sections.display')} testID="settings-display">
        <SettingsBlock label={t('language.label')} description={t('language.hint')}>
          <HStack gap="xs">
            {LAUNCH_LANGUAGES.map((code: Lang) => (
              <Chip
                key={code}
                testID={`settings-lang-${code}`}
                label={LANGUAGES[code].nativeName}
                accessibilityHint={LANGUAGES[code].englishName}
                selected={s.language === code}
                onPress={() => set('language', code)}
              />
            ))}
          </HStack>
        </SettingsBlock>

        <SettingsBlock label={t('textSize.label')}>
          <Segmented<TextSize>
            accessibilityLabel={t('textSize.label')}
            value={s.textSize}
            onChange={(v) => set('textSize', v)}
            options={[
              { value: 'default', label: t('textSize.default'), testID: 'text-size-default' },
              { value: 'large', label: t('textSize.large'), testID: 'text-size-large' },
              { value: 'larger', label: t('textSize.larger'), testID: 'text-size-larger' },
            ]}
          />
          <Card signal="sky" treatment="outline" testID="text-size-preview">
            <Text variant="caption" bold tone="sky">
              {t('textSize.preview')}
            </Text>
            <Text variant="heading">{t('textSize.previewHeading')}</Text>
            <Text>{t('textSize.previewBody')}</Text>
          </Card>
        </SettingsBlock>

        <SettingsBlock label={t('theme.label')}>
          <Segmented<ThemeMode>
            accessibilityLabel={t('theme.label')}
            value={s.themeMode}
            onChange={(v) => set('themeMode', v)}
            options={[
              { value: 'system', label: t('theme.system') },
              { value: 'light', label: t('theme.light') },
              { value: 'dark', label: t('theme.dark') },
            ]}
          />
        </SettingsBlock>

        <ToggleRow
          testID="toggle-high-contrast"
          icon={Contrast}
          label={t('highContrast.label')}
          description={t('highContrast.description')}
          value={s.highContrast}
          onChange={(v) => set('highContrast', v)}
        />

        <SettingsBlock label={t('reduceMotion.label')} description={t('reduceMotion.description')}>
          <Segmented<MotionPref>
            accessibilityLabel={t('reduceMotion.label')}
            value={s.reduceMotion}
            onChange={(v) => set('reduceMotion', v)}
            options={[
              { value: 'system', label: t('reduceMotion.system') },
              { value: 'on', label: t('reduceMotion.on') },
              { value: 'off', label: t('reduceMotion.off') },
            ]}
          />
        </SettingsBlock>
      </SettingsGroup>

      <SettingsGroup title={t('sections.sound')}>
        <ToggleRow
          testID="toggle-haptics"
          icon={Vibrate}
          label={t('haptics.label')}
          description={t('haptics.description')}
          note={isWeb ? t('haptics.web') : undefined}
          disabled={isWeb}
          value={s.haptics && !isWeb}
          onChange={(v) => set('haptics', v)}
        />
        <SettingsBlock label={t('speech.label')}>
          <Segmented<Speed>
            accessibilityLabel={t('speech.label')}
            value={speedOf(s.speechRate)}
            onChange={(v) => set('speechRate', SPEED_RATE[v])}
            options={[
              { value: 'slow', label: t('speech.slow') },
              { value: 'normal', label: t('speech.normal') },
              { value: 'fast', label: t('speech.fast') },
            ]}
          />
          <HStack gap="sm">
            <ReadAloud text={t('speech.sample')} label={t('speech.test')} />
            <Text variant="label" tone="muted" style={{ flex: 1, minWidth: 160 }}>
              {t('speech.sample')}
            </Text>
          </HStack>
        </SettingsBlock>
      </SettingsGroup>

      <SettingsGroup title={t('sections.privacy')}>
        <SettingsBlock label={t('privacyNote.title')} description={t('privacyNote.body')} />
        {isWeb ? (
          <SettingsBlock label={t('appLock.label')} description={t('appLock.web')} />
        ) : (
          <ToggleRow
            testID="toggle-app-lock"
            icon={Lock}
            signal="mint"
            label={t('appLock.label')}
            description={t('appLock.description')}
            value={s.appLock}
            onChange={(v) => void toggleAppLock(v)}
          />
        )}
        <ToggleRow
          testID="toggle-private-notifications"
          icon={EyeOff}
          signal="mint"
          label={t('privateNotifications.label')}
          description={t('privateNotifications.description')}
          value={s.privateNotifications}
          onChange={(v) => set('privateNotifications', v)}
        />
        <ToggleRow
          testID="toggle-low-data"
          icon={WifiOff}
          label={t('lowData.label')}
          description={t('lowData.description')}
          value={s.lowData}
          onChange={(v) => set('lowData', v)}
        />
        <ToggleRow
          testID="toggle-navigator"
          icon={Users}
          signal="lilac"
          label={t('navigatorMode.label')}
          description={t('navigatorMode.description')}
          value={s.navigatorMode}
          onChange={toggleNavigator}
        />
        {s.navigatorMode ? (
          <SettingsBlock label={t('navigatorMode.clientLanguage')} description={t('navigatorMode.clientLanguageHint')}>
            <HStack gap="xs">
              <Chip
                label={t('navigatorMode.sameAsApp')}
                selected={s.clientLanguage === null}
                onPress={() => set('clientLanguage', null)}
              />
              {LAUNCH_LANGUAGES.map((code: Lang) => (
                <Chip
                  key={code}
                  testID={`client-lang-${code}`}
                  label={LANGUAGES[code].nativeName}
                  accessibilityHint={LANGUAGES[code].englishName}
                  selected={s.clientLanguage === code}
                  onPress={() => set('clientLanguage', code)}
                />
              ))}
            </HStack>
            <Button
              compact
              variant="secondary"
              icon={UserRoundPlus}
              label={t('navigator.newClient')}
              onPress={confirmNewClient}
              style={{ alignSelf: 'flex-start' }}
              testID="settings-new-client"
            />
          </SettingsBlock>
        ) : null}
        <SettingsBlock label={t('clear.button')} description={t('clear.hint')}>
          <Button
            compact
            variant="danger"
            icon={Eraser}
            label={t('clear.button')}
            onPress={clearData}
            style={{ alignSelf: 'flex-start' }}
            testID="clear-data"
          />
        </SettingsBlock>
      </SettingsGroup>

      <View style={{ gap: spacing.xs }}>
        <Text variant="heading" style={{ marginTop: spacing.sm }}>
          {t('sections.data')}
        </Text>
        <VStack gap="sm">
          <ListRow
            testID="settings-sources"
            icon={Database}
            signal="sky"
            title={t('links.sources')}
            subtitle={t('links.sourcesSub')}
            onPress={() => router.push('/settings/sources' as Href)}
          />
          <ListRow
            testID="settings-about"
            icon={Info}
            signal="sky"
            title={t('links.about')}
            subtitle={t('links.aboutSub')}
            onPress={() => router.push('/settings/about' as Href)}
          />
          {region.reportProblemUrl ? (
            <ListRow
              testID="settings-report"
              icon={Flag}
              signal="sunflower"
              title={t('links.report')}
              subtitle={`${t('links.reportSub')} ${t('links.reportHint')}`}
              onPress={() => void openExternal(region.reportProblemUrl ?? '')}
            />
          ) : null}
        </VStack>
      </View>
    </Screen>
  );
}
