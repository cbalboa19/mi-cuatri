// Estado de los bloques del horario respecto a la hora actual.

import { toMin } from './dates';
import type { ScheduleBlock } from './types';

export type BlockState = 'past' | 'now' | 'future';

export interface TimelineState {
  states: BlockState[];
  /** Índice del bloque antes del que va la línea de "ahora" (length = al final). Null si no se pinta. */
  pulseAt: number | null;
}

/**
 * `nowMin` = minutos desde medianoche, o null si no es el día de hoy (no hay estado ni línea).
 * La línea de "ahora" se pinta cuando ningún bloque está en curso: antes del siguiente bloque
 * o, si ya han pasado todos, al final.
 */
export function timelineState(blocks: ScheduleBlock[], nowMin: number | null): TimelineState {
  if (nowMin == null) return { states: blocks.map(() => 'future'), pulseAt: null };
  const states = blocks.map((b): BlockState => {
    if (nowMin >= toMin(b.end)) return 'past';
    if (nowMin >= toMin(b.start)) return 'now';
    return 'future';
  });
  if (!blocks.length || states.includes('now')) return { states, pulseAt: null };
  const next = states.indexOf('future');
  return { states, pulseAt: next === -1 ? blocks.length : next };
}

/** Minutos de bloques de estudio. */
export const studyMinutes = (blocks: ScheduleBlock[]): number =>
  blocks.filter((b) => b.cat === 'estudio').reduce((a, b) => a + toMin(b.end) - toMin(b.start), 0);
