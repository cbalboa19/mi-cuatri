// 1RM estimado, última sesión de un ejercicio y sugerencia de subir peso.

import type { ExerciseDef, RoutineDef, Workout, WorkoutExercise } from './types';

/** 1RM estimado con la fórmula de Epley. Con 1 repetición es el propio peso. */
export function e1rm(kg: number, reps: number): number {
  if (reps <= 1) return kg;
  return kg * (1 + reps / 30);
}

/** Mejor 1RM estimado de una sesión de un ejercicio. */
export function bestE1rm(ex: WorkoutExercise): number {
  return Math.max(0, ...ex.sets.map((s) => e1rm(s.kg, s.reps)));
}

/** Última vez que se hizo el ejercicio (workouts ordenados por fecha ascendente). */
export function lastSessionFor(exerciseId: string, workouts: Workout[]): WorkoutExercise | null {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const ex = workouts[i]?.exercises.find((e) => e.exerciseId === exerciseId);
    if (ex && ex.sets.length) return ex;
  }
  return null;
}

/**
 * Progresión doble: si en la última sesión hiciste todas las series previstas, todas con el
 * mismo peso y todas en el máximo del rango, devuelve el peso al que subir. Si no, null.
 */
export function suggestIncrease(def: ExerciseDef, last: WorkoutExercise | null): number | null {
  if (!last || def.incrementKg <= 0) return null;
  const sets = last.sets;
  if (!sets.length || sets.length < last.plannedSets) return null;
  const kg = sets[0]!.kg;
  if (!sets.every((s) => s.kg === kg)) return null;
  if (!sets.every((s) => s.reps >= def.reps[1])) return null;
  return Math.round((kg + def.incrementKg) * 10) / 10;
}

export interface ExerciseSession {
  workout: Workout;
  exercise: WorkoutExercise;
}

export function exerciseSessions(exerciseId: string, workouts: Workout[]): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (const workout of workouts) {
    const exercise = workout.exercises.find((e) => e.exerciseId === exerciseId);
    if (exercise) out.push({ workout, exercise });
  }
  return out;
}

export interface TrackedExercise {
  id: string;
  name: string;
}

/**
 * Ejercicios con al menos un registro: primero los de la config (en su orden y con su nombre
 * actual) y después los que ya no están en la config pero tienen historial.
 */
export function trackedExercises(routines: RoutineDef[], workouts: Workout[]): TrackedExercise[] {
  const logged = new Map<string, string>();
  for (const w of workouts) for (const e of w.exercises) logged.set(e.exerciseId, e.name);
  const out: TrackedExercise[] = [];
  const seen = new Set<string>();
  for (const r of routines) {
    for (const e of r.exercises) {
      if (!seen.has(e.id) && logged.has(e.id)) out.push({ id: e.id, name: e.name });
      seen.add(e.id);
    }
  }
  for (const [id, name] of logged) if (!seen.has(id)) out.push({ id, name });
  return out;
}
