import type { Category, ScheduleBlock } from '../domain/types';

// Horario de ejemplo.

export const CATEGORY_LABELS: Record<Category, string> = {
  clase: 'Clase',
  lab: 'Laboratorio',
  estudio: 'Estudio',
  gym: 'Gym',
  comida: 'Comida',
  viaje: 'Viaje',
  ocio: 'Ocio',
  sueno: 'Dormir',
  libre: 'Libre',
  rutina: 'Rutina',
};

const monday: ScheduleBlock[] = [
  { start: '9:00', end: '11:00', label: 'Estudio', cat: 'estudio' },
  { start: '11:00', end: '12:00', label: 'Estudio', cat: 'estudio' },
  { start: '12:00', end: '13:00', label: 'Gym', cat: 'gym' },
  { start: '14:30', end: '15:20', label: 'Estudio', cat: 'estudio' },
  { start: '15:30', end: '17:30', label: 'Clase', cat: 'clase' },
  { start: '17:50', end: '18:50', label: 'Estudio', cat: 'estudio' },
];

const weekday: ScheduleBlock[] = [
  { start: '9:00', end: '11:00', label: 'Clase', cat: 'clase' },
  { start: '12:00', end: '13:00', label: 'Gym', cat: 'gym' },
];

const friday: ScheduleBlock[] = [
  { start: '10:00', end: '12:00', label: 'Clase', cat: 'clase' },
  { start: '16:00', end: '20:00', label: 'Ocio', cat: 'ocio' },
];

const weekend: ScheduleBlock[] = [{ start: '10:00', end: '12:00', label: 'Estudio', cat: 'estudio' }];

/** Índice 0 = lunes ... 6 = domingo. Los bloques de cada día deben ir en orden. */
export const WEEK: readonly ScheduleBlock[][] = [monday, weekday, weekday, weekday, friday, weekend, weekend];
