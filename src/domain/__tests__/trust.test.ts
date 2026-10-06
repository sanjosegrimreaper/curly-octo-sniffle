import { CONFIRMED_METHODS, type SourceRef } from '@/data/schemas';

import { isConfirmed } from '../trust';
import { FAKE_SOURCES } from './fixtures';

const src = (method: SourceRef['method']): SourceRef => ({ ...FAKE_SOURCES[0]!, method });

describe('isConfirmed', () => {
  it('is true when every source was confirmed on the official source', () => {
    expect(isConfirmed(FAKE_SOURCES)).toBe(true);
    expect(isConfirmed(CONFIRMED_METHODS.map(src))).toBe(true);
  });

  it.each(CONFIRMED_METHODS.map((m) => [m]))('%s counts as confirmed', (m) => {
    expect(isConfirmed([src(m)])).toBe(true);
  });

  it('is false when any source is unconfirmed', () => {
    expect(isConfirmed([src('unconfirmed')])).toBe(false);
    expect(isConfirmed([src('official-pdf'), src('unconfirmed')])).toBe(false);
  });

  it('is false with no sources at all', () => {
    expect(isConfirmed([])).toBe(false);
  });
});
