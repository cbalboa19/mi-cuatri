// Formato de números, duraciones y fechas para la interfaz.

import { pad } from '../domain/dates';

export const fmtDur = (sec: number): string => {
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

/** 125 → "2:05" */
export const fmtClock = (sec: number): string => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;

/** Número con formato español (coma decimal, punto de miles). */
export const fmtNum = (v: number, maxDigits = 0): string =>
  v.toLocaleString('es', { maximumFractionDigits: maxDigits });

export const fmtDate = (t: number | Date, opts: Intl.DateTimeFormatOptions): string =>
  new Date(t).toLocaleDateString('es', opts);

/** Número tal cual para inputs y placeholders ("" si no hay). */
export const plain = (v: number | null | undefined): string => (v == null ? '' : String(v));
