import { MONTHLY, WEEKLY } from '../../config/checklists';
import { monthWorkouts, weekDailySummary, weekWorkouts } from '../../domain/checklists';
import { isoWeek, monthKey } from '../../domain/dates';
import { DAY_NAMES, MONTH_NAMES } from '../../domain/locale';
import { formatStart, planWeek, weeklyGymTarget } from '../../domain/plan';
import { monthWeights } from '../../domain/weight';
import type { Store } from '../../app/store';
import { checklist, checklistCtx, header } from '../components';
import { fmtDur } from '../format';
import type { UiState } from '../state';

export function renderChecks(store: Store, ui: UiState, now: Date): string {
  const d = now;
  const exam = store.data.settings.examMode;
  const seg = `<div class="seg" role="group">${(['semana', 'mes'] as const)
    .map((s) => `<button data-seg="${s}" aria-pressed="${ui.checkSeg === s}">${s === 'semana' ? 'Esta semana' : 'Este mes'}</button>`)
    .join('')}</div>`;
  let body = '';
  if (ui.checkSeg === 'semana') {
    const cl = checklist(WEEKLY, 'weekly', isoWeek(d), d, store);
    const sum = weekDailySummary(d, store.data.checks.daily, checklistCtx(store));
    const days = sum.days
      .map((c, i) => `<div class="stat"><span>${DAY_NAMES[i]}</span><b>${c ? `${c.done}/${c.total}` : '-'}</b></div>`)
      .join('');
    body = `<h2>Checklist semanal · ${cl.done}/${cl.total}</h2>${cl.html}
     <h2>Resumen</h2><div class="list"><div class="stat"><span>Entrenos</span><b>${weekWorkouts(store.data.workouts, d).length}/${weeklyGymTarget(exam)}</b></div><div class="stat"><span>Checklists diarias</span><b>${sum.pct}%</b></div>${days}</div>`;
  } else {
    const mk = monthKey(d);
    const cl = checklist(MONTHLY, 'monthly', mk, d, store);
    const mw = monthWorkouts(store.data.workouts, d);
    const ws = monthWeights(store.data.weights, mk);
    const first = ws[0]?.[1];
    const last = ws[ws.length - 1]?.[1];
    const weightTxt = ws.length >= 2 ? `${first} a ${last} kg` : ws.length ? `${first} kg` : '-';
    body = `<h2>Checklist de ${MONTH_NAMES[d.getMonth()]} · ${cl.done}/${cl.total}</h2>${cl.html}
     <h2>Resumen del mes</h2><div class="list"><div class="stat"><span>Entrenos</span><b>${mw.length}</b></div><div class="stat"><span>Tiempo entrenando</span><b>${fmtDur(mw.reduce((a, w) => a + w.durationSec, 0))}</b></div><div class="stat"><span>Peso</span><b>${weightTxt}</b></div></div>`;
  }
  const w = planWeek(d);
  const start = formatStart();
  const sub = w < 1 ? `El plan empieza el ${start.slice(0, start.indexOf(' de '))}` : `Semana ${w} del plan`;
  return (
    header(store, 'Checks', sub) +
    seg +
    body +
    `<h2>Exámenes</h2><div class="list"><button class="item ${exam ? 'done' : ''}" data-exam aria-pressed="${exam}"><span class="box"></span><span class="lbl">Modo exámenes<div class="hint">Gym en mantenimiento: 3 días, 2 series por ejercicio</div></span></button></div>`
  );
}
