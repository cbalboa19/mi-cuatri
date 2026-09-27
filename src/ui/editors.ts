// Editores: rutinas y ejercicios, checklists, horario y ajustes. Se abren en lugar de la pestaña
// (ui.editor) y guardan cada cambio al momento en la configuración del usuario.

import { CATEGORY_LABELS } from '../config/schedule';
import { newId, type Config, type NotifyTimes, type UserConfig } from '../domain/config';
import { pad, toMin } from '../domain/dates';
import { DAY_NAMES } from '../domain/locale';
import { CATEGORIES, type SchedulePayload } from '../domain/schedule';
import { moveItem, parseNum } from '../domain/workout';
import type { Category, ChecklistItem, DayIndex, DayType, ExerciseDef, RoutineDef } from '../domain/types';
import type { Store } from '../app/store';
import type { App } from './app';
import { editorHeader, scheduleLock } from './components';
import { esc } from './html';
import type { Editor, UiState } from './state';

type ListKey = DayType | 'weekly' | 'monthly';

const DAY_TYPE_LABELS: Record<DayType, string> = { weekday: 'L-J', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo' };
const DAY_TYPES: DayType[] = ['weekday', 'friday', 'saturday', 'sunday'];

const eicon = (attrs: string, label: string, glyph: string, danger = false) =>
  `<button class="eicon${danger ? ' danger' : ''}" ${attrs} aria-label="${esc(label)}">${glyph}</button>`;

// ---------- Rutinas ----------

function renderRoutineEditor(store: Store, id: string): string {
  const r = store.cfg.routines.find((x) => x.id === id);
  if (!r) return `${editorHeader('Rutina')}<div class="empty">Esta rutina ya no existe.</div>`;
  const days = `<option value="" ${r.day == null ? 'selected' : ''}>Sin día fijo</option>${DAY_NAMES.map((n, i) => `<option value="${i}" ${r.day === i ? 'selected' : ''}>${n}</option>`).join('')}`;
  const exs = r.exercises
    .map((e, i) => {
      const f = (field: string, label: string, value: string | number, mode = 'numeric') =>
        `<label>${label}<input inputmode="${mode}" data-ex-field="${field}" data-ex="${esc(e.id)}" value="${esc(value)}"></label>`;
      return `<div class="list" style="margin-bottom:10px">
        <div class="erow"><input class="einput" data-ex-field="name" data-ex="${esc(e.id)}" value="${esc(e.name)}" aria-label="Nombre del ejercicio">${i > 0 ? eicon(`data-ex-move="${esc(e.id)}" data-dir="-1"`, 'Subir', '↑') : ''}${i < r.exercises.length - 1 ? eicon(`data-ex-move="${esc(e.id)}" data-dir="1"`, 'Bajar', '↓') : ''}${eicon(`data-ex-del="${esc(e.id)}"`, 'Borrar ejercicio', '✕', true)}</div>
        <div class="egrid">${f('sets', 'Series', e.sets)}${f('repsMin', 'Reps mín.', e.reps[0])}${f('repsMax', 'Reps máx.', e.reps[1])}${f('rir', 'RIR', e.rir, 'text')}${f('restSec', 'Descanso (s)', e.restSec)}${f('incrementKg', 'Subida (kg)', e.incrementKg, 'decimal')}</div>
      </div>`;
    })
    .join('');
  return `${editorHeader('Editar rutina')}
    <div class="list" style="margin-top:14px"><div class="egrid" style="grid-template-columns:1fr 1fr">
      <label class="full">Nombre<input data-rt-field="name" value="${esc(r.name)}"></label>
      <label class="full">Descripción<input data-rt-field="desc" value="${esc(r.desc)}" placeholder="Opcional"></label>
      <label>Día<select data-rt-field="day">${days}</select></label>
      <label>En exámenes<select data-rt-field="exam"><option value="1" ${r.exam ? 'selected' : ''}>Se mantiene</option><option value="0" ${!r.exam ? 'selected' : ''}>Se pausa</option></select></label>
    </div></div>
    <h2>Ejercicios</h2>${exs || '<p class="sub">Aún no hay ejercicios.</p>'}
    <button class="btn ghost" data-ex-add>+ Añadir ejercicio</button>
    <p class="sub">Si solo cambias el nombre de un ejercicio se conserva su historial. Los cambios se aplican a los próximos entrenos.</p>
    <button class="btn danger" data-rt-delete style="margin-top:10px">Borrar rutina</button>`;
}

function editRoutine(store: Store, id: string, fn: (r: RoutineDef) => void): void {
  store.updateConfig(['routines'], (c) => {
    const r = c.routines.find((x) => x.id === id);
    if (r) fn(r);
  });
}

function editExercise(store: Store, routineId: string, exId: string, fn: (e: ExerciseDef, r: RoutineDef) => void): void {
  editRoutine(store, routineId, (r) => {
    const e = r.exercises.find((x) => x.id === exId);
    if (e) fn(e, r);
  });
}

// ---------- Checklists ----------

function listOf(c: Config, key: ListKey): ChecklistItem[] {
  return key === 'weekly' ? c.checklists.weekly : key === 'monthly' ? c.checklists.monthly : c.checklists.daily[key];
}

function renderChecklistEditor(store: Store, key: ListKey): string {
  const items = listOf(store.cfg, key);
  const daily = key !== 'weekly' && key !== 'monthly';
  const title = key === 'weekly' ? 'Checklist semanal' : key === 'monthly' ? 'Checklist mensual' : 'Checklist diaria';
  const seg = daily
    ? `<div class="seg" role="group" style="margin-top:14px">${DAY_TYPES.map((t) => `<button data-cl-list="${t}" aria-pressed="${key === t}">${DAY_TYPE_LABELS[t]}</button>`).join('')}</div>`
    : '';
  const rows = items
    .map(
      (it, i) =>
        `<div class="erow"><input class="einput" data-cl-label="${esc(it.id)}" value="${esc(it.label)}" aria-label="Texto del ítem">${it.auto ? '<span class="hint" style="font-size:12px;color:var(--muted)">auto</span>' : ''}${i > 0 ? eicon(`data-cl-move="${esc(it.id)}" data-dir="-1"`, 'Subir', '↑') : ''}${i < items.length - 1 ? eicon(`data-cl-move="${esc(it.id)}" data-dir="1"`, 'Bajar', '↓') : ''}${eicon(`data-cl-del="${esc(it.id)}"`, 'Borrar ítem', '✕', true)}</div>`,
    )
    .join('');
  const weigh = daily
    ? `<h2>Días de pesaje</h2><div class="list"><div class="chips">${DAY_NAMES.map((n, i) => `<button data-weigh-day="${i}" aria-pressed="${store.cfg.checklists.weighDays.includes(i as DayIndex)}">${n.slice(0, 2)}</button>`).join('')}</div></div><p class="sub">Esos días se añade solo «Pesarme por la mañana».</p>`
    : '';
  const reset = store.isCustomized('checklists')
    ? `<button class="linkbtn" style="display:block;margin:14px auto 0;color:var(--muted)" data-reset="checklists">Restaurar todas las checklists originales</button>`
    : '';
  return `${editorHeader(title)}${seg}
    <div class="list" style="margin-top:14px">${rows || '<div class="empty">Lista vacía.</div>'}</div>
    <form class="field" data-cl-add style="margin-top:10px"><input id="clNew" placeholder="Nuevo ítem" autocomplete="off"><button class="btn sm" type="submit">Añadir</button></form>
    <p class="sub">Los ítems «auto» se marcan solos. Cambiar el texto de un ítem no borra lo que ya marcaste.</p>${weigh}${reset}`;
}

function editList(store: Store, key: ListKey, fn: (items: ChecklistItem[]) => void): void {
  store.updateConfig(['checklists'], (c) => fn(listOf(c, key)));
}

// ---------- Horario ----------

/** "06:45" → "6:45"; fin "00:00" → "24:00". */
function normTime(v: string, isEnd: boolean): string | null {
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  if (isEnd && h === 0 && min === 0) return '24:00';
  return `${h}:${pad(min)}`;
}

const toInputTime = (t: string): string => {
  const m = toMin(t === '24:00' ? '0:00' : t);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

function renderScheduleEditor(store: Store, day: DayIndex): string {
  // Sin horario todavía: se empieza con una semana vacía.
  const s = store.schedule ?? { labels: CATEGORY_LABELS, week: [[], [], [], [], [], [], []] };
  const days = `<div class="days" role="group" aria-label="Día" style="margin-top:14px">${DAY_NAMES.map((n, i) => `<button data-sch-day="${i}" aria-pressed="${day === i}">${n.slice(0, 2)}</button>`).join('')}</div>`;
  const cats = (sel: Category) => CATEGORIES.map((c) => `<option value="${c}" ${c === sel ? 'selected' : ''}>${esc(s.labels[c])}</option>`).join('');
  const blocks = (s.week[day] ?? [])
    .map(
      (b, i) => `<div class="list" style="margin-bottom:8px"><div class="egrid">
        <label>Inicio<input type="time" data-bl-field="start" data-bl="${i}" value="${toInputTime(b.start)}"></label>
        <label>Fin<input type="time" data-bl-field="end" data-bl="${i}" value="${toInputTime(b.end)}"></label>
        <label>Tipo<select data-bl-field="cat" data-bl="${i}">${cats(b.cat)}</select></label>
        <label class="full">Texto<input data-bl-field="label" data-bl="${i}" value="${esc(b.label)}"></label>
      </div><div class="erow" style="justify-content:flex-end"><button class="linkbtn" style="color:#D93025" data-bl-del="${i}">Borrar bloque</button></div></div>`,
    )
    .join('');
  const reset = store.isCustomized('schedule')
    ? `<button class="linkbtn" style="display:block;margin:14px auto 0;color:var(--muted)" data-reset="schedule">Volver al horario original</button>`
    : '';
  return `${editorHeader('Editar horario')}${days}<h2>${DAY_NAMES[day]}</h2>${blocks || '<p class="sub">Día sin bloques.</p>'}
    <button class="btn ghost" data-bl-add>+ Añadir bloque</button>
    <p class="sub">Los bloques se ordenan solos por hora. Tus cambios se guardan solo en este dispositivo (y en tus copias).</p>${reset}`;
}

function editDay(store: Store, day: DayIndex, fn: (blocks: SchedulePayload['week'][number]) => void): void {
  store.updateConfig(['schedule'], (c) => {
    if (!c.schedule) return;
    const blocks = c.schedule.week[day] ?? (c.schedule.week[day] = []);
    fn(blocks);
    blocks.sort((a, b) => toMin(a.start) - toMin(b.start));
  });
}

// ---------- Ajustes ----------

function renderSettingsEditor(store: Store): string {
  const c = store.cfg;
  const t = (k: 'creatina' | 'peso' | 'planWeek' | 'backup', label: string) =>
    `<label>${label}<input type="time" data-nt="${k}" value="${toInputTime(c.notifyTimes[k])}"></label>`;
  return `${editorHeader('Ajustes')}
    <h2>Plan</h2><div class="list"><div class="egrid" style="grid-template-columns:1fr">
      <label>Lunes de la semana 1 del plan<input type="date" data-set-start value="${esc(c.planStart ?? '')}"></label>
    </div></div>
    <p class="sub">Las fases (reentrada, descarga…) y las series se ajustan desde esa semana. Déjalo vacío si no sigues un plan por semanas.</p>
    ${
      store.hasProfile
        ? `<h2>Horas de los avisos</h2><div class="list"><div class="egrid" style="grid-template-columns:1fr 1fr">
      ${t('creatina', 'Creatina')}${t('peso', 'Pesarse')}${t('planWeek', 'Planificar semana (dom.)')}${t('backup', 'Copia de seguridad (dom.)')}
      <label>Aviso de gym (min antes)<input inputmode="numeric" data-nt-num="gymMinutesBefore" value="${c.notifyTimes.gymMinutesBefore}"></label>
      <label>Entreno abierto (min)<input inputmode="numeric" data-nt-num="openWorkoutMinutes" value="${c.notifyTimes.openWorkoutMinutes}"></label>
    </div></div>`
        : ''
    }
    <p class="sub">Los días de pesaje se cambian en el editor de la checklist diaria.</p>
    ${store.hasProfile ? '' : `<h2>Clave</h2>${scheduleLock().replace('Introduce tu clave para cargar el horario en este dispositivo.', 'Si tienes una clave, escríbela para cargar tu perfil en este dispositivo.')}`}
    ${store.isCustomized('notifyTimes') || store.isCustomized('planStart') ? `<button class="linkbtn" style="display:block;margin:14px auto 0;color:var(--muted)" data-reset-settings>Restaurar ajustes originales</button>` : ''}`;
}

// ---------- Montaje ----------

export function renderEditor(store: Store, ui: UiState): string {
  const ed = ui.editor!;
  switch (ed.kind) {
    case 'routine':
      return renderRoutineEditor(store, ed.id);
    case 'checklist':
      return renderChecklistEditor(store, ed.list);
    case 'schedule':
      return renderScheduleEditor(store, ed.day);
    case 'settings':
      return renderSettingsEditor(store);
  }
}

const int = (v: string) => Math.round(parseNum(v));

export function installEditorHandlers(app: App): void {
  const { store, ui } = app;
  const open = (editor: Editor) => {
    ui.editor = editor;
    app.render();
    window.scrollTo(0, 0);
  };
  const rerender = () => app.render();
  const current = <K extends Editor['kind']>(kind: K) => (ui.editor?.kind === kind ? (ui.editor as Extract<Editor, { kind: K }>) : null);

  document.addEventListener('click', (e) => {
    const t = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!t) return;
    const ds = t.dataset;

    // Abrir y cerrar editores
    if (t.hasAttribute('data-editor-done')) {
      ui.editor = null;
      app.render();
      return window.scrollTo(0, 0);
    }
    if (ds.editRoutine) return open({ kind: 'routine', id: ds.editRoutine });
    if (t.hasAttribute('data-new-routine')) {
      const id = newId('rt');
      store.updateConfig(['routines'], (c) => c.routines.push({ id, name: 'Nueva rutina', day: null, desc: '', exam: false, exercises: [] }));
      return open({ kind: 'routine', id });
    }
    if (ds.editChecklist) return open({ kind: 'checklist', list: ds.editChecklist as ListKey });
    if (ds.editSchedule != null) return open({ kind: 'schedule', day: Number(ds.editSchedule) as DayIndex });
    if (t.hasAttribute('data-edit-settings')) return open({ kind: 'settings' });
    if (ds.reset) {
      const names: Record<string, string> = { routines: 'las rutinas', checklists: 'las checklists', schedule: 'el horario' };
      if (!confirm(`¿Volver a ${names[ds.reset] ?? 'los valores'} originales? Se perderán tus cambios.`)) return;
      store.resetConfig(ds.reset as keyof UserConfig);
      if (ds.reset === 'routines' && current('routine')) ui.editor = null;
      rerender();
      return app.toast('Restaurado');
    }
    if (t.hasAttribute('data-reset-settings')) {
      if (!confirm('¿Restaurar la fecha de inicio y las horas de los avisos?')) return;
      store.resetConfig('planStart');
      store.resetConfig('notifyTimes');
      rerender();
      return app.toast('Ajustes restaurados');
    }

    // Rutina
    const rt = current('routine');
    if (rt) {
      if (t.hasAttribute('data-ex-add')) {
        editRoutine(store, rt.id, (r) =>
          r.exercises.push({ id: newId('ex'), name: 'Nuevo ejercicio', sets: 3, reps: [8, 12], rir: '1-2', restSec: 90, incrementKg: 2.5 }),
        );
        rerender();
        return setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 0);
      }
      if (ds.exMove) {
        editRoutine(store, rt.id, (r) => moveItem(r.exercises, r.exercises.findIndex((x) => x.id === ds.exMove), ds.dir === '-1' ? -1 : 1));
        return rerender();
      }
      if (ds.exDel) {
        const name = store.cfg.routines.find((r) => r.id === rt.id)?.exercises.find((x) => x.id === ds.exDel)?.name;
        if (!confirm(`¿Borrar «${name}» de la rutina? Su historial se conserva.`)) return;
        editRoutine(store, rt.id, (r) => (r.exercises = r.exercises.filter((x) => x.id !== ds.exDel)));
        return rerender();
      }
      if (t.hasAttribute('data-rt-delete')) {
        if (!confirm('¿Borrar esta rutina? Los entrenos ya guardados se conservan.')) return;
        store.updateConfig(['routines'], (c) => (c.routines = c.routines.filter((r) => r.id !== rt.id)));
        ui.editor = null;
        rerender();
        return app.toast('Rutina borrada');
      }
    }

    // Checklist
    const cl = current('checklist');
    if (cl) {
      if (ds.clList) return open({ kind: 'checklist', list: ds.clList as ListKey });
      if (ds.clMove) {
        editList(store, cl.list, (items) => moveItem(items, items.findIndex((x) => x.id === ds.clMove), ds.dir === '-1' ? -1 : 1));
        return rerender();
      }
      if (ds.clDel) {
        editList(store, cl.list, (items) => {
          const i = items.findIndex((x) => x.id === ds.clDel);
          if (i >= 0) items.splice(i, 1);
        });
        return rerender();
      }
      if (ds.weighDay != null) {
        const d = Number(ds.weighDay) as DayIndex;
        store.updateConfig(['checklists'], (c) => {
          const w = c.checklists.weighDays;
          c.checklists.weighDays = w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort();
        });
        return rerender();
      }
    }

    // Horario
    const sch = current('schedule');
    if (sch) {
      if (ds.schDay != null) return open({ kind: 'schedule', day: Number(ds.schDay) as DayIndex });
      if (t.hasAttribute('data-bl-add')) {
        editDay(store, sch.day, (blocks) => {
          const last = blocks[blocks.length - 1];
          const start = last && last.end !== '24:00' ? toMin(last.end) : 9 * 60;
          const end = Math.min(start + 60, 24 * 60);
          const fmt = (m: number) => (m >= 24 * 60 ? '24:00' : `${Math.floor(m / 60)}:${pad(m % 60)}`);
          blocks.push({ start: fmt(start), end: fmt(end), label: 'Nuevo bloque', cat: 'libre' });
        });
        return rerender();
      }
      if (ds.blDel != null) {
        if (!confirm('¿Borrar este bloque?')) return;
        editDay(store, sch.day, (blocks) => blocks.splice(Number(ds.blDel), 1));
        return rerender();
      }
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    const ds = el.dataset;
    const v = el.value;

    const rt = current('routine');
    if (rt && ds.rtField) {
      editRoutine(store, rt.id, (r) => {
        if (ds.rtField === 'name' && v.trim()) r.name = v.trim();
        if (ds.rtField === 'desc') r.desc = v.trim();
        if (ds.rtField === 'day') r.day = v === '' ? null : (Number(v) as DayIndex);
        if (ds.rtField === 'exam') r.exam = v === '1';
      });
      return;
    }
    if (rt && ds.exField && ds.ex) {
      let error = '';
      editExercise(store, rt.id, ds.ex, (x) => {
        const n = int(v);
        switch (ds.exField) {
          case 'name':
            if (v.trim()) x.name = v.trim();
            break;
          case 'sets':
            if (n >= 1 && n <= 10) x.sets = n;
            else error = 'Series entre 1 y 10';
            break;
          case 'repsMin':
            if (n >= 1 && n <= x.reps[1]) x.reps = [n, x.reps[1]];
            else error = 'El mínimo no puede superar al máximo';
            break;
          case 'repsMax':
            if (n >= x.reps[0] && n <= 100) x.reps = [x.reps[0], n];
            else error = 'El máximo no puede ser menor que el mínimo';
            break;
          case 'rir':
            x.rir = v.trim() || '-';
            break;
          case 'restSec':
            if (n >= 0 && n <= 900) x.restSec = n;
            else error = 'Descanso entre 0 y 900 s';
            break;
          case 'incrementKg': {
            const k = parseNum(v);
            if (k >= 0 && k <= 50) x.incrementKg = Math.round(k * 10) / 10;
            else error = 'Subida entre 0 y 50 kg';
            break;
          }
        }
      });
      if (error) {
        app.toast(error);
        rerender();
      }
      return;
    }

    const cl = current('checklist');
    if (cl && ds.clLabel) {
      if (!v.trim()) return app.toast('El texto no puede estar vacío');
      editList(store, cl.list, (items) => {
        const it = items.find((x) => x.id === ds.clLabel);
        if (it) it.label = v.trim();
      });
      return;
    }

    const sch = current('schedule');
    if (sch && ds.blField && ds.bl != null) {
      const i = Number(ds.bl);
      let error = '';
      editDay(store, sch.day, (blocks) => {
        const b = blocks[i];
        if (!b) return;
        if (ds.blField === 'label') b.label = v.trim();
        if (ds.blField === 'cat') b.cat = v as Category;
        if (ds.blField === 'start' || ds.blField === 'end') {
          const tm = normTime(v, ds.blField === 'end');
          if (!tm) return void (error = 'Hora no válida');
          const next = { ...b, [ds.blField]: tm };
          if (toMin(next.end) <= toMin(next.start)) return void (error = 'El fin tiene que ser después del inicio');
          b[ds.blField] = tm;
        }
      });
      if (error) app.toast(error);
      if (error || ds.blField === 'start') rerender();
      return;
    }

    if (current('settings')) {
      if (el.hasAttribute('data-set-start')) {
        if (v === '') {
          store.updateConfig(['planStart'], (c) => (c.planStart = null));
          return app.toast('Sin plan por semanas');
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return app.toast('Fecha no válida');
        store.updateConfig(['planStart'], (c) => (c.planStart = v));
        return app.toast('Fecha de inicio cambiada');
      }
      if (ds.nt) {
        const tm = normTime(v, false);
        if (!tm) return app.toast('Hora no válida');
        store.updateConfig(['notifyTimes'], (c) => (c.notifyTimes[ds.nt as 'creatina'] = tm));
        return app.toast('Hora del aviso cambiada');
      }
      if (ds.ntNum) {
        const n = int(v);
        if (!(n >= 0 && n <= 600)) return app.toast('Entre 0 y 600 minutos');
        store.updateConfig(['notifyTimes'], (c) => (c.notifyTimes[ds.ntNum as keyof Pick<NotifyTimes, 'gymMinutesBefore' | 'openWorkoutMinutes'>] = n));
        return app.toast('Aviso cambiado');
      }
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    const cl = current('checklist');
    if (!cl || !form.hasAttribute('data-cl-add')) return;
    e.preventDefault();
    const input = form.querySelector<HTMLInputElement>('#clNew');
    const label = input?.value.trim() ?? '';
    if (!label) return app.toast('Escribe el texto del ítem');
    editList(store, cl.list, (items) => items.push({ id: newId('c'), label }));
    rerender();
    app.toast('Ítem añadido');
    document.querySelector<HTMLInputElement>('#clNew')?.focus();
  });
}

