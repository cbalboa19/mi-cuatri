import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IdbRepository } from '../data/idb-repository';
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
