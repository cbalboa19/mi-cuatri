// Utilidades de fechas en hora local. Las diferencias se calculan por días de calendario
// (no por milisegundos) para que los cambios de hora no desplacen semanas.

import type { DayIndex } from './types';

export const DAY_MS = 86_400_000;

export const pad = (n: number): string => String(n).padStart(2, '0');

/** "YYYY-MM-DD" en hora local. */
export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "YYYY-MM-DD" → Date local a las 00:00. */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Día de la semana con lunes = 0. */
export const dow = (d: Date): DayIndex => ((d.getDay() + 6) % 7) as DayIndex;

/** "H:MM" → minutos desde medianoche. */
export function toMin(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export const minutesOfDay = (d: Date): number => d.getHours() * 60 + d.getMinutes();

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Lunes (00:00 local) de la semana de `d`. */
export const mondayOf = (d: Date): Date => addDays(startOfDay(d), -dow(d));

/** Días de calendario de `a` a `b` (b - a), ignorando la hora y los cambios de hora. */
export function dayDiff(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / DAY_MS);
}

/** Semana ISO 8601, p. ej. "2026-W40". */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const n = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - n);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}

/** "YYYY-MM" */
export const monthKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** ¿Están `a` y `b` en la misma semana (lunes-domingo)? */
export const sameWeek = (a: Date, b: Date): boolean => ymd(mondayOf(a)) === ymd(mondayOf(b));
