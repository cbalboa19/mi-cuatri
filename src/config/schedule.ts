import type { EncryptedPayload } from '../domain/crypto';
import type { Category } from '../domain/types';
import encrypted from './schedule.enc.json';

// El horario se distribuye cifrado (schedule.enc.json) y se desbloquea una vez en cada dispositivo.
// Se genera con `npm run schedule:encrypt`.
// Los colores de cada categoría están en src/styles/main.css (--c-clase, --c-gym, ...).

export const ENCRYPTED_SCHEDULE = encrypted as EncryptedPayload;

/** Nombres por defecto de las categorías. El horario puede sustituirlos (campo `labels`). */
export const CATEGORY_LABELS: Record<Category, string> = {
  clase: 'Clase',
  lab: 'Laboratorio',
  estudio: 'Estudio',
  gym: 'Gym',
  comida: 'Comida',
  viaje: 'Viaje',
  ocio: 'Ocio',
  sueno: 'Dormir',
  libre: 'Libre',
  rutina: 'Rutina',
};
