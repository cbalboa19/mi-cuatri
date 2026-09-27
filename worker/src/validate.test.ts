import { describe, expect, it } from 'vitest';
import { LIMITS, parseBearer, parseJobs, parseSubscription, randomHex, safeEqual, sha256Hex } from './validate';

const now = 1_800_000_000_000;
const job = (over: Record<string, unknown> = {}) => ({ id: 'creatina:2026-09-28', fireAt: now + 60_000, title: 'Creatina', body: 'x', ...over });

describe('parseJobs', () => {
  it('accepts valid jobs and drops the ones already past', () => {
    const r = parseJobs({ jobs: [job(), job({ id: 'old', fireAt: now - 120_000 }), job({ id: 'late', fireAt: now - 30_000 })] }, now);
    expect(r?.map((j) => j.id)).toEqual(['creatina:2026-09-28', 'late']);
  });

  it('rejects malformed input', () => {
    expect(parseJobs(null, now)).toBeNull();
    expect(parseJobs({ jobs: [job({ id: '' })] }, now)).toBeNull();
    expect(parseJobs({ jobs: [job(), job()] }, now)).toBeNull(); // id repetido
    expect(parseJobs({ jobs: [job({ fireAt: now + LIMITS.horizon + 1 })] }, now)).toBeNull();
    expect(parseJobs({ jobs: [job({ title: 'x'.repeat(LIMITS.text + 1) })] }, now)).toBeNull();
    expect(parseJobs({ jobs: Array.from({ length: LIMITS.jobsPerDevice + 1 }, (_, i) => job({ id: `j${i}` })) }, now)).toBeNull();
  });

  it('accepts an empty list (cancel everything)', () => {
    expect(parseJobs({ jobs: [] }, now)).toEqual([]);
  });
});

describe('parseSubscription', () => {
  it('accepts a push subscription', () => {
    const s = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'BN...', auth: 'xyz' } };
    expect(parseSubscription(s)).toEqual(s);
  });

  it('rejects non-https endpoints and missing keys', () => {
    expect(parseSubscription({ endpoint: 'http://x.com', keys: { p256dh: 'a', auth: 'b' } })).toBeNull();
    expect(parseSubscription({ endpoint: 'https://x.com' })).toBeNull();
    expect(parseSubscription({ endpoint: 'nope', keys: { p256dh: 'a', auth: 'b' } })).toBeNull();
  });
});

describe('auth helpers', () => {
  it('parses bearer credentials', () => {
    const id = randomHex(16);
    const secret = randomHex(32);
    expect(parseBearer(`Bearer ${id}.${secret}`)).toEqual({ id, secret });
    expect(parseBearer('Bearer nope')).toBeNull();
    expect(parseBearer(null)).toBeNull();
  });

  it('hashes and compares', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(safeEqual('abcd', 'abcd')).toBe(true);
    expect(safeEqual('abcd', 'abce')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('invites and job diff', async () => {
  const { diffJobs, generateInviteCode, parseLabel, registrationToken, sha256Hex } = await import('./validate');

  it('generates readable invite codes', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
    expect(generateInviteCode()).not.toBe(code);
  });

  it('derives the same token regardless of case and spaces', async () => {
    expect(await registrationToken('  AbCd-EfGh ')).toBe(await registrationToken('abcd-efgh'));
    expect(await registrationToken('abcd-efgh')).toBe(await sha256Hex('mi-cuatri-notify:abcd-efgh'));
  });

  it('validates labels', () => {
    expect(parseLabel(' Mamá ')).toBe('Mamá');
    expect(parseLabel('')).toBeNull();
    expect(parseLabel('x'.repeat(41))).toBeNull();
    expect(parseLabel(3)).toBeNull();
  });

  it('only rewrites the jobs that changed', () => {
    const a = { id: 'a', fireAt: 1, title: 't', body: 'b' };
    const b = { id: 'b', fireAt: 2, title: 't', body: 'b' };
    const c = { id: 'c', fireAt: 3, title: 't', body: 'b' };
    const r = diffJobs([a, b], [a, { ...b, fireAt: 5 }, c]);
    expect(r.remove).toEqual([]);
    expect(r.upsert.map((j) => j.id)).toEqual(['b', 'c']);
    expect(diffJobs([a, b], [b])).toEqual({ remove: ['a'], upsert: [] });
  });
});
