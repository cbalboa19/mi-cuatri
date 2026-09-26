import { describe, expect, it } from 'vitest';
import { WEEKLY } from '../config/checklists';
import {
  countDone,
  dailyItems,
  isAutoDone,
  monthWorkouts,
  resolveLabel,
  weekDailySummary,
  weekWorkouts,
  type ChecklistContext,
} from './checklists';
import type { Workout } from './types';

const at = (y: number, m: number, d: number, h = 13) => new Date(y, m - 1, d, h);
const workout = (date: Date): Workout => ({
  id: `w_${date.getTime()}`,
  routineId: 'torso-a',
  routineName: 'Torso A',
  startedAt: date.getTime(),
  durationSec: 3600,
  exercises: [],
});
const ids = (date: Date, exam = false) => dailyItems(date, exam).map((i) => i.id);

describe('dailyItems', () => {
  it('uses the weekday list with weigh-in on monday and wednesday', () => {
    expect(ids(at(2026, 9, 28))).toEqual([
      'desayuno', 'peso', 'snack', 'gym', 'comida', 'merienda', 'repaso', 'estudio', 'creatina', 'agua', 'dormir',
    ]);
    expect(ids(at(2026, 9, 29))).not.toContain('peso'); // martes
    expect(ids(at(2026, 9, 30))).toContain('peso'); // miércoles
  });

  it('uses friday, saturday and sunday lists', () => {
    expect(ids(at(2026, 10, 2))).toEqual(['desayuno', 'peso', 'repaso', 'creatina', 'agua']);
    expect(ids(at(2026, 10, 3))).toEqual(['despertar', 'desayuno', 'estudio', 'creatina', 'agua']);
    expect(ids(at(2026, 10, 4))).toEqual(['despertar', 'desayuno', 'estudio', 'creatina', 'plan', 'dormir']);
  });

  it('drops the gym item on thursday in exam mode', () => {
    expect(ids(at(2026, 10, 1))).toContain('gym');
    expect(ids(at(2026, 10, 1), true)).not.toContain('gym');
    expect(ids(at(2026, 9, 28), true)).toContain('gym');
  });
});

describe('auto items', () => {
  const ctx: ChecklistContext = {
    workouts: [at(2026, 9, 28), at(2026, 9, 29), at(2026, 9, 30), at(2026, 10, 4, 23)].map(workout),
    weights: { '2026-09-28': 64, '2026-09-30': 64.2, '2026-10-02': 64.4 },
    examMode: false,
  };

  it('daily gym and weight', () => {
    expect(isAutoDone('daily-gym', at(2026, 9, 28, 20), ctx)).toBe(true);
    expect(isAutoDone('daily-gym', at(2026, 10, 1), ctx)).toBe(false);
    expect(isAutoDone('daily-weight', at(2026, 9, 30), ctx)).toBe(true);
    expect(isAutoDone('daily-weight', at(2026, 9, 29), ctx)).toBe(false);
  });

  it('weekly gym uses the target of the current mode', () => {
    expect(weekWorkouts(ctx.workouts, at(2026, 10, 1))).toHaveLength(4);
    expect(isAutoDone('weekly-gym', at(2026, 10, 1), ctx)).toBe(true);
    const three = { ...ctx, workouts: ctx.workouts.slice(0, 3) };
    expect(isAutoDone('weekly-gym', at(2026, 10, 1), three)).toBe(false);
    expect(isAutoDone('weekly-gym', at(2026, 10, 1), { ...three, examMode: true })).toBe(true);
  });

  it('weekly weights needs one per weigh-in day', () => {
    expect(isAutoDone('weekly-weights', at(2026, 10, 3), ctx)).toBe(true);
    expect(isAutoDone('weekly-weights', at(2026, 10, 6), ctx)).toBe(false);
  });

  it('counts manual and auto items', () => {
    const items = dailyItems(at(2026, 9, 28), false);
    expect(countDone(items, { desayuno: true, agua: true, snack: false }, at(2026, 9, 28), ctx)).toEqual({ done: 4, total: 11 });
  });

  it('summarises the week until today', () => {
    const s = weekDailySummary(at(2026, 9, 29), { '2026-09-28': { desayuno: true } }, ctx);
    expect(s.days[0]).toEqual({ done: 3, total: 11 });
    expect(s.days[1]).toEqual({ done: 1, total: 10 });
    expect(s.days.slice(2)).toEqual([null, null, null, null, null]);
    expect(s.pct).toBe(19); // 4 / 21
  });

  it('filters workouts by month', () => {
    expect(monthWorkouts(ctx.workouts, at(2026, 10, 15))).toHaveLength(1);
  });

  it('resolves the gym target placeholder', () => {
    const item = WEEKLY[0]!;
    expect(resolveLabel(item, false)).toBe('4 de 4 entrenos');
    expect(resolveLabel(item, true)).toBe('3 de 3 entrenos');
  });
});
