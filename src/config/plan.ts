import type { SetsRule } from '../domain/types';

// Fechas y fases del plan del cuatrimestre.

/** Lunes de la semana 1 del plan (YYYY-MM-DD). */
export const PLAN_START = '2026-09-28';

export interface PhaseDef {
  key: string;
  /** Semanas del plan (inclusive). */
  from: number;
  to: number;
  label: string;
  txt: string;
  /** Color del punto (variable CSS). */
  color: string;
  sets: SetsRule;
}

/** Fases por semana del plan, en orden. */
export const PHASES: PhaseDef[] = [
  {
    key: 're',
    from: 1,
    to: 2,
    label: 'Reentrada',
    txt: 'Una serie menos por ejercicio y RIR 3-4. Pierna ligera.',
    color: 'var(--c-rutina)',
    sets: { kind: 'minusOne', ifAtLeast: 3 },
  },
  {
    key: 'p1',
    from: 3,
    to: 7,
    label: 'Progresión 1',
    txt: 'Rutina completa. Sube peso cuando completes el rango.',
    color: 'var(--accent)',
    sets: { kind: 'full' },
  },
  {
    key: 'deload',
    from: 8,
    to: 8,
    label: 'Descarga',
    txt: 'Mitad de series, mismos pesos. Recupera.',
    color: 'var(--c-estudio)',
    sets: { kind: 'half' },
  },
  {
    key: 'p2',
    from: 9,
    to: 12,
    label: 'Progresión 2',
    txt: 'Añade 1 serie a lo que vaya rezagado.',
    color: 'var(--accent)',
    sets: { kind: 'full' },
  },
];

/** Antes de la semana 1. El texto con la fecha de inicio se genera solo. */
export const BEFORE_START = {
  key: 'pre',
  label: 'Antes de empezar',
  color: 'var(--muted)',
};

/** Después de la última fase. */
export const AFTER_END = {
  key: 'late',
  txt: 'Recta final. Si hay exámenes, activa el modo exámenes en Checks.',
  color: 'var(--accent)',
  sets: { kind: 'full' } as SetsRule,
};

/** Entrenos objetivo por semana en fase normal. */
export const WEEKLY_GYM_TARGET = 4;

/** Modo exámenes (se activa a mano en Checks). */
export const EXAM_MODE = {
  key: 'exam',
  label: 'Modo exámenes',
  txt: '3 días × 45 min, 2 series por ejercicio. Mantienes lo ganado.',
  color: 'var(--warn)',
  sets: { kind: 'fixed', sets: 2 } as SetsRule,
  /** Rutinas que se mantienen (cada una en su día habitual). */
  routineIds: ['torso-a', 'pierna-a', 'torso-b'],
  weeklyGymTarget: 3,
};

/** Textos de ayuda de la pestaña Progreso. */
export const WEIGHT_GOAL_TEXT =
  'Objetivo semanal de peso.';
