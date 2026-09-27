// Validadores de datos (backups y perfil cifrado). Sin imports de valores para poder usarse
// también desde el script de Node (scripts/schedule.ts).

import type { ChecklistsConfig } from './config';
import type { AutoKind, ChecklistItem, DayIndex, DayType, ExerciseDef, RoutineDef } from './types';

export class Invalid extends Error {}

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function fail(path: string): never {
  throw new Invalid(`Dato no válido en ${path}`);
}

export function str(v: unknown, path: string): string {
  return typeof v === 'string' ? v : fail(path);
}
export function num(v: unknown, path: string): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fail(path);
}
export function bool(v: unknown, path: string): boolean {
  return typeof v === 'boolean' ? v : fail(path);
}
export function obj(v: unknown, path: string): Record<string, unknown> {
  return isObj(v) ? v : fail(path);
}
export function arr(v: unknown, path: string): unknown[] {
  return Array.isArray(v) ? v : fail(path);
}
export function numOrNull(v: unknown, path: string): number | null {
  return v === null ? null : num(v, path);
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function vRange(v: unknown, p: string): [number, number] {
  const a = arr(v, p);
  if (a.length !== 2) fail(p);
  return [num(a[0], `${p}[0]`), num(a[1], `${p}[1]`)];
}

const AUTO_KINDS: AutoKind[] = ['daily-gym', 'daily-weight', 'weekly-gym', 'weekly-weights'];
const DAY_TYPES: DayType[] = ['weekday', 'friday', 'saturday', 'sunday'];

export function vDay(v: unknown, p: string): DayIndex {
  const n = num(v, p);
  if (!Number.isInteger(n) || n < 0 || n > 6) fail(p);
  return n as DayIndex;
}

export function vItems(v: unknown, p: string): ChecklistItem[] {
  return arr(v, p).map((it, i) => {
    const o = obj(it, `${p}[${i}]`);
    const item: ChecklistItem = { id: str(o.id, `${p}[${i}].id`), label: str(o.label, `${p}[${i}].label`) };
    if (o.auto !== undefined) {
      if (!AUTO_KINDS.includes(o.auto as AutoKind)) fail(`${p}[${i}].auto`);
      item.auto = o.auto as AutoKind;
    }
    return item;
  });
}

export function vExercise(v: unknown, p: string): ExerciseDef {
  const o = obj(v, p);
  return {
    id: str(o.id, `${p}.id`),
    name: str(o.name, `${p}.name`),
    sets: num(o.sets, `${p}.sets`),
    reps: vRange(o.reps, `${p}.reps`),
    rir: str(o.rir, `${p}.rir`),
    restSec: num(o.restSec, `${p}.restSec`),
    incrementKg: num(o.incrementKg, `${p}.incrementKg`),
  };
}

export function vRoutine(v: unknown, p: string): RoutineDef {
  const o = obj(v, p);
  return {
    id: str(o.id, `${p}.id`),
    name: str(o.name, `${p}.name`),
    day: o.day === null ? null : vDay(o.day, `${p}.day`),
    desc: str(o.desc, `${p}.desc`),
    ...(o.exam !== undefined ? { exam: bool(o.exam, `${p}.exam`) } : {}),
    exercises: arr(o.exercises, `${p}.exercises`).map((e, j) => vExercise(e, `${p}.exercises[${j}]`)),
  };
}

export function vChecklists(v: unknown, p: string): ChecklistsConfig {
  const o = obj(v, p);
  const d = obj(o.daily, `${p}.daily`);
  const daily = Object.fromEntries(DAY_TYPES.map((t) => [t, vItems(d[t], `${p}.daily.${t}`)])) as Record<DayType, ChecklistItem[]>;
  return {
    daily,
    weekly: vItems(o.weekly, `${p}.weekly`),
    monthly: vItems(o.monthly, `${p}.monthly`),
    weighDays: arr(o.weighDays, `${p}.weighDays`).map((x, i) => vDay(x, `${p}.weighDays[${i}]`)),
  };
}

export function vDate(v: unknown, p: string): string {
  const d = str(v, p);
  if (!DATE_RE.test(d)) fail(p);
  return d;
}
