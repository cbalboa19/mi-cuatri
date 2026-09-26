// Sección "Datos" (al final de Checks): exportar e importar la copia de seguridad.

import type { ExportResult, Store } from '../app/store';
import type { App } from './app';
import { $ } from './html';

function lastExportText(days: number | null): string {
  if (days == null) return 'Nunca';
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return `Hace ${days} días`;
}

export function renderDataSection(store: Store, now: Date): string {
  const t = now.getTime();
  const need = store.needsBackup(t);
  // Se precalcula para que al pulsar "Exportar" la hoja de compartir se abra al instante.
  void store.warmExport().catch(() => {});
  return `<h2>Datos</h2><div class="list"><div class="stat"><span>Última copia</span><b class="${need ? 'reminder' : ''}">${lastExportText(store.daysSinceExport(t))}</b></div><div class="stat"><span>Guardado</span><b>${store.synced ? 'En tu cuenta' : 'En este dispositivo'}</b></div></div>
    <div class="row" style="margin-top:10px"><button class="btn ghost" data-export>Exportar copia</button><button class="btn ghost" data-import>Importar copia</button></div>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
    <p class="sub">Tus datos solo están en este móvil: si borras la app, se pierden. Guarda la copia en Archivos o iCloud Drive de vez en cuando.</p>
    <p class="sub" style="font-size:12px">Mi cuatri v${__APP_VERSION__}</p>`;
}

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Abre la hoja de compartir (iOS: "Guardar en Archivos") o descarga el archivo. */
async function deliver(result: ExportResult): Promise<boolean> {
  const file = new File([result.json], result.name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Copia de Mi cuatri' });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false;
      // NotAllowedError u otros: se descarga como alternativa.
    }
  }
  download(file);
  return true;
}

export function installBackupHandlers(app: App): void {
  const { store } = app;

  document.addEventListener('click', (e) => {
    const t = (e.target as Element).closest('button');
    if (!t) return;
    if (t.hasAttribute('data-export')) {
      const cached = store.cachedExport();
      const run = async () => {
        const result = cached ?? (await store.exportBackup(new Date()));
        if (!(await deliver(result))) return;
        await store.markExported(Date.now());
        app.render();
        app.toast('Copia exportada');
      };
      run().catch((err) => {
        console.error(err);
        app.toast('No se ha podido exportar la copia');
      });
    } else if (t.hasAttribute('data-import')) {
      $<HTMLInputElement>('#importFile')?.click();
    }
  });

  document.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.id !== 'importFile' || !input.files?.[0]) return;
    const file = input.files[0];
    input.value = '';
    file
      .text()
      .then(async (text) => {
        const prep = store.prepareImport(text);
        if (!prep.ok) return app.toast(prep.error);
        if (!confirm(`Se sustituirán TODOS tus datos por los de la copia (${prep.summary}). ¿Continuar?`)) return;
        await prep.apply();
        app.refresh();
        app.toast('Copia importada');
      })
      .catch((err) => {
        console.error(err);
        app.toast('No se ha podido importar la copia');
      });
  });
}
