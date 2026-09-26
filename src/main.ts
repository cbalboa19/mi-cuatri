import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './styles/main.css';
import { NotifyClient } from './app/notify';
import { Store } from './app/store';
import { IdbRepository } from './data/idb-repository';
import { App } from './ui/app';
import { installBackupHandlers, renderDataSection } from './ui/backup';
import { installEditorHandlers, renderEditor } from './ui/editors';
import { installNotificationHandlers, renderNotificationsSection } from './ui/notifications';

async function main(): Promise<void> {
  let app: App | undefined;
  const onSaveError = (e: unknown) => {
    console.error(e);
    app?.toast('No se ha podido guardar. Exporta una copia desde Checks.');
  };
  const repo = await IdbRepository.open();
  const store = await Store.load(repo, onSaveError);
  const notify = await NotifyClient.load(repo, store);
  store.onChange = (urgent) => notify.scheduleSync(urgent);
  app = new App(store);
  app.extend('checks', renderNotificationsSection(notify));
  app.extend('checks', renderDataSection);
  app.setEditorRenderer((s, ui) => renderEditor(s, ui));
  installEditorHandlers(app);
  installNotificationHandlers(app, notify);
  installBackupHandlers(app);
  app.start();
  // Al abrir o volver a la app se reprograman los avisos (p. ej. los de los próximos días).
  notify.scheduleSync();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') notify.scheduleSync();
  });
  // Cuando se instala una versión nueva de la app, se recarga para usarla (los datos ya están guardados).
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  }
  // Pide al navegador que no borre los datos si falta espacio.
  void navigator.storage?.persist?.().catch(() => {});
}

main().catch((e) => {
  console.error(e);
  const el = document.querySelector('#app');
  if (el) el.innerHTML = '<div class="empty">No se ha podido abrir el almacenamiento del dispositivo. Cierra la app y vuelve a abrirla.</div>';
});
