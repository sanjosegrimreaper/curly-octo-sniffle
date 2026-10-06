import { screen } from '@testing-library/react-native';

import { getPack } from '@/data/pack';
import type { Clinic, Helper } from '@/data/schemas';

import { renderUi } from '../../home/__tests__/testUtils';
import { relevantAudiences, splitHelpers } from '../audience';
import { ClinicCard } from '../ClinicCard';

jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : () => null) }),
);
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: jest.fn() }));

const SOURCES: Clinic['sources'] = [
  { name: 'Test Source (fake)', url: 'https://example.org/source', method: 'unconfirmed', checkedOn: '2026-01-15' },
];

/** FAKE clinic for tests — not a real place. */
function fakeClinic(overrides: Partial<Clinic>): Clinic {
  return {
    id: 'test-clinic',
    name: 'Test Clinic (fake)',
    organization: 'Test Org (fake)',
    address: '1 Test Street',
    city: 'Testville',
    county: 'santa-clara',
    lat: null,
    lng: null,
    phone: null,
    url: 'https://example.org/clinic',
    zip: null,
    slidingFee: null,
    hasPharmacy: null,
    pharmacyHours: null,
    languages: [],
    sources: SOURCES,
    verifiedAsOf: '2026-01-15',
    ...overrides,
  };
}

describe('ClinicCard', () => {
  it('shows unknown services as "call to confirm" and offers no Call button without a phone', async () => {
    await renderUi(<ClinicCard clinic={fakeClinic({})} />);
    expect(screen.getByText('Pharmacy: call to confirm')).toBeTruthy();
    expect(screen.getByText('Fees: call to confirm')).toBeTruthy();
    expect(screen.getByText('Phone not listed — use the website or visit')).toBeTruthy();
    expect(screen.queryByLabelText(/^Call /)).toBeNull();
    expect(screen.getByLabelText('Website: example.org')).toBeTruthy();
    expect(screen.getByText(/Not yet confirmed — call to confirm/)).toBeTruthy();
  });

  it('shows only what the source says when services are listed', async () => {
    await renderUi(<ClinicCard clinic={fakeClinic({ hasPharmacy: true, slidingFee: true, phone: '555-0100' })} />);
    expect(screen.getByText('Pharmacy on site')).toBeTruthy();
    expect(screen.getByText('Sliding fee (cost based on income)')).toBeTruthy();
    expect(screen.getByLabelText('Call 555-0100')).toBeTruthy();
  });
});

describe('helpers relevance', () => {
  const helpers: Helper[] = getPack().helpers;

  it('shows everything before the screener is answered', () => {
    const { forYou, others } = splitHelpers(helpers, null, relevantAudiences({ insurance: 'unsure', age65: null }, false));
    expect(forYou.length).toBe(helpers.length);
    expect(others).toEqual([]);
  });

  it('keeps county-only helpers to their county; region-wide helpers stay for everyone', () => {
    const all = relevantAudiences({ insurance: 'none', age65: 'no' }, true);
    const monterey = splitHelpers(helpers, 'monterey', all);
    const ids = [...monterey.forYou, ...monterey.others].map((h) => h.id);
    for (const h of helpers) {
      const expected = h.counties.length === 0 || h.counties.includes('monterey');
      expect(ids.includes(h.id)).toBe(expected);
    }
  });

  it('puts Medicare helpers under "Also available" for an uninsured person under 65', () => {
    const { forYou, others } = splitHelpers(helpers, 'santa-clara', relevantAudiences({ insurance: 'none', age65: 'no' }, true));
    expect(forYou.every((h) => h.forWhom !== 'medicare')).toBe(true);
    expect(others.some((h) => h.forWhom === 'medicare')).toBe(true);
  });
});
