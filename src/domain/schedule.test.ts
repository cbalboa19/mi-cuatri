import { describe, expect, it } from 'vitest';
import { CATEGORY_LABELS } from '../config/schedule';
import { parseSchedulePayload, toSchedule } from './schedule';

const day = [{ start: '9:00', end: '10:00', label: 'Clase', cat: 'clase' }];
const week = [day, day, day, day, day, [], []];

describe('schedule payload', () => {
  it('accepts a valid week and applies label overrides', () => {
    const p = parseSchedulePayload({ labels: { ocio: 'Ocio y amigos' }, week });
    const s = toSchedule(p, CATEGORY_LABELS);
    expect(s.week[0]).toEqual(day);
    expect(s.labels.ocio).toBe('Ocio y amigos');
    expect(s.labels.clase).toBe('Clase');
  });

  it('rejects malformed schedules', () => {
    expect(() => parseSchedulePayload(null)).toThrow();
    expect(() => parseSchedulePayload({ week: [day] })).toThrow('7 días');
    expect(() => parseSchedulePayload({ week: [[{ ...day[0], cat: 'fiesta' }], [], [], [], [], [], []] })).toThrow('fiesta');
    expect(() => parseSchedulePayload({ week: [[{ ...day[0], start: '9h' }], [], [], [], [], [], []] })).toThrow('inicio');
    expect(() => parseSchedulePayload({ labels: { nope: 'x' }, week })).toThrow('labels');
  });

  it('the bundled encrypted profile has the expected shape', async () => {
    const enc = (await import('../config/profile.enc.json')).default;
    expect(enc).toMatchObject({ v: 1, kdf: 'PBKDF2-SHA256' });
    expect(enc.iter).toBeGreaterThanOrEqual(600_000);
  });
});
