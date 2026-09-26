// Estado de la interfaz (no son datos del usuario). Solo la pestaña se recuerda entre sesiones.

import { dow } from '../domain/dates';
import type { DayIndex } from '../domain/types';

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
}

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
  return { tab: loadTab(), viewDay: dow(now), progEx: null, checkSeg: 'semana', weightDate: null };
}
