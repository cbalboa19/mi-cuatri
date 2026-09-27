// Cliente de notificaciones: registra el dispositivo en el worker y le envía la lista de avisos
// programados cada vez que cambian los datos.

import { PUSH_SERVER_URL, VAPID_PUBLIC_KEY, type NotificationType } from '../config/notifications';
import { notifyToken } from '../domain/crypto';
import { planNotifications } from '../domain/notifications';
import type { NotifyState, Repository } from '../data/repository';
import type { Store } from './store';

export type NotifyStatus = 'unsupported' | 'not-installed' | 'denied' | 'off' | 'on';
export type EnableResult = 'ok' | 'denied' | 'bad-key' | 'error';

export interface InviteInfo {
  id: string;
  label: string;
  createdAt: number;
  devices: number;
}

const DEBOUNCE_MS = 1500;

function base64UrlToBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4);
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export class NotifyClient {
  private registration: ServiceWorkerRegistration | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private syncing: Promise<void> = Promise.resolve();
  /** Invitaciones (solo el dueño); null = sin cargar. */
  invites: InviteInfo[] | null = null;
  /** Se llama cuando llegan datos nuevos del servidor (para volver a pintar). */
  onUpdate: (() => void) | null = null;

  private constructor(
    private readonly repo: Repository,
    private readonly store: Store,
    public state: NotifyState | null,
  ) {
    // Se obtiene por adelantado: en iOS la suscripción debe pedirse justo al pulsar, sin esperas.
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready.then((r) => (this.registration = r)).catch(() => {});
    }
  }

  static async load(repo: Repository, store: Store): Promise<NotifyClient> {
    return new NotifyClient(repo, store, await repo.getNotifyState());
  }

  get status(): NotifyStatus {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return this.isIos() && !this.isStandalone() ? 'not-installed' : 'unsupported';
    }
    if (this.isIos() && !this.isStandalone()) return 'not-installed';
    if (Notification.permission === 'denied') return 'denied';
    return this.state ? 'on' : 'off';
  }

  private isStandalone(): boolean {
    return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  }

  private isIos(): boolean {
    return /iPhone|iPad|iPod/.test(navigator.userAgent);
  }

  isEnabled(type: NotificationType): boolean {
    return !this.state?.disabled[type];
  }

  /**
   * Activa las notificaciones. Debe llamarse directamente desde el evento del usuario:
   * lo primero que hace es pedir la suscripción (y con ella el permiso de iOS).
   */
  enable(password: string): Promise<EnableResult> {
    const reg = this.registration;
    if (!reg) return Promise.resolve('error');
    const subscribing = reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) });
    return (async (): Promise<EnableResult> => {
      let sub: PushSubscription;
      try {
        sub = await subscribing;
      } catch (e) {
        console.error(e);
        return Notification.permission === 'denied' ? 'denied' : 'error';
      }
      try {
        const res = await fetch(`${PUSH_SERVER_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: await notifyToken(password), subscription: sub.toJSON() }),
        });
        if (res.status === 403) {
          await sub.unsubscribe().catch(() => {});
          return 'bad-key';
        }
        if (!res.ok) return 'error';
        const { id, secret, role } = (await res.json()) as { id: string; secret: string; role?: 'owner' | 'guest' };
        this.state = { deviceId: id, secret, role: role ?? 'owner', disabled: this.state?.disabled ?? {} };
        this.invites = null;
        await this.repo.setNotifyState(this.state);
        await this.sync();
        return 'ok';
      } catch (e) {
        console.error(e);
        return 'error';
      }
    })();
  }

  async disable(): Promise<void> {
    const state = this.state;
    this.state = null;
    this.invites = null;
    await this.repo.setNotifyState(null);
    if (state) await this.call('DELETE', '/device', undefined, state).catch(() => {});
    const sub = await this.registration?.pushManager.getSubscription();
    await sub?.unsubscribe().catch(() => {});
  }

  /** ¿Este dispositivo es del dueño? (los registros antiguos no guardaban el rol). */
  isOwner(hasProfile: boolean): boolean {
    return this.state?.role === 'owner' || (!!this.state && !this.state.role && hasProfile);
  }

  async loadInvites(): Promise<void> {
    try {
      const res = await this.call('GET', '/invites');
      if (!res.ok) return;
      this.invites = ((await res.json()) as { invites: InviteInfo[] }).invites;
      this.onUpdate?.();
    } catch {
      // sin conexión: se reintenta al volver a abrir la sección
    }
  }

  /** Crea un código de invitación. Devuelve el código (solo se ve esta vez). */
  async createInvite(label: string): Promise<{ code: string; label: string } | 'limit' | 'error'> {
    try {
      const res = await this.call('POST', '/invites', { label });
      if (res.status === 409) return 'limit';
      if (!res.ok) return 'error';
      const inv = (await res.json()) as { code: string; label: string };
      await this.loadInvites();
      return inv;
    } catch {
      return 'error';
    }
  }

  async revokeInvite(id: string): Promise<boolean> {
    try {
      const res = await this.call('DELETE', `/invites/${id}`);
      if (res.ok) await this.loadInvites();
      return res.ok;
    } catch {
      return false;
    }
  }

  async setEnabled(type: NotificationType, on: boolean): Promise<void> {
    if (!this.state) return;
    this.state = { ...this.state, disabled: { ...this.state.disabled, [type]: !on } };
    await this.repo.setNotifyState(this.state);
    this.scheduleSync(true);
  }

  async sendTest(): Promise<boolean> {
    const res = await this.call('POST', '/test');
    return res.ok && ((await res.json()) as { result: string }).result === 'sent';
  }

  /** Programa una sincronización. Los cambios urgentes (descanso) se envían al momento. */
  scheduleSync(urgent = false): void {
    if (!this.state) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), urgent ? 0 : DEBOUNCE_MS);
  }

  /** Envía al worker la lista completa de avisos (sustituye a la anterior). */
  sync(): Promise<void> {
    this.syncing = this.syncing.then(async () => {
      if (!this.state) return;
      const jobs = planNotifications({
        now: new Date(),
        data: this.store.data,
        schedule: this.store.schedule,
        lastExportAt: this.store.meta.lastExportAt,
        disabled: this.state.disabled,
        cfg: this.store.cfg,
      }).map(({ id, fireAt, title, body }) => ({ id, fireAt, title, body }));
      try {
        const res = await this.call('PUT', '/jobs', { jobs });
        if (res.status === 401) {
          // El servidor ya no reconoce el dispositivo (p. ej. se desinstaló la suscripción).
          this.state = null;
          await this.repo.setNotifyState(null);
        }
      } catch (e) {
        console.warn('No se han podido sincronizar los avisos', e);
      }
    });
    return this.syncing;
  }

  private call(method: string, path: string, body?: unknown, state = this.state): Promise<Response> {
    if (!state) return Promise.reject(new Error('Notificaciones desactivadas'));
    return fetch(`${PUSH_SERVER_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${state.deviceId}.${state.secret}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
}
