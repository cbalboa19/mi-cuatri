// Montaje de la interfaz: render, pestañas y eventos (delegación).

import { newId } from '../domain/config';
import { dayDiff, dow, parseYmd, ymd } from '../domain/dates';
import { isValidWeight } from '../domain/weight';
import { parseNum, workoutVolume } from '../domain/workout';
import type { CheckScope, ExerciseDef } from '../domain/types';
import type { Store } from '../app/store';
import { fmtClock, fmtDur, fmtNum } from './format';
import { $ } from './html';
import { RestTimer } from './rest-timer';
import { initialUiState, saveTab, type TabKey, type UiState } from './state';
import { renderChecks } from './views/checks';
import { renderGym } from './views/gym';
import { renderHorario } from './views/horario';
import { renderHoy } from './views/hoy';
import { renderProgreso } from './views/progreso';

const TABS: [TabKey, string, string][] = [
  ['hoy', 'Hoy', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'],
  ['horario', 'Horario', '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
  ['gym', 'Gym', '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'],
  ['progreso', 'Progreso', '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>'],
  ['checks', 'Checks', '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 12.5l2.5 2.5L16 9.5"/>'],
];

/** Secciones extra que se pintan al final de una pestaña (p. ej. Datos en Checks). */
export type Extension = (store: Store, now: Date) => string;
/** Pinta el editor abierto (ui.editor). */
export type EditorRenderer = (store: Store, ui: UiState, now: Date) => string;

const MAX_REST_SEC = 900;

export class App {
  readonly ui: UiState;
  readonly rest: RestTimer;
  private lastDay: string;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly extensions: Partial<Record<TabKey, Extension[]>> = {};
  private editorRenderer: EditorRenderer | null = null;

  constructor(readonly store: Store) {
    const now = new Date();
    this.ui = initialUiState(now);
    this.lastDay = ymd(now);
    this.rest = new RestTimer(store, (m) => this.toast(m));
  }

  extend(tab: TabKey, ext: Extension): void {
    (this.extensions[tab] ??= []).push(ext);
  }

  setEditorRenderer(r: EditorRenderer): void {
    this.editorRenderer = r;
  }

  start(): void {
    document.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('input', (e) => this.onInput(e));
    document.addEventListener('change', (e) => this.onChange(e));
    document.addEventListener('submit', (e) => this.onSubmit(e));
    // Al volver a la app (o si queda abierta de un día para otro) se refresca todo.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.refresh();
    });
    setInterval(() => this.tickClock(), 1000);
    setInterval(() => {
      const live = (this.ui.tab === 'hoy' || this.ui.tab === 'horario') && !this.ui.editor;
      if (this.dayChanged() || (live && !this.editing())) this.render();
    }, 60_000);
    this.render();
    this.rest.sync();
  }

  refresh(): void {
    this.dayChanged();
    if (!this.editing()) this.render();
    this.rest.sync();
  }

  /** Si ha cambiado el día, las vistas vuelven a hoy. */
  private dayChanged(): boolean {
    const now = new Date();
    const today = ymd(now);
    if (today === this.lastDay) return false;
    this.lastDay = today;
    Object.assign(this.ui, { viewDay: dow(now), weightDate: null, dayOffset: 0, weekOffset: 0, monthOffset: 0 });
    return true;
  }

  private editing(): boolean {
    return !!document.activeElement?.matches('input, select, textarea');
  }

  toast(msg: string): void {
    const t = $('#toast')!;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  private renderTabs(now: Date): void {
    const badge = this.store.needsBackup(now.getTime());
    $('#tabs')!.innerHTML = TABS.map(
      ([k, l, ic]) =>
        `<button data-tab="${k}" ${this.ui.tab === k ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg>${l}${k === 'checks' && badge ? '<span class="badge" title="Copia de seguridad pendiente"></span>' : ''}</button>`,
    ).join('');
  }

  render(): void {
    const now = new Date();
    this.renderTabs(now);
    const { store, ui } = this;
    const views: Record<TabKey, () => string> = {
      hoy: () => renderHoy(store, ui, now),
      horario: () => renderHorario(store, ui, now),
      gym: () => renderGym(store, now),
      progreso: () => renderProgreso(store, ui, now),
      checks: () => renderChecks(store, ui, now),
    };
    const a = document.activeElement as HTMLElement | null;
    const focusSel = a?.dataset?.in ? `[data-in="${a.dataset.in}"][data-e="${a.dataset.e}"][data-s="${a.dataset.s}"]` : null;
    if (ui.editor && this.editorRenderer) {
      $('#app')!.innerHTML = this.editorRenderer(store, ui, now);
    } else {
      const extra = (this.extensions[ui.tab] ?? []).map((ext) => ext(store, now)).join('');
      $('#app')!.innerHTML = views[ui.tab]() + extra;
    }
    if (focusSel) $<HTMLInputElement>(focusSel)?.focus();
    this.tickClock();
  }

  private tickClock(): void {
    const c = $('#clock');
    const active = this.store.active;
    if (c && active) c.textContent = fmtClock(Math.floor((Date.now() - active.startedAt) / 1000));
  }

  goTab(tab: TabKey): void {
    this.ui.tab = tab;
    this.ui.editor = null;
    saveTab(tab);
    this.render();
    window.scrollTo(0, 0);
  }

  private onInput(e: Event): void {
    const i = e.target as HTMLInputElement;
    if (!i.dataset.in || !this.store.active) return;
    this.store.setSetField(Number(i.dataset.e), Number(i.dataset.s), i.dataset.in as 'kg' | 'reps', i.value.replace(',', '.'));
  }

  private onSubmit(e: Event): void {
    const form = e.target as HTMLFormElement;
    if (form.hasAttribute('data-add-ex')) return this.onAddExercise(e, form);
    if (!form.hasAttribute('data-unlock')) return;
    e.preventDefault();
    const input = form.querySelector<HTMLInputElement>('#schedKey');
    const password = input?.value ?? '';
    if (!password.trim()) return this.toast('Escribe la clave');
    input?.blur();
    this.toast('Desbloqueando…');
    this.store
      .unlockSchedule(password)
      .then((ok) => {
        if (!ok) return this.toast('Clave incorrecta');
        this.render();
        this.toast('Perfil cargado');
      })
      .catch((err) => {
        console.error(err);
        this.toast('No se ha podido cargar el perfil');
      });
  }

  /** Añade un ejercicio al entreno en curso (de una rutina o uno nuevo). */
  private onAddExercise(e: Event, form: HTMLFormElement): void {
    e.preventDefault();
    const { store } = this;
    const val = (sel: string) => form.querySelector<HTMLInputElement>(sel)?.value ?? '';
    const chosen = val('#addExSel');
    const name = val('#addExName').trim();
    const sets = Math.round(parseNum(val('#addExSets')));
    const rest = Math.round(parseNum(val('#addExRest')));
    const save = form.querySelector<HTMLInputElement>('#addExSave')?.checked ?? false;
    if (!(sets >= 1 && sets <= 10)) return this.toast('Series entre 1 y 10');
    if (!(rest >= 0 && rest <= MAX_REST_SEC)) return this.toast(`Descanso entre 0 y ${MAX_REST_SEC} s`);
    const base = chosen ? store.findExercise(chosen) : undefined;
    if (!base && !name) return this.toast('Elige un ejercicio o escribe uno nuevo');
    const def: ExerciseDef = base
      ? { ...base, sets, restSec: rest }
      : { id: newId('ex'), name, sets, reps: [8, 12], rir: '1-2', restSec: rest, incrementKg: 2.5 };
    store.addExerciseToActive(def, sets, save);
    this.render();
    this.toast('Ejercicio añadido');
  }

  private onChange(e: Event): void {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (t.dataset.exrest != null) {
      const v = Math.round(parseNum(t.value));
      if (!(v >= 0 && v <= MAX_REST_SEC)) return this.toast(`Descanso entre 0 y ${MAX_REST_SEC} s`);
      this.store.setExerciseRest(Number(t.dataset.exrest), v, false);
      this.render();
      return this.toast('Descanso cambiado para este entreno');
    }
    if (t.id === 'exSel') {
      this.ui.progEx = t.value;
      this.render();
    } else if (t.id === 'wDate') {
      const kgInput = $<HTMLInputElement>('#wIn')?.value ?? '';
      this.ui.weightDate = t.value && t.value !== ymd(new Date()) ? t.value : null;
      this.render();
      const wIn = $<HTMLInputElement>('#wIn');
      if (wIn) wIn.value = kgInput;
    }
  }

  private onClick(e: Event): void {
    const target = e.target as Element;
    const tabBtn = target.closest<HTMLElement>('[data-tab]');
    if (tabBtn) return this.goTab(tabBtn.dataset.tab as TabKey);
    const t = target.closest<HTMLButtonElement>('button');
    if (!t) return;
    const { store } = this;
    const ds = t.dataset;

    if (ds.start) {
      if (store.active && !confirm('Ya tienes un entreno en curso. ¿Descartarlo y empezar otro?')) return;
      store.startWorkout(ds.start, new Date());
      this.rest.sync();
      return this.goTab('gym');
    }
    if (t.hasAttribute('data-go-workout')) return this.goTab('gym');

    // ---------- Entreno en curso ----------
    if (t.hasAttribute('data-tick')) {
      const ei = Number(ds.e), si = Number(ds.s);
      const r = store.toggleSet(ei, si);
      if (!r) return;
      if (!r.ok) return this.toast('Pon las repeticiones');
      if (r.completed && !store.active!.editOf) this.rest.start(store.restFor(ei));
      return this.render();
    }
    if (ds.addset != null) {
      store.addSet(Number(ds.addset));
      return this.render();
    }
    if (ds.delset != null) {
      store.removeSet(Number(ds.delset));
      return this.render();
    }
    if (ds.exmove != null) {
      store.moveExerciseInActive(Number(ds.exmove), ds.dir === '-1' ? -1 : 1);
      return this.render();
    }
    if (ds.exremove != null) {
      const ex = store.active?.exercises[Number(ds.exremove)];
      if (ex && confirm(`¿Quitar «${ex.name}» de este entreno?`)) {
        store.removeExerciseFromActive(Number(ds.exremove));
        this.render();
      }
      return;
    }
    if (ds.exrestSave != null) {
      const ei = Number(ds.exrestSave);
      const v = Math.round(parseNum($<HTMLInputElement>(`[data-exrest="${ei}"]`)?.value ?? ''));
      if (!(v >= 0 && v <= MAX_REST_SEC)) return this.toast(`Descanso entre 0 y ${MAX_REST_SEC} s`);
      store.setExerciseRest(ei, v, true);
      this.render();
      return this.toast('Descanso guardado en la rutina');
    }
    if (t.hasAttribute('data-finish')) {
      const editing = !!store.active?.editOf;
      const w = store.finishWorkout(Date.now());
      if (!w) return this.toast('Marca al menos una serie');
      this.rest.sync();
      this.toast(editing ? 'Cambios guardados' : `Entreno guardado · ${fmtDur(w.durationSec)} · ${fmtNum(Math.round(workoutVolume(w)))} kg`);
      return editing ? this.goTab('progreso') : this.render();
    }
    if (t.hasAttribute('data-discard')) {
      const editing = !!store.active?.editOf;
      if (confirm(editing ? '¿Salir sin guardar los cambios?' : '¿Descartar este entreno? No se guardará.')) {
        store.discardWorkout();
        this.rest.sync();
        if (editing) return this.goTab('progreso');
        this.render();
      }
      return;
    }
    if (ds.editw) {
      if (!store.editWorkout(ds.editw)) return this.toast('Termina o descarta primero el entreno en curso');
      return this.goTab('gym');
    }

    // ---------- Navegación entre días, semanas y meses ----------
    if (ds.daynav != null) {
      this.ui.dayOffset = Math.min(0, this.ui.dayOffset + Number(ds.daynav));
      return this.render();
    }
    if (t.hasAttribute('data-daynav-today')) {
      this.ui.dayOffset = 0;
      return this.render();
    }
    if (ds.weeknav != null) {
      this.ui.weekOffset = Math.min(0, this.ui.weekOffset + Number(ds.weeknav));
      return this.render();
    }
    if (ds.monthnav != null) {
      this.ui.monthOffset = Math.min(0, this.ui.monthOffset + Number(ds.monthnav));
      return this.render();
    }
    if (ds.openday) {
      this.ui.dayOffset = Math.min(0, dayDiff(new Date(), parseYmd(ds.openday)));
      return this.goTab('hoy');
    }
    if (ds.day != null) {
      this.ui.viewDay = Number(ds.day) as UiState['viewDay'];
      return this.render();
    }

    // ---------- Checklists y ajustes ----------
    if (ds.chk) {
      const list = t.closest<HTMLElement>('.list');
      if (!list?.dataset.store || list.dataset.key == null) return;
      store.toggleCheck(list.dataset.store as CheckScope, list.dataset.key, ds.chk);
      return this.render();
    }
    if (ds.auto) {
      return this.toast(ds.auto.includes('gym') ? 'Se marca solo al guardar un entreno' : 'Se marca solo al registrar tu peso');
    }
    if (ds.seg) {
      this.ui.checkSeg = ds.seg === 'mes' ? 'mes' : 'semana';
      return this.render();
    }
    if (t.hasAttribute('data-exam')) {
      store.setExamMode(!store.data.settings.examMode);
      this.render();
      return this.toast(store.data.settings.examMode ? 'Modo exámenes activado' : 'Modo exámenes desactivado');
    }

    // ---------- Peso e historial ----------
    if (t.hasAttribute('data-addw')) {
      const v = parseNum($<HTMLInputElement>('#wIn')?.value ?? '');
      if (!isValidWeight(v)) return this.toast('Escribe tu peso en kg, p. ej. 64,5');
      store.setWeight(this.ui.weightDate ?? ymd(new Date()), v);
      this.ui.weightDate = null;
      this.toast('Peso guardado');
      return this.render();
    }
    if (ds.delweight) {
      if (confirm('¿Borrar este pesaje?')) {
        store.deleteWeight(ds.delweight);
        this.render();
      }
      return;
    }
    if (ds.delw) {
      if (confirm('¿Borrar este entreno del historial?')) {
        store.deleteWorkout(ds.delw);
        this.render();
      }
      return;
    }
  }
}
