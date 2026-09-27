// Horario: formato del contenido cifrado y su validación.
// Solo importa tipos, para poder usarse desde el script de Node (scripts/profile.ts).

import type { Category, ScheduleBlock } from './types';

export const CATEGORIES: readonly Category[] = [
  'clase',
  'lab',
  'estudio',
  'gym',
  'comida',
  'viaje',
  'ocio',
  'sueno',
  'libre',
  'rutina',
];

export interface SchedulePayload {
  /** Nombres de las categorías (sustituyen a los genéricos de config/schedule.ts). */
  labels?: Partial<Record<Category, string>>;
  /** 7 días (0 = lunes), cada uno con sus bloques en orden. */
  week: ScheduleBlock[][];
}

export interface Schedule {
  labels: Record<Category, string>;
  week: ScheduleBlock[][];
}

const TIME_RE = /^([01]?\d|2[0-4]):[0-5]\d$/;

/** Valida el horario descifrado. Lanza un Error con el motivo si no es válido. */
export function parseSchedulePayload(raw: unknown): SchedulePayload {
  if (typeof raw !== 'object' || raw === null) throw new Error('El horario no es un objeto');
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.week) || o.week.length !== 7) throw new Error('El horario debe tener 7 días');
  const week = o.week.map((day, d) => {
    if (!Array.isArray(day)) throw new Error(`Día ${d}: no es una lista`);
    return day.map((b, i) => {
      const p = `Día ${d}, bloque ${i}`;
      if (typeof b !== 'object' || b === null) throw new Error(`${p}: no es un objeto`);
      const { start, end, label, cat } = b as Record<string, unknown>;
      if (typeof start !== 'string' || !TIME_RE.test(start)) throw new Error(`${p}: inicio no válido`);
      if (typeof end !== 'string' || !TIME_RE.test(end)) throw new Error(`${p}: fin no válido`);
      if (typeof label !== 'string') throw new Error(`${p}: texto no válido`);
      if (!CATEGORIES.includes(cat as Category)) throw new Error(`${p}: categoría "${String(cat)}" desconocida`);
      return { start, end, label, cat: cat as Category };
    });
  });
  const labels: Partial<Record<Category, string>> = {};
  if (o.labels !== undefined) {
    if (typeof o.labels !== 'object' || o.labels === null) throw new Error('labels no válido');
    for (const [k, v] of Object.entries(o.labels)) {
      if (!CATEGORIES.includes(k as Category) || typeof v !== 'string') throw new Error(`labels.${k} no válido`);
      labels[k as Category] = v;
    }
  }
  return { labels, week };
}

export const toSchedule = (p: SchedulePayload, defaults: Record<Category, string>): Schedule => ({
  labels: { ...defaults, ...p.labels },
  week: p.week,
});
