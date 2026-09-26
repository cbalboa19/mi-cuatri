import { WEIGHT_GOAL_TEXT } from '../../config/plan';
import { parseYmd, ymd } from '../../domain/dates';
import { bestE1rm, exerciseSessions, trackedExercises } from '../../domain/progression';
import { movingAverage, weekAverages } from '../../domain/weight';
import { workoutVolume } from '../../domain/workout';
import type { Store } from '../../app/store';
import { header, lineChart } from '../components';
import { fmtDate, fmtDur, fmtNum } from '../format';
import { esc } from '../html';
import type { UiState } from '../state';

const RECENT_WEIGHTS = 7;

export function renderProgreso(store: Store, ui: UiState, now: Date): string {
  const { weights, workouts } = store.data;
  const today = ymd(now);
  const wDate = ui.weightDate ?? today;

  // Peso corporal
  const pts = movingAverage(weights).map((p) => ({ x: p.t, y: p.kg, y2: p.avg }));
  const { thisWeek: aT, lastWeek: aP, change } = weekAverages(weights, now);
  const changeColor = change != null ? (change >= 0.1 ? 'var(--ok)' : 'var(--warn)') : 'inherit';
  const changeTxt = change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)} kg` : '-';
  const recent = Object.entries(weights)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, RECENT_WEIGHTS)
    .map(
      ([date, kg]) =>
        `<div class="hist"><div>${esc(fmtDate(parseYmd(date), { weekday: 'long', day: 'numeric', month: 'short' }))}<small>${esc(fmtNum(kg, 1))} kg</small></div><button class="btn sm ghost" data-delweight="${esc(date)}" aria-label="Borrar pesaje">Borrar</button></div>`,
    )
    .join('');

  // Cargas por ejercicio
  const exercises = trackedExercises(store.cfg.routines, workouts);
  if (!ui.progEx || !exercises.some((e) => e.id === ui.progEx)) ui.progEx = exercises[0]?.id ?? null;
  let exBlock = `<div class="list"><div class="empty">Cuando guardes tu primer entreno, aquí verás cómo evolucionan tus cargas.</div></div>`;
  if (ui.progEx) {
    const sess = exerciseSessions(ui.progEx, workouts);
    const epts = sess.map(({ workout, exercise }) => ({ x: workout.startedAt, y: bestE1rm(exercise) }));
    const best = Math.max(...epts.map((p) => p.y));
    exBlock = `<div class="field"><select id="exSel" aria-label="Ejercicio">${exercises.map((e) => `<option value="${esc(e.id)}" ${e.id === ui.progEx ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></div>
     <div class="chart"><div class="sub" style="padding:2px 4px 6px">1RM estimado · mejor: <b style="color:var(--ink)">${best.toFixed(1)} kg</b></div>${lineChart(epts, (v) => v.toFixed(0))}</div>
     <div class="list" style="margin-top:10px">${sess
       .slice(-5)
       .reverse()
       .map(({ workout, exercise }) => `<div class="hist"><div>${esc(fmtDate(workout.startedAt, { weekday: 'short', day: 'numeric', month: 'short' }))}<small>${esc(exercise.sets.map((s) => `${s.kg}×${s.reps}`).join('  ·  '))}</small></div></div>`)
       .join('')}</div>`;
  }

  // Historial
  const hist = [...workouts]
    .reverse()
    .slice(0, 15)
    .map((w) => `<div class="hist"><div><b>${esc(w.routineName)}</b><small>${esc(fmtDate(w.startedAt, { weekday: 'long', day: 'numeric', month: 'short' }))} · ${fmtDur(w.durationSec)} · ${fmtNum(Math.round(workoutVolume(w)))} kg</small></div><div class="row"><button class="btn sm ghost" data-editw="${esc(w.id)}" aria-label="Editar entreno">Editar</button><button class="btn sm ghost" data-delw="${esc(w.id)}" aria-label="Borrar entreno">Borrar</button></div></div>`)
    .join('');

  const placeholder = weights[wDate] != null ? String(weights[wDate]) : '64,0';
  return (
    header(store, 'Progreso', 'Peso y cargas') +
    `<h2>Peso corporal</h2><div class="field"><input id="wIn" inputmode="decimal" placeholder="${esc(placeholder)} kg" aria-label="Peso en kg"><input id="wDate" type="date" value="${esc(wDate)}" max="${esc(today)}" aria-label="Fecha del pesaje"><button class="btn sm" data-addw>${wDate === today ? 'Guardar hoy' : 'Guardar'}</button></div>
    <div class="list" style="margin-top:10px"><div class="stat"><span>Media esta semana</span><b>${aT != null ? aT.toFixed(1) + ' kg' : '-'}</b></div><div class="stat"><span>Media semana pasada</span><b>${aP != null ? aP.toFixed(1) + ' kg' : '-'}</b></div><div class="stat"><span>Cambio</span><b style="color:${changeColor}">${changeTxt}</b></div></div>
    <p class="sub">${esc(WEIGHT_GOAL_TEXT)}</p>
    <div class="chart">${lineChart(pts, (v) => v.toFixed(1))}</div>
    ${recent ? `<div class="list" style="margin-top:10px">${recent}</div>` : ''}
    <h2>Cargas por ejercicio</h2>${exBlock}
    <h2>Historial</h2><div class="list">${hist || '<div class="empty">Aún no hay entrenos. Empieza el de hoy desde Gym.</div>'}</div>`
  );
}
