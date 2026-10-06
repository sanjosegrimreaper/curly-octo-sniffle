import { fireEvent, screen } from '@testing-library/react-native';

import { getPack } from '@/data/pack';
import { isConfirmed } from '@/domain';

import { renderUi } from '../../home/__tests__/testUtils';
import { packStats } from '../packStats';
import { ToggleRow } from '../ToggleRow';

jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : () => null) }),
);
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: jest.fn() }));

describe('ToggleRow', () => {
  it('is one accessible switch with its state, and toggles on press', async () => {
    const onChange = jest.fn();
    await renderUi(<ToggleRow label="High contrast" description="Stronger colors." value onChange={onChange} testID="t" />);
    const sw = screen.getByRole('switch', { name: 'High contrast' });
    expect(sw.props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText('On', { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(sw);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not toggle when disabled and says why', async () => {
    const onChange = jest.fn();
    await renderUi(<ToggleRow label="Vibrate on tap" note="Not available on the web." value={false} disabled onChange={onChange} />);
    fireEvent.press(screen.getByRole('switch', { name: 'Vibrate on tap' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Not available on the web.')).toBeTruthy();
    expect(screen.getByText('Off', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('packStats', () => {
  it('counts confirmed vs not-yet-confirmed records with the domain rule', () => {
    const pack = getPack();
    const stats = packStats(pack);
    const clinics = stats.find((s) => s.key === 'clinics');
    expect(clinics?.records).toBe(pack.clinics.length);
    expect(clinics?.confirmed).toBe(pack.clinics.filter((c) => isConfirmed(c.sources)).length);
    for (const s of stats) expect(s.confirmed + s.unconfirmed).toBe(s.records);
  });
});
