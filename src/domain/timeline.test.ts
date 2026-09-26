import { describe, expect, it } from 'vitest';
import { studyMinutes, timelineState } from './timeline';
import type { ScheduleBlock } from './types';

const blocks: ScheduleBlock[] = [
  { start: '9:00', end: '10:00', label: 'A', cat: 'estudio' },
  { start: '10:15', end: '11:00', label: 'B', cat: 'clase' },
  { start: '23:00', end: '24:00', label: 'Dormir', cat: 'sueno' },
];

describe('timelineState', () => {
  it('without "now" (another day) everything is neutral', () => {
    expect(timelineState(blocks, null)).toEqual({ states: ['future', 'future', 'future'], pulseAt: null });
  });

  it('highlights the current block and hides the line', () => {
    expect(timelineState(blocks, 9 * 60 + 30)).toEqual({ states: ['now', 'future', 'future'], pulseAt: null });
  });

  it('puts the line in gaps between blocks', () => {
    expect(timelineState(blocks, 10 * 60 + 5)).toEqual({ states: ['past', 'future', 'future'], pulseAt: 1 });
  });

  it('puts the line before the first block early in the morning', () => {
    expect(timelineState(blocks, 60).pulseAt).toBe(0);
  });

  it('treats 24:00 as the end of the day', () => {
    expect(timelineState(blocks, 23 * 60 + 59).states[2]).toBe('now');
  });

  it('puts the line at the end once every block is over', () => {
    const friday: ScheduleBlock[] = [
      { start: '10:30', end: '12:30', label: 'Clase', cat: 'clase' },
      { start: '16:30', end: '23:30', label: 'Ocio', cat: 'ocio' },
    ];
    expect(timelineState(friday, 23 * 60 + 45).pulseAt).toBe(2);
  });
});

describe('studyMinutes', () => {
  it('adds study blocks', () => {
    expect(studyMinutes(blocks)).toBe(60);
  });
});
