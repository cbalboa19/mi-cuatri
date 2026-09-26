import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './styles/main.css';
import { Store } from './app/store';
import { IdbRepository } from './data/idb-repository';
import { App } from './ui/app';
import { installBackupHandlers, renderDataSection } from './ui/backup';

async function main(): Promise<void> {
  let app: App | undefined;
  const onSaveError = (e: unknown) => {
    console.error(e);
    app?.toast('No se ha podido guardar. Exporta una copia desde Checks.');
  };
  const repo = await IdbRepository.open();
  const store = await Store.load(repo, onSaveError);
  app = new App(store);
  app.extend('checks', renderDataSection);
  installBackupHandlers(app);
  app.start();
  // Pide al navegador que no borre los datos si falta espacio.
  void navigator.storage?.persist?.().catch(() => {});
}

main().catch((e) => {
  console.error(e);
  const el = document.querySelector('#app');
  if (el) el.innerHTML = '<div class="empty">No se ha podido abrir el almacenamiento del dispositivo. Cierra la app y vuelve a abrirla.</div>';
});
