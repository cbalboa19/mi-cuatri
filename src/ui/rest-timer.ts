// Temporizador de descanso. El fin del descanso se guarda en el entreno en curso, así que
// sobrevive a que iOS cierre la app en segundo plano.

import type { Store } from '../app/store';
import { fmtClock } from './format';
import { $ } from './html';

export class RestTimer {
  private iv: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly store: Store,
    private readonly toast: (msg: string) => void,
  ) {
    $('#restPlus')!.addEventListener('click', () => this.shift(15_000));
    $('#restMinus')!.addEventListener('click', () => this.shift(-15_000));
    $('#restSkip')!.addEventListener('click', () => {
      this.store.setRest(Date.now());
      this.tick();
    });
  }

  start(sec: number): void {
    this.store.setRest(Date.now() + sec * 1000);
    this.sync();
  }

  /** Muestra u oculta el temporizador según el entreno en curso (al arrancar o volver a la app). */
  sync(): void {
    const end = this.store.active?.restEndsAt;
    if (end == null) return this.hide();
    if (end <= Date.now()) {
      // Terminó mientras la app estaba cerrada o en segundo plano.
      this.store.setRest(null);
      return this.hide();
    }
    $('#rest')!.classList.add('show');
    clearInterval(this.iv);
    this.iv = setInterval(() => this.tick(), 250);
    this.tick();
  }

  private shift(ms: number): void {
    const end = this.store.active?.restEndsAt;
    if (end == null) return;
    this.store.setRest(end + ms);
    this.tick();
  }

  private tick(): void {
    const end = this.store.active?.restEndsAt;
    if (end == null) return this.hide();
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    $('#restT')!.textContent = fmtClock(left);
    if (left <= 0) {
      this.store.setRest(null);
      this.hide();
      this.toast('Descanso terminado');
    }
  }

  private hide(): void {
    clearInterval(this.iv);
    this.iv = undefined;
    $('#rest')!.classList.remove('show');
  }
}
