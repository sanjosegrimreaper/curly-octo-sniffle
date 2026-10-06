import { getPack } from '@/data/pack';
import { i18next, initI18n } from '@/i18n';

import { buildCallScript, scriptMedicineName } from '../callScript';

initI18n('en');
const t = i18next.getFixedT('en', 'programs');
const med = (id: string) => {
  const m = getPack().medications.find((x) => x.id === id);
  if (!m) throw new Error(id);
  return m;
};

describe('buildCallScript', () => {
  it('fills in medicine, strength, coverage, household and income range', () => {
    const lines = buildCallScript(t, 'en', {
      medication: med('apixaban'),
      strengthId: 'tab-5',
      insurance: 'none',
      householdSize: 2,
      income: { min: 0, max: 29863.2 },
      incomeExact: false,
    });
    expect(lines[0]).toBe("Hi, I'm calling to ask about help paying for Eliquis (apixaban), 5 mg tablet.");
    expect(lines).toContain("I don't have health insurance.");
    expect(lines).toContain('There are 2 people in my household.');
    expect(lines).toContain('Our household income is under $29,863 a year.');
    expect(lines).toContain('Am I able to apply? What documents do you need?');
  });

  it('leaves out anything unknown — never guesses', () => {
    const lines = buildCallScript(t, 'en', {
      medication: undefined,
      strengthId: null,
      insurance: null,
      householdSize: null,
      income: null,
      incomeExact: false,
    });
    expect(lines[0]).toBe("Hi, I'm calling to ask about help paying for my medicine.");
    expect(lines.join(' ')).not.toMatch(/household|income|insurance|\$/i);
  });

  it('words one-person households and open-ended ranges', () => {
    const lines = buildCallScript(t, 'en', {
      medication: med('insulin-glargine'),
      strengthId: null,
      insurance: 'medicare',
      householdSize: 1,
      income: { min: 63840, max: null, minExclusive: true },
      incomeExact: false,
    });
    expect(lines[0]).toBe("Hi, I'm calling to ask about help paying for insulin glargine.");
    expect(lines).toContain('I have Medicare.');
    expect(lines).toContain('There is 1 person in my household.');
    expect(lines).toContain('My income is over $63,840 a year.');
  });

  it('uses the generic name unless the medicine is brand-only', () => {
    expect(scriptMedicineName(med('apixaban'))).toBe('Eliquis (apixaban)');
    expect(scriptMedicineName(med('metformin-er'))).toBe(med('metformin-er').generic);
  });
});
