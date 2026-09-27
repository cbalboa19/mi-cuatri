// Sección "Notificaciones" (en Checks): activar (con la clave o con un código de invitación),
// elegir tipos de aviso, probar y desactivar. El dueño además crea y revoca invitaciones.

import { NOTIFICATION_TYPES, NOTIFY, type NotificationType } from '../config/notifications';
import type { Config } from '../domain/config';
import type { NotifyClient } from '../app/notify';
import type { Store } from '../app/store';
import type { App } from './app';
import { fmtDate } from './format';
import { esc } from './html';

const APP_URL = 'https://cbalboa19.github.io/mi-cuatri/';

/** Código recién creado (solo se muestra una vez, hasta que se cierre). */
let lastCode: { code: string; label: string } | null = null;

/** Tipos de aviso que tienen sentido con la configuración de este dispositivo. */
function relevantTypes(cfg: Config): typeof NOTIFICATION_TYPES {
  const daily = Object.values(cfg.checklists.daily).flat();
  const has = (id: string) => daily.some((i) => i.id === id);
  return NOTIFICATION_TYPES.filter(({ id }) => {
    if (id === 'creatina') return has(NOTIFY.creatina.item);
    if (id === 'plan-week') return cfg.checklists.daily.sunday.some((i) => i.id === NOTIFY.planWeek.item);
    if (id === 'peso') return cfg.checklists.weighDays.length > 0;
    if (id === 'gym') return cfg.routines.some((r) => r.day != null);
    return true;
  });
}

function invitesSection(notify: NotifyClient): string {
  if (notify.invites == null) {
    void notify.loadInvites();
    return `<h2>Invitaciones</h2><div class="list"><div class="empty">Cargando…</div></div>`;
  }
  const fresh = lastCode
    ? `<div class="list" style="margin-bottom:10px;border-color:var(--accent)"><div class="stat" style="flex-direction:column;align-items:flex-start;gap:6px"><span>Código para <b>${esc(lastCode.label)}</b> (solo se muestra ahora):</span><b style="font-family:var(--display);font-size:26px;letter-spacing:.04em">${esc(lastCode.code)}</b><span class="sub">Que abra la app desde el icono → Checks → Notificaciones y lo escriba.</span></div><div class="row" style="padding:0 14px 12px"><button class="btn sm" data-invite-share>Compartir</button><button class="btn sm ghost" data-invite-hide>Listo</button></div></div>`
    : '';
  const rows = notify.invites
    .map(
      (i) =>
        `<div class="hist"><div>${esc(i.label)}<small>${i.devices ? `${i.devices} ${i.devices === 1 ? 'móvil' : 'móviles'}` : 'Aún sin usar'} · creada el ${esc(fmtDate(i.createdAt, { day: 'numeric', month: 'short' }))}</small></div><button class="btn sm ghost" data-invite-revoke="${esc(i.id)}" data-label="${esc(i.label)}">Revocar</button></div>`,
    )
    .join('');
  return `<h2>Invitaciones</h2>${fresh}
    <div class="list">${rows || '<div class="empty">Nadie más recibe avisos. Crea un código para quien quieras.</div>'}</div>
    <form class="field" data-invite-new style="margin-top:10px"><input id="inviteLabel" placeholder="Para quién (p. ej. Mamá)" maxlength="40" autocomplete="off"><button class="btn sm" type="submit">Crear código</button></form>
    <p class="sub">Cada código sirve para hasta 3 móviles de esa persona. Si lo revocas, deja de recibir avisos al momento.</p>`;
}

export function renderNotificationsSection(notify: NotifyClient): (store: Store, now: Date) => string {
  return (store) => {
    const status = notify.status;
    const head = '<h2>Notificaciones</h2>';
    if (status === 'not-installed' || status === 'unsupported') {
      return `${head}<div class="list"><div class="empty">Para recibir avisos, abre la app desde el icono de la pantalla de inicio.</div></div>`;
    }
    if (status === 'denied') {
      return `${head}<div class="list"><div class="empty">Las notificaciones están bloqueadas. Actívalas para Mi cuatri en los ajustes de notificaciones del móvil.</div></div>`;
    }
    if (status === 'off') {
      const owner = store.hasProfile;
      const text = owner
        ? 'Avisos como el fin del descanso o si se te olvida algo de la checklist.'
        : 'Si alguien te ha dado un código de invitación, escríbelo para recibir avisos (fin del descanso, entreno del día…).';
      return `${head}<div class="list"><div class="empty">${text}</div><form class="field" data-notify-on style="padding:0 14px 14px"><input id="notifyKey" type="${owner ? 'password' : 'text'}" autocomplete="${owner ? 'current-password' : 'off'}" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${owner ? 'Tu clave' : 'Código de invitación'}" aria-label="${owner ? 'Tu clave' : 'Código de invitación'}"><button class="btn sm" type="submit">Activar</button></form></div>`;
    }
    const rows = relevantTypes(store.cfg)
      .map(({ id, label, hint }) => {
        const on = notify.isEnabled(id);
        return `<button class="item toggle ${on ? 'done' : ''}" data-notify-type="${esc(id)}" aria-pressed="${on}"><span class="box"></span><span class="lbl">${esc(label)}<div class="hint">${esc(hint)}</div></span></button>`;
      })
      .join('');
    const invites = notify.isOwner(store.hasProfile) ? invitesSection(notify) : '';
    return `${head}<div class="list">${rows}</div><div class="row" style="margin-top:10px"><button class="btn ghost" data-notify-test>Probar</button><button class="btn ghost" data-notify-off>Desactivar</button></div>${invites}`;
  };
}

export function installNotificationHandlers(app: App, notify: NotifyClient): void {
  notify.onUpdate = () => {
    if (app.ui.tab === 'checks' && !app.ui.editor) app.render();
  };

  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (form.hasAttribute('data-notify-on')) {
      e.preventDefault();
      const input = form.querySelector<HTMLInputElement>('#notifyKey');
      const secret = input?.value ?? '';
      if (!secret.trim()) return app.toast(app.store.hasProfile ? 'Escribe tu clave' : 'Escribe el código');
      // enable() pide el permiso al momento: tiene que ir antes de cualquier espera.
      const result = notify.enable(secret);
      input?.blur();
      void result.then((r) => {
        const msg = {
          ok: 'Notificaciones activadas',
          denied: 'Has bloqueado las notificaciones',
          'bad-key': app.store.hasProfile ? 'Clave incorrecta' : 'Código no válido',
          error: 'No se han podido activar. Inténtalo con conexión.',
        }[r];
        app.render();
        app.toast(msg);
      });
      return;
    }
    if (form.hasAttribute('data-invite-new')) {
      e.preventDefault();
      const input = form.querySelector<HTMLInputElement>('#inviteLabel');
      const label = input?.value.trim() ?? '';
      if (!label) return app.toast('Escribe para quién es');
      input?.blur();
      void notify.createInvite(label).then((r) => {
        if (r === 'limit') return app.toast('Has llegado al máximo de invitaciones');
        if (r === 'error') return app.toast('No se ha podido crear. Inténtalo con conexión.');
        lastCode = r;
        app.render();
      });
    }
  });

  document.addEventListener('click', (e) => {
    const t = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!t) return;
    if (t.dataset.notifyType) {
      const type = t.dataset.notifyType as NotificationType;
      void notify.setEnabled(type, !notify.isEnabled(type)).then(() => app.render());
    } else if (t.hasAttribute('data-notify-test')) {
      app.toast('Enviando aviso de prueba…');
      notify
        .sendTest()
        .then((ok) => app.toast(ok ? 'Aviso enviado' : 'No se ha podido enviar'))
        .catch(() => app.toast('Sin conexión con el servidor de avisos'));
    } else if (t.hasAttribute('data-notify-off')) {
      if (!confirm('¿Desactivar las notificaciones en este dispositivo?')) return;
      void notify.disable().then(() => {
        app.render();
        app.toast('Notificaciones desactivadas');
      });
    } else if (t.hasAttribute('data-invite-share') && lastCode) {
      const text = `Tu código para recibir avisos en Mi cuatri: ${lastCode.code}\nÁbrela desde el icono → Checks → Notificaciones.\n${APP_URL}`;
      if (navigator.share) void navigator.share({ text }).catch(() => {});
      else void navigator.clipboard?.writeText(text).then(() => app.toast('Copiado'));
    } else if (t.hasAttribute('data-invite-hide')) {
      lastCode = null;
      app.render();
    } else if (t.dataset.inviteRevoke) {
      if (!confirm(`¿Revocar la invitación de «${t.dataset.label}»? Dejará de recibir avisos.`)) return;
      void notify.revokeInvite(t.dataset.inviteRevoke).then((ok) => {
        app.render();
        app.toast(ok ? 'Invitación revocada' : 'No se ha podido revocar');
      });
    }
  });
}
