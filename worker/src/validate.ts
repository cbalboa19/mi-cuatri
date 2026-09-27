// Validación de las peticiones del worker (sin dependencias de Cloudflare, para poder testearla).

export interface Job {
  /** Identificador estable, p. ej. "creatina:2026-09-28". También se usa como tag de la notificación. */
  id: string;
  /** epoch ms */
  fireAt: number;
  title: string;
  body: string;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const LIMITS = {
  jobsPerDevice: 200,
  /** Dispositivos del dueño (registrados con su clave). */
  maxOwnerDevices: 5,
  /** Dispositivos por código de invitación. */
  maxDevicesPerInvite: 3,
  maxInvites: 30,
  label: 40,
  text: 200,
  id: 80,
  /** Hasta cuándo se admite programar (ms desde ahora). */
  horizon: 10 * 86_400_000,
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseSubscription(v: unknown): PushSubscriptionJSON | null {
  if (!isObj(v) || typeof v.endpoint !== 'string' || !isObj(v.keys)) return null;
  const { p256dh, auth } = v.keys;
  if (typeof p256dh !== 'string' || typeof auth !== 'string') return null;
  let url: URL;
  try {
    url = new URL(v.endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || v.endpoint.length > 1000 || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint: v.endpoint, keys: { p256dh, auth } };
}

/** Valida la lista de avisos. Devuelve null si algo no es válido. */
export function parseJobs(v: unknown, now: number): Job[] | null {
  if (!isObj(v) || !Array.isArray(v.jobs) || v.jobs.length > LIMITS.jobsPerDevice) return null;
  const out: Job[] = [];
  const seen = new Set<string>();
  for (const j of v.jobs) {
    if (!isObj(j)) return null;
    const { id, fireAt, title, body } = j;
    if (typeof id !== 'string' || !id || id.length > LIMITS.id || seen.has(id)) return null;
    if (typeof fireAt !== 'number' || !Number.isFinite(fireAt) || fireAt > now + LIMITS.horizon) return null;
    if (typeof title !== 'string' || title.length > LIMITS.text) return null;
    if (typeof body !== 'string' || body.length > LIMITS.text) return null;
    seen.add(id);
    if (fireAt >= now - 60_000) out.push({ id, fireAt: Math.round(fireAt), title, body });
  }
  return out;
}

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparación de cadenas en tiempo constante (para hashes de la misma longitud). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** "Bearer <id>.<secret>" → { id, secret } */
export function parseBearer(header: string | null): { id: string; secret: string } | null {
  const m = header?.match(/^Bearer ([a-f0-9]{16,64})\.([a-f0-9]{32,128})$/);
  return m ? { id: m[1]!, secret: m[2]! } : null;
}

/** Token de registro que envía la app: sha256("mi-cuatri-notify:" + clave o código). */
export const registrationToken = (secret: string): Promise<string> =>
  sha256Hex(`mi-cuatri-notify:${secret.trim().toLowerCase()}`);

/** Código de invitación legible, p. ej. "k7mq-2xpa" (sin caracteres que se confundan). */
export function generateInviteCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const chars = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

export function parseLabel(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t && t.length <= LIMITS.label ? t : null;
}

/** Qué avisos borrar y cuáles escribir para pasar de `current` a `desired` (solo lo que cambia). */
export function diffJobs(current: Job[], desired: Job[]): { remove: string[]; upsert: Job[] } {
  const now = new Map(current.map((j) => [j.id, j]));
  const want = new Set(desired.map((j) => j.id));
  const remove = current.filter((j) => !want.has(j.id)).map((j) => j.id);
  const upsert = desired.filter((j) => {
    const c = now.get(j.id);
    return !c || c.fireAt !== j.fireAt || c.title !== j.title || c.body !== j.body;
  });
  return { remove, upsert };
}
