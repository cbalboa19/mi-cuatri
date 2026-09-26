import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { parseBackupText } from '../domain/backup';
import type { ActiveWorkout, Workout } from '../domain/types';
import { IdbRepository } from './idb-repository';

let counter = 0;
const repos: IdbRepository[] = [];
async function open(): Promise<IdbRepository> {
  const r = await IdbRepository.open(`test-${++counter}`, () => 1234);
  repos.push(r);
  return r;
}
afterEach(() => repos.splice(0).forEach((r) => r.close()));

const workout = (id: string, startedAt: number): Workout => ({
  id,
  routineId: 'torso-a',
  routineName: 'Torso A',
  startedAt,
  durationSec: 3600,
  exercises: [{ exerciseId: 'bench-press', name: 'Banca', plannedSets: 3, sets: [{ kg: 70, reps: 8 }] }],
});

const active: ActiveWorkout = {
  id: 'w_9',
  routineId: 'pierna-a',
  routineName: 'Pierna A',
  startedAt: 9,
  restEndsAt: 99,
  exercises: [],
};

describe('IdbRepository', () => {
  it('starts empty', async () => {
    const r = await open();
    expect(await r.load()).toEqual({
      settings: { examMode: false },
      checks: { daily: {}, weekly: {}, monthly: {} },
      weights: {},
      workouts: [],
      active: null,
    });
    expect(await r.getMeta()).toEqual({ lastExportAt: null });
    expect(r.syncLabel).toBe('Local');
  });

  it('persists every kind of data', async () => {
    const r = await open();
    await r.saveChecks('daily', '2026-09-28', { desayuno: true });
    await r.saveChecks('monthly', '2026-09', { 'm-foto': true });
    await r.setWeight('2026-09-28', 64);
    await r.setWeight('2026-09-30', 64.4);
    await r.deleteWeight('2026-09-28');
    await r.saveWorkout(workout('w_2', 2000));
    await r.saveWorkout(workout('w_1', 1000));
    await r.saveWorkout(workout('w_3', 3000));
    await r.deleteWorkout('w_3');
    await r.saveActiveWorkout(active);
    await r.saveSettings({ examMode: true });

    const d = await r.load();
    expect(d.checks.daily['2026-09-28']).toEqual({ desayuno: true });
    expect(d.checks.monthly['2026-09']).toEqual({ 'm-foto': true });
    expect(d.weights).toEqual({ '2026-09-30': 64.4 });
    expect(d.workouts.map((w) => w.id)).toEqual(['w_1', 'w_2']);
    expect(d.active).toEqual(active);
    expect(d.settings).toEqual({ examMode: true });

    await r.saveActiveWorkout(null);
    expect((await r.load()).active).toBeNull();
  });

  it('exports and imports a backup, replacing everything but device meta', async () => {
    const a = await open();
    await a.setWeight('2026-09-28', 64);
    await a.saveWorkout(workout('w_1', 1000));
    await a.saveChecks('weekly', '2026-W40', { 'w-plan': true });
    await a.saveSettings({ examMode: true });
    const backup = await a.exportBackup(new Date(2026, 9, 1));
    expect(backup.data.weights).toEqual([{ date: '2026-09-28', kg: 64, updatedAt: 1234 }]);

    const b = await open();
    await b.setWeight('2026-01-01', 70);
    await b.setMeta({ lastExportAt: 42 });
    const parsed = parseBackupText(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.error);
    await b.importBackup(parsed.backup);

    expect(await b.load()).toEqual(await a.load());
    expect(await b.getMeta()).toEqual({ lastExportAt: 42 });
  });

  it('stores device meta', async () => {
    const r = await open();
    await r.setMeta({ lastExportAt: 5 });
    expect(await r.getMeta()).toEqual({ lastExportAt: 5 });
  });
});
