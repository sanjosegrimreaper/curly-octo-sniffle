import { contrastRatio, parseHex } from '../lib/contrast';

describe('contrast math', () => {
  it('parses hex forms and rejects translucent colors', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('#0F172A')).toEqual({ r: 15, g: 23, b: 42 });
    expect(parseHex('#000000ff')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHex('#00000080')).toBeNull();
    expect(parseHex('rgba(0,0,0,0.5)')).toBeNull();
    expect(parseHex('transparent')).toBeNull();
  });

  it('matches known WCAG ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // #767676 is the classic "just passes AA on white" gray.
    expect(contrastRatio('#767676', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeLessThan(4.5);
    // Order does not matter.
    expect(contrastRatio('#4F46E5', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#4F46E5') ?? 0, 10);
  });
});
