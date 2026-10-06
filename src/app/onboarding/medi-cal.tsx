import { IdCard, MessageCircleQuestionMark, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { DraftBanner } from '@/components/DraftBanner';
import { NoticeBanner } from '@/components/onboarding/NoticeBanner';
import { ScreenerScreen } from '@/components/onboarding/ScreenerScreen';
import { href, ROUTES } from '@/components/onboarding/steps';
import { getPack } from '@/data/pack';
import { Button, Card, motion, spacing, Text, useTheme } from '@/design';
import { useScreener } from '@/state/screener';
import { startFresh } from '@/navigation';

const ROUTE = ROUTES.mediCal;

/** For Medi-Cal members: what to do at the pharmacy, plus the pack's Medi-Cal notices. No unverified claims. */
export default function MediCalScreen() {
  const { t } = useTranslation('onboarding');
  const { palette, reduceMotion } = useTheme();
  const update = useScreener((s) => s.update);
  const notices = getPack().notices.filter((n) => n.appliesTo.includes('medi-cal'));
  const ease = Easing.bezier(...motion.easing);

  const lookUp = () => {
    update({ completedAt: new Date().toISOString() });
    startFresh(href(ROUTES.find));
  };

  return (
    <ScreenerScreen
      route={ROUTE}
      testID="screen-medi-cal"
      title={t('mediCal.title')}
      subtitle={t('mediCal.body')}
      footer={<Button label={t('mediCal.lookUp')} onPress={lookUp} testID="medi-cal-look-up" />}>
      <Card
        signal="lilac"
        treatment="solid"
        style={{ gap: spacing.md, paddingVertical: spacing.lg }}
        testID="medi-cal-tips">
        <Tip icon={IdCard} text={t('mediCal.tipCard')} color={palette.signals.lilac.ink} bg={palette.surface} />
        <View style={{ height: 1, backgroundColor: palette.signals.lilac.solid, opacity: 0.25 }} />
        <Tip
          icon={MessageCircleQuestionMark}
          text={t('mediCal.tipAsk')}
          color={palette.signals.lilac.ink}
          bg={palette.surface}
        />
      </Card>

      <DraftBanner />

      {notices.length > 0 ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
          <Text variant="heading">{t('mediCal.noticesTitle')}</Text>
          {notices.map((n, i) => (
            <Animated.View
              key={n.id}
              entering={
                reduceMotion
                  ? undefined
                  : FadeInDown.delay(120 + i * 40)
                      .duration(motion.slow)
                      .easing(ease)
              }>
              <NoticeBanner notice={n} />
            </Animated.View>
          ))}
        </View>
      ) : null}
    </ScreenerScreen>
  );
}

function Tip({ icon: Icon, text, color, bg }: { icon: LucideIcon; text: string; color: string; bg: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon size={24} color={color} />
      </View>
      <Text variant="subheading" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}
