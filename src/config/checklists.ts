import type { ChecklistItem, DayIndex, DayType } from '../domain/types';

// Checklists. Cada ítem: id (único dentro de su lista, no lo cambies si ya lo usas), texto y,
// opcionalmente, `auto` para que se marque solo:
//   daily-gym      → hay un entreno guardado ese día
//   daily-weight   → hay un peso registrado ese día
//   weekly-gym     → entrenos de la semana ≥ objetivo ({gymTarget}: 4, o 3 en modo exámenes)
//   weekly-weights → pesajes de la semana ≥ número de días de pesaje ({weighTarget})
// Estos son los valores por defecto: desde la app se pueden añadir, editar y borrar ítems.

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

export const DAILY: Record<DayType, ChecklistItem[]> = {
  weekday: [
    { id: 'desayuno', label: 'Desayuno' },
    { id: 'snack', label: 'Snack' },
    { id: 'gym', label: 'Entreno hecho', auto: 'daily-gym' },
    { id: 'comida', label: 'Comida' },
    { id: 'merienda', label: 'Merienda' },
    { id: 'repaso', label: 'Repasar la clase' },
    { id: 'estudio', label: 'Estudio' },
    { id: 'creatina', label: 'Creatina' },
    { id: 'agua', label: 'Agua' },
    { id: 'dormir', label: 'Dormir pronto' },
  ],
  friday: [
    { id: 'desayuno', label: 'Desayuno' },
    { id: 'repaso', label: 'Repasar la clase' },
    { id: 'creatina', label: 'Creatina' },
    { id: 'agua', label: 'Agua' },
  ],
  saturday: [
    { id: 'despertar', label: 'Madrugar' },
    { id: 'desayuno', label: 'Desayuno' },
    { id: 'estudio', label: 'Estudio' },
    { id: 'creatina', label: 'Creatina' },
    { id: 'agua', label: 'Agua' },
  ],
  sunday: [
    { id: 'despertar', label: 'Madrugar' },
    { id: 'desayuno', label: 'Desayuno' },
    { id: 'estudio', label: 'Estudio' },
    { id: 'creatina', label: 'Creatina' },
    { id: 'plan', label: 'Planificar la semana' },
    { id: 'dormir', label: 'Dormir pronto' },
  ],
};

/** Días de pesaje: se añade el ítem en la posición indicada de la checklist diaria. */
export const WEIGH_IN = {
  days: [0, 2, 4] as DayIndex[], // lunes, miércoles, viernes
  position: 1,
  item: { id: 'peso', label: 'Pesarme por la mañana', auto: 'daily-weight' } as ChecklistItem,
};

export const WEEKLY: ChecklistItem[] = [
  { id: 'w-gym', label: '{gymTarget} de {gymTarget} entrenos', auto: 'weekly-gym' },
  { id: 'w-peso', label: '{weighTarget} pesajes registrados', auto: 'weekly-weights' },
  { id: 'w-repaso', label: 'Repaso al día' },
  { id: 'w-horas', label: 'Horas de estudio' },
  { id: 'w-sueno', label: 'Dormir bien' },
  { id: 'w-moodle', label: 'Revisar entregas' },
  { id: 'w-plan', label: 'Planificación hecha' },
];

export const MONTHLY: ChecklistItem[] = [
  { id: 'm-peso', label: 'Revisar el peso medio' },
  { id: 'm-cal', label: 'Ajustar la dieta' },
  { id: 'm-fechas', label: 'Fechas importantes' },
  { id: 'm-cargas', label: 'Revisar las cargas' },
  { id: 'm-foto', label: 'Foto de progreso' },
  { id: 'm-desc', label: '¿Semana de descarga?' },
];
