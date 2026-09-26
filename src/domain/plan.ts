// Semana del plan, fase actual y series ajustadas por fase.

import {
  AFTER_END,
  BEFORE_START,
  EXAM_MODE,
  PHASES,
  PLAN_START,
  WEEKLY_GYM_TARGET,
  type PhaseDef,
} from '../config/plan';
import { ROUTINES } from '../config/routines';
import { dayDiff, dow, mondayOf, parseYmd } from './dates';
import { DAY_NAMES, MONTH_NAMES } from './locale';
import type { DayIndex, RoutineDef, SetsRule } from './types';

export interface Phase {
  key: string;
  /** Texto principal, p. ej. "Semana 3 · Progresión 1". */
  name: string;
  txt: string;
  color: string;
  sets: SetsRule;
}

export interface PlanConfig {
  start: string;
  phases: PhaseDef[];
}

const DEFAULT_PLAN: PlanConfig = { start: PLAN_START, phases: PHASES };

/** Semana del plan (1 = semana que empieza en `start`). ≤ 0 antes de empezar. */
export function planWeek(date: Date, start: string = PLAN_START): number {
  return Math.floor(dayDiff(parseYmd(start), mondayOf(date)) / 7) + 1;
}

/** "lunes 28 de septiembre" */
export function formatStart(start: string = PLAN_START): string {
  const d = parseYmd(start);
  return `${DAY_NAMES[dow(d)].toLowerCase()} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

export function phaseFor(date: Date, examMode: boolean, plan: PlanConfig = DEFAULT_PLAN): Phase {
  if (examMode) {
    return { key: EXAM_MODE.key, name: EXAM_MODE.label, txt: EXAM_MODE.txt, color: EXAM_MODE.color, sets: EXAM_MODE.sets };
  }
  const w = planWeek(date, plan.start);
  if (w < 1) {
    return {
      key: BEFORE_START.key,
      name: BEFORE_START.label,
      txt: `El plan arranca el ${formatStart(plan.start)}.`,
      color: BEFORE_START.color,
      sets: { kind: 'full' },
    };
  }
  const p = plan.phases.find((ph) => w >= ph.from && w <= ph.to);
  if (p) return { key: p.key, name: `Semana ${w} · ${p.label}`, txt: p.txt, color: p.color, sets: p.sets };
  return { key: AFTER_END.key, name: `Semana ${w}`, txt: AFTER_END.txt, color: AFTER_END.color, sets: AFTER_END.sets };
}

/** Series que tocan para un ejercicio de `base` series según la regla de la fase. */
export function adjustSets(base: number, rule: SetsRule): number {
  switch (rule.kind) {
    case 'full':
      return base;
    case 'minusOne':
      return base >= rule.ifAtLeast ? base - 1 : base;
    case 'half':
      return Math.ceil(base / 2);
    case 'fixed':
      return rule.sets;
  }
}

/** Entrenos objetivo de la semana. */
export const weeklyGymTarget = (examMode: boolean): number =>
  examMode ? EXAM_MODE.weeklyGymTarget : WEEKLY_GYM_TARGET;

/** Rutinas activas (en modo exámenes solo las de mantenimiento). */
export function activeRoutines(examMode: boolean, routines: RoutineDef[] = ROUTINES): RoutineDef[] {
  return examMode ? routines.filter((r) => EXAM_MODE.routineIds.includes(r.id)) : routines;
}

/** Rutina que toca un día concreto, si hay. */
export function routineForDay(
  day: DayIndex,
  examMode: boolean,
  routines: RoutineDef[] = ROUTINES,
): RoutineDef | undefined {
  return activeRoutines(examMode, routines).find((r) => r.day === day);
}
