import { monthWorkouts, weekDailySummary, weekWorkouts } from '../../domain/checklists';
import { addDays, isoWeek, mondayOf, monthKey, ymd } from '../../domain/dates';
import { DAY_NAMES, MONTH_NAMES } from '../../domain/locale';
import { activeRoutines, formatStart, planWeek, weeklyGymTarget } from '../../domain/plan';
import { monthWeights } from '../../domain/weight';
import type { Store } from '../../app/store';
import { checklist, checklistCtx, editLink, header } from '../components';
import { fmtDur } from '../format';
import { esc } from '../html';
import type { UiState } from '../state';

function navRow(nav: string, label: string, offset: number): string {
  return `<div class="navrow"><button class="navbtn" data-${nav}="-1" aria-label="Anterior">‹</button><span>${esc(label)}</span><button class="navbtn" data-${nav}="1" aria-label="Siguiente" ${offset >= 0 ? 'disabled' : ''}>›</button></div>`;
}

export function renderChecks(store: Store, ui: UiState, now: Date): string {
  const exam = store.data.settings.examMode;
  const cfg = store.cfg;
  const seg = `<div class="seg" role="group">${(['semana', 'mes'] as const)
    .map((s) => `<button data-seg="${s}" aria-pressed="${ui.checkSeg === s}">${s === 'semana' ? 'Semana' : 'Mes'}</button>`)
    .join('')}</div>`;
  let body = '';
  if (ui.checkSeg === 'semana') {
    const wd = addDays(now, 7 * ui.weekOffset);
    const monday = mondayOf(wd);
    const label = ui.weekOffset === 0 ? 'Esta semana' : ui.weekOffset === -1 ? 'Semana pasada' : `Semana del ${monday.getDate()} de ${MONTH_NAMES[monday.getMonth()]}`;
    // Para semanas pasadas el resumen cuenta la semana entera.
    const until = ui.weekOffset < 0 ? addDays(monday, 6) : now;
    const cl = checklist(cfg.checklists.weekly, 'weekly', isoWeek(wd), wd, store);
    const sum = weekDailySummary(until, store.data.checks.daily, checklistCtx(store));
    const days = sum.days
      .map((c, i) =>
        c
          ? `<button class="stat" data-openday="${ymd(addDays(monday, i))}"><span>${DAY_NAMES[i]}</span><b>${c.done}/${c.total} ›</b></button>`
          : `<div class="stat"><span>${DAY_NAMES[i]}</span><b>-</b></div>`,
      )
      .join('');
    body = `${navRow('weeknav', label, ui.weekOffset)}
     <div class="ehead"><h2>Checklist semanal · ${cl.done}/${cl.total}</h2>${editLink('data-edit-checklist="weekly"')}</div>${cl.html}
     <h2>Resumen</h2><div class="list"><div class="stat"><span>Entrenos</span><b>${weekWorkouts(store.data.workouts, wd).length}/${weeklyGymTarget(exam, cfg.routines)}</b></div><div class="stat"><span>Checklists diarias</span><b>${sum.pct}%</b></div>${days}</div>
     <p class="sub">Toca un día para ver o corregir su checklist.</p>`;
  } else {
    const md = ui.monthOffset === 0 ? now : new Date(now.getFullYear(), now.getMonth() + ui.monthOffset, 1);
    const mk = monthKey(md);
    const label = ui.monthOffset === 0 ? 'Este mes' : `${MONTH_NAMES[md.getMonth()]} ${md.getFullYear()}`;
    const cl = checklist(cfg.checklists.monthly, 'monthly', mk, md, store);
    const mw = monthWorkouts(store.data.workouts, md);
    const ws = monthWeights(store.data.weights, mk);
    const first = ws[0]?.[1];
    const last = ws[ws.length - 1]?.[1];
    const weightTxt = ws.length >= 2 ? `${first} a ${last} kg` : ws.length ? `${first} kg` : '-';
    body = `${navRow('monthnav', label, ui.monthOffset)}
     <div class="ehead"><h2>Checklist de ${MONTH_NAMES[md.getMonth()]} · ${cl.done}/${cl.total}</h2>${editLink('data-edit-checklist="monthly"')}</div>${cl.html}
     <h2>Resumen del mes</h2><div class="list"><div class="stat"><span>Entrenos</span><b>${mw.length}</b></div><div class="stat"><span>Tiempo entrenando</span><b>${fmtDur(mw.reduce((a, w) => a + w.durationSec, 0))}</b></div><div class="stat"><span>Peso</span><b>${weightTxt}</b></div></div>`;
  }
  const w = planWeek(now, cfg.planStart);
  const start = formatStart(cfg.planStart);
  const sub = w < 1 ? `El plan empieza el ${start.slice(0, start.indexOf(' de '))}` : `Semana ${w} del plan`;
  const examDays = activeRoutines(true, cfg.routines).filter((r) => r.day != null).length;
  return (
    header(store, 'Checks', sub) +
    seg +
    body +
    `<h2>Exámenes</h2><div class="list"><button class="item ${exam ? 'done' : ''}" data-exam aria-pressed="${exam}"><span class="box"></span><span class="lbl">Modo exámenes<div class="hint">Gym en mantenimiento: ${examDays} días, 2 series por ejercicio</div></span></button></div>` +
    `<button class="btn ghost" data-edit-settings style="margin-top:10px">Ajustes del plan y de los avisos</button>`
  );
}
