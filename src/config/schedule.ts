import type { EncryptedPayload } from '../domain/crypto';
import type { Category } from '../domain/types';
import encrypted from './profile.enc.json';

// Perfil cifrado (horario + configuración propia): se desbloquea una vez en cada dispositivo.
// Se genera con `npm run profile:encrypt`.
// Los colores de cada categoría del horario están en src/styles/main.css (--c-clase, --c-gym, ...).

export const ENCRYPTED_PROFILE = encrypted as EncryptedPayload;

/** Nombres por defecto de las categorías del horario. El perfil puede sustituirlos (campo `labels`). */
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
