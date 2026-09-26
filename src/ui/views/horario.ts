import { dow } from '../../domain/dates';
import { DAY_NAMES } from '../../domain/locale';
import { studyMinutes } from '../../domain/timeline';
import type { Store } from '../../app/store';
import { editLink, header, timeline } from '../components';
import { fmtNum } from '../format';
import type { UiState } from '../state';

export function renderHorario(store: Store, ui: UiState, now: Date): string {
  const today = dow(now);
  const btns = DAY_NAMES.map(
    (n, i) => `<button data-day="${i}" aria-pressed="${ui.viewDay === i}">${n.slice(0, 2)}${i === today ? '·' : ''}</button>`,
  ).join('');
  const study = store.schedule ? studyMinutes(store.schedule.week[ui.viewDay] ?? []) : 0;
  const edit = store.schedule ? editLink(`data-edit-schedule="${ui.viewDay}"`) : '';
  return (
    header(store, 'Horario', 'Semana tipo') +
    `<div class="days" role="group" aria-label="Día">${btns}</div>` +
    `<div class="ehead"><h2>${DAY_NAMES[ui.viewDay]}${study ? ` · ${fmtNum(study / 60, 1)} h de estudio` : ''}</h2>${edit}</div>` +
    timeline(store.schedule, ui.viewDay, ui.viewDay === today, now)
  );
}
