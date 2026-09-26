import { ROUTINES } from '../../config/routines';
import { weekWorkouts } from '../../domain/checklists';
import { dow } from '../../domain/dates';
import { DAY_NAMES } from '../../domain/locale';
import { phaseFor, routineForDay, weeklyGymTarget } from '../../domain/plan';
import { lastSessionFor, suggestIncrease } from '../../domain/progression';
import type { ExerciseDef } from '../../domain/types';
import type { Store } from '../../app/store';
import { header, phaseStrip } from '../components';
import { fmtClock, fmtDate, fmtNum, plain } from '../format';
import { esc } from '../html';

export function renderGym(store: Store, now: Date): string {
  if (store.active) return renderWorkout(store);
  const exam = store.data.settings.examMode;
  const todays = routineForDay(dow(now), exam);
  const ph = phaseFor(now, exam);
  const cards = ROUTINES.map((r) => {
    const isToday = todays?.id === r.id;
    const last = [...store.data.workouts].reverse().find((x) => x.routineId === r.id);
    const lastTxt = last ? ` · último: ${fmtDate(last.startedAt, { day: 'numeric', month: 'short' })}` : '';
    return `<div class="rt ${isToday ? 'today' : ''}">${isToday ? '<span class="tag">Te toca hoy</span>' : ''}<h3>${r.day != null ? `${DAY_NAMES[r.day]} · ` : ""}${esc(r.name)}</h3><p>${esc(r.desc)} · ${r.exercises.length} ejercicios${esc(lastTxt)}</p><button class="btn ${isToday ? '' : 'ghost'}" data-start="${esc(r.id)}">Empezar rutina</button></div>`;
  }).join('');
  return (
    header(store, 'Gym', `${weekWorkouts(store.data.workouts, now).length}/${weeklyGymTarget(exam)} entrenos esta semana`) +
    phaseStrip(ph, ' Las series ya vienen ajustadas.', 'margin-bottom:14px') +
    cards +
    `<p class="sub" style="margin-top:14px">RIR = repeticiones que te quedan en la recámara. Cuando hagas el máximo del rango en todas las series, sube peso y vuelve al mínimo.</p>`
  );
}

const FALLBACK_DEF = (id: string, name: string): ExerciseDef => ({
  id,
  name,
  sets: 0,
  reps: [0, 0],
  rir: '-',
  restSec: 90,
  incrementKg: 0,
});

/** Definición del ejercicio en la config (o una genérica si ya no existe). */
export function exerciseDef(routineId: string, exerciseId: string, name: string): ExerciseDef {
  const r = ROUTINES.find((x) => x.id === routineId);
  return r?.exercises.find((e) => e.id === exerciseId) ?? FALLBACK_DEF(exerciseId, name);
}

function renderWorkout(store: Store): string {
  const active = store.active!;
  const exs = active.exercises
    .map((ex, ei) => {
      const def = exerciseDef(active.routineId, ex.exerciseId, ex.name);
      const up = suggestIncrease(def, lastSessionFor(ex.exerciseId, store.data.workouts));
      const rows = ex.sets
        .map((s, si) => {
          const prev = s.prevKg != null || s.prevReps != null ? `${plain(s.prevKg)}×${plain(s.prevReps)}` : '-';
          return `<tr class="${s.done ? 'ok' : ''}"><td>${si + 1}</td><td class="prev">${esc(prev)}</td><td><input inputmode="decimal" aria-label="Kg serie ${si + 1}" placeholder="${esc(plain(s.prevKg))}" value="${esc(s.kg)}" data-in="kg" data-e="${ei}" data-s="${si}"></td><td><input inputmode="numeric" aria-label="Reps serie ${si + 1}" placeholder="${esc(plain(s.prevReps))}" value="${esc(s.reps)}" data-in="reps" data-e="${ei}" data-s="${si}"></td><td><button class="tick" aria-label="Marcar serie ${si + 1}" data-tick data-e="${ei}" data-s="${si}"></button></td></tr>`;
        })
        .join('');
      return `<div class="ex"><h4>${esc(ex.name)}</h4><div class="meta">${def.reps[0]}-${def.reps[1]} reps · RIR ${esc(def.rir)} · descanso ${fmtClock(def.restSec)}</div>${up != null ? `<div class="up">Completaste el rango: prueba ${fmtNum(up, 1)} kg</div>` : ''}<table class="sets"><thead><tr><th>Serie</th><th>Anterior</th><th>Kg</th><th>Reps</th><th></th></tr></thead><tbody>${rows}</tbody></table><div class="row" style="justify-content:space-between"><button class="addset" data-addset="${ei}">+ Añadir serie</button>${ex.sets.length > 1 ? `<button class="addset" style="color:var(--muted)" data-delset="${ei}">Quitar serie</button>` : ''}</div></div>`;
    })
    .join('');
  return (
    `<div class="whead"><div><b style="font-family:var(--display);font-size:20px">${esc(active.routineName)}</b><div class="clock" id="clock">0:00</div></div><button class="btn sm" data-finish>Terminar</button></div>` +
    exs +
    `<button class="btn danger" data-discard style="margin-top:6px">Descartar entreno</button>`
  );
}
