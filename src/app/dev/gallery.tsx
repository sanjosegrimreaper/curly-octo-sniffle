import { ArrowRight, BadgeCheck, Bell, Contrast, Info } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SectionHeader } from '@/components/home/SectionHeader';
import { ToggleRow } from '@/components/settings/ToggleRow';
import { getPack } from '@/data/pack';
import type { SourceRef } from '@/data/schemas';
import { todayISO } from '@/domain';
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  FreshnessRing,
  HStack,
  Illustration,
  Screen,
  Segmented,
  SourceChip,
  spacing,
  Text,
  useTheme,
  VStack,
  type IllustrationName,
  type SignalName,
} from '@/design';

import NotFoundScreen from '../+not-found';

const SIGNALS: SignalName[] = ['mint', 'sky', 'lilac', 'tangerine', 'sunflower', 'coral', 'slate'];
const TREATMENTS = ['plain', 'solid', 'outline', 'hatched', 'dashed'] as const;
const ILLUSTRATIONS: IllustrationName[] = ['pillBottle', 'bridge', 'storefront', 'phone', 'folder', 'mapPin', 'calendar', 'magnifier', 'shield'];

function daysAgo(today: string, days: number): string {
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) - days));
  return dt.toISOString().slice(0, 10);
}

/** Dev-only design gallery (for design-review screenshots). Release builds show the not-found page. */
export default function GalleryRoute() {
  if (!__DEV__) return <NotFoundScreen />;
  return <Gallery />;
}

function Gallery() {
  const { t } = useTranslation('settings');
  const { palette } = useTheme();
  const [chip, setChip] = useState(true);
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [toggle, setToggle] = useState(true);
  const today = todayISO();

  // Sample sources built from a real pack source, with the method changed to show each chip state.
  const base = getPack().region.sources[0] as SourceRef;
  const confirmed: SourceRef[] = [{ ...base, method: 'official-pdf' }];
  const unconfirmed: SourceRef[] = [{ ...base, method: 'unconfirmed' }];

  return (
    <Screen back title={t('gallery.title')} testID="gallery-screen">
      <SectionHeader title={t('gallery.cards')} />
      {TREATMENTS.map((tr) => (
        <HStack key={tr} gap="xs" align="stretch">
          {SIGNALS.map((s) => (
            <Card key={s} signal={tr === 'plain' ? undefined : s} treatment={tr} style={{ width: 104, minHeight: 64 }}>
              <Text variant="caption" bold style={{ color: palette.signals[s].ink }}>
                {s}
              </Text>
              <Text variant="caption" tone="muted">
                {tr}
              </Text>
            </Card>
          ))}
        </HStack>
      ))}

      <SectionHeader title={t('gallery.badges')} />
      <HStack gap="xs">
        {SIGNALS.map((s) => (
          <Badge key={s} label={s} signal={s} icon={BadgeCheck} />
        ))}
      </HStack>

      <SectionHeader title={t('gallery.banners')} />
      <VStack gap="sm">
        <Banner tone="info" title={t('gallery.info')} body={t('gallery.sampleBody')} />
        <Banner tone="caution" title={t('gallery.caution')} body={t('gallery.sampleBody')} />
        <Banner tone="success" title={t('gallery.success')} body={t('gallery.sampleBody')} />
      </VStack>

      <SectionHeader title={t('gallery.chips')} />
      <HStack gap="xs">
        <Chip label={t('gallery.selected')} selected={chip} onPress={() => setChip((v) => !v)} />
        <Chip label={t('gallery.notSelected')} selected={!chip} onPress={() => setChip((v) => !v)} />
      </HStack>
      <Segmented
        accessibilityLabel={t('gallery.chips')}
        value={seg}
        onChange={setSeg}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C' },
        ]}
      />

      <SectionHeader title={t('gallery.buttons')} />
      <VStack gap="sm">
        <Button label={t('gallery.primary')} icon={ArrowRight} onPress={() => undefined} />
        <Button label={t('gallery.secondary')} variant="secondary" external onPress={() => undefined} />
        <HStack gap="xs">
          <Button compact label={t('gallery.ghost')} variant="ghost" icon={Bell} onPress={() => undefined} />
          <Button compact label={t('gallery.danger')} variant="danger" onPress={() => undefined} />
          <Button compact label={t('gallery.primary')} disabled onPress={() => undefined} />
          <Button compact label={t('gallery.primary')} loading onPress={() => undefined} />
        </HStack>
      </VStack>

      <SectionHeader title={t('gallery.sourceChips')} />
      <VStack gap="xs">
        <Text variant="caption" tone="muted">
          {t('gallery.confirmed')}
        </Text>
        <SourceChip sources={confirmed} verifiedAsOf={daysAgo(today, 3)} recordId="gallery:confirmed" />
        <Text variant="caption" tone="muted">
          {t('gallery.unconfirmed')}
        </Text>
        <SourceChip sources={unconfirmed} verifiedAsOf={today} recordId="gallery:unconfirmed" />
        <Text variant="caption" tone="muted">
          {t('gallery.stale')}
        </Text>
        <SourceChip sources={confirmed} verifiedAsOf={daysAgo(today, 200)} recordId="gallery:stale" />
      </VStack>

      <SectionHeader title={t('gallery.rings')} />
      <HStack gap="lg">
        {[0, 90, 200].map((d) => (
          <View key={d} style={{ alignItems: 'center', gap: spacing.xxs }}>
            <FreshnessRing verifiedAsOf={daysAgo(today, d)} today={today} size={44} />
            <Text variant="caption" tabular>
              {t('gallery.days', { count: d })}
            </Text>
          </View>
        ))}
      </HStack>

      <SectionHeader title={t('gallery.toggles')} />
      <Card padded={false}>
        <ToggleRow icon={Contrast} label={t('gallery.sampleTitle')} description={t('gallery.sampleBody')} value={toggle} onChange={setToggle} />
        <ToggleRow icon={Info} label={t('gallery.sampleTitle')} note={t('haptics.web')} disabled value={false} onChange={() => undefined} />
      </Card>

      <SectionHeader title={t('gallery.empty')} />
      <EmptyState
        illustration="bridge"
        title={t('gallery.sampleTitle')}
        body={t('gallery.sampleBody')}
        action={<Button label={t('gallery.primary')} variant="secondary" onPress={() => undefined} />}
      />

      <SectionHeader title={t('gallery.illustrations')} />
      <HStack gap="sm">
        {ILLUSTRATIONS.map((n) => (
          <Card key={n} style={{ alignItems: 'center' }}>
            <Illustration name={n} size={72} />
            <Text variant="caption" tone="muted">
              {n}
            </Text>
          </Card>
        ))}
      </HStack>
    </Screen>
  );
}
