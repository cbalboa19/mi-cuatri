// Sección "Notificaciones" (en Checks): activar, elegir tipos de aviso, probar y desactivar.

import { NOTIFICATION_TYPES, type NotificationType } from '../config/notifications';
import type { NotifyClient } from '../app/notify';
import type { Store } from '../app/store';
import type { App } from './app';
import { esc } from './html';

export function renderNotificationsSection(notify: NotifyClient): (store: Store, now: Date) => string {
  return (store) => {
    // Sin perfil (clave) no hay notificaciones: el servidor pide la clave para registrarse.
    if (!store.hasProfile) return '';
    const status = notify.status;
    const head = '<h2>Notificaciones</h2>';
    if (status === 'not-installed' || status === 'unsupported') {
      return `${head}<div class="list"><div class="empty">Para recibir avisos, abre la app desde el icono de la pantalla de inicio.</div></div>`;
    }
    if (status === 'denied') {
      return `${head}<div class="list"><div class="empty">Las notificaciones están bloqueadas. Actívalas para Mi cuatri en los ajustes de notificaciones del móvil.</div></div>`;
    }
    if (status === 'off') {
      return `${head}<div class="list"><div class="empty">Avisos como el fin del descanso o si se te olvida la creatina.</div><form class="field" data-notify-on style="padding:0 14px 14px"><input id="notifyKey" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Tu clave" aria-label="Tu clave"><button class="btn sm" type="submit">Activar</button></form></div>`;
    }
    const rows = NOTIFICATION_TYPES.map(({ id, label, hint }) => {
      const on = notify.isEnabled(id);
      return `<button class="item ${on ? 'done' : ''}" data-notify-type="${esc(id)}" aria-pressed="${on}"><span class="box"></span><span class="lbl">${esc(label)}<div class="hint">${esc(hint)}</div></span></button>`;
    }).join('');
    return `${head}<div class="list">${rows}</div><div class="row" style="margin-top:10px"><button class="btn ghost" data-notify-test>Probar</button><button class="btn ghost" data-notify-off>Desactivar</button></div>`;
  };
}

export function installNotificationHandlers(app: App, notify: NotifyClient): void {
  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (!form.hasAttribute('data-notify-on')) return;
    e.preventDefault();
    const input = form.querySelector<HTMLInputElement>('#notifyKey');
    const password = input?.value ?? '';
    if (!password.trim()) return app.toast('Escribe tu clave');
    // enable() pide el permiso al momento: tiene que ir antes de cualquier espera.
    const result = notify.enable(password);
    input?.blur();
    void result.then((r) => {
      const msg = {
        ok: 'Notificaciones activadas',
        denied: 'Has bloqueado las notificaciones',
        'bad-key': 'Clave incorrecta',
        error: 'No se han podido activar. Inténtalo con conexión.',
      }[r];
      app.render();
      app.toast(msg);
    });
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
    }
  });
}
