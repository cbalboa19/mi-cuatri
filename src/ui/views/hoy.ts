import { dailyItems, dayTypeOf, workoutsOnDay } from '../../domain/checklists';
import { addDays, dow, startOfDay, ymd } from '../../domain/dates';
import { DAY_NAMES, MONTH_NAMES } from '../../domain/locale';
import { phaseFor, routinesForDay } from '../../domain/plan';
import type { Store } from '../../app/store';
import { checklist, editLink, header, navHeader, phaseStrip, timeline } from '../components';
import { esc } from '../html';
import type { UiState } from '../state';

/** "de hoy", "de ayer" o "del martes 29". */
function dayTitle(offset: number, d: Date): string {
  if (offset === 0) return 'de hoy';
  if (offset === -1) return 'de ayer';
  return `del ${DAY_NAMES[dow(d)]!.toLowerCase()} ${d.getDate()}`;
}

export function renderHoy(store: Store, ui: UiState, now: Date): string {
  const d = now;
  const w = dow(d);
  const exam = store.data.settings.examMode;
  const cfg = store.cfg;
  const ph = phaseFor(d, exam, cfg.planStart);

  // Checklist: hoy o un día anterior (flechas ‹ ›).
  const cd = addDays(startOfDay(now), ui.dayOffset);
  const cl = checklist(dailyItems(cd, exam, cfg), 'daily', ymd(cd), cd, store);
  const title = `Checklist ${dayTitle(ui.dayOffset, cd)} · ${cl.done}/${cl.total}`;
  const past =
    ui.dayOffset < 0
      ? `<p class="sub" style="margin:-4px 0 8px">${esc(`${cd.getDate()} de ${MONTH_NAMES[cd.getMonth()]}`)} · puedes marcar lo que se te olvidó. <button class="linkbtn" data-daynav-today>Volver a hoy</button></p>`
      : '';

  const routines = routinesForDay(w, exam, cfg.routines);
  const doneToday = workoutsOnDay(store.data.workouts, d).length > 0;
  let gymBtn = '';
  if (store.active) {
    gymBtn = `<button class="btn" data-go-workout>${store.active.editOf ? 'Seguir editando el entreno' : 'Seguir con el entreno en curso'}</button>`;
  } else if (routines.length && !doneToday) {
    gymBtn = routines.map((r) => `<button class="btn" data-start="${esc(r.id)}">Empezar ${esc(r.name)}</button>`).join('<div style="height:8px"></div>');
  }

  return (
    header(store, `${DAY_NAMES[w]} ${d.getDate()}`, `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`) +
    phaseStrip(ph) +
    (gymBtn ? `<div style="margin-top:12px">${gymBtn}</div>` : '') +
    navHeader(title, 'daynav', false, ui.dayOffset >= 0) +
    past +
    cl.html +
    `<div style="text-align:right">${editLink(`data-edit-checklist="${dayTypeOf(cd)}"`, 'Editar checklist')}</div>` +
    `<h2>Tu día</h2>${timeline(store.schedule, w, true, now)}`
  );
}
