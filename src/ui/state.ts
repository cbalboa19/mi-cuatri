// Estado de la interfaz (no son datos del usuario). Solo la pestaña se recuerda entre sesiones.

import { dow } from '../domain/dates';
import type { DayIndex, DayType } from '../domain/types';

export type TabKey = 'hoy' | 'horario' | 'gym' | 'progreso' | 'checks';
const TAB_KEYS: TabKey[] = ['hoy', 'horario', 'gym', 'progreso', 'checks'];
const TAB_STORAGE_KEY = 'mi-cuatri:tab';

export interface UiState {
  tab: TabKey;
  /** Día elegido en Horario. */
  viewDay: DayIndex;
  /** Ejercicio elegido en Progreso. */
  progEx: string | null;
  checkSeg: 'semana' | 'mes';
  /** Fecha elegida para registrar el peso ("YYYY-MM-DD"); null = hoy. */
  weightDate: string | null;
  /** Días hacia atrás de la checklist que se ve en Hoy (0 = hoy, -1 = ayer...). */
  dayOffset: number;
  /** Semanas / meses hacia atrás en Checks. */
  weekOffset: number;
  monthOffset: number;
  /** Editor abierto (se pinta en lugar de la pestaña). */
  editor: Editor | null;
}

export type Editor =
  | { kind: 'routine'; id: string }
  | { kind: 'checklist'; list: DayType | 'weekly' | 'monthly' }
  | { kind: 'schedule'; day: DayIndex }
  | { kind: 'settings' };

function loadTab(): TabKey {
  try {
    const t = localStorage.getItem(TAB_STORAGE_KEY);
    return TAB_KEYS.includes(t as TabKey) ? (t as TabKey) : 'hoy';
  } catch {
    return 'hoy';
  }
}

export function saveTab(tab: TabKey): void {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // sin almacenamiento: no pasa nada, se abre en Hoy
  }
}

export function initialUiState(now: Date): UiState {
  return { tab: loadTab(), viewDay: dow(now), progEx: null, checkSeg: 'semana', weightDate: null, dayOffset: 0, weekOffset: 0, monthOffset: 0, editor: null };
}
