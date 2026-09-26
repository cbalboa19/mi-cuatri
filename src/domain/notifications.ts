// Qué avisos tocan y cuándo. La app calcula la lista completa y se la envía al worker, que solo
// los manda a su hora. Cada vez que cambian los datos se vuelve a calcular y se sustituye.

import { NOTIFY, type NotificationType } from '../config/notifications';
import { WEIGH_IN } from '../config/checklists';
import { dailyItems, workoutsOnDay } from './checklists';
import { addDays, dow, pad, startOfDay, toMin, ymd } from './dates';
import { routineForDay } from './plan';
import type { Schedule } from './schedule';
import type { AppData } from './types';

export interface PlannedNotification {
  /** Estable por aviso y día (p. ej. "creatina:2026-09-28"); sirve para sustituir o cancelar. */
  id: string;
  type: NotificationType;
  fireAt: number;
  title: string;
  body: string;
}

export interface PlanInput {
  now: Date;
  data: AppData;
  schedule: Schedule | null;
  lastExportAt: number | null;
  /** Tipos desactivados por el usuario (el resto están activos). */
  disabled?: Partial<Record<NotificationType, boolean>>;
}

const WEEK_MS = 7 * 86_400_000;

/** Fecha `day` a la hora "H:MM" (hora local). */
function at(day: Date, time: string): Date {
  const m = toMin(time);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60);
}

const fill = (s: string, vars: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

const hhmm = (d: Date): string => `${d.getHours()}:${pad(d.getMinutes())}`;

/** Hora de inicio del bloque de gym de ese día en el horario, si lo hay. */
function gymStart(schedule: Schedule | null, day: Date): string | null {
  return schedule?.week[dow(day)]?.find((b) => b.cat === 'gym')?.start ?? null;
}

export function planNotifications({ now, data, schedule, lastExportAt, disabled = {} }: PlanInput): PlannedNotification[] {
  const on = (t: NotificationType) => !disabled[t];
  const exam = data.settings.examMode;
  const hasData =
    data.workouts.length > 0 ||
    Object.keys(data.weights).length > 0 ||
    Object.values(data.checks).some((s) => Object.keys(s).length > 0);
  const out: PlannedNotification[] = [];
  const add = (type: NotificationType, key: string, fire: Date | number, title: string, body: string) => {
    const fireAt = typeof fire === 'number' ? fire : fire.getTime();
    if (fireAt > now.getTime()) out.push({ id: `${type}:${key}`, type, fireAt, title, body });
  };
  const checked = (day: Date, item: string) => !!data.checks.daily[ymd(day)]?.[item];
  const hasItem = (day: Date, item: string) => dailyItems(day, exam).some((i) => i.id === item);

  for (let i = 0; i < NOTIFY.horizonDays; i++) {
    const day = addDays(startOfDay(now), i);
    const key = ymd(day);
    const d = dow(day);

    if (on('creatina') && hasItem(day, NOTIFY.creatina.item) && !checked(day, NOTIFY.creatina.item)) {
      add('creatina', key, at(day, NOTIFY.creatina.time), NOTIFY.creatina.title, NOTIFY.creatina.body);
    }

    if (on('peso') && WEIGH_IN.days.includes(d) && data.weights[key] == null) {
      add('peso', key, at(day, NOTIFY.peso.time), NOTIFY.peso.title, NOTIFY.peso.body);
    }

    const routine = routineForDay(d, exam);
    const trainingNow = data.active != null && ymd(new Date(data.active.startedAt)) === key;
    if (on('gym') && routine && workoutsOnDay(data.workouts, day).length === 0 && !trainingNow) {
      const start = at(day, gymStart(schedule, day) ?? NOTIFY.gym.fallbackTime);
      const fire = new Date(start.getTime() - NOTIFY.gym.minutesBefore * 60_000);
      add('gym', key, fire, NOTIFY.gym.title, fill(NOTIFY.gym.body, { routine: routine.name, time: hhmm(start) }));
    }

    if (on('plan-week') && d === NOTIFY.planWeek.day && hasItem(day, NOTIFY.planWeek.item) && !checked(day, NOTIFY.planWeek.item)) {
      add('plan-week', key, at(day, NOTIFY.planWeek.time), NOTIFY.planWeek.title, NOTIFY.planWeek.body);
    }

    if (on('backup') && d === NOTIFY.backup.day && hasData) {
      const fire = at(day, NOTIFY.backup.time);
      if (lastExportAt == null || fire.getTime() - lastExportAt >= WEEK_MS) {
        add('backup', key, fire, NOTIFY.backup.title, NOTIFY.backup.body);
      }
    }
  }

  const active = data.active;
  if (active) {
    if (on('open-workout')) {
      add(
        'open-workout',
        active.id,
        active.startedAt + NOTIFY.openWorkout.afterMinutes * 60_000,
        NOTIFY.openWorkout.title,
        fill(NOTIFY.openWorkout.body, { routine: active.routineName }),
      );
    }
    if (on('rest') && active.restEndsAt != null) {
      const next = active.exercises.find((e) => e.sets.some((s) => !s.done));
      add('rest', active.id, active.restEndsAt, NOTIFY.rest.title, next ? fill(NOTIFY.rest.body, { exercise: next.name }) : 'A por la siguiente');
    }
  }

  return out.sort((a, b) => a.fireAt - b.fireAt);
}
