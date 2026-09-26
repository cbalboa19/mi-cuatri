import { dailyItems, workoutsOnDay } from '../../domain/checklists';
import { dow, ymd } from '../../domain/dates';
import { DAY_NAMES, MONTH_NAMES } from '../../domain/locale';
import { phaseFor, routineForDay } from '../../domain/plan';
import type { Store } from '../../app/store';
import { checklist, header, phaseStrip, timeline } from '../components';
import { esc } from '../html';

export function renderHoy(store: Store, now: Date): string {
  const d = now;
  const w = dow(d);
  const exam = store.data.settings.examMode;
  const ph = phaseFor(d, exam);
  const cl = checklist(dailyItems(d, exam), 'daily', ymd(d), d, store);
  const routine = routineForDay(w, exam);
  const doneToday = workoutsOnDay(store.data.workouts, d).length > 0;
  let gymBtn = '';
  if (store.active) gymBtn = `<button class="btn" data-go-workout>Seguir con el entreno en curso</button>`;
  else if (routine && !doneToday) gymBtn = `<button class="btn" data-start="${esc(routine.id)}">Empezar ${esc(routine.name)}</button>`;
  return (
    header(store, `${DAY_NAMES[w]} ${d.getDate()}`, `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`) +
    phaseStrip(ph) +
    (gymBtn ? `<div style="margin-top:12px">${gymBtn}</div>` : '') +
    `<h2>Checklist de hoy · ${cl.done}/${cl.total}</h2>${cl.html}` +
    `<h2>Tu día</h2>${timeline(w, true, now)}`
  );
}
