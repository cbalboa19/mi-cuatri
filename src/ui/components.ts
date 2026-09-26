// Piezas de interfaz reutilizadas por varias vistas.

import { countDone, isItemDone, resolveLabel, type ChecklistContext } from '../domain/checklists';
import { minutesOfDay, pad } from '../domain/dates';
import type { Phase } from '../domain/plan';
import type { Schedule } from '../domain/schedule';
import { timelineState } from '../domain/timeline';
import type { ChecklistItem, CheckScope, DayIndex } from '../domain/types';
import type { Store } from '../app/store';
import { esc } from './html';

export function header(store: Store, title: string, sub: string): string {
  const on = store.synced;
  const tip = on ? 'Guardado en tu cuenta' : 'Guardado en este dispositivo';
  return `<div class="topline"><span class="sub">${esc(sub)}</span><span class="sync ${on ? 'on' : ''}" title="${tip}"><i></i>${esc(store.syncLabel)}</span></div><h1>${esc(title)}</h1>`;
}

export function phaseStrip(ph: Phase, extraTxt = '', style = ''): string {
  return `<div class="phase"${style ? ` style="${style}"` : ''}><span class="dot" style="background:${esc(ph.color)}"></span><div><b>${esc(ph.name)}</b><div class="sub">${esc(ph.txt)}${esc(extraTxt)}</div></div></div>`;
}

/** Formulario para cargar el horario en el dispositivo (se pide la clave una sola vez). */
export const scheduleLock = (): string =>
  `<div class="list"><div class="empty">Introduce tu clave para cargar el horario en este dispositivo.</div><form class="field" data-unlock style="padding:0 14px 14px"><input id="schedKey" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Clave del horario" aria-label="Clave del horario"><button class="btn sm" type="submit">Desbloquear</button></form></div>`;

export function timeline(schedule: Schedule | null, day: DayIndex, live: boolean, now: Date): string {
  if (!schedule) return scheduleLock();
  const blocks = schedule.week[day] ?? [];
  const n = minutesOfDay(now);
  const { states, pulseAt } = timelineState(blocks, live ? n : null);
  const pulse = `<div class="pulse"><em>${pad(Math.floor(n / 60))}:${pad(n % 60)}</em></div>`;
  let html = '';
  blocks.forEach((b, i) => {
    if (pulseAt === i) html += pulse;
    const st = states[i];
    const cls = st === 'future' ? '' : st;
    const end = b.end === '24:00' ? '0:00' : b.end;
    html += `<div class="blk ${cls}" style="--cat:var(--c-${b.cat})"><div class="t">${esc(b.start)}</div><div class="card">${cls === 'now' ? '<span class="nowtag">Ahora</span>' : ''}<b>${esc(b.label)}</b><span>${esc(b.start)} - ${esc(end)} · ${esc(schedule.labels[b.cat])}</span></div></div>`;
  });
  if (pulseAt === blocks.length) html += pulse;
  return `<div class="tl">${html}</div>`;
}

export interface ChecklistHtml {
  html: string;
  done: number;
  total: number;
}

export function checklist(
  items: ChecklistItem[],
  scope: CheckScope,
  period: string,
  date: Date,
  store: Store,
): ChecklistHtml {
  const ctx = checklistCtx(store);
  const record = store.data.checks[scope][period];
  const { done, total } = countDone(items, record, date, ctx);
  const rows = items
    .map((item) => {
      const on = isItemDone(item, record, date, ctx);
      const data = item.auto ? `data-auto="${esc(item.auto)}"` : `data-chk="${esc(item.id)}"`;
      return `<button class="item ${on ? 'done' : ''} ${item.auto ? 'auto' : ''}" ${data} aria-pressed="${on}"><span class="box"></span><span class="lbl">${esc(resolveLabel(item, ctx.examMode))}</span>${item.auto ? '<span class="hint">auto</span>' : ''}</button>`;
    })
    .join('');
  const pct = total ? (done / total) * 100 : 0;
  return {
    html: `<div class="progress"><i style="width:${pct}%"></i></div><div class="list" data-store="${scope}" data-key="${esc(period)}">${rows}</div>`,
    done,
    total,
  };
}

export const checklistCtx = (store: Store): ChecklistContext => ({
  workouts: store.data.workouts,
  weights: store.data.weights,
  examMode: store.data.settings.examMode,
});

export interface ChartPoint {
  x: number;
  y: number;
  /** Serie secundaria (media móvil). */
  y2?: number;
}

export function lineChart(points: ChartPoint[], fmt: (v: number) => string): string {
  if (points.length < 2) return `<div class="empty">Necesitas al menos 2 registros para ver la gráfica.</div>`;
  const W = 320, H = 170, pl = 34, pr = 8, pt = 12, pb = 22;
  const hasY2 = points[0]!.y2 != null;
  const xs = points.map((p) => p.x);
  const ys = points.flatMap((p) => (p.y2 != null ? [p.y, p.y2] : [p.y]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 - y0 < 1) { y0 -= 0.5; y1 += 0.5; }
  const padY = (y1 - y0) * 0.12;
  y0 -= padY;
  y1 += padY;
  const X = (x: number) => pl + ((x - x0) / (x1 - x0 || 1)) * (W - pl - pr);
  const Y = (y: number) => pt + (1 - (y - y0) / (y1 - y0)) * (H - pt - pb);
  const path = (k: 'y' | 'y2') =>
    points
      .filter((p) => p[k] != null)
      .map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p[k]!).toFixed(1)}`)
      .join('');
  const ticks = [y0 + padY, (y0 + y1) / 2, y1 - padY]
    .map((v) => `<text x="${pl - 5}" y="${Y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${esc(fmt(v))}</text><line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/>`)
    .join('');
  const d0 = new Date(x0), d1 = new Date(x1);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de evolución">${ticks}
   <path d="${path('y')}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="${hasY2 ? '3 3' : '0'}" opacity="${hasY2 ? 0.7 : 1}"/>
   ${hasY2 ? `<path d="${path('y2')}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>` : ''}
   ${points.map((p) => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="2.6" fill="${hasY2 ? 'var(--muted)' : 'var(--accent)'}"/>`).join('')}
   <text x="${pl}" y="${H - 5}" font-size="10" fill="var(--muted)">${d0.getDate()}/${d0.getMonth() + 1}</text><text x="${W - pr}" y="${H - 5}" font-size="10" fill="var(--muted)" text-anchor="end">${d1.getDate()}/${d1.getMonth() + 1}</text></svg>`;
}
