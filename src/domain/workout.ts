// Ciclo de vida de un entreno: crear, marcar series, añadir/quitar series y terminar.

import { adjustSets } from './plan';
import { lastSessionFor } from './progression';
import type { ActiveExercise, ActiveSet, ActiveWorkout, ExerciseDef, RoutineDef, SetsRule, Workout } from './types';

/** "62,5" o "62.5" → 62.5. Vacío o inválido → NaN. */
export const parseNum = (s: string): number => parseFloat(s.replace(',', '.'));

const numOrNull = (s: string): number | null => {
  const n = parseNum(s);
  return Number.isFinite(n) ? n : null;
};

/** Ejercicio listo para entrenar: series según la fase y valores de la última sesión. */
export function createActiveExercise(def: ExerciseDef, history: Workout[], sets: number): ActiveExercise {
  const last = lastSessionFor(def.id, history);
  return {
    exerciseId: def.id,
    name: def.name,
    plannedSets: sets,
    restSec: def.restSec,
    reps: [def.reps[0], def.reps[1]],
    rir: def.rir,
    incrementKg: def.incrementKg,
    sets: Array.from({ length: Math.max(1, sets) }, (_, i): ActiveSet => {
      const p = last ? (last.sets[i] ?? last.sets[last.sets.length - 1] ?? null) : null;
      return { kg: '', reps: '', prevKg: p ? p.kg : null, prevReps: p ? p.reps : null, done: false };
    }),
  };
}

export function createActiveWorkout(
  routine: RoutineDef,
  history: Workout[],
  setsRule: SetsRule,
  now: number,
): ActiveWorkout {
  return {
    id: `w_${now}`,
    routineId: routine.id,
    routineName: routine.name,
    startedAt: now,
    restEndsAt: null,
    exercises: routine.exercises.map((def) => createActiveExercise(def, history, adjustSets(def.sets, setsRule))),
  };
}

/** Mueve un ejercicio del entreno una posición arriba (-1) o abajo (+1). */
export function moveItem<T>(list: T[], index: number, dir: -1 | 1): void {
  const j = index + dir;
  if (index < 0 || j < 0 || index >= list.length || j >= list.length) return;
  [list[index], list[j]] = [list[j]!, list[index]!];
}

/**
 * Convierte un entreno guardado en uno editable (todas las series marcadas).
 * `defs` da la configuración actual de cada ejercicio, si sigue existiendo.
 */
export function toEditable(w: Workout, defs: (exerciseId: string) => ExerciseDef | undefined): ActiveWorkout {
  return {
    id: w.id,
    routineId: w.routineId,
    routineName: w.routineName,
    startedAt: w.startedAt,
    restEndsAt: null,
    editOf: w.id,
    editDurationSec: w.durationSec,
    exercises: w.exercises.map((ex) => {
      const def = defs(ex.exerciseId);
      return {
        exerciseId: ex.exerciseId,
        name: ex.name,
        plannedSets: ex.plannedSets,
        ...(def ? { restSec: def.restSec, reps: [def.reps[0], def.reps[1]] as [number, number], rir: def.rir, incrementKg: def.incrementKg } : {}),
        sets: ex.sets.map((s) => ({ kg: String(s.kg), reps: String(s.reps), prevKg: null, prevReps: null, done: true })),
      };
    }),
  };
}

export type ToggleResult = { ok: true; completed: boolean } | { ok: false; reason: 'missing-reps' };

/**
 * Marca o desmarca una serie. Al marcarla, los campos vacíos se rellenan con los de la sesión
 * anterior; si siguen faltando las repeticiones no se marca.
 */
export function toggleSet(set: ActiveSet): ToggleResult {
  if (set.done) {
    set.done = false;
    return { ok: true, completed: false };
  }
  const reps = set.reps !== '' ? set.reps : set.prevReps != null ? String(set.prevReps) : '';
  if (reps === '') return { ok: false, reason: 'missing-reps' };
  if (set.kg === '' && set.prevKg != null) set.kg = String(set.prevKg);
  set.reps = reps;
  set.done = true;
  return { ok: true, completed: true };
}

export function addSet(ex: ActiveExercise): void {
  const l = ex.sets[ex.sets.length - 1];
  ex.sets.push({
    kg: '',
    reps: '',
    prevKg: l ? (numOrNull(l.kg) ?? l.prevKg) : null,
    prevReps: l ? (numOrNull(l.reps) ?? l.prevReps) : null,
    done: false,
  });
}

export function removeSet(ex: ActiveExercise): void {
  if (ex.sets.length > 1) ex.sets.pop();
}

/** Convierte el entreno en curso en uno guardado. Null si no hay ninguna serie marcada. */
export function finishWorkout(active: ActiveWorkout, now: number): Workout | null {
  const exercises = active.exercises
    .map((ex) => ({
      exerciseId: ex.exerciseId,
      name: ex.name,
      plannedSets: ex.plannedSets,
      sets: ex.sets
        .filter((s) => s.done)
        .map((s) => ({ kg: numOrNull(s.kg) ?? 0, reps: numOrNull(s.reps) ?? 0 })),
    }))
    .filter((ex) => ex.sets.length);
  if (!exercises.length) return null;
  return {
    id: active.id,
    routineId: active.routineId,
    routineName: active.routineName,
    startedAt: active.startedAt,
    durationSec: active.editDurationSec ?? Math.max(0, Math.floor((now - active.startedAt) / 1000)),
    exercises,
  };
}

/** Volumen total (kg × reps). */
export const workoutVolume = (w: Workout): number =>
  w.exercises.reduce((a, ex) => a + ex.sets.reduce((b, s) => b + s.kg * s.reps, 0), 0);
