// Interfaz de almacenamiento. La UI y el store solo conocen esto: para pasar a sync en la nube
// (p. ej. Supabase) basta con otra implementación de Repository.

import type { Backup } from '../domain/backup';
import type { NotificationType } from '../config/notifications';
import type { UserConfig } from '../domain/config';
import type { ActiveWorkout, AppData, CheckScope, Settings, Workout } from '../domain/types';

/** Datos de este dispositivo que no forman parte del backup. */
export interface DeviceMeta {
  lastExportAt: number | null;
}

/** Registro de este dispositivo en el servidor de avisos. No va en el backup. */
export interface NotifyState {
  deviceId: string;
  secret: string;
  /** Dueño (registrado con su clave) o invitado (con un código). Sin valor = registro antiguo del dueño. */
  role?: 'owner' | 'guest';
  disabled: Partial<Record<NotificationType, boolean>>;
}

export interface Repository {
  /** Texto del indicador del header ("Local", "Sincronizado"...). */
  readonly syncLabel: string;
  /** true si los datos están en la nube. */
  readonly synced: boolean;

  load(): Promise<AppData>;

  saveChecks(scope: CheckScope, period: string, items: Record<string, boolean>): Promise<void>;
  setWeight(date: string, kg: number): Promise<void>;
  deleteWeight(date: string): Promise<void>;
  saveWorkout(workout: Workout): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
  saveActiveWorkout(active: ActiveWorkout | null): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  saveConfig(config: UserConfig): Promise<void>;

  exportBackup(now: Date): Promise<Backup>;
  /** Sustituye TODOS los datos por los del backup (ya validado). */
  importBackup(backup: Backup): Promise<void>;

  getMeta(): Promise<DeviceMeta>;
  setMeta(meta: DeviceMeta): Promise<void>;

  /** Clave (no exportable) que descifra el horario en este dispositivo. No va en el backup. */
  getScheduleKey(): Promise<CryptoKey | null>;
  setScheduleKey(key: CryptoKey | null): Promise<void>;

  getNotifyState(): Promise<NotifyState | null>;
  setNotifyState(state: NotifyState | null): Promise<void>;
}
