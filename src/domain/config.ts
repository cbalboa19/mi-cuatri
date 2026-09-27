// Configuración efectiva. Por defecto la app está vacía (sin rutinas ni checklists); encima van
// el perfil cifrado (si el dispositivo tiene la clave) y los cambios hechos desde la app.

import { NOTIFY } from '../config/notifications';
import type { Profile } from './profile';
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
  /** Horario editado en el dispositivo (sustituye al del perfil). */
  schedule?: SchedulePayload;
  /** Lunes de la semana 1 del plan; null = sin plan por semanas. */
  planStart?: string | null;
  notifyTimes?: Partial<NotifyTimes>;
}

export interface Config {
  routines: RoutineDef[];
  checklists: ChecklistsConfig;
  planStart: string | null;
  notifyTimes: NotifyTimes;
  weightGoal: string | null;
}

const clone = <T>(v: T): T => structuredClone(v);

export const emptyChecklists = (): ChecklistsConfig => ({
  daily: { weekday: [], friday: [], saturday: [], sunday: [] },
  weekly: [],
  monthly: [],
  weighDays: [],
});

export const defaultNotifyTimes = (): NotifyTimes => ({
  creatina: NOTIFY.creatina.time,
  peso: NOTIFY.peso.time,
  planWeek: NOTIFY.planWeek.time,
  backup: NOTIFY.backup.time,
  gymMinutesBefore: NOTIFY.gym.minutesBefore,
  openWorkoutMinutes: NOTIFY.openWorkout.afterMinutes,
});

/** Cambios del usuario > perfil (si hay clave) > app vacía. */
export function resolveConfig(user: UserConfig = {}, profile: Profile | null = null): Config {
  return {
    routines: user.routines ?? (profile?.routines ? clone(profile.routines) : []),
    checklists: user.checklists ?? (profile?.checklists ? clone(profile.checklists) : emptyChecklists()),
    planStart: user.planStart !== undefined ? user.planStart : (profile?.planStart ?? null),
    notifyTimes: { ...defaultNotifyTimes(), ...user.notifyTimes },
    weightGoal: profile?.weightGoal ?? null,
  };
}

/** Configuración de una app recién instalada, sin perfil. */
export const DEFAULT_CONFIG: Config = resolveConfig();

/** Identificador nuevo para ítems, ejercicios o rutinas creados desde la app. */
export function newId(prefix: string): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(36).padStart(2, '0')).join('');
  return `${prefix}_${rand}`;
}
