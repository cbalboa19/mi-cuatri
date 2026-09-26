// Configuración efectiva: los valores por defecto de src/config/ con los cambios que el usuario
// haya hecho desde la app (guardados en el dispositivo y en la copia de seguridad).

import { DAILY, MONTHLY, WEEKLY, WEIGH_IN } from '../config/checklists';
import { NOTIFY } from '../config/notifications';
import { EXAM_MODE, PLAN_START } from '../config/plan';
import { ROUTINES } from '../config/routines';
import type { SchedulePayload } from './schedule';
import type { ChecklistItem, DayIndex, DayType, RoutineDef } from './types';

export interface ChecklistsConfig {
  daily: Record<DayType, ChecklistItem[]>;
  weekly: ChecklistItem[];
  monthly: ChecklistItem[];
  /** Días de pesaje (0 = lunes): añaden el ítem de pesarse y fijan el objetivo semanal. */
  weighDays: DayIndex[];
}

export interface NotifyTimes {
  creatina: string;
  peso: string;
  planWeek: string;
  backup: string;
  gymMinutesBefore: number;
  openWorkoutMinutes: number;
}

/** Lo que el usuario ha cambiado. Cada sección, si existe, sustituye entera a la de por defecto. */
export interface UserConfig {
  routines?: RoutineDef[];
  checklists?: ChecklistsConfig;
  /** Horario editado en el dispositivo (sustituye al que viene con la app). */
  schedule?: SchedulePayload;
  planStart?: string;
  notifyTimes?: Partial<NotifyTimes>;
}

export interface Config {
  routines: RoutineDef[];
  checklists: ChecklistsConfig;
  planStart: string;
  notifyTimes: NotifyTimes;
}

const clone = <T>(v: T): T => structuredClone(v);

export const defaultRoutines = (): RoutineDef[] =>
  ROUTINES.map((r) => ({ ...clone(r), exam: r.exam ?? EXAM_MODE.routineIds.includes(r.id) }));

export const defaultChecklists = (): ChecklistsConfig => ({
  daily: clone(DAILY),
  weekly: clone(WEEKLY),
  monthly: clone(MONTHLY),
  weighDays: [...WEIGH_IN.days],
});

export const defaultNotifyTimes = (): NotifyTimes => ({
  creatina: NOTIFY.creatina.time,
  peso: NOTIFY.peso.time,
  planWeek: NOTIFY.planWeek.time,
  backup: NOTIFY.backup.time,
  gymMinutesBefore: NOTIFY.gym.minutesBefore,
  openWorkoutMinutes: NOTIFY.openWorkout.afterMinutes,
});

export function resolveConfig(user: UserConfig = {}): Config {
  return {
    routines: user.routines ?? defaultRoutines(),
    checklists: user.checklists ?? defaultChecklists(),
    planStart: user.planStart ?? PLAN_START,
    notifyTimes: { ...defaultNotifyTimes(), ...user.notifyTimes },
  };
}

export const DEFAULT_CONFIG: Config = resolveConfig();

/** Identificador nuevo para ítems, ejercicios o rutinas creados desde la app. */
export function newId(prefix: string): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(36).padStart(2, '0')).join('');
  return `${prefix}_${rand}`;
}
