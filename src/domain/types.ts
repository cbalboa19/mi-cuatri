// Tipos compartidos entre config, dominio, datos y UI.

import type { UserConfig } from './config';

/** Categorías del horario. El color de cada una vive en CSS como `--c-<categoría>`. */
export type Category =
  | 'clase'
  | 'lab'
  | 'estudio'
  | 'gym'
  | 'comida'
  | 'viaje'
  | 'ocio'
  | 'sueno'
  | 'libre'
  | 'rutina';

export interface ScheduleBlock {
  /** "H:MM" o "HH:MM" */
  start: string;
  /** "H:MM" o "HH:MM"; "24:00" = medianoche */
  end: string;
  label: string;
  cat: Category;
}

/** Día de la semana: 0 = lunes ... 6 = domingo. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ExerciseDef {
  /** Identificador estable: no lo cambies aunque renombres el ejercicio, el historial va enlazado a él. */
  id: string;
  name: string;
  sets: number;
  reps: [min: number, max: number];
  rir: string;
  restSec: number;
  /** Cuánto subir cuando completas el rango. 0 = no sugerir. */
  incrementKg: number;
}

export interface RoutineDef {
  /** Identificador estable. */
  id: string;
  name: string;
  /** Día de la semana (0 = lunes) o null si no tiene día fijo. */
  day: DayIndex | null;
  desc: string;
  /** ¿Se mantiene en modo exámenes? */
  exam?: boolean;
  exercises: ExerciseDef[];
}

/** Qué checklist diaria usa cada tipo de día. */
export type DayType = 'weekday' | 'friday' | 'saturday' | 'sunday';

export type SetsRule =
  | { kind: 'full' }
  | { kind: 'minusOne'; ifAtLeast: number }
  | { kind: 'half' }
  | { kind: 'fixed'; sets: number };

export type AutoKind = 'daily-gym' | 'daily-weight' | 'weekly-gym' | 'weekly-weights';

export interface ChecklistItem {
  id: string;
  /** Admite `{gymTarget}`, que se sustituye por los entrenos objetivo de la semana. */
  label: string;
  /** Si se indica, el ítem se marca solo. */
  auto?: AutoKind;
}

export type CheckScope = 'daily' | 'weekly' | 'monthly';

// ---------- Datos del usuario ----------

/** Peso por fecha local "YYYY-MM-DD". */
export type WeightMap = Record<string, number>;

/** scope → periodo ("2026-09-28" | "2026-W40" | "2026-09") → itemId → hecho */
export type ChecksState = Record<CheckScope, Record<string, Record<string, boolean>>>;

export interface Settings {
  examMode: boolean;
}

export interface WorkoutSet {
  kg: number;
  reps: number;
}

export interface WorkoutExercise {
  exerciseId: string;
  name: string;
  /** Series previstas por la fase cuando se hizo el entreno. */
  plannedSets: number;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  routineId: string;
  routineName: string;
  /** epoch ms */
  startedAt: number;
  durationSec: number;
  exercises: WorkoutExercise[];
}

export interface ActiveSet {
  /** Texto tal cual lo escribe el usuario ("" = vacío). */
  kg: string;
  reps: string;
  prevKg: number | null;
  prevReps: number | null;
  /** Objetivo calculado para esta serie (progresión doble). */
  targetKg?: number | null;
  targetReps?: number | null;
  done: boolean;
}

/** Por qué se propone ese objetivo. */
export type TargetReason = 'increase' | 'more-reps' | 'repeat' | 'reduce' | 'deload' | 'bodyweight-max';

export interface ActiveExercise {
  exerciseId: string;
  name: string;
  plannedSets: number;
  sets: ActiveSet[];
  /** Copia de la definición al empezar (se puede cambiar durante el entreno). */
  restSec?: number;
  reps?: [number, number];
  rir?: string;
  incrementKg?: number;
  /** Motivo del objetivo y peso de trabajo propuesto. */
  targetReason?: TargetReason;
  targetKg?: number;
}

export interface ActiveWorkout {
  id: string;
  routineId: string;
  routineName: string;
  startedAt: number;
  /** epoch ms en el que acaba el descanso en curso, o null. */
  restEndsAt: number | null;
  exercises: ActiveExercise[];
  /** Si se está editando un entreno ya guardado: su id y su duración original. */
  editOf?: string;
  editDurationSec?: number;
}

/** Todo lo que la app necesita en memoria. */
export interface AppData {
  settings: Settings;
  checks: ChecksState;
  weights: WeightMap;
  /** Ordenados por startedAt ascendente. */
  workouts: Workout[];
  active: ActiveWorkout | null;
  /** Cambios de configuración hechos desde la app. */
  config: UserConfig;
}

export function emptyAppData(): AppData {
  return {
    config: {},
    settings: { examMode: false },
    checks: { daily: {}, weekly: {}, monthly: {} },
    weights: {},
    workouts: [],
    active: null,
  };
}
