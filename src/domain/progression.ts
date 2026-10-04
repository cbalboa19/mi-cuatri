// 1RM estimado, última sesión de un ejercicio, sugerencia de subir peso y objetivos por serie.

import type { ExerciseDef, RoutineDef, TargetReason, Workout, WorkoutExercise } from './types';

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

export interface SetTarget {
  kg: number;
  reps: number;
}

export interface ExerciseTarget {
  reason: TargetReason;
  /** Peso de trabajo propuesto (el de la serie más pesada). */
  kg: number;
  sets: SetTarget[];
}

const roundHalf = (kg: number): number => Math.round(kg * 2) / 2;

/** Redondea al escalón de peso del ejercicio (su incremento; 0,5 kg si no tiene). */
const toStep = (kg: number, step: number, mode: 'round' | 'floor'): number => {
  const s = step > 0 ? step : 0.5;
  const v = (mode === 'floor' ? Math.floor(kg / s + 1e-9) : Math.round(kg / s)) * s;
  return Math.round(v * 100) / 100;
};

/** Peso con el que se harían `reps` repeticiones según un 1RM estimado (Epley invertida). */
const weightFor = (oneRm: number, reps: number): number => oneRm / (1 + reps / 30);

/**
 * Objetivo de kg y reps para cada serie de la próxima sesión (progresión doble):
 * - todas las series previstas en el máximo del rango y con el mismo peso → sube el peso y vuelve al mínimo;
 * - si no → mismo peso y +1 rep por serie (sin pasar del máximo; si no llegó al mínimo, el mínimo);
 * - dos sesiones seguidas sin llegar al mínimo en la primera serie con el mismo peso → baja un 10 %;
 * - semana de descarga → mismos pesos y el mínimo de reps.
 * Null si nunca se ha hecho el ejercicio.
 */
export function nextTargets(def: ExerciseDef, workouts: Workout[], sets: number, deload = false): ExerciseTarget | null {
  const sessions = exerciseSessions(def.id, workouts)
    .map((s) => s.exercise)
    .filter((e) => e.sets.length);
  const last = sessions[sessions.length - 1];
  if (!last) return null;
  const [min, max] = def.reps;
  const n = Math.max(1, sets);
  const top = Math.max(...last.sets.map((s) => s.kg));
  const prevFor = (i: number) => last.sets[i] ?? last.sets[last.sets.length - 1]!;
  const each = (fn: (i: number) => SetTarget) => Array.from({ length: n }, (_, i) => fn(i));

  if (deload) return { reason: 'deload', kg: top, sets: each((i) => ({ kg: prevFor(i).kg, reps: min })) };

  const bestRm = Math.max(...last.sets.map((s) => e1rm(s.kg, s.reps)));
  const up = suggestIncrease(def, last);
  if (up != null) {
    // Si te pasaste mucho del rango (3+ reps de media), el salto es mayor: el peso que te deja
    // en mitad del rango según tu 1RM estimado.
    const avgReps = last.sets.reduce((a, s) => a + s.reps, 0) / last.sets.length;
    const mid = Math.round((min + max) / 2);
    const kg = avgReps >= max + 3 ? Math.max(up, toStep(weightFor(bestRm, mid), def.incrementKg, 'round')) : up;
    return { reason: 'increase', kg, sets: each(() => ({ kg, reps: min })) };
  }

  // Muy por debajo del mínimo (2+ reps): el peso que te deja en el mínimo según tu 1RM estimado.
  const bestReps = Math.max(...last.sets.filter((s) => s.kg === top).map((s) => s.reps));
  if (top > 0 && bestReps <= min - 2) {
    const kg = Math.min(top, toStep(weightFor(bestRm, min), def.incrementKg, 'floor'));
    if (kg < top && kg > 0) return { reason: 'too-heavy', kg, sets: each(() => ({ kg, reps: min })) };
  }

  const before = sessions[sessions.length - 2];
  const failed = (e: WorkoutExercise) => e.sets[0] != null && e.sets[0].kg === top && e.sets[0].reps < min;
  if (top > 0 && before && failed(last) && failed(before)) {
    const kg = roundHalf(top * 0.9);
    return { reason: 'reduce', kg, sets: each(() => ({ kg, reps: min })) };
  }

  const out = each((i) => {
    const p = prevFor(i);
    return { kg: p.kg, reps: p.reps < min ? min : Math.min(p.reps + 1, max) };
  });
  if (top === 0 && def.incrementKg <= 0 && last.sets.every((s) => s.reps >= max)) return { reason: 'bodyweight-max', kg: 0, sets: out };
  const moreReps = out.some((s, i) => s.reps > prevFor(i).reps);
  return { reason: moreReps ? 'more-reps' : 'repeat', kg: top, sets: out };
}
