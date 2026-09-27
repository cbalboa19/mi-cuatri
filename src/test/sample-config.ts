// Configuración de ejemplo para los tests (contenido genérico).

import { resolveConfig, type Config } from '../domain/config';
import type { Profile } from '../domain/profile';
import type { ExerciseDef, RoutineDef } from '../domain/types';

const ex = (id: string, name: string, sets: number, reps: [number, number], restSec: number, incrementKg = 2.5): ExerciseDef => ({
  id,
  name,
  sets,
  reps,
  rir: '1-2',
  restSec,
  incrementKg,
});

const routines: RoutineDef[] = [
  { id: 'torso-a', name: 'Torso A', day: 0, desc: '', exam: true, exercises: [ex('bench-press', 'Press de banca', 4, [5, 8], 180), ex('row', 'Remo', 4, [6, 10], 150)] },
  { id: 'pierna-a', name: 'Pierna A', day: 1, desc: '', exam: true, exercises: [ex('squat', 'Sentadilla', 4, [6, 10], 180, 5)] },
  { id: 'torso-b', name: 'Torso B', day: 2, desc: '', exam: true, exercises: [ex('pullup', 'Dominadas', 4, [6, 10], 150)] },
  { id: 'pierna-b', name: 'Pierna B', day: 3, desc: '', exam: false, exercises: [ex('hip-thrust', 'Hip thrust', 3, [8, 12], 120, 5)] },
];

export const SAMPLE_PROFILE: Profile = {
  routines,
  checklists: {
    daily: {
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
    },
    weekly: [
      { id: 'w-gym', label: '{gymTarget} de {gymTarget} entrenos', auto: 'weekly-gym' },
      { id: 'w-peso', label: '{weighTarget} pesajes registrados', auto: 'weekly-weights' },
      { id: 'w-plan', label: 'Planificación hecha' },
    ],
    monthly: [{ id: 'm-foto', label: 'Foto de progreso' }],
    weighDays: [0, 2, 4],
  },
  planStart: '2026-09-28',
  weightGoal: 'Objetivo de ejemplo',
};

export const SAMPLE_CONFIG: Config = resolveConfig({}, SAMPLE_PROFILE);
