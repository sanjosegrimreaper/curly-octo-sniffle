import * as fc from 'fast-check';

import type { InsuranceStatus, Program } from '@/data/schemas';

import { insuranceFit, matchProgram, matchPrograms, type Fit } from '../papMatch';
import { FPL, makeProfile, makeProgram, PROGRAMS } from './fixtures';

const STATUSES: InsuranceStatus[] = ['none', 'unsure', 'private', 'medi-cal', 'medicare', 'other'];

describe('insuranceFit', () => {
  const table: Record<Program['insuranceRule'], Fit[]> = {
    //                       none    unsure   private  medi-cal medicare other
    uninsuredOnly: ['yes', 'maybe', 'no', 'no', 'no', 'no'],
    uninsuredOrUnderinsured: ['yes', 'maybe', 'maybe', 'no', 'maybe', 'maybe'],
    medicareOk: ['yes', 'maybe', 'maybe', 'no', 'yes', 'maybe'],
    commercialOnly: ['no', 'maybe', 'yes', 'no', 'no', 'maybe'],
    any: ['yes', 'yes', 'yes', 'yes', 'yes', 'yes'],
    unknown: ['maybe', 'maybe', 'maybe', 'maybe', 'maybe', 'maybe'],
  };
  for (const [rule, fits] of Object.entries(table) as [Program['insuranceRule'], Fit[]][]) {
    it.each(STATUSES.map((s, i) => [s, fits[i]] as const))(`${rule} + %s → %s`, (status, fit) => {
      expect(insuranceFit(rule, status)).toBe(fit);
    });
  }
});

describe('matchPrograms', () => {
  // Household 1, 2026: 400% = $48,000; 120% = $14,400.
  const profile = makeProfile({ insurance: 'none', householdSize: 1, income: { min: 20000, max: 20000 } });

  it('groups likely / worth checking / closed and filters by medication', () => {
    const m = matchPrograms(PROGRAMS, 'test-med-brand', profile, FPL);
    expect(m.likely.map((x) => x.program.id)).toEqual(['p-under']);
    expect(m.closed.map((x) => x.program.id)).toEqual(['p-closed']);
    expect(m.worthChecking.map((x) => [x.program.id, x.insurance, x.income])).toEqual([
      ['p-unpublished', 'yes', 'unpublished'],
      ['p-low-cap', 'yes', 'over'],
      ['p-commercial', 'no', 'under'],
    ]);
    const all = [...m.likely, ...m.worthChecking, ...m.closed].map((x) => x.program.id);
    expect(all).not.toContain('p-other-drug');
  });

  it('reports the cap in dollars for the household', () => {
    const m = matchPrograms(PROGRAMS, 'test-med-brand', profile, FPL);
    expect(m.likely[0]?.capDollars).toBe(48000);
    expect(m.worthChecking.find((x) => x.program.id === 'p-unpublished')?.capDollars).toBeNull();
  });

  it('is empty for a medicine no program covers', () => {
    expect(matchPrograms(PROGRAMS, 'nothing', profile, FPL)).toEqual({ likely: [], worthChecking: [], closed: [] });
  });

  it('closed programs are closed even when everything else fits', () => {
    const m = matchProgram(makeProgram({ id: 'c', closedToNew: true }), profile, FPL);
    expect(m).toMatchObject({ group: 'closed', insurance: 'yes', income: 'under' });
  });

  it('a bracket that straddles the cap is overlap → worth checking', () => {
    const p = makeProfile({ income: { min: 36000, max: 60000, minExclusive: true } });
    expect(matchProgram(makeProgram({ id: 'x' }), p, FPL)).toMatchObject({ income: 'overlap', group: 'worthChecking' });
  });

  it('the open top bracket is never likely', () => {
    const p = makeProfile({ income: { min: 1000, max: null, minExclusive: true } });
    expect(matchProgram(makeProgram({ id: 'x' }), p, FPL)).toMatchObject({ income: 'overlap', group: 'worthChecking' });
  });

  it('a bracket starting exactly at the cap is over it', () => {
    const p = makeProfile({ income: { min: 48000, max: 60000, minExclusive: true } });
    expect(matchProgram(makeProgram({ id: 'x' }), p, FPL).income).toBe('over');
  });

  it('unknown income or household → unknown, never likely', () => {
    expect(matchProgram(makeProgram({ id: 'x' }), makeProfile({ income: null }), FPL)).toMatchObject({
      income: 'unknown',
      group: 'worthChecking',
    });
    expect(
      matchProgram(makeProgram({ id: 'x' }), makeProfile({ householdSize: null, income: { min: 1, max: 1 } }), FPL),
    ).toMatchObject({ income: 'unknown', capDollars: null, group: 'worthChecking' });
  });

  it('unsure insurance is only "maybe", so never likely', () => {
    const p = makeProfile({ insurance: 'unsure', income: { min: 1, max: 1 } });
    expect(matchProgram(makeProgram({ id: 'x' }), p, FPL)).toMatchObject({
      insurance: 'maybe',
      group: 'worthChecking',
    });
  });

  it("uses the program's own FPL year, or the latest", () => {
    const p = makeProfile({ income: { min: 1, max: 1 } });
    expect(matchProgram(makeProgram({ id: 'x', fplYear: 2025 }), p, FPL).capDollars).toBe(40000);
    expect(matchProgram(makeProgram({ id: 'x', fplYear: null }), p, FPL).capDollars).toBe(48000);
  });

  it('sorts worth checking best-first (insurance, then income)', () => {
    const programs = [
      makeProgram({ id: 'no-under', insuranceRule: 'commercialOnly' }),
      makeProgram({ id: 'maybe-unknown', insuranceRule: 'unknown', fplMax: null }),
      makeProgram({ id: 'yes-over', fplMax: 100 }),
      makeProgram({ id: 'maybe-under', insuranceRule: 'unknown' }),
      makeProgram({ id: 'yes-unpublished', fplMax: null }),
    ];
    const m = matchPrograms(programs, 'test-med-brand', profile, FPL);
    expect(m.worthChecking.map((x) => x.program.id)).toEqual([
      'yes-unpublished',
      'yes-over',
      'maybe-under',
      'maybe-unknown',
      'no-under',
    ]);
  });

  it('likely ⇔ open + published cap + whole range under it + insurance fits (property)', () => {
    fc.assert(
      fc.property(
        fc.record({
          fplMax: fc.option(fc.integer({ min: 50, max: 500 })),
          insuranceRule: fc.constantFrom(
            'uninsuredOnly',
            'uninsuredOrUnderinsured',
            'medicareOk',
            'commercialOnly',
            'any',
            'unknown',
          ),
          closedToNew: fc.boolean(),
        }),
        fc.constantFrom(...STATUSES),
        fc.integer({ min: 1, max: 20 }),
        fc.option(fc.tuple(fc.integer({ min: 0, max: 200000 }), fc.option(fc.integer({ min: 0, max: 200000 })))),
        (props, insurance, householdSize, inc) => {
          const program = makeProgram({ id: 'p', ...props });
          const income = inc ? { min: inc[0], max: inc[1] === null ? null : inc[0] + inc[1] } : null;
          const m = matchProgram(program, makeProfile({ insurance, householdSize, income }), FPL);
          const cap = m.capDollars;
          const fullyUnder = !!income && income.max !== null && cap !== null && income.max <= cap;
          const expected = props.closedToNew
            ? 'closed'
            : props.fplMax !== null && fullyUnder && insuranceFit(props.insuranceRule, insurance) === 'yes'
              ? 'likely'
              : 'worthChecking';
          expect(m.group).toBe(expected);
        },
      ),
    );
  });
});
