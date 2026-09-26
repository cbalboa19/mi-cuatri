// Checklists: ítems de cada día, ítems automáticos y resúmenes.

import { DAY_TYPES, WEIGH_IN } from '../config/checklists';
import { DEFAULT_CONFIG, type Config } from './config';
import { addDays, dow, mondayOf, monthKey, sameWeek, ymd } from './dates';
import { routinesForDay, weeklyGymTarget } from './plan';
import { weekWeights } from './weight';
import type { AutoKind, ChecklistItem, DayType, WeightMap, Workout } from './types';

export interface ChecklistContext {
  workouts: Workout[];
  weights: WeightMap;
  examMode: boolean;
  cfg?: Config;
}

export const dayTypeOf = (date: Date): DayType => DAY_TYPES[dow(date)] ?? 'weekday';

/** Checklist diaria de una fecha: según el tipo de día, con el pesaje y sin "entreno" si no toca. */
export function dailyItems(date: Date, examMode: boolean, cfg: Config = DEFAULT_CONFIG): ChecklistItem[] {
  const d = dow(date);
  const items = [...cfg.checklists.daily[dayTypeOf(date)]];
  const hasWeigh = items.some((i) => i.auto === 'daily-weight');
  if (cfg.checklists.weighDays.includes(d) && !hasWeigh) {
    items.splice(Math.min(WEIGH_IN.position, items.length), 0, WEIGH_IN.item);
  }
  if (routinesForDay(d, examMode, cfg.routines).length === 0) return items.filter((i) => i.auto !== 'daily-gym');
  return items;
}

export const weekWorkouts = (workouts: Workout[], date: Date): Workout[] =>
  workouts.filter((w) => sameWeek(new Date(w.startedAt), date));

export const monthWorkouts = (workouts: Workout[], date: Date): Workout[] =>
  workouts.filter((w) => monthKey(new Date(w.startedAt)) === monthKey(date));

export const workoutsOnDay = (workouts: Workout[], date: Date): Workout[] =>
  workouts.filter((w) => ymd(new Date(w.startedAt)) === ymd(date));

export function isAutoDone(kind: AutoKind, date: Date, ctx: ChecklistContext): boolean {
  const cfg = ctx.cfg ?? DEFAULT_CONFIG;
  switch (kind) {
    case 'daily-gym':
      return workoutsOnDay(ctx.workouts, date).length > 0;
    case 'daily-weight':
      return ctx.weights[ymd(date)] != null;
    case 'weekly-gym':
      return weekWorkouts(ctx.workouts, date).length >= weeklyGymTarget(ctx.examMode, cfg.routines);
    case 'weekly-weights':
      return weekWeights(ctx.weights, date).length >= cfg.checklists.weighDays.length;
  }
}

export function isItemDone(
  item: ChecklistItem,
  record: Record<string, boolean> | undefined,
  date: Date,
  ctx: ChecklistContext,
): boolean {
  return item.auto ? isAutoDone(item.auto, date, ctx) : !!record?.[item.id];
}

export const resolveLabel = (item: ChecklistItem, examMode: boolean, cfg: Config = DEFAULT_CONFIG): string =>
  item.label
    .replaceAll('{gymTarget}', String(weeklyGymTarget(examMode, cfg.routines)))
    .replaceAll('{weighTarget}', String(cfg.checklists.weighDays.length));

export interface Count {
  done: number;
  total: number;
}

export function countDone(
  items: ChecklistItem[],
  record: Record<string, boolean> | undefined,
  date: Date,
  ctx: ChecklistContext,
): Count {
  return { done: items.filter((i) => isItemDone(i, record, date, ctx)).length, total: items.length };
}

export interface WeekDailySummary {
  /** Lunes..domingo; null para días que aún no han llegado. */
  days: (Count | null)[];
  /** Porcentaje de ítems diarios hechos desde el lunes hasta hoy (0-100). */
  pct: number;
}

/** Resumen de la semana de `today`, contando solo hasta `today` (inclusive). */
export function weekDailySummary(
  today: Date,
  daily: Record<string, Record<string, boolean>>,
  ctx: ChecklistContext,
): WeekDailySummary {
  const m = mondayOf(today);
  const t = dow(today);
  let done = 0;
  let total = 0;
  const days: (Count | null)[] = [];
  for (let i = 0; i < 7; i++) {
    if (i > t) {
      days.push(null);
      continue;
    }
    const x = addDays(m, i);
    const c = countDone(dailyItems(x, ctx.examMode, ctx.cfg), daily[ymd(x)], x, ctx);
    done += c.done;
    total += c.total;
    days.push(c);
  }
  return { days, pct: total ? Math.round((done / total) * 100) : 0 };
}
