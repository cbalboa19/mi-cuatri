import { describe, expect, it } from 'vitest';
import { addSet, createActiveWorkout, finishWorkout, parseNum, removeSet, toggleSet, workoutVolume } from './workout';
import type { ActiveSet, RoutineDef, Workout } from './types';

const routine: RoutineDef = {
  id: 'torso-a',
  name: 'Torso A',
  day: 0,
  desc: '',
  exercises: [
    { id: 'bench', name: 'Banca', sets: 4, reps: [5, 8], rir: '2', restSec: 180, incrementKg: 2.5 },
    { id: 'curl', name: 'Curl', sets: 2, reps: [8, 12], rir: '1', restSec: 75, incrementKg: 2.5 },
  ],
};

const history: Workout[] = [
  {
    id: 'w_1',
    routineId: 'torso-a',
    routineName: 'Torso A',
    startedAt: 1,
    durationSec: 100,
    exercises: [{ exerciseId: 'bench', name: 'Banca', plannedSets: 2, sets: [{ kg: 70, reps: 8 }, { kg: 72.5, reps: 6 }] }],
  },
];

const set = (over: Partial<ActiveSet> = {}): ActiveSet => ({ kg: '', reps: '', prevKg: null, prevReps: null, done: false, ...over });

describe('createActiveWorkout', () => {
  it('adjusts sets to the phase and fills previous values', () => {
    const a = createActiveWorkout(routine, history, { kind: 'minusOne', ifAtLeast: 3 }, 1000);
    expect(a).toMatchObject({ id: 'w_1000', routineId: 'torso-a', routineName: 'Torso A', startedAt: 1000, restEndsAt: null });
    const [bench, curl] = a.exercises;
    expect(bench?.plannedSets).toBe(3);
    expect(bench?.sets.map((s) => [s.prevKg, s.prevReps])).toEqual([
      [70, 8],
      [72.5, 6],
      [72.5, 6], // si la sesión anterior tenía menos series, repite la última
    ]);
    expect(curl?.sets).toHaveLength(2);
    expect(curl?.sets[0]).toEqual(set());
  });
});

describe('toggleSet', () => {
  it('fills empty fields from the previous session', () => {
    const s = set({ prevKg: 70, prevReps: 8 });
    expect(toggleSet(s)).toEqual({ ok: true, completed: true });
    expect(s).toMatchObject({ kg: '70', reps: '8', done: true });
  });

  it('keeps typed values', () => {
    const s = set({ kg: '75', reps: '6', prevKg: 70, prevReps: 8 });
    toggleSet(s);
    expect(s).toMatchObject({ kg: '75', reps: '6' });
  });

  it('refuses without reps and leaves the set untouched', () => {
    const s = set({ prevKg: 70 });
    expect(toggleSet(s)).toEqual({ ok: false, reason: 'missing-reps' });
    expect(s).toEqual(set({ prevKg: 70 }));
  });

  it('unticks a done set', () => {
    const s = set({ kg: '70', reps: '8', done: true });
    expect(toggleSet(s)).toEqual({ ok: true, completed: false });
    expect(s.done).toBe(false);
  });
});

describe('add/remove sets', () => {
  it('adds a set using the last one as reference', () => {
    const ex = { exerciseId: 'b', name: 'B', plannedSets: 1, sets: [set({ kg: '60', reps: '', prevKg: 55, prevReps: 10 })] };
    addSet(ex);
    expect(ex.sets[1]).toEqual(set({ prevKg: 60, prevReps: 10, targetKg: 60, targetReps: null }));
  });

  it('never removes the last set', () => {
    const ex = { exerciseId: 'b', name: 'B', plannedSets: 1, sets: [set(), set()] };
    removeSet(ex);
    removeSet(ex);
    expect(ex.sets).toHaveLength(1);
  });
});

describe('finishWorkout', () => {
  it('keeps only done sets and exercises with sets', () => {
    const a = createActiveWorkout(routine, [], { kind: 'full' }, 0);
    a.exercises[0]!.sets[0] = set({ kg: '62,5', reps: '8', done: true });
    a.exercises[0]!.sets[1] = set({ kg: '', reps: '10', done: true });
    a.exercises[0]!.sets[2] = set({ kg: '70', reps: '5', done: false });
    const w = finishWorkout(a, 3_725_000);
    expect(w).toEqual({
      id: 'w_0',
      routineId: 'torso-a',
      routineName: 'Torso A',
      startedAt: 0,
      durationSec: 3725,
      exercises: [{ exerciseId: 'bench', name: 'Banca', plannedSets: 4, sets: [{ kg: 62.5, reps: 8 }, { kg: 0, reps: 10 }] }],
    });
    expect(workoutVolume(w!)).toBe(500);
  });

  it('returns null when nothing was done', () => {
    expect(finishWorkout(createActiveWorkout(routine, [], { kind: 'full' }, 0), 10)).toBeNull();
  });

  it('parses comma decimals', () => {
    expect(parseNum('64,5')).toBe(64.5);
    expect(parseNum('')).toBeNaN();
  });
});

describe('targets in the active workout', () => {
  it('fills targets from history and uses them when ticking an empty set', () => {
    const a = createActiveWorkout(routine, history, { kind: 'full' }, 1000);
    const bench = a.exercises[0]!;
    expect(bench.targetReason).toBe('more-reps');
    expect(bench.sets[0]).toMatchObject({ targetKg: 70, targetReps: 8 });
    expect(bench.sets[1]).toMatchObject({ targetKg: 72.5, targetReps: 7 });
    expect(toggleSet(bench.sets[1]!)).toEqual({ ok: true, completed: true });
    expect(bench.sets[1]).toMatchObject({ kg: '72.5', reps: '7', done: true });
  });

  it('marks a deload session', () => {
    const a = createActiveWorkout(routine, history, { kind: 'half' }, 1000, true);
    expect(a.exercises[0]?.targetReason).toBe('deload');
  });

  it('an extra set aims at what was just done', () => {
    const ex = { exerciseId: 'b', name: 'B', plannedSets: 1, sets: [set({ kg: '80', reps: '6', targetKg: 77.5, targetReps: 6 })] };
    addSet(ex);
    expect(ex.sets[1]).toMatchObject({ targetKg: 80, targetReps: 6 });
  });
});
