import { describe, expect, it } from 'vitest';
import { addDays, dayDiff, dow, isoWeek, mondayOf, monthKey, parseYmd, sameWeek, toMin, ymd } from './dates';

describe('dates', () => {
  it('formats and parses local dates', () => {
    expect(ymd(new Date(2026, 8, 28))).toBe('2026-09-28');
    expect(ymd(parseYmd('2026-01-05'))).toBe('2026-01-05');
    expect(monthKey(new Date(2026, 0, 31))).toBe('2026-01');
  });

  it('uses monday as day 0', () => {
    expect(dow(new Date(2026, 8, 28))).toBe(0); // lunes
    expect(dow(new Date(2026, 9, 4))).toBe(6); // domingo
  });

  it('converts H:MM to minutes', () => {
    expect(toMin('6:45')).toBe(405);
    expect(toMin('24:00')).toBe(1440);
  });

  it('finds the monday of a week', () => {
    expect(ymd(mondayOf(new Date(2026, 9, 4, 23, 30)))).toBe('2026-09-28');
    expect(ymd(mondayOf(new Date(2026, 8, 28, 0, 1)))).toBe('2026-09-28');
  });

  it('computes calendar day differences across DST changes', () => {
    // Fin del horario de verano en España: 25/10/2026. Inicio: 28/03/2027.
    expect(dayDiff(new Date(2026, 9, 19), new Date(2026, 9, 26))).toBe(7);
    expect(dayDiff(new Date(2027, 2, 22), new Date(2027, 2, 29))).toBe(7);
    expect(dayDiff(new Date(2026, 8, 28, 23, 0), new Date(2026, 8, 29, 0, 30))).toBe(1);
  });

  it('computes ISO weeks, including year boundaries', () => {
    expect(isoWeek(new Date(2026, 8, 28))).toBe('2026-W40');
    expect(isoWeek(new Date(2026, 9, 4))).toBe('2026-W40');
    expect(isoWeek(new Date(2027, 0, 1))).toBe('2026-W53');
    expect(isoWeek(new Date(2027, 0, 4))).toBe('2027-W01');
    expect(isoWeek(new Date(2024, 11, 30))).toBe('2025-W01');
  });

  it('detects same week', () => {
    expect(sameWeek(new Date(2026, 9, 25, 23, 30), new Date(2026, 9, 19))).toBe(true);
    expect(sameWeek(new Date(2026, 9, 26), new Date(2026, 9, 25))).toBe(false);
    expect(ymd(addDays(new Date(2026, 9, 24), 2))).toBe('2026-10-26');
  });
});

describe('test environment', () => {
  it('runs in Europe/Madrid so DST cases are meaningful', () => {
    expect(new Date(2026, 9, 24, 12).getTimezoneOffset()).toBe(-120);
    expect(new Date(2026, 9, 26, 12).getTimezoneOffset()).toBe(-60);
  });
});
