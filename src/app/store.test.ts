import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IdbRepository } from '../data/idb-repository';
import { deriveKey, encryptWithKey, randomBytes } from '../domain/crypto';
import { Store } from './store';

const DAY = 86_400_000;
let n = 0;
async function makeStore(): Promise<Store> {
  const repo = await IdbRepository.open(`store-${++n}`);
  return Store.load(repo, (e) => {
    throw e;
  });
}

describe('Store', () => {
  it('reminds to export only when there is data and 7+ days passed', async () => {
    const s = await makeStore();
    const now = new Date(2026, 9, 10).getTime();
    expect(s.needsBackup(now)).toBe(false); // sin datos
    s.setWeight('2026-10-10', 64);
    expect(s.needsBackup(now)).toBe(true); // nunca exportado
    await s.markExported(now - 6 * DAY);
    expect(s.daysSinceExport(now)).toBe(6);
    expect(s.needsBackup(now)).toBe(false);
    await s.markExported(now - 7 * DAY);
    expect(s.needsBackup(now)).toBe(true);
  });

  it('invalidates the precomputed export on every change', async () => {
    const s = await makeStore();
    s.toggleCheck('daily', '2026-10-10', 'agua');
    await s.warmExport();
    expect(s.cachedExport()?.backup.data.checks).toHaveLength(1);
    s.setExamMode(true);
    expect(s.cachedExport()).toBeNull();
    await s.warmExport();
    expect(s.cachedExport()?.backup.data.settings.examMode).toBe(true);
  });

  it('runs a workout from start to finish', async () => {
    const s = await makeStore();
    s.startWorkout('torso-a', new Date(2026, 9, 12, 12, 15)); // semana 3: series completas
    expect(s.active?.exercises[0]?.plannedSets).toBe(4);
    s.setSetField(0, 0, 'kg', '70');
    s.setSetField(0, 0, 'reps', '8');
    expect(s.toggleSet(0, 0)).toEqual({ ok: true, completed: true });
    s.setRest(123);
    expect(s.active?.restEndsAt).toBe(123);
    const w = s.finishWorkout(new Date(2026, 9, 12, 13, 15).getTime());
    expect(w?.durationSec).toBe(3600);
    expect(s.active).toBeNull();
    expect(s.data.workouts).toHaveLength(1);
  });

  it('imports a valid backup and rejects an invalid one', async () => {
    const a = await makeStore();
    a.setWeight('2026-10-01', 64);
    a.setWeight('2026-10-03', 64.3);
    const { json } = await a.exportBackup(new Date());

    const b = await makeStore();
    b.setWeight('2025-01-01', 80);
    expect(b.prepareImport('{"app":"otra"}')).toMatchObject({ ok: false });
    const prep = b.prepareImport(json);
    if (!prep.ok) throw new Error(prep.error);
    expect(prep.summary).toBe('0 entrenos, 2 pesajes y 0 checklists');
    await prep.apply();
    expect(b.data.weights).toEqual({ '2026-10-01': 64, '2026-10-03': 64.3 });
  });
});

describe('Store schedule', () => {
  const week = [[{ start: '9:00', end: '10:00', label: 'Clase A', cat: 'clase' }], [], [], [], [], [], []];

  async function encrypted(password: string) {
    const salt = randomBytes(16);
    return encryptWithKey({ labels: { ocio: 'Ocio' }, week }, await deriveKey(password, salt, 1000), salt, 1000);
  }

  it('stays locked until the right password is given, then remembers the key', async () => {
    const enc = await encrypted('buena');
    const name = `store-sched-${++n}`;
    const repo = await IdbRepository.open(name);
    const s = await Store.load(repo, (e) => { throw e; }, enc);
    expect(s.schedule).toBeNull();
    expect(await s.unlockSchedule('mala')).toBe(false);
    expect(s.schedule).toBeNull();
    expect(await s.unlockSchedule(' buena ')).toBe(true);
    expect(s.schedule?.week[0]?.[0]?.label).toBe('Clase A');
    repo.close();

    // Al volver a abrir la app ya no pide la clave.
    const repo2 = await IdbRepository.open(name);
    const s2 = await Store.load(repo2, (e) => { throw e; }, enc);
    expect(s2.schedule?.week[0]?.[0]?.label).toBe('Clase A');

    // Si la clave del horario cambia, se vuelve a bloquear.
    const s3 = await Store.load(repo2, (e) => { throw e; }, await encrypted('otra'));
    expect(s3.schedule).toBeNull();
    expect(await repo2.getScheduleKey()).toBeNull();
    repo2.close();
  });
});

describe('Store editable config', () => {
  it('edits and resets routines, keeping defaults untouched', async () => {
    const s = await makeStore();
    expect(s.isCustomized('routines')).toBe(false);
    s.updateConfig(['routines'], (c) => {
      c.routines[0]!.name = 'Torso A+';
      c.routines[0]!.exercises[0]!.restSec = 200;
    });
    expect(s.cfg.routines[0]?.name).toBe('Torso A+');
    expect(s.findExercise('bench-press')?.restSec).toBe(200);
    expect(s.isCustomized('routines')).toBe(true);
    s.resetConfig('routines');
    expect(s.cfg.routines[0]?.name).toBe('Torso A');
    expect(s.findExercise('bench-press')?.restSec).toBe(180);
  });

  it('uses edited checklists and weigh days', async () => {
    const s = await makeStore();
    s.updateConfig(['checklists'], (c) => {
      c.checklists.daily.saturday.push({ id: 'c_x', label: 'Leer 20 min' });
      c.checklists.weighDays = [5];
    });
    expect(s.cfg.checklists.daily.saturday.at(-1)?.label).toBe('Leer 20 min');
    expect(s.cfg.checklists.weighDays).toEqual([5]);
  });

  it('adds exercises during a workout, optionally to the routine, and changes rest', async () => {
    const s = await makeStore();
    s.startWorkout('torso-a', new Date(2026, 9, 12, 12));
    const def = { id: 'ex_new', name: 'Pullover', sets: 3, reps: [10, 12] as [number, number], rir: '1', restSec: 75, incrementKg: 2.5 };
    s.addExerciseToActive(def, 3, true);
    expect(s.active?.exercises.at(-1)).toMatchObject({ exerciseId: 'ex_new', plannedSets: 3, restSec: 75 });
    expect(s.cfg.routines.find((r) => r.id === 'torso-a')?.exercises.at(-1)?.id).toBe('ex_new');
    const last = s.active!.exercises.length - 1;
    s.setExerciseRest(last, 60, false);
    expect(s.restFor(last)).toBe(60);
    expect(s.findExercise('ex_new')?.restSec).toBe(75);
    s.setExerciseRest(0, 150, true);
    expect(s.findExercise('bench-press')?.restSec).toBe(150);
    s.moveExerciseInActive(last, -1);
    expect(s.active?.exercises.at(-2)?.exerciseId).toBe('ex_new');
    s.removeExerciseFromActive(s.active!.exercises.length - 2);
    expect(s.active?.exercises.some((e) => e.exerciseId === 'ex_new')).toBe(false);
  });

  it('edits a saved workout keeping its date and duration', async () => {
    const s = await makeStore();
    s.startWorkout('torso-a', new Date(2026, 9, 12, 12));
    s.setSetField(0, 0, 'kg', '70');
    s.setSetField(0, 0, 'reps', '8');
    s.toggleSet(0, 0);
    const w = s.finishWorkout(new Date(2026, 9, 12, 13).getTime())!;
    expect(s.editWorkout(w.id)).toBe(true);
    expect(s.active?.editOf).toBe(w.id);
    s.setSetField(0, 0, 'kg', '72,5'.replace(',', '.'));
    const edited = s.finishWorkout(Date.now())!;
    expect(edited).toMatchObject({ id: w.id, startedAt: w.startedAt, durationSec: 3600 });
    expect(edited.exercises[0]?.sets[0]).toEqual({ kg: 72.5, reps: 8 });
    expect(s.data.workouts).toHaveLength(1);
    // No se puede editar si hay un entreno en curso.
    s.startWorkout('pierna-a', new Date());
    expect(s.editWorkout(w.id)).toBe(false);
  });

  it('uses a schedule edited on the device over the bundled one', async () => {
    const s = await makeStore();
    expect(s.schedule).toBeNull();
    s.data.config = { schedule: { week: [[{ start: '9:00', end: '10:00', label: 'Mío', cat: 'clase' }], [], [], [], [], [], []] } };
    expect(s.schedule?.week[0]?.[0]?.label).toBe('Mío');
    expect(s.schedule?.labels.clase).toBe('Clase');
  });
});
