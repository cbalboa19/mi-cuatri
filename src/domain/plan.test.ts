import { describe, expect, it } from 'vitest';
import { activeRoutines, adjustSets, formatStart, phaseFor, planWeek, routineForDay, weeklyGymTarget } from './plan';

const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h);

describe('planWeek', () => {
  it('starts at week 1 on the start monday', () => {
    expect(planWeek(d(2026, 9, 27), '2026-09-28')).toBe(0);
    expect(planWeek(d(2026, 9, 28, 0), '2026-09-28')).toBe(1);
    expect(planWeek(d(2026, 10, 4, 23), '2026-09-28')).toBe(1);
    expect(planWeek(d(2026, 10, 5), '2026-09-28')).toBe(2);
  });

  it('is not shifted by DST changes', () => {
    // 25/10 cambia la hora: domingo sigue en semana 4, lunes 26 en semana 5.
    expect(planWeek(d(2026, 10, 25, 23), '2026-09-28')).toBe(4);
    expect(planWeek(d(2026, 10, 26, 0), '2026-09-28')).toBe(5);
    // En primavera (28/03/2027) antes se perdía una semana.
    expect(planWeek(d(2027, 3, 29, 0), '2026-09-28')).toBe(27);
  });
});

describe('phaseFor', () => {
  it('follows the plan blocks', () => {
    expect(phaseFor(d(2026, 9, 26), false).key).toBe('pre');
    expect(phaseFor(d(2026, 9, 26), false).txt).toBe('El plan arranca el lunes 28 de septiembre.');
    expect(phaseFor(d(2026, 9, 28), false)).toMatchObject({ key: 're', name: 'Semana 1 · Reentrada' });
    expect(phaseFor(d(2026, 10, 11), false).key).toBe('re'); // semana 2
    expect(phaseFor(d(2026, 10, 12), false)).toMatchObject({ key: 'p1', name: 'Semana 3 · Progresión 1' });
    expect(phaseFor(d(2026, 11, 15), false).key).toBe('p1'); // semana 7
    expect(phaseFor(d(2026, 11, 16), false)).toMatchObject({ key: 'deload', name: 'Semana 8 · Descarga' });
    expect(phaseFor(d(2026, 11, 23), false)).toMatchObject({ key: 'p2', name: 'Semana 9 · Progresión 2' });
    expect(phaseFor(d(2026, 12, 20), false).key).toBe('p2'); // semana 12
    expect(phaseFor(d(2026, 12, 21), false)).toMatchObject({ key: 'late', name: 'Semana 13' });
  });

  it('exam mode overrides everything', () => {
    expect(phaseFor(d(2026, 9, 1), true).key).toBe('exam');
    expect(phaseFor(d(2026, 11, 1), true)).toMatchObject({ key: 'exam', sets: { kind: 'fixed', sets: 2 } });
  });

  it('formats the start date', () => {
    expect(formatStart('2026-09-28')).toBe('lunes 28 de septiembre');
  });
});

describe('adjustSets', () => {
  it('reentry removes one set from exercises with 3+ sets', () => {
    const rule = { kind: 'minusOne', ifAtLeast: 3 } as const;
    expect(adjustSets(4, rule)).toBe(3);
    expect(adjustSets(3, rule)).toBe(2);
    expect(adjustSets(2, rule)).toBe(2);
  });

  it('deload halves rounding up', () => {
    expect(adjustSets(4, { kind: 'half' })).toBe(2);
    expect(adjustSets(3, { kind: 'half' })).toBe(2);
    expect(adjustSets(2, { kind: 'half' })).toBe(1);
  });

  it('full and fixed', () => {
    expect(adjustSets(4, { kind: 'full' })).toBe(4);
    expect(adjustSets(4, { kind: 'fixed', sets: 2 })).toBe(2);
  });
});

describe('routines by mode', () => {
  it('normal mode trains 4 days', () => {
    expect(weeklyGymTarget(false)).toBe(4);
    expect(activeRoutines(false)).toHaveLength(4);
    expect(routineForDay(3, false)?.id).toBe('pierna-b');
    expect(routineForDay(4, false)).toBeUndefined();
  });

  it('exam mode keeps Torso A, Pierna A and Torso B', () => {
    expect(weeklyGymTarget(true)).toBe(3);
    expect(activeRoutines(true).map((r) => r.id)).toEqual(['torso-a', 'pierna-a', 'torso-b']);
    expect(routineForDay(3, true)).toBeUndefined();
    expect(routineForDay(0, true)?.id).toBe('torso-a');
  });
});
