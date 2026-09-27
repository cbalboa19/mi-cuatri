import { weekWorkouts } from '../../domain/checklists';
import { dow } from '../../domain/dates';
import { DAY_NAMES } from '../../domain/locale';
import { routinesForDay, weeklyGymTarget } from '../../domain/plan';
import { lastSessionFor, suggestIncrease } from '../../domain/progression';
import type { ActiveExercise, ExerciseDef } from '../../domain/types';
import type { Store } from '../../app/store';
import { header, phaseStrip } from '../components';
import { fmtClock, fmtDate, fmtNum, plain } from '../format';
import { esc } from '../html';

export function renderGym(store: Store, now: Date): string {
  if (store.active) return renderWorkout(store);
  const exam = store.data.settings.examMode;
  const cfg = store.cfg;
  const todays = new Set(routinesForDay(dow(now), exam, cfg.routines).map((r) => r.id));
  const ph = store.phase(now);
  const cards = cfg.routines
    .map((r) => {
      const isToday = todays.has(r.id);
      const last = [...store.data.workouts].reverse().find((x) => x.routineId === r.id);
      const lastTxt = last ? ` · último: ${fmtDate(last.startedAt, { day: 'numeric', month: 'short' })}` : '';
      const pausa = exam && !r.exam ? ' · en pausa (exámenes)' : '';
      const title = `${r.day != null ? `${DAY_NAMES[r.day]} · ` : ''}${r.name}`;
      return `<div class="rt ${isToday ? 'today' : ''}">${isToday ? '<span class="tag">Te toca hoy</span>' : ''}<div class="ehead"><h3>${esc(title)}</h3><button class="linkbtn" data-edit-routine="${esc(r.id)}">Editar</button></div><p>${esc(r.desc)}${r.desc ? ' · ' : ''}${r.exercises.length} ejercicios${esc(lastTxt)}${pausa}</p><button class="btn ${isToday ? '' : 'ghost'}" data-start="${esc(r.id)}">Empezar rutina</button></div>`;
    })
    .join('');
  const reset = store.isCustomized('routines')
    ? `<button class="linkbtn" style="display:block;margin:10px auto 0;color:var(--muted)" data-reset="routines">Restaurar las rutinas originales</button>`
    : '';
  const done = weekWorkouts(store.data.workouts, now).length;
  const target = weeklyGymTarget(exam, cfg.routines);
  const empty = cfg.routines.length ? '' : '<div class="list" style="margin-bottom:10px"><div class="empty">Aún no tienes rutinas. Crea la primera con sus ejercicios.</div></div>';
  return (
    header(store, 'Gym', target ? `${done}/${target} entrenos esta semana` : `${done} entrenos esta semana`) +
    phaseStrip(ph, ' Las series ya vienen ajustadas.', 'margin-bottom:14px') +
    empty +
    cards +
    `<button class="btn ghost" data-new-routine>+ Nueva rutina</button>${reset}` +
    `<p class="sub" style="margin-top:14px">RIR = repeticiones que te quedan en la recámara. Cuando hagas el máximo del rango en todas las series, sube peso y vuelve al mínimo.</p>`
  );
}

/** Configuración de un ejercicio del entreno: la copia guardada al empezar o la de la rutina. */
export function exerciseInfo(store: Store, ex: ActiveExercise): ExerciseDef {
  const def = store.findExercise(ex.exerciseId);
  return {
    id: ex.exerciseId,
    name: ex.name,
    sets: ex.plannedSets,
    reps: ex.reps ?? def?.reps ?? [0, 0],
    rir: ex.rir ?? def?.rir ?? '-',
    restSec: ex.restSec ?? def?.restSec ?? 90,
    incrementKg: ex.incrementKg ?? def?.incrementKg ?? 0,
  };
}

function addExerciseForm(store: Store): string {
  const groups = store.cfg.routines
    .filter((r) => r.exercises.length)
    .map((r) => `<optgroup label="${esc(r.name)}">${r.exercises.map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</optgroup>`)
    .join('');
  const canSave = !store.active?.editOf && store.cfg.routines.some((r) => r.id === store.active?.routineId);
  return `<details class="exopts"><summary style="color:var(--accent);font-size:14px">+ Añadir ejercicio</summary><div class="list"><form class="egrid" data-add-ex style="grid-template-columns:1fr 1fr">
    <label class="full">Ejercicio<select id="addExSel"><option value="">Elige uno…</option>${groups}</select></label>
    <label class="full">…o uno nuevo<input id="addExName" placeholder="Nombre del ejercicio" autocomplete="off"></label>
    <label>Series<input id="addExSets" inputmode="numeric" value="3"></label>
    <label>Descanso (s)<input id="addExRest" inputmode="numeric" value="90"></label>
    ${canSave ? `<label class="full" style="flex-direction:row;align-items:center;gap:8px;font-size:14px;color:var(--ink)"><input type="checkbox" id="addExSave" style="width:auto"> Añadir también a la rutina</label>` : ''}
    <button class="btn sm full" type="submit" style="width:100%">Añadir</button>
  </form></div></details>`;
}

function renderWorkout(store: Store): string {
  const active = store.active!;
  const editing = !!active.editOf;
  const n = active.exercises.length;
  const exs = active.exercises
    .map((ex, ei) => {
      const info = exerciseInfo(store, ex);
      const up = editing ? null : suggestIncrease(info, lastSessionFor(ex.exerciseId, store.data.workouts));
      const rows = ex.sets
        .map((s, si) => {
          const prev = s.prevKg != null || s.prevReps != null ? `${plain(s.prevKg)}×${plain(s.prevReps)}` : '-';
          return `<tr class="${s.done ? 'ok' : ''}"><td>${si + 1}</td><td class="prev">${esc(prev)}</td><td><input inputmode="decimal" aria-label="Kg serie ${si + 1}" placeholder="${esc(plain(s.prevKg))}" value="${esc(s.kg)}" data-in="kg" data-e="${ei}" data-s="${si}"></td><td><input inputmode="numeric" aria-label="Reps serie ${si + 1}" placeholder="${esc(plain(s.prevReps))}" value="${esc(s.reps)}" data-in="reps" data-e="${ei}" data-s="${si}"></td><td><button class="tick" aria-label="Marcar serie ${si + 1}" data-tick data-e="${ei}" data-s="${si}"></button></td></tr>`;
        })
        .join('');
      const meta = info.reps[1] ? `${info.reps[0]}-${info.reps[1]} reps · RIR ${esc(info.rir)} · descanso ${fmtClock(info.restSec)}` : `descanso ${fmtClock(info.restSec)}`;
      const inRoutine = store.cfg.routines.some((r) => r.exercises.some((e) => e.id === ex.exerciseId));
      const opts = `<details class="exopts"><summary>Opciones del ejercicio</summary>
        <div class="row"><span class="sub">Descanso</span><input inputmode="numeric" data-exrest="${ei}" value="${info.restSec}" aria-label="Descanso en segundos"><span class="sub">s</span>${inRoutine ? `<button class="addset" data-exrest-save="${ei}">Guardar en la rutina</button>` : ''}</div>
        <div class="row">${ei > 0 ? `<button class="addset" data-exmove="${ei}" data-dir="-1">↑ Subir</button>` : ''}${ei < n - 1 ? `<button class="addset" data-exmove="${ei}" data-dir="1">↓ Bajar</button>` : ''}<button class="addset" style="color:#D93025" data-exremove="${ei}">Quitar ejercicio</button></div>
      </details>`;
      return `<div class="ex"><h4>${esc(ex.name)}</h4><div class="meta">${meta}</div>${up != null ? `<div class="up">Completaste el rango: prueba ${fmtNum(up, 1)} kg</div>` : ''}<table class="sets"><thead><tr><th>Serie</th><th>Anterior</th><th>Kg</th><th>Reps</th><th></th></tr></thead><tbody>${rows}</tbody></table><div class="row" style="justify-content:space-between"><button class="addset" data-addset="${ei}">+ Añadir serie</button>${ex.sets.length > 1 ? `<button class="addset" style="color:var(--muted)" data-delset="${ei}">Quitar serie</button>` : ''}</div>${opts}</div>`;
    })
    .join('');
  const head = editing
    ? `<div class="whead"><div><b style="font-family:var(--display);font-size:20px">Editar · ${esc(active.routineName)}</b><div class="clock">${esc(fmtDate(active.startedAt, { weekday: 'long', day: 'numeric', month: 'short' }))}</div></div><button class="btn sm" data-finish>Guardar</button></div>`
    : `<div class="whead"><div><b style="font-family:var(--display);font-size:20px">${esc(active.routineName)}</b><div class="clock" id="clock">0:00</div></div><button class="btn sm" data-finish>Terminar</button></div>`;
  return (
    head +
    exs +
    addExerciseForm(store) +
    `<button class="btn danger" data-discard style="margin-top:12px">${editing ? 'Cancelar cambios' : 'Descartar entreno'}</button>`
  );
}
