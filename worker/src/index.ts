// Worker de avisos: guarda la suscripción push del dispositivo y la lista de avisos programados,
// y los envía a su hora con una alarma de Durable Object. No guarda nada más.

import { buildPushPayload } from '@block65/webcrypto-web-push';
import { DurableObject } from 'cloudflare:workers';
import {
  LIMITS,
  parseBearer,
  parseJobs,
  parseSubscription,
  randomHex,
  safeEqual,
  sha256Hex,
  type Job,
  type PushSubscriptionJSON,
} from './validate';

export interface Env {
  SCHEDULER: DurableObjectNamespace<Scheduler>;
  /** JWK (JSON) de la clave privada VAPID. Secret. */
  VAPID_PRIVATE_KEY: string;
  /** Clave pública VAPID (base64url), la misma que usa la app. */
  VAPID_PUBLIC_KEY: string;
  /** SHA-256 (hex) del token de registro. Secret. */
  REGISTER_TOKEN_HASH: string;
  /** Orígenes permitidos (CORS), separados por comas. */
  ALLOWED_ORIGINS: string;
  /** Contacto VAPID (URL o mailto:). */
  CONTACT: string;
}

type SendResult = 'sent' | 'gone' | 'error';

export class Scheduler extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, subscription TEXT NOT NULL, created_at INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS jobs (
      device_id TEXT NOT NULL, id TEXT NOT NULL, fire_at INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
      PRIMARY KEY (device_id, id))`);
  }

  async register(sub: PushSubscriptionJSON): Promise<{ id: string; secret: string }> {
    const id = randomHex(16);
    const secret = randomHex(32);
    // Si el dispositivo ya estaba registrado con la misma suscripción, se sustituye.
    for (const row of this.sql.exec<{ id: string; subscription: string }>('SELECT id, subscription FROM devices')) {
      if ((JSON.parse(row.subscription) as PushSubscriptionJSON).endpoint === sub.endpoint) this.deleteDevice(row.id);
    }
    // Límite de dispositivos: se descarta el más antiguo.
    const extra = this.sql.exec<{ id: string }>('SELECT id FROM devices ORDER BY created_at DESC LIMIT -1 OFFSET ?', LIMITS.maxDevices - 1).toArray();
    for (const row of extra) this.deleteDevice(row.id);
    this.sql.exec(
      'INSERT INTO devices (id, secret_hash, subscription, created_at) VALUES (?, ?, ?, ?)',
      id,
      await sha256Hex(secret),
      JSON.stringify(sub),
      Date.now(),
    );
    return { id, secret };
  }

  async authenticate(id: string, secret: string): Promise<boolean> {
    const row = this.sql.exec<{ secret_hash: string }>('SELECT secret_hash FROM devices WHERE id = ?', id).toArray()[0];
    return !!row && safeEqual(row.secret_hash, await sha256Hex(secret));
  }

  /** Sustituye todos los avisos del dispositivo por los indicados. */
  async setJobs(deviceId: string, jobs: Job[]): Promise<number> {
    this.sql.exec('DELETE FROM jobs WHERE device_id = ?', deviceId);
    for (const j of jobs) {
      this.sql.exec('INSERT INTO jobs (device_id, id, fire_at, title, body) VALUES (?, ?, ?, ?, ?)', deviceId, j.id, j.fireAt, j.title, j.body);
    }
    await this.reschedule();
    return jobs.length;
  }

  async removeDevice(id: string): Promise<void> {
    this.deleteDevice(id);
    await this.reschedule();
  }

  async sendTest(id: string): Promise<SendResult> {
    return this.send(id, { title: 'Mi cuatri', body: 'Las notificaciones funcionan', tag: 'test' });
  }

  override async alarm(): Promise<void> {
    const due = this.sql
      .exec<{ device_id: string; id: string; title: string; body: string }>(
        'SELECT device_id, id, title, body FROM jobs WHERE fire_at <= ? ORDER BY fire_at',
        Date.now() + 1000,
      )
      .toArray();
    for (const j of due) {
      this.sql.exec('DELETE FROM jobs WHERE device_id = ? AND id = ?', j.device_id, j.id);
      await this.send(j.device_id, { title: j.title, body: j.body, tag: j.id });
    }
    await this.reschedule();
  }

  private deleteDevice(id: string): void {
    this.sql.exec('DELETE FROM jobs WHERE device_id = ?', id);
    this.sql.exec('DELETE FROM devices WHERE id = ?', id);
  }

  private async reschedule(): Promise<void> {
    const next = this.sql.exec<{ t: number | null }>('SELECT MIN(fire_at) AS t FROM jobs').toArray()[0]?.t;
    if (next == null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(Math.max(next, Date.now() + 100));
  }

  private async send(deviceId: string, payload: { title: string; body: string; tag: string }): Promise<SendResult> {
    const row = this.sql.exec<{ subscription: string }>('SELECT subscription FROM devices WHERE id = ?', deviceId).toArray()[0];
    if (!row) return 'gone';
    try {
      const sub = JSON.parse(row.subscription) as PushSubscriptionJSON;
      const request = await buildPushPayload(
        { data: payload, options: { ttl: 3600, urgency: 'high', topic: topicFor(payload.tag) } },
        { ...sub, expirationTime: null },
        {
          subject: this.env.CONTACT,
          publicKey: this.env.VAPID_PUBLIC_KEY,
          privateKey: (JSON.parse(this.env.VAPID_PRIVATE_KEY) as { d: string }).d,
        },
      );
      const res = await fetch(sub.endpoint, request);
      if (res.status === 404 || res.status === 410) {
        // La suscripción ya no existe (app desinstalada o permiso retirado).
        this.deleteDevice(deviceId);
        return 'gone';
      }
      return res.ok ? 'sent' : 'error';
    } catch (e) {
      console.error('push failed', e);
      return 'error';
    }
  }
}

/** Topic de Web Push (máx. 32 caracteres base64url): los avisos con el mismo tag se sustituyen. */
function topicFor(tag: string): string {
  return tag.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32);
}

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  return allowed.includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      }
    : {};
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const headers = { 'Content-Type': 'application/json', ...cors(req, env) };
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    const { pathname } = new URL(req.url);
    const stub = env.SCHEDULER.get(env.SCHEDULER.idFromName('main'));
    const body = async (): Promise<unknown> => {
      try {
        return await req.json();
      } catch {
        return null;
      }
    };

    if (req.method === 'GET' && pathname === '/health') return json({ ok: true });

    if (req.method === 'POST' && pathname === '/register') {
      const b = (await body()) as { token?: unknown; subscription?: unknown } | null;
      const sub = parseSubscription(b?.subscription);
      if (!sub || typeof b?.token !== 'string') return json({ error: 'bad_request' }, 400);
      if (!safeEqual(await sha256Hex(b.token), env.REGISTER_TOKEN_HASH)) return json({ error: 'forbidden' }, 403);
      return json(await stub.register(sub));
    }

    const auth = parseBearer(req.headers.get('Authorization'));
    if (!auth || !(await stub.authenticate(auth.id, auth.secret))) return json({ error: 'unauthorized' }, 401);

    if (req.method === 'PUT' && pathname === '/jobs') {
      const jobs = parseJobs(await body(), Date.now());
      if (!jobs) return json({ error: 'bad_request' }, 400);
      return json({ scheduled: await stub.setJobs(auth.id, jobs) });
    }
    if (req.method === 'POST' && pathname === '/test') return json({ result: await stub.sendTest(auth.id) });
    if (req.method === 'DELETE' && pathname === '/device') {
      await stub.removeDevice(auth.id);
      return json({ ok: true });
    }
    return json({ error: 'not_found' }, 404);
  },
} satisfies ExportedHandler<Env>;
