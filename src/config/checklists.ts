import type { ChecklistItem, DayType } from '../domain/types';

// Checklists. La app empieza sin ítems: se añaden desde la app (o vienen del perfil).
// Tipos de ítem automático (`auto`), que se marcan solos:
//   daily-gym      → hay un entreno guardado ese día
//   daily-weight   → hay un peso registrado ese día
//   weekly-gym     → entrenos de la semana ≥ objetivo ({gymTarget})
//   weekly-weights → pesajes de la semana ≥ número de días de pesaje ({weighTarget})

/** Qué checklist diaria usa cada día. Índice 0 = lunes. */
export const DAY_TYPES: readonly DayType[] = [
  'weekday',
  'weekday',
  'weekday',
  'weekday',
  'friday',
  'saturday',
  'sunday',
];

/** En los días de pesaje se añade este ítem en esa posición de la checklist diaria. */
export const WEIGH_IN = {
  position: 1,
  item: { id: 'peso', label: 'Pesarme por la mañana', auto: 'daily-weight' } as ChecklistItem,
};
