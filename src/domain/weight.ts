// Peso corporal: media móvil y medias semanales.

import { addDays, dayDiff, mondayOf, parseYmd, ymd } from './dates';
import type { WeightMap } from './types';

export interface WeightPoint {
  date: string;
  /** epoch ms del día a las 00:00 local */
  t: number;
  kg: number;
  /** Media de los registros de los últimos `windowDays` días (incluido este). */
  avg: number;
}

export function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** Serie ordenada por fecha con la media móvil por días de calendario. */
export function movingAverage(weights: WeightMap, windowDays = 7): WeightPoint[] {
  const entries = Object.entries(weights)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, kg]) => ({ date, day: parseYmd(date), kg }));
  return entries.map(({ date, day, kg }) => {
    const win = entries.filter((e) => {
      const diff = dayDiff(e.day, day);
      return diff >= 0 && diff < windowDays;
    });
    return { date, t: day.getTime(), kg, avg: average(win.map((e) => e.kg)) ?? kg };
  });
}

/** Pesos registrados en la semana (lunes-domingo) de `date`. */
export function weekWeights(weights: WeightMap, date: Date): number[] {
  const m = mondayOf(date);
  const out: number[] = [];
  for (let i = 0; i < 7; i++) {
    const v = weights[ymd(addDays(m, i))];
    if (v != null) out.push(v);
  }
  return out;
}

export interface WeekAverages {
  thisWeek: number | null;
  lastWeek: number | null;
  change: number | null;
}

export function weekAverages(weights: WeightMap, date: Date): WeekAverages {
  const thisWeek = average(weekWeights(weights, date));
  const lastWeek = average(weekWeights(weights, addDays(date, -7)));
  return { thisWeek, lastWeek, change: thisWeek != null && lastWeek != null ? thisWeek - lastWeek : null };
}

/** Pesos del mes "YYYY-MM", ordenados por fecha. */
export function monthWeights(weights: WeightMap, month: string): [string, number][] {
  return Object.entries(weights)
    .filter(([k]) => k.startsWith(month))
    .sort(([a], [b]) => (a < b ? -1 : 1));
}

/** Peso válido en kg (rango razonable). */
export const isValidWeight = (kg: number): boolean => Number.isFinite(kg) && kg > 30 && kg < 200;
