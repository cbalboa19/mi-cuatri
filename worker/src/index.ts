// Worker de avisos: guarda la suscripción push de cada dispositivo y su lista de avisos, y los
// envía a su hora con una alarma de Durable Object. No guarda nada más.
// Se registran el dueño (con su clave) y quien tenga un código de invitación creado por él.

import { buildPushPayload } from '@block65/webcrypto-web-push';
import { DurableObject } from 'cloudflare:workers';
import {
  diffJobs,
  generateInviteCode,
  LIMITS,
  parseBearer,
  parseJobs,
  parseLabel,
  parseSubscription,
  randomHex,
  registrationToken,
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
  /** SHA-256 (hex) del token de registro del dueño. Secret. */
  REGISTER_TOKEN_HASH: string;
  /** Orígenes permitidos (CORS), separados por comas. */
  ALLOWED_ORIGINS: string;
  /** Contacto VAPID (URL o mailto:). */
  CONTACT: string;
}

type Role = 'owner' | 'guest';
type SendResult = 'sent' | 'gone' | 'error';

export interface InviteInfo {
  id: string;
  label: string;
  createdAt: number;
  devices: number;
}

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
    this.sql.exec(`CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL, created_at INTEGER NOT NULL)`);
    // v2: dispositivos del dueño o de un invitado (los ya existentes eran todos del dueño).
    const cols = this.sql.exec<{ name: string }>('PRAGMA table_info(devices)').toArray().map((c) => c.name);
    if (!cols.includes('role')) this.sql.exec(`ALTER TABLE devices ADD COLUMN role TEXT NOT NULL DEFAULT 'owner'`);
    if (!cols.includes('invite_id')) this.sql.exec('ALTER TABLE devices ADD COLUMN invite_id TEXT');
  }

  /** Registra un dispositivo. `tokenHash` = sha256 del token de registro. Null si no es válido. */
  async register(sub: PushSubscriptionJSON, tokenHash: string, isOwner: boolean): Promise<{ id: string; secret: string; role: Role } | null> {
    let role: Role = 'owner';
    let inviteId: string | null = null;
    if (!isOwner) {
      const inv = this.sql.exec<{ id: string }>('SELECT id FROM invites WHERE token_hash = ?', tokenHash).toArray()[0];
      if (!inv) return null;
      role = 'guest';
      inviteId = inv.id;
    }
    // Si el dispositivo ya estaba registrado con la misma suscripción, se sustituye.
    for (const row of this.sql.exec<{ id: string; subscription: string }>('SELECT id, subscription FROM devices')) {
      if ((JSON.parse(row.subscription) as PushSubscriptionJSON).endpoint === sub.endpoint) this.deleteDevice(row.id);
    }
    // Límite de dispositivos por dueño / por invitación: se descarta el más antiguo del mismo grupo.
    const [where, arg, max] =
      role === 'owner' ? ["role = 'owner'", null, LIMITS.maxOwnerDevices] : ['invite_id = ?', inviteId, LIMITS.maxDevicesPerInvite];
    const group = this.sql
      .exec<{ id: string }>(`SELECT id FROM devices WHERE ${where} ORDER BY created_at DESC`, ...(arg ? [arg] : []))
      .toArray();
    for (const row of group.slice(max - 1)) this.deleteDevice(row.id);

    const id = randomHex(16);
    const secret = randomHex(32);
    this.sql.exec(
      'INSERT INTO devices (id, secret_hash, subscription, created_at, role, invite_id) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      await sha256Hex(secret),
      JSON.stringify(sub),
      Date.now(),
      role,
      inviteId,
    );
    await this.reschedule();
    return { id, secret, role };
  }

  /** Rol del dispositivo si las credenciales son correctas. */
  async authenticate(id: string, secret: string): Promise<Role | null> {
    const row = this.sql.exec<{ secret_hash: string; role: Role }>('SELECT secret_hash, role FROM devices WHERE id = ?', id).toArray()[0];
    return row && safeEqual(row.secret_hash, await sha256Hex(secret)) ? row.role : null;
  }

  /** Deja los avisos del dispositivo como los indicados, escribiendo solo lo que cambia. */
  async setJobs(deviceId: string, jobs: Job[]): Promise<number> {
    const current = this.sql
      .exec<{ id: string; fire_at: number; title: string; body: string }>('SELECT id, fire_at, title, body FROM jobs WHERE device_id = ?', deviceId)
      .toArray()
      .map((r) => ({ id: r.id, fireAt: r.fire_at, title: r.title, body: r.body }));
    const { remove, upsert } = diffJobs(current, jobs);
    for (const id of remove) this.sql.exec('DELETE FROM jobs WHERE device_id = ? AND id = ?', deviceId, id);
    for (const j of upsert) {
      this.sql.exec('INSERT OR REPLACE INTO jobs (device_id, id, fire_at, title, body) VALUES (?, ?, ?, ?, ?)', deviceId, j.id, j.fireAt, j.title, j.body);
    }
    if (remove.length || upsert.length) await this.reschedule();
    return jobs.length;
  }

  async removeDevice(id: string): Promise<void> {
    this.deleteDevice(id);
    await this.reschedule();
  }

  async sendTest(id: string): Promise<SendResult> {
    return this.send(id, { title: 'Mi cuatri', body: 'Las notificaciones funcionan', tag: 'test' });
  }

  // ---------- Invitaciones (solo el dueño) ----------

  async createInvite(label: string): Promise<{ id: string; code: string; label: string } | null> {
    const count = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM invites').toArray()[0]?.n ?? 0;
    if (count >= LIMITS.maxInvites) return null;
    const id = randomHex(8);
    const code = generateInviteCode();
    this.sql.exec(
      'INSERT INTO invites (id, token_hash, label, created_at) VALUES (?, ?, ?, ?)',
      id,
      await sha256Hex(await registrationToken(code)),
      label,
      Date.now(),
    );
    return { id, code, label };
  }

  async listInvites(): Promise<InviteInfo[]> {
    return this.sql
      .exec<{ id: string; label: string; created_at: number; devices: number }>(
        'SELECT i.id, i.label, i.created_at, COUNT(d.id) AS devices FROM invites i LEFT JOIN devices d ON d.invite_id = i.id GROUP BY i.id ORDER BY i.created_at',
      )
      .toArray()
      .map((r) => ({ id: r.id, label: r.label, createdAt: r.created_at, devices: r.devices }));
  }

  /** Borra la invitación y deja sin avisos a los dispositivos que se registraron con ella. */
  async revokeInvite(id: string): Promise<boolean> {
    const exists = this.sql.exec('SELECT id FROM invites WHERE id = ?', id).toArray().length > 0;
    if (!exists) return false;
    for (const d of this.sql.exec<{ id: string }>('SELECT id FROM devices WHERE invite_id = ?', id).toArray()) this.deleteDevice(d.id);
    this.sql.exec('DELETE FROM invites WHERE id = ?', id);
    await this.reschedule();
    return true;
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
      if (!sub || typeof b?.token !== 'string' || b.token.length > 128) return json({ error: 'bad_request' }, 400);
      const tokenHash = await sha256Hex(b.token);
      const result = await stub.register(sub, tokenHash, safeEqual(tokenHash, env.REGISTER_TOKEN_HASH));
      return result ? json(result) : json({ error: 'forbidden' }, 403);
    }

    const auth = parseBearer(req.headers.get('Authorization'));
    const role = auth ? await stub.authenticate(auth.id, auth.secret) : null;
    if (!auth || !role) return json({ error: 'unauthorized' }, 401);

    if (req.method === 'GET' && pathname === '/me') return json({ role });
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

    // Invitaciones: solo desde un dispositivo del dueño.
    if (pathname === '/invites' || pathname.startsWith('/invites/')) {
      if (role !== 'owner') return json({ error: 'forbidden' }, 403);
      if (req.method === 'GET' && pathname === '/invites') return json({ invites: await stub.listInvites() });
      if (req.method === 'POST' && pathname === '/invites') {
        const label = parseLabel(((await body()) as { label?: unknown } | null)?.label);
        if (!label) return json({ error: 'bad_request' }, 400);
        const inv = await stub.createInvite(label);
        return inv ? json(inv) : json({ error: 'too_many_invites' }, 409);
      }
      const m = pathname.match(/^\/invites\/([a-f0-9]{16})$/);
      if (req.method === 'DELETE' && m) return (await stub.revokeInvite(m[1]!)) ? json({ ok: true }) : json({ error: 'not_found' }, 404);
    }
    return json({ error: 'not_found' }, 404);
  },
} satisfies ExportedHandler<Env>;
