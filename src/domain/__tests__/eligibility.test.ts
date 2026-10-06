import * as fc from 'fast-check';

import type { RuleCondition } from '@/data/schemas';

import {
  compareIncome,
  evaluateCondition,
  evaluateRule,
  evaluateRules,
  insuranceFromAnswers,
  profileFromScreener,
  sortRuleResults,
  type ConditionResult,
  type RuleResult,
} from '../eligibility';
import { FPL, makeProfile, makeRule, makeScreener, RULES } from './fixtures';

const rule = (id: string) => RULES.find((r) => r.id === id)!;

describe('insuranceFromAnswers', () => {
  it.each([
    [{ coverage: 'no', coverageType: null }, 'none'],
    [{ coverage: 'no', coverageType: 'private' }, 'none'],
    [{ coverage: 'unsure', coverageType: null }, 'unsure'],
    [{ coverage: null, coverageType: null }, 'unsure'],
    [{ coverage: 'yes', coverageType: 'medi-cal' }, 'medi-cal'],
    [{ coverage: 'yes', coverageType: 'medicare' }, 'medicare'],
    [{ coverage: 'yes', coverageType: 'private' }, 'private'],
    [{ coverage: 'yes', coverageType: 'other' }, 'other'],
    [{ coverage: 'yes', coverageType: null }, 'other'],
  ] as const)('%j → %s', (answers, expected) => {
    expect(insuranceFromAnswers(answers)).toBe(expected);
  });
});

describe('profileFromScreener', () => {
  it('maps every answer', () => {
    const s = makeScreener({
      coverage: 'no',
      age65: 'yes',
      county: 'test-county-a',
      householdSize: 2,
      income: { kind: 'exact', annual: 20000 },
    });
    expect(profileFromScreener(s, FPL, [150])).toEqual({
      insurance: 'none',
      age65: 'yes',
      county: 'test-county-a',
      householdSize: 2,
      income: { min: 20000, max: 20000 },
    });
  });

  it('keeps unanswered fields unknown', () => {
    expect(profileFromScreener(makeScreener(), FPL, [150])).toEqual({
      insurance: 'unsure',
      age65: null,
      county: null,
      householdSize: null,
      income: null,
    });
  });

  it('falls back to the household size stored with a bracket answer', () => {
    const s = makeScreener({ income: { kind: 'bracket', index: 1, householdSize: 3, fplYear: 2026 } });
    const p = profileFromScreener(s, FPL, [150, 300]);
    expect(p.householdSize).toBe(3);
    expect(p.income).toEqual({ min: 36000, max: 72000, minExclusive: true });
  });

  it('ignores an invalid household size', () => {
    expect(profileFromScreener(makeScreener({ householdSize: 0 }), FPL, []).householdSize).toBeNull();
  });
});

describe('compareIncome', () => {
  it('max: pass at or below, fail wholly above, partial when straddling', () => {
    expect(compareIncome({ min: 18000, max: 18000 }, 18000, 'max')).toBe('pass');
    expect(compareIncome({ min: 18000.01, max: 18000.01 }, 18000, 'max')).toBe('fail');
    expect(compareIncome({ min: 18000, max: 36000, minExclusive: true }, 18000, 'max')).toBe('fail');
    expect(compareIncome({ min: 18000, max: 36000 }, 18000, 'max')).toBe('partial');
    expect(compareIncome({ min: 0, max: null }, 18000, 'max')).toBe('partial');
  });

  it('min: pass at or above, fail wholly below, partial when straddling', () => {
    expect(compareIncome({ min: 18000, max: 18000 }, 18000, 'min')).toBe('pass');
    expect(compareIncome({ min: 18000, max: 36000, minExclusive: true }, 18000, 'min')).toBe('pass');
    expect(compareIncome({ min: 17999.99, max: 17999.99 }, 18000, 'min')).toBe('fail');
    expect(compareIncome({ min: 0, max: 18000 }, 18000, 'min')).toBe('partial');
    expect(compareIncome({ min: 0, max: 17000 }, 18000, 'min')).toBe('fail');
    expect(compareIncome({ min: 20000, max: null }, 18000, 'min')).toBe('pass');
  });

  it('is not fooled by float noise from monthly × 12', () => {
    expect(compareIncome({ min: 1500 * 12, max: 1500.0000000000002 * 12 }, 18000, 'max')).toBe('pass');
  });
});

describe('evaluateCondition', () => {
  const ev = (cond: RuleCondition, overrides: Parameters<typeof makeProfile>[0] = {}, year = 2026) =>
    evaluateCondition(cond, makeProfile(overrides), FPL, year);

  it('insurance is list membership', () => {
    expect(ev({ insurance: ['none', 'unsure'] }, { insurance: 'none' })).toBe('pass');
    expect(ev({ insurance: ['none', 'unsure'] }, { insurance: 'private' })).toBe('fail');
  });

  it('county is list membership; unanswered is unknown', () => {
    expect(ev({ county: ['test-county-a'] }, { county: 'test-county-a' })).toBe('pass');
    expect(ev({ county: ['test-county-a'] }, { county: 'other' })).toBe('fail');
    expect(ev({ county: ['test-county-a'] }, { county: null })).toBe('unknown');
  });

  it('age65 must match; skipped or unanswered is unknown', () => {
    expect(ev({ age65: 'yes' }, { age65: 'yes' })).toBe('pass');
    expect(ev({ age65: 'yes' }, { age65: 'no' })).toBe('fail');
    expect(ev({ age65: 'no' }, { age65: 'no' })).toBe('pass');
    expect(ev({ age65: 'yes' }, { age65: 'skip' })).toBe('unknown');
    expect(ev({ age65: 'yes' }, { age65: null })).toBe('unknown');
  });

  it('incomePctFplMax uses the household limit (household 1, 2026: 150% = $18,000)', () => {
    const exact = (x: number) => ({ income: { min: x, max: x } });
    expect(ev({ incomePctFplMax: 150 }, exact(17000))).toBe('pass');
    expect(ev({ incomePctFplMax: 150 }, exact(18000))).toBe('pass');
    expect(ev({ incomePctFplMax: 150 }, exact(18000.01))).toBe('fail');
    expect(ev({ incomePctFplMax: 150 }, { income: { min: 10000, max: 20000 } })).toBe('partial');
    expect(ev({ incomePctFplMax: 150 }, { householdSize: 2, ...exact(20000) })).toBe('pass');
    expect(ev({ incomePctFplMax: 150 }, exact(16000), 2025)).toBe('fail');
  });

  it('incomePctFplMin passes when the whole range is at or above the limit', () => {
    expect(ev({ incomePctFplMin: 150 }, { income: { min: 18000, max: 18000 } })).toBe('pass');
    expect(ev({ incomePctFplMin: 150 }, { income: { min: 17000, max: 17000 } })).toBe('fail');
    expect(ev({ incomePctFplMin: 150 }, { income: { min: 17000, max: 19000 } })).toBe('partial');
  });

  it('unknown income, household or year → unknown', () => {
    expect(ev({ incomePctFplMax: 150 }, { income: null })).toBe('unknown');
    expect(ev({ incomePctFplMax: 150 }, { householdSize: null, income: { min: 1, max: 1 } })).toBe('unknown');
    expect(ev({ incomePctFplMin: 150 }, { income: { min: 1, max: 1 } }, 2099)).toBe('unknown');
  });
});

describe('evaluateRule', () => {
  const exact = (x: number) => ({ income: { min: x, max: x } });

  it('all pass → the rule tier, with the limit in dollars', () => {
    const r = evaluateRule(rule('test-coverage-a'), makeProfile(exact(15000)), FPL);
    expect(r).toMatchObject({ tier: 'mayQualify', nearLimit: false, limitDollars: 18000, fplYear: 2026 });
    expect(r.conditions).toEqual(['pass', 'pass']);
  });

  it('any fail → notLikely', () => {
    expect(evaluateRule(rule('test-coverage-a'), makeProfile({ insurance: 'private', ...exact(1) }), FPL).tier).toBe(
      'notLikely',
    );
    expect(evaluateRule(rule('test-coverage-a'), makeProfile(exact(30000)), FPL).tier).toBe('notLikely');
  });

  it('partial or unknown → worthChecking (never more confident)', () => {
    expect(evaluateRule(rule('test-coverage-a'), makeProfile({ income: null }), FPL).tier).toBe('worthChecking');
    expect(evaluateRule(rule('test-coverage-a'), makeProfile({ income: { min: 0, max: null } }), FPL).tier).toBe(
      'worthChecking',
    );
    expect(evaluateRule(rule('test-senior'), makeProfile({ age65: 'skip' }), FPL).tier).toBe('worthChecking');
  });

  it('a worthChecking rule stays worthChecking when everything passes', () => {
    expect(evaluateRule(rule('test-senior'), makeProfile({ age65: 'yes' }), FPL).tier).toBe('worthChecking');
    expect(evaluateRule(rule('test-standard'), makeProfile(), FPL).tier).toBe('worthChecking');
  });

  it('a bracket that starts at the limit is over it', () => {
    const p = makeProfile({ income: { min: 18000, max: 36000, minExclusive: true } });
    expect(evaluateRule(rule('test-coverage-a'), p, FPL).tier).toBe('notLikely');
    expect(evaluateRule(rule('test-coverage-b'), p, FPL).tier).toBe('mayQualify');
  });

  it('nearLimit: exact income within ±5% of a limit', () => {
    const near = (x: number) => evaluateRule(rule('test-coverage-a'), makeProfile(exact(x)), FPL).nearLimit;
    expect(near(17100)).toBe(true); // 5% under $18,000 exactly
    expect(near(17099.99)).toBe(false);
    expect(near(18900)).toBe(true); // 5% over, tier notLikely but still worth saying
    expect(near(18900.01)).toBe(false);
    expect(near(5000)).toBe(false);
  });

  it('nearLimit also checks minimum limits, and never applies to brackets', () => {
    expect(evaluateRule(rule('test-coverage-b'), makeProfile(exact(17500)), FPL).nearLimit).toBe(true);
    expect(
      evaluateRule(rule('test-coverage-a'), makeProfile({ income: { min: 17500, max: 17600 } }), FPL).nearLimit,
    ).toBe(false);
  });

  it('limitDollars is the lowest max limit, or null when the household is unknown', () => {
    const r = makeRule({ id: 'two', when: { all: [{ incomePctFplMax: 300 }, { incomePctFplMax: 200 }] } });
    expect(evaluateRule(r, makeProfile(), FPL).limitDollars).toBe(24000);
    expect(evaluateRule(r, makeProfile({ householdSize: null }), FPL).limitDollars).toBeNull();
    expect(evaluateRule(rule('test-senior'), makeProfile(), FPL).limitDollars).toBeNull();
  });

  it('uses the rule year, or the latest when null or missing', () => {
    expect(evaluateRule(makeRule({ id: 'y', fplYear: 2025 }), makeProfile(), FPL).fplYear).toBe(2025);
    expect(evaluateRule(makeRule({ id: 'y', fplYear: null }), makeProfile(), FPL).fplYear).toBe(2026);
    expect(evaluateRule(makeRule({ id: 'y', fplYear: 2099 }), makeProfile(), FPL).fplYear).toBe(2026);
  });

  it('county rules', () => {
    expect(evaluateRule(rule('test-county'), makeProfile({ county: 'test-county-a' }), FPL).tier).toBe('mayQualify');
    expect(evaluateRule(rule('test-county'), makeProfile({ county: 'other' }), FPL).tier).toBe('notLikely');
    expect(evaluateRule(rule('test-county'), makeProfile({ county: null }), FPL).tier).toBe('worthChecking');
  });

  it('tier follows the any-fail / all-pass law for random condition outcomes', () => {
    const conds: RuleCondition[] = [{ insurance: ['none'] }, { age65: 'yes' }, { county: ['a'] }];
    fc.assert(
      fc.property(
        fc.constantFrom('none', 'private', 'unsure'),
        fc.constantFrom('yes', 'no', 'skip', null),
        fc.constantFrom('a', 'b', null),
        (insurance, age65, county) => {
          const r = evaluateRule(
            makeRule({ id: 'x', when: { all: conds } }),
            makeProfile({ insurance, age65, county }),
            FPL,
          );
          const c: ConditionResult[] = r.conditions;
          if (c.includes('fail')) expect(r.tier).toBe('notLikely');
          else if (c.every((x) => x === 'pass')) expect(r.tier).toBe('mayQualify');
          else expect(r.tier).toBe('worthChecking');
        },
      ),
    );
  });
});

describe('evaluateRules / sortRuleResults', () => {
  it('sorts mayQualify → worthChecking → notLikely', () => {
    const results = evaluateRules(RULES, makeProfile({ income: { min: 15000, max: 15000 }, county: 'other' }), FPL);
    expect(results.map((r) => [r.rule.id, r.tier])).toEqual([
      ['test-coverage-a', 'mayQualify'],
      ['test-senior', 'worthChecking'],
      ['test-standard', 'worthChecking'],
      ['test-coverage-b', 'notLikely'],
      ['test-county', 'notLikely'],
    ]);
  });

  it('is stable within a tier', () => {
    const mk = (id: string, tier: RuleResult['tier']): RuleResult => ({
      rule: makeRule({ id }),
      tier,
      nearLimit: false,
      limitDollars: null,
      fplYear: 2026,
      conditions: [],
    });
    const sorted = sortRuleResults([
      mk('a', 'notLikely'),
      mk('b', 'worthChecking'),
      mk('c', 'notLikely'),
      mk('d', 'mayQualify'),
      mk('e', 'worthChecking'),
    ]);
    expect(sorted.map((r) => r.rule.id)).toEqual(['d', 'b', 'e', 'a', 'c']);
  });
});
