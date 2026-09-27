// Notificaciones: servidor de avisos, tipos y textos.

/** Worker que envía los avisos a su hora (carpeta worker/). */
export const PUSH_SERVER_URL = 'https://mi-cuatri-push.mi-cuatri-push.workers.dev';

/** Clave pública VAPID (la privada solo la tiene el worker). */
export const VAPID_PUBLIC_KEY =
  'BMDf-RJviTKSt24W40p8OI7-z4_LJwp9Qf5-BIvtfEN8JSiF4wuz7WQ8JeyxiScOf0EpRsZdLDUlj5gHscJwSeE';

export type NotificationType = 'rest' | 'creatina' | 'peso' | 'gym' | 'open-workout' | 'plan-week' | 'backup';

/** Tipos de aviso, en el orden en que se muestran en Checks. Todos activados por defecto. */
export const NOTIFICATION_TYPES: { id: NotificationType; label: string; hint: string }[] = [
  { id: 'rest', label: 'Descanso terminado', hint: 'Al acabar el descanso entre series' },
  { id: 'creatina', label: 'Creatina', hint: 'A las 21:30 si no la has marcado' },
  { id: 'peso', label: 'Pesarse', hint: 'L-X-V a las 7:00 si no te has pesado' },
  { id: 'gym', label: 'Entreno del día', hint: '15 min antes del bloque de gym del horario' },
  { id: 'open-workout', label: 'Entreno sin terminar', hint: '3 h después de empezarlo' },
  { id: 'plan-week', label: 'Planificar la semana', hint: 'Domingo a las 20:30 si no está hecho' },
  { id: 'backup', label: 'Copia de seguridad', hint: 'Domingo a las 20:00 si llevas 7 días sin copia' },
];

/** Detalle de cada aviso. `{routine}`, `{time}` y `{exercise}` se sustituyen. */
export const NOTIFY = {
  /** Días hacia delante que se programan cada vez que se sincroniza. */
  horizonDays: 7,
  rest: { title: 'Descanso terminado', body: 'Siguiente serie: {exercise}' },
  creatina: { item: 'creatina', time: '21:30', title: 'Creatina', body: 'Se te ha olvidado la creatina hoy' },
  peso: { time: '7:00', title: 'Pesarse', body: 'Pésate antes de desayunar' },
  /** Solo si el horario tiene un bloque de tipo Gym ese día. */
  gym: { minutesBefore: 15, title: 'Gym', body: 'Hoy toca {routine} a las {time}' },
  openWorkout: { afterMinutes: 180, title: 'Entreno sin terminar', body: 'El entreno de {routine} sigue abierto. ¿Lo terminas?' },
  planWeek: { item: 'plan', day: 6, time: '20:30', title: 'Planificar la semana', body: 'Toca planificar la semana (20 min)' },
  backup: { day: 6, time: '20:00', title: 'Copia de seguridad', body: 'Hace más de 7 días que no exportas una copia' },
};
