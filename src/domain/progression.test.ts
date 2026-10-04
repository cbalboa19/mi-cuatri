import { describe, expect, it } from 'vitest';
import { bestE1rm, e1rm, exerciseSessions, lastSessionFor, suggestIncrease, trackedExercises } from './progression';
import type { ExerciseDef, RoutineDef, Workout, WorkoutExercise } from './types';

const bench: ExerciseDef = { id: 'bench', name: 'Banca', sets: 4, reps: [5, 8], rir: '2', restSec: 180, incrementKg: 2.5 };

const ex = (sets: [number, number][], plannedSets = sets.length, exerciseId = 'bench', name = 'Banca'): WorkoutExercise => ({
  exerciseId,
  name,
  plannedSets,
  sets: sets.map(([kg, reps]) => ({ kg, reps })),
});

const workout = (id: string, startedAt: number, exercises: WorkoutExercise[]): Workout => ({
  id,
  routineId: 'torso-a',
  routineName: 'Torso A',
  startedAt,
  durationSec: 3600,
  exercises,
});

describe('e1rm (Epley)', () => {
  it('estimates one rep max', () => {
    expect(e1rm(100, 5)).toBeCloseTo(116.67, 2);
    expect(e1rm(60, 10)).toBeCloseTo(80, 5);
  });

  it('returns the weight itself for a single rep', () => {
    expect(e1rm(100, 1)).toBe(100);
  });

  it('takes the best set of a session', () => {
    expect(bestE1rm(ex([[80, 8], [85, 5], [70, 12]]))).toBeCloseTo(101.33, 2);
  });
});

describe('suggestIncrease', () => {
  it('suggests when every planned set hits the top of the range at the same weight', () => {
    expect(suggestIncrease(bench, ex([[70, 8], [70, 8], [70, 8], [70, 9]]))).toBe(72.5);
  });

  it('does nothing without history or without increment', () => {
    expect(suggestIncrease(bench, null)).toBeNull();
    expect(suggestIncrease({ ...bench, incrementKg: 0 }, ex([[0, 15]]))).toBeNull();
  });

  it('requires all planned sets', () => {
    expect(suggestIncrease(bench, ex([[70, 8]], 4))).toBeNull();
  });

  it('requires the top of the range in every set', () => {
    expect(suggestIncrease(bench, ex([[70, 8], [70, 8], [70, 7], [70, 8]]))).toBeNull();
  });

  it('requires the same weight in every set', () => {
    expect(suggestIncrease(bench, ex([[70, 8], [72.5, 8], [70, 8], [70, 8]]))).toBeNull();
  });

  it('rounds to one decimal', () => {
    expect(suggestIncrease({ ...bench, incrementKg: 0.1 }, ex([[20.2, 8]], 1))).toBe(20.3);
  });
});

describe('history helpers', () => {
  const ws = [
    workout('w1', 1, [ex([[60, 8]])]),
    workout('w2', 2, [ex([[62.5, 6]]), ex([[40, 10]], 1, 'row', 'Remo')]),
    workout('w3', 3, [ex([[20, 12]], 1, 'old', 'Ejercicio quitado')]),
  ];

  it('finds the last session of an exercise', () => {
    expect(lastSessionFor('bench', ws)?.sets[0]?.kg).toBe(62.5);
    expect(lastSessionFor('nope', ws)).toBeNull();
  });

  it('lists sessions of an exercise in order', () => {
    expect(exerciseSessions('bench', ws).map((s) => s.workout.id)).toEqual(['w1', 'w2']);
  });

  it('lists tracked exercises: config order first, then removed ones', () => {
    const routines: RoutineDef[] = [
      {
        id: 'r',
        name: 'R',
        day: 0,
        desc: '',
        exercises: [
          { ...bench, id: 'row', name: 'Remo renombrado' },
          { ...bench, id: 'curl', name: 'Curl' },
          bench,
        ],
      },
    ];
    expect(trackedExercises(routines, ws)).toEqual([
      { id: 'row', name: 'Remo renombrado' },
      { id: 'bench', name: 'Banca' },
      { id: 'old', name: 'Ejercicio quitado' },
    ]);
  });
});

describe('nextTargets (double progression)', async () => {
  const { nextTargets } = await import('./progression');
  const def = { id: 'bench', name: 'Banca', sets: 4, reps: [5, 8] as [number, number], rir: '2', restSec: 180, incrementKg: 2.5 };
  const w = (id: string, t: number, sets: [number, number][], planned = sets.length): Workout =>
    workout(id, t, [ex(sets, planned)]);

  it('returns null without history', () => {
    expect(nextTargets(def, [], 4)).toBeNull();
  });

  it('adds weight and goes back to the bottom of the range when every set hit the top', () => {
    const t = nextTargets(def, [w('a', 1, [[70, 8], [70, 8], [70, 8], [70, 8]])], 4)!;
    expect(t.reason).toBe('increase');
    expect(t.sets).toEqual(Array(4).fill({ kg: 72.5, reps: 5 }));
  });

  it('otherwise keeps the weight and adds one rep per set, capped at the top', () => {
    const t = nextTargets(def, [w('a', 1, [[70, 8], [70, 7], [70, 6], [70, 5]])], 4)!;
    expect(t.reason).toBe('more-reps');
    expect(t.sets).toEqual([{ kg: 70, reps: 8 }, { kg: 70, reps: 8 }, { kg: 70, reps: 7 }, { kg: 70, reps: 6 }]);
  });

  it('aims for the minimum when a set fell short', () => {
    const t = nextTargets(def, [w('a', 1, [[70, 6], [70, 4]])], 2)!;
    expect(t.sets).toEqual([{ kg: 70, reps: 7 }, { kg: 70, reps: 5 }]);
  });

  it('uses the last set as reference for extra sets', () => {
    const t = nextTargets(def, [w('a', 1, [[70, 6], [70, 6], [70, 5]], 3)], 4)!;
    expect(t.sets[3]).toEqual({ kg: 70, reps: 6 });
  });

  it('drops 10% after two sessions missing the minimum on the first set', () => {
    const hist = [w('a', 1, [[80, 4], [80, 4]]), w('b', 2, [[80, 4], [80, 3]])];
    const t = nextTargets(def, hist, 2)!;
    expect(t.reason).toBe('reduce');
    expect(t.sets).toEqual([{ kg: 72, reps: 5 }, { kg: 72, reps: 5 }]);
  });

  it('keeps the weights with easy reps in a deload week', () => {
    const t = nextTargets(def, [w('a', 1, [[70, 8], [70, 8]])], 2, true)!;
    expect(t.reason).toBe('deload');
    expect(t.sets).toEqual([{ kg: 70, reps: 5 }, { kg: 70, reps: 5 }]);
  });

  it('progresses bodyweight exercises by reps', () => {
    const pull = { ...def, id: 'pullup', reps: [6, 15] as [number, number], incrementKg: 0 };
    const mk = (sets: [number, number][]) => [workout('a', 1, [ex(sets, sets.length, 'pullup', 'Dominadas')])];
    expect(nextTargets(pull, mk([[0, 12], [0, 10]]), 2)!.sets).toEqual([{ kg: 0, reps: 13 }, { kg: 0, reps: 11 }]);
    expect(nextTargets(pull, mk([[0, 15], [0, 15]]), 2)!.reason).toBe('bodyweight-max');
  });
});
