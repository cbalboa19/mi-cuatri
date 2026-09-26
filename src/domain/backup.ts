// Formato de backup (JSON con versión de esquema), validación y migraciones.
// Si cambias el formato: sube CURRENT_SCHEMA_VERSION y añade una migración en MIGRATIONS.

import type {
  ActiveExercise,
  ActiveSet,
  ActiveWorkout,
  AppData,
  CheckScope,
  Settings,
  Workout,
  WorkoutExercise,
} from './types';

export const BACKUP_APP_ID = 'mi-cuatri';
export const CURRENT_SCHEMA_VERSION = 1;

export interface CheckRecord {
  /** "daily:2026-09-28" | "weekly:2026-W40" | "monthly:2026-09" */
  id: string;
  scope: CheckScope;
  period: string;
  items: Record<string, boolean>;
  updatedAt: number;
}

export interface WeightRecord {
  date: string;
  kg: number;
  updatedAt: number;
}

export type WorkoutRecord = Workout & { updatedAt: number };
export type SettingsRecord = Settings & { updatedAt: number };

export interface BackupData {
  settings: SettingsRecord;
  checks: CheckRecord[];
  weights: WeightRecord[];
  workouts: WorkoutRecord[];
  active: ActiveWorkout | null;
}

export interface Backup {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  data: BackupData;
}

export const checkId = (scope: CheckScope, period: string): string => `${scope}:${period}`;

export function buildBackup(data: BackupData, now: Date): Backup {
  return { app: BACKUP_APP_ID, schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

/** Registros → estado en memoria de la app. */
export function toAppData(data: BackupData): AppData {
  const checks: AppData['checks'] = { daily: {}, weekly: {}, monthly: {} };
  for (const c of data.checks) checks[c.scope][c.period] = { ...c.items };
  const weights: AppData['weights'] = {};
  for (const w of data.weights) weights[w.date] = w.kg;
  const workouts = data.workouts
    .map(({ updatedAt: _u, ...w }) => w)
    .sort((a, b) => a.startedAt - b.startedAt);
  return { settings: { examMode: data.settings.examMode }, checks, weights, workouts, active: data.active };
}

export const backupFileName = (now: Date): string =>
  `mi-cuatri-backup-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`;

// ---------- Migraciones ----------

type Migration = (data: unknown) => unknown;

/** MIGRATIONS[n] convierte los datos de la versión n a la n + 1. */
const MIGRATIONS: Record<number, Migration> = {};

// ---------- Validación ----------

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

class Invalid extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(path: string): never {
  throw new Invalid(`Dato no válido en ${path}`);
}

function str(v: unknown, path: string): string {
  return typeof v === 'string' ? v : fail(path);
}
function num(v: unknown, path: string): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fail(path);
}
function bool(v: unknown, path: string): boolean {
  return typeof v === 'boolean' ? v : fail(path);
}
function obj(v: unknown, path: string): Record<string, unknown> {
  return isObj(v) ? v : fail(path);
}
function arr(v: unknown, path: string): unknown[] {
  return Array.isArray(v) ? v : fail(path);
}
function numOrNull(v: unknown, path: string): number | null {
  return v === null ? null : num(v, path);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SCOPES: CheckScope[] = ['daily', 'weekly', 'monthly'];

function vSettings(v: unknown): SettingsRecord {
  const o = obj(v, 'settings');
  return { examMode: bool(o.examMode, 'settings.examMode'), updatedAt: num(o.updatedAt, 'settings.updatedAt') };
}

function vCheck(v: unknown, i: number): CheckRecord {
  const p = `checks[${i}]`;
  const o = obj(v, p);
  const scope = str(o.scope, `${p}.scope`) as CheckScope;
  if (!SCOPES.includes(scope)) fail(`${p}.scope`);
  const period = str(o.period, `${p}.period`);
  const items: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(obj(o.items, `${p}.items`))) items[k] = bool(val, `${p}.items.${k}`);
  return { id: checkId(scope, period), scope, period, items, updatedAt: num(o.updatedAt, `${p}.updatedAt`) };
}

function vWeight(v: unknown, i: number): WeightRecord {
  const p = `weights[${i}]`;
  const o = obj(v, p);
  const date = str(o.date, `${p}.date`);
  if (!DATE_RE.test(date)) fail(`${p}.date`);
  return { date, kg: num(o.kg, `${p}.kg`), updatedAt: num(o.updatedAt, `${p}.updatedAt`) };
}

function vWorkoutExercise(v: unknown, p: string): WorkoutExercise {
  const o = obj(v, p);
  return {
    exerciseId: str(o.exerciseId, `${p}.exerciseId`),
    name: str(o.name, `${p}.name`),
    plannedSets: num(o.plannedSets, `${p}.plannedSets`),
    sets: arr(o.sets, `${p}.sets`).map((s, j) => {
      const so = obj(s, `${p}.sets[${j}]`);
      return { kg: num(so.kg, `${p}.sets[${j}].kg`), reps: num(so.reps, `${p}.sets[${j}].reps`) };
    }),
  };
}

function vWorkout(v: unknown, i: number): WorkoutRecord {
  const p = `workouts[${i}]`;
  const o = obj(v, p);
  return {
    id: str(o.id, `${p}.id`),
    routineId: str(o.routineId, `${p}.routineId`),
    routineName: str(o.routineName, `${p}.routineName`),
    startedAt: num(o.startedAt, `${p}.startedAt`),
    durationSec: num(o.durationSec, `${p}.durationSec`),
    exercises: arr(o.exercises, `${p}.exercises`).map((e, j) => vWorkoutExercise(e, `${p}.exercises[${j}]`)),
    updatedAt: num(o.updatedAt, `${p}.updatedAt`),
  };
}

function vActiveSet(v: unknown, p: string): ActiveSet {
  const o = obj(v, p);
  return {
    kg: str(o.kg, `${p}.kg`),
    reps: str(o.reps, `${p}.reps`),
    prevKg: numOrNull(o.prevKg, `${p}.prevKg`),
    prevReps: numOrNull(o.prevReps, `${p}.prevReps`),
    done: bool(o.done, `${p}.done`),
  };
}

function vActive(v: unknown): ActiveWorkout | null {
  if (v === null || v === undefined) return null;
  const p = 'active';
  const o = obj(v, p);
  return {
    id: str(o.id, `${p}.id`),
    routineId: str(o.routineId, `${p}.routineId`),
    routineName: str(o.routineName, `${p}.routineName`),
    startedAt: num(o.startedAt, `${p}.startedAt`),
    restEndsAt: numOrNull(o.restEndsAt ?? null, `${p}.restEndsAt`),
    exercises: arr(o.exercises, `${p}.exercises`).map((e, j): ActiveExercise => {
      const ep = `${p}.exercises[${j}]`;
      const eo = obj(e, ep);
      return {
        exerciseId: str(eo.exerciseId, `${ep}.exerciseId`),
        name: str(eo.name, `${ep}.name`),
        plannedSets: num(eo.plannedSets, `${ep}.plannedSets`),
        sets: arr(eo.sets, `${ep}.sets`).map((s, k) => vActiveSet(s, `${ep}.sets[${k}]`)),
      };
    }),
  };
}

function vData(v: unknown): BackupData {
  const o = obj(v, 'data');
  return {
    settings: vSettings(o.settings),
    checks: arr(o.checks, 'checks').map(vCheck),
    weights: arr(o.weights, 'weights').map(vWeight),
    workouts: arr(o.workouts, 'workouts').map(vWorkout),
    active: vActive(o.active),
  };
}

/** Valida un backup (ya parseado desde JSON), migrándolo a la versión actual si hace falta. */
export function parseBackup(raw: unknown): ParseResult {
  try {
    if (!isObj(raw) || raw.app !== BACKUP_APP_ID) return { ok: false, error: 'El archivo no es una copia de Mi cuatri.' };
    const version = raw.schemaVersion;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      return { ok: false, error: 'La copia no indica una versión válida.' };
    }
    if (version > CURRENT_SCHEMA_VERSION) {
      return { ok: false, error: 'La copia es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.' };
    }
    let data: unknown = raw.data;
    for (let v = version; v < CURRENT_SCHEMA_VERSION; v++) {
      const m = MIGRATIONS[v];
      if (!m) return { ok: false, error: `No sé migrar copias de la versión ${v}.` };
      data = m(data);
    }
    return {
      ok: true,
      backup: {
        app: BACKUP_APP_ID,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
        data: vData(data),
      },
    };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: `La copia está dañada: ${e.message}.` };
    throw e;
  }
}

/** Parsea el texto de un archivo de backup. */
export function parseBackupText(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
  return parseBackup(raw);
}
