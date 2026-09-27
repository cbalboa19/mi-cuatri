import { describe, expect, it } from 'vitest';
import { SAMPLE_CONFIG } from '../test/sample-config';
import { planNotifications, type PlanInput } from './notifications';
import type { Schedule } from './schedule';
import { emptyAppData, type AppData, type Workout } from './types';

// Lunes 5/10/2026 a las 8:00 (semana 2 del plan).
const MON = new Date(2026, 9, 5, 8, 0);
const t = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();

const schedule: Schedule = {
  labels: {} as Schedule['labels'],
  week: [
    [{ start: '12:15', end: '13:30', label: 'Gym', cat: 'gym' }],
    [{ start: '12:40', end: '14:00', label: 'Gym', cat: 'gym' }],
    [],
    [{ start: '12:40', end: '14:00', label: 'Gym', cat: 'gym' }],
    [], [], [],
  ],
};

function plan(over: Partial<PlanInput> & { data?: AppData } = {}) {
  return planNotifications({ now: MON, data: emptyAppData(), schedule, lastExportAt: null, cfg: SAMPLE_CONFIG, ...over });
}
const ids = (over: Parameters<typeof plan>[0] = {}) => plan(over).map((n) => n.id);

const workout = (at: number): Workout => ({ id: `w_${at}`, routineId: 'torso-a', routineName: 'Torso A', startedAt: at, durationSec: 60, exercises: [] });

describe('planNotifications', () => {
  it('plans the next 7 days in time order', () => {
    const n = plan();
    expect(n.every((x, i) => i === 0 || n[i - 1]!.fireAt <= x.fireAt)).toBe(true);
    expect(n.every((x) => x.fireAt > MON.getTime() && x.fireAt < MON.getTime() + 7 * 86_400_000)).toBe(true);
  });

  it('reminds creatina at 21:30 unless checked', () => {
    expect(plan().find((n) => n.id === 'creatina:2026-10-05')).toMatchObject({ fireAt: t(5, 21, 30), body: 'Se te ha olvidado la creatina hoy' });
    const data = emptyAppData();
    data.checks.daily['2026-10-05'] = { creatina: true };
    expect(ids({ data })).not.toContain('creatina:2026-10-05');
    expect(ids({ data })).toContain('creatina:2026-10-06');
  });

  it('reminds to weigh in on M-W-F at 7:00, only if not logged and not past', () => {
    // Hoy lunes a las 8:00 ya ha pasado la hora.
    expect(ids()).not.toContain('peso:2026-10-05');
    expect(plan().find((n) => n.id === 'peso:2026-10-07')?.fireAt).toBe(t(7, 7));
    expect(ids()).not.toContain('peso:2026-10-06'); // martes
    const data = emptyAppData();
    data.weights['2026-10-07'] = 64;
    expect(ids({ data })).not.toContain('peso:2026-10-07');
  });

  it('reminds the workout 15 min before the gym block of the schedule', () => {
    expect(plan().find((n) => n.id === 'gym:2026-10-05')).toMatchObject({ fireAt: t(5, 12, 0), body: 'Hoy toca Torso A a las 12:15' });
    expect(plan().find((n) => n.id === 'gym:2026-10-06')).toMatchObject({ fireAt: t(6, 12, 25), body: 'Hoy toca Pierna A a las 12:40' });
    // Sin bloque de gym en el horario no se avisa.
    expect(ids({ schedule: null })).not.toContain('gym:2026-10-06');
    expect(ids()).not.toContain('gym:2026-10-09'); // viernes
  });

  it('skips the workout reminder once trained, and on thursday in exam mode', () => {
    const data = emptyAppData();
    data.workouts.push(workout(t(5, 7, 30)));
    expect(ids({ data })).not.toContain('gym:2026-10-05');
    expect(ids()).toContain('gym:2026-10-08');
    const exam = emptyAppData();
    exam.settings.examMode = true;
    expect(ids({ data: exam })).not.toContain('gym:2026-10-08');
  });

  it('reminds weekly planning on sunday unless done', () => {
    expect(plan().find((n) => n.id === 'plan-week:2026-10-11')?.fireAt).toBe(t(11, 20, 30));
    const data = emptyAppData();
    data.checks.daily['2026-10-11'] = { plan: true };
    expect(ids({ data })).not.toContain('plan-week:2026-10-11');
  });

  it('reminds the backup only with data and after 7 days without export', () => {
    expect(ids()).not.toContain('backup:2026-10-11'); // sin datos
    const data = emptyAppData();
    data.weights['2026-10-01'] = 64;
    expect(ids({ data })).toContain('backup:2026-10-11');
    expect(ids({ data, lastExportAt: t(9, 10) })).not.toContain('backup:2026-10-11');
    expect(ids({ data, lastExportAt: t(4, 10) })).toContain('backup:2026-10-11');
  });

  it('plans rest end and open workout from the active workout', () => {
    const data = emptyAppData();
    data.active = {
      id: 'w_1',
      routineId: 'torso-a',
      routineName: 'Torso A',
      startedAt: t(5, 7, 50),
      restEndsAt: t(5, 8, 2),
      exercises: [
        { exerciseId: 'a', name: 'Press banca', plannedSets: 1, sets: [{ kg: '70', reps: '8', prevKg: null, prevReps: null, done: true }] },
        { exerciseId: 'b', name: 'Remo', plannedSets: 1, sets: [{ kg: '', reps: '', prevKg: null, prevReps: null, done: false }] },
      ],
    };
    const n = plan({ data });
    expect(n[0]).toMatchObject({ id: 'rest:w_1', fireAt: t(5, 8, 2), title: 'Descanso terminado', body: 'Siguiente serie: Remo' });
    expect(n.find((x) => x.id === 'open-workout:w_1')).toMatchObject({ fireAt: t(5, 10, 50), body: 'El entreno de Torso A sigue abierto. ¿Lo terminas?' });
    expect(ids({ data })).not.toContain('gym:2026-10-05'); // ya está entrenando
    data.active.restEndsAt = null;
    expect(ids({ data })).not.toContain('rest:w_1');
  });

  it('respects disabled types', () => {
    const n = plan({ disabled: { creatina: true, gym: true } });
    expect(n.some((x) => x.type === 'creatina' || x.type === 'gym')).toBe(false);
    expect(n.some((x) => x.type === 'peso')).toBe(true);
  });
});
