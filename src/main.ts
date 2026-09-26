import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './styles/main.css';
import { Store } from './app/store';
import { IdbRepository } from './data/idb-repository';
import { App } from './ui/app';

async function main(): Promise<void> {
  let app: App | undefined;
  const onSaveError = (e: unknown) => {
    console.error(e);
    app?.toast('No se ha podido guardar. Exporta una copia desde Checks.');
  };
  const repo = await IdbRepository.open();
  const store = await Store.load(repo, onSaveError);
  app = new App(store);
  app.start();
}

main().catch((e) => {
  console.error(e);
  const el = document.querySelector('#app');
  if (el) el.innerHTML = '<div class="empty">No se ha podido abrir el almacenamiento del dispositivo. Cierra la app y vuelve a abrirla.</div>';
});
