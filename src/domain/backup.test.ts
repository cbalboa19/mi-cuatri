import { describe, expect, it } from 'vitest';
import { backupFileName, buildBackup, parseBackup, parseBackupText, toAppData, type BackupData } from './backup';

const data: BackupData = {
  settings: { examMode: true, updatedAt: 5 },
  checks: [
    { id: 'daily:2026-09-28', scope: 'daily', period: '2026-09-28', items: { desayuno: true, agua: false }, updatedAt: 1 },
    { id: 'weekly:2026-W40', scope: 'weekly', period: '2026-W40', items: { 'w-plan': true }, updatedAt: 2 },
  ],
  weights: [{ date: '2026-09-28', kg: 64.2, updatedAt: 3 }],
  workouts: [
    {
      id: 'w_2',
      routineId: 'pierna-a',
      routineName: 'Pierna A',
      startedAt: 2000,
      durationSec: 60,
      exercises: [{ exerciseId: 'back-squat', name: 'Sentadilla', plannedSets: 3, sets: [{ kg: 60, reps: 8 }] }],
      updatedAt: 4,
    },
    { id: 'w_1', routineId: 'torso-a', routineName: 'Torso A', startedAt: 1000, durationSec: 60, exercises: [], updatedAt: 4 },
  ],
  active: {
    id: 'w_3',
    routineId: 'torso-b',
    routineName: 'Torso B',
    startedAt: 3000,
    restEndsAt: null,
    exercises: [
      {
        exerciseId: 'face-pull',
        name: 'Face pull',
        plannedSets: 2,
        sets: [{ kg: '10', reps: '', prevKg: null, prevReps: 15, done: false }],
      },
    ],
  },
};

const now = new Date(2026, 9, 5, 10, 0);

describe('backup', () => {
  it('round-trips through JSON', () => {
    const b = buildBackup(data, now);
    expect(b).toMatchObject({ app: 'mi-cuatri', schemaVersion: 1, exportedAt: now.toISOString() });
    const r = parseBackupText(JSON.stringify(b));
    expect(r).toEqual({ ok: true, backup: b });
  });

  it('converts records to app data', () => {
    const app = toAppData(data);
    expect(app.settings).toEqual({ examMode: true });
    expect(app.checks.daily['2026-09-28']).toEqual({ desayuno: true, agua: false });
    expect(app.checks.weekly['2026-W40']).toEqual({ 'w-plan': true });
    expect(app.weights).toEqual({ '2026-09-28': 64.2 });
    expect(app.workouts.map((w) => w.id)).toEqual(['w_1', 'w_2']);
    expect(app.workouts[0]).not.toHaveProperty('updatedAt');
    expect(app.active?.id).toBe('w_3');
  });

  it('rejects files that are not backups', () => {
    expect(parseBackupText('nope')).toEqual({ ok: false, error: 'El archivo no es un JSON válido.' });
    expect(parseBackup({ foo: 1 })).toMatchObject({ ok: false, error: 'El archivo no es una copia de Mi cuatri.' });
    expect(parseBackup({ app: 'mi-cuatri' })).toMatchObject({ ok: false });
  });

  it('rejects backups from a newer version', () => {
    const r = parseBackup({ ...buildBackup(data, now), schemaVersion: 99 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('más nueva');
  });

  it('rejects malformed records with the path of the problem', () => {
    const bad = JSON.parse(JSON.stringify(buildBackup(data, now)));
    bad.data.weights = [{ date: '28/09/2026', kg: 64, updatedAt: 1 }];
    const r = parseBackup(bad);
    expect(r).toEqual({ ok: false, error: 'La copia está dañada: Dato no válido en weights[0].date.' });

    const bad2 = JSON.parse(JSON.stringify(buildBackup(data, now)));
    bad2.data.workouts[0].exercises[0].sets[0].kg = '60';
    expect(parseBackup(bad2)).toMatchObject({ ok: false });

    const bad3 = JSON.parse(JSON.stringify(buildBackup(data, now)));
    bad3.data.checks[0].scope = 'yearly';
    expect(parseBackup(bad3)).toMatchObject({ ok: false });
  });

  it('drops unknown fields and rebuilds check ids', () => {
    const raw = JSON.parse(JSON.stringify(buildBackup(data, now)));
    raw.data.checks[0].id = '<img src=x onerror=alert(1)>';
    raw.data.workouts[0].extra = 'x';
    const r = parseBackup(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.data.checks[0]?.id).toBe('daily:2026-09-28');
      expect(r.backup.data.workouts[0]).not.toHaveProperty('extra');
    }
  });

  it('accepts a backup without active workout', () => {
    const raw = JSON.parse(JSON.stringify(buildBackup(data, now)));
    delete raw.data.active;
    const r = parseBackup(raw);
    expect(r.ok && r.backup.data.active).toBeNull();
  });

  it('names the file with the date', () => {
    expect(backupFileName(now)).toBe('mi-cuatri-backup-2026-10-05.json');
  });
});
