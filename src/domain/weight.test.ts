import { describe, expect, it } from 'vitest';
import { average, isValidWeight, monthWeights, movingAverage, weekAverages, weekWeights } from './weight';

describe('movingAverage', () => {
  it('averages the entries of the last 7 calendar days', () => {
    const pts = movingAverage({
      '2026-09-28': 64,
      '2026-09-30': 65,
      '2026-10-02': 66,
      '2026-10-05': 67, // ventana 29/09-05/10 → 65, 66, 67
    });
    expect(pts.map((p) => p.date)).toEqual(['2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05']);
    expect(pts.map((p) => p.avg)).toEqual([64, 64.5, 65, 66]);
  });

  it('includes day 6 back and excludes day 7 back', () => {
    const pts = movingAverage({ '2026-10-01': 60, '2026-10-02': 62, '2026-10-08': 70 });
    expect(pts[2]?.avg).toBe(66); // 02/10 entra (6 días), 01/10 no (7 días)
  });

  it('is not affected by the DST change', () => {
    const pts = movingAverage({ '2026-10-20': 64, '2026-10-26': 66 });
    expect(pts[1]?.avg).toBe(65);
  });

  it('handles an empty map', () => {
    expect(movingAverage({})).toEqual([]);
  });
});

describe('weekly weights', () => {
  const w = { '2026-09-28': 64, '2026-09-30': 64.4, '2026-10-02': 64.6, '2026-10-05': 64.8, '2026-10-07': 65.2 };

  it('collects the weights of the week', () => {
    expect(weekWeights(w, new Date(2026, 9, 1))).toEqual([64, 64.4, 64.6]);
  });

  it('compares this week with the previous one', () => {
    const r = weekAverages(w, new Date(2026, 9, 8));
    expect(r.thisWeek).toBeCloseTo(65);
    expect(r.lastWeek).toBeCloseTo(64.333, 3);
    expect(r.change).toBeCloseTo(0.667, 3);
    expect(weekAverages(w, new Date(2026, 8, 29)).change).toBeNull();
  });

  it('filters by month', () => {
    expect(monthWeights(w, '2026-10').map(([d]) => d)).toEqual(['2026-10-02', '2026-10-05', '2026-10-07']);
  });

  it('averages and validates', () => {
    expect(average([])).toBeNull();
    expect(average([1, 2])).toBe(1.5);
    expect(isValidWeight(64.5)).toBe(true);
    expect(isValidWeight(25)).toBe(false);
    expect(isValidWeight(NaN)).toBe(false);
  });
});
