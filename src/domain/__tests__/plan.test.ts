import * as fc from 'fast-check';

import type { RuleResult } from '../eligibility';
import { buildPlan, MAX_PLAN_STEPS, type PlanInput, type PlanMedicine, type PlanStep } from '../plan';
import { makeProfile, makeRule } from './fixtures';

const result = (id: string, programKey: RuleResult['rule']['programKey'], tier: RuleResult['tier']): RuleResult => ({
  rule: makeRule({ id, programKey }),
  tier,
  nearLimit: false,
  limitDollars: null,
  fplYear: 2026,
  conditions: [],
});

const med = (overrides: Partial<PlanMedicine> = {}): PlanMedicine => ({
  drugId: 'test-metformin',
  strengthId: 's-tab',
  quantity: 30,
  bestPriceCents: 500,
  seller: 'Test Seller',
  likelyProgramIds: [],
  ...overrides,
});

const input = (overrides: Partial<PlanInput> = {}): PlanInput => ({
  screenerDone: true,
  profile: makeProfile({ insurance: 'private' }),
  ruleResults: [],
  saved: [],
  trackedProgramIds: [],
  renewals: [],
  today: '2026-10-06',
  ...overrides,
});

const kinds = (steps: PlanStep[]) => steps.map((s) => s.kind);

describe('buildPlan', () => {
  it('asks to finish the screener first', () => {
    expect(buildPlan(input({ screenerDone: false }))[0]).toEqual({ kind: 'finishScreener' });
    expect(kinds(buildPlan(input()))).not.toContain('finishScreener');
  });

  it('suggests findMedicine when nothing is saved', () => {
    expect(buildPlan(input())).toEqual([{ kind: 'findMedicine' }]);
  });

  it('applyBenefit: first mayQualify Medi-Cal / Covered California rule, uninsured or unsure only', () => {
    const ruleResults = [
      result('std', 'standard', 'mayQualify'),
      result('county', 'county', 'mayQualify'),
      result('cc', 'covered-california', 'worthChecking'),
      result('mc', 'medi-cal', 'mayQualify'),
      result('cc2', 'covered-california', 'mayQualify'),
    ];
    const none = buildPlan(input({ profile: makeProfile({ insurance: 'none' }), ruleResults }));
    expect(none[0]).toEqual({ kind: 'applyBenefit', ruleId: 'mc', programKey: 'medi-cal' });
    expect(none.filter((s) => s.kind === 'applyBenefit')).toHaveLength(1);
    const unsure = buildPlan(input({ profile: makeProfile({ insurance: 'unsure' }), ruleResults }));
    expect(unsure[0]?.kind).toBe('applyBenefit');
    expect(kinds(buildPlan(input({ ruleResults })))).not.toContain('applyBenefit');
  });

  it('checkMedicare for 65+ without coverage', () => {
    expect(kinds(buildPlan(input({ profile: makeProfile({ insurance: 'none', age65: 'yes' }) })))).toContain(
      'checkMedicare',
    );
    expect(kinds(buildPlan(input({ profile: makeProfile({ insurance: 'none', age65: 'skip' }) })))).not.toContain(
      'checkMedicare',
    );
    expect(kinds(buildPlan(input({ profile: makeProfile({ insurance: 'medicare', age65: 'yes' }) })))).not.toContain(
      'checkMedicare',
    );
  });

  it('renew within 45 days (overdue included), soonest first', () => {
    const steps = buildPlan(
      input({
        saved: [med()],
        trackedProgramIds: ['a', 'b', 'c', 'd'],
        renewals: [
          { programId: 'a', renewBy: '2026-11-20' }, // 45 days
          { programId: 'b', renewBy: '2026-11-21' }, // 46 days
          { programId: 'c', renewBy: '2026-10-01' }, // overdue
          { programId: 'd', renewBy: 'not-a-date' },
        ],
      }),
    );
    expect(steps.filter((s) => s.kind === 'renew')).toEqual([
      { kind: 'renew', programId: 'c', renewBy: '2026-10-01' },
      { kind: 'renew', programId: 'a', renewBy: '2026-11-20' },
    ]);
  });

  it('callProgram for likely programs not yet tracked, once per program', () => {
    const steps = buildPlan(
      input({
        saved: [
          med({ drugId: 'd1', likelyProgramIds: ['p1', 'p2'], bestPriceCents: null }),
          med({ drugId: 'd2', likelyProgramIds: ['p1', 'p3'], bestPriceCents: null }),
        ],
        trackedProgramIds: ['p2'],
      }),
    );
    expect(steps.filter((s) => s.kind === 'callProgram')).toEqual([
      { kind: 'callProgram', programId: 'p1', drugId: 'd1' },
      { kind: 'callProgram', programId: 'p3', drugId: 'd2' },
    ]);
  });

  it('buyNow only for saved medicines with a price and seller', () => {
    const steps = buildPlan(
      input({
        saved: [
          med({ drugId: 'priced' }),
          med({ drugId: 'unpriced', bestPriceCents: null }),
          med({ drugId: 'noseller', seller: null }),
        ],
      }),
    );
    expect(steps).toEqual([
      { kind: 'buyNow', drugId: 'priced', strengthId: 's-tab', quantity: 30, priceCents: 500, seller: 'Test Seller' },
    ]);
  });

  it('trackApplication for tracked programs without a renewal step, last', () => {
    const steps = buildPlan(
      input({
        saved: [med()],
        trackedProgramIds: ['t1', 't2'],
        renewals: [{ programId: 't2', renewBy: '2026-10-20' }],
      }),
    );
    expect(kinds(steps)).toEqual(['renew', 'buyNow', 'trackApplication']);
    expect(steps[2]).toEqual({ kind: 'trackApplication', programId: 't1' });
  });

  it('follows the priority order and caps at 5 steps', () => {
    const steps = buildPlan({
      screenerDone: false,
      profile: makeProfile({ insurance: 'none', age65: 'yes' }),
      ruleResults: [result('mc', 'medi-cal', 'mayQualify')],
      saved: [med({ likelyProgramIds: ['p1'] })],
      trackedProgramIds: ['p9'],
      renewals: [{ programId: 'p9', renewBy: '2026-10-10' }],
      today: '2026-10-06',
    });
    expect(kinds(steps)).toEqual(['finishScreener', 'applyBenefit', 'checkMedicare', 'renew', 'callProgram']);
  });

  it('never exceeds 5 steps and never repeats a step (property)', () => {
    const id = fc.constantFrom('a', 'b', 'c', 'd');
    const arbMed = fc.record({
      drugId: id,
      strengthId: fc.constantFrom('s1', 's2'),
      quantity: fc.constantFrom(30, 90),
      bestPriceCents: fc.option(fc.integer({ min: 0, max: 100000 })),
      seller: fc.option(fc.constantFrom('Test Seller')),
      likelyProgramIds: fc.array(id, { maxLength: 4 }),
    });
    const day = fc
      .integer({ min: 0, max: 120 })
      .map((n) => new Date(Date.UTC(2026, 8, 1) + n * 86400000).toISOString().slice(0, 10));
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.constantFrom('none', 'unsure', 'private', 'medicare'),
        fc.constantFrom('yes', 'no', 'skip', null),
        fc.array(
          fc.tuple(
            id,
            fc.constantFrom('medi-cal', 'covered-california', 'standard'),
            fc.constantFrom('mayQualify', 'worthChecking', 'notLikely'),
          ),
          { maxLength: 4 },
        ),
        fc.array(arbMed, { maxLength: 6 }),
        fc.array(id, { maxLength: 4 }),
        fc.array(fc.record({ programId: id, renewBy: day }), { maxLength: 4 }),
        (screenerDone, insurance, age65, rules, saved, tracked, renewals) => {
          const steps = buildPlan({
            screenerDone,
            profile: makeProfile({ insurance, age65 }),
            ruleResults: rules.map(([rid, key, tier]) => result(rid, key, tier)),
            saved,
            trackedProgramIds: tracked,
            renewals,
            today: '2026-10-06',
          });
          expect(steps.length).toBeLessThanOrEqual(MAX_PLAN_STEPS);
          const keys = steps.map((s) =>
            JSON.stringify(
              s.kind === 'callProgram' || s.kind === 'renew' || s.kind === 'trackApplication'
                ? [s.kind, s.programId]
                : s,
            ),
          );
          expect(new Set(keys).size).toBe(keys.length);
          expect(steps.length).toBeGreaterThan(0);
          if (!screenerDone) expect(steps[0]).toEqual({ kind: 'finishScreener' });
        },
      ),
    );
  });
});
