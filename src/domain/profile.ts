// Perfil cifrado: horario + configuración propia (rutinas, checklists, inicio del plan...).
// Quien no tiene la clave usa la app vacía; con la clave, esto son sus valores por defecto.
// Los imports llevan extensión .ts para poder usarse también desde el script de Node.

import type { ChecklistsConfig } from './config.ts';
import { parseSchedulePayload, type SchedulePayload } from './schedule.ts';
import type { RoutineDef } from './types.ts';
import { arr, isObj, str, vChecklists, vDate, vRoutine } from './validators.ts';

export interface Profile {
  routines?: RoutineDef[];
  checklists?: ChecklistsConfig;
  planStart?: string;
  /** Texto de objetivo que se muestra en Progreso → Peso. */
  weightGoal?: string;
}

export type ProfilePayload = SchedulePayload & Profile;

/** Valida el perfil descifrado. Lanza un Error con el motivo si no es válido. */
export function parseProfilePayload(raw: unknown): ProfilePayload {
  const out: ProfilePayload = parseSchedulePayload(raw);
  const o = isObj(raw) ? raw : {};
  if (o.routines !== undefined) out.routines = arr(o.routines, 'routines').map((r, i) => vRoutine(r, `routines[${i}]`));
  if (o.checklists !== undefined) out.checklists = vChecklists(o.checklists, 'checklists');
  if (o.planStart !== undefined) out.planStart = vDate(o.planStart, 'planStart');
  if (o.weightGoal !== undefined) out.weightGoal = str(o.weightGoal, 'weightGoal');
  return out;
}

export const profileOf = (p: ProfilePayload): Profile => ({
  ...(p.routines ? { routines: p.routines } : {}),
  ...(p.checklists ? { checklists: p.checklists } : {}),
  ...(p.planStart ? { planStart: p.planStart } : {}),
  ...(p.weightGoal ? { weightGoal: p.weightGoal } : {}),
});
