// Repository sobre IndexedDB (local-first, funciona offline).

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  buildBackup,
  checkId,
  toAppData,
  type Backup,
  type CheckRecord,
  type SettingsRecord,
  type WeightRecord,
  type WorkoutRecord,
} from '../domain/backup';
import type { ActiveWorkout, AppData, CheckScope, Settings, Workout } from '../domain/types';
import type { DeviceMeta, NotifyState, Repository } from './repository';

type KvValue =
  | { key: 'settings'; value: SettingsRecord }
  | { key: 'active'; value: ActiveWorkout | null }
  | { key: 'meta'; value: DeviceMeta }
  | { key: 'scheduleKey'; value: CryptoKey | null }
  | { key: 'notify'; value: NotifyState | null };

interface MiCuatriDB extends DBSchema {
  checks: { key: string; value: CheckRecord };
  weights: { key: string; value: WeightRecord };
  workouts: { key: string; value: WorkoutRecord; indexes: { startedAt: number } };
  kv: { key: KvValue['key']; value: KvValue };
}

export const DB_NAME = 'mi-cuatri';
const DB_VERSION = 1;
const DATA_STORES = ['checks', 'weights', 'workouts', 'kv'] as const;

const DEFAULT_SETTINGS: SettingsRecord = { examMode: false, updatedAt: 0 };

export class IdbRepository implements Repository {
  readonly syncLabel = 'Local';
  readonly synced = false;

  private constructor(
    private readonly db: IDBPDatabase<MiCuatriDB>,
    private readonly now: () => number,
  ) {}

  static async open(name = DB_NAME, now: () => number = Date.now): Promise<IdbRepository> {
    const db = await openDB<MiCuatriDB>(name, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('checks', { keyPath: 'id' });
          db.createObjectStore('weights', { keyPath: 'date' });
          const workouts = db.createObjectStore('workouts', { keyPath: 'id' });
          workouts.createIndex('startedAt', 'startedAt');
          db.createObjectStore('kv', { keyPath: 'key' });
        }
      },
    });
    return new IdbRepository(db, now);
  }

  close(): void {
    this.db.close();
  }

  private async readAll() {
    const tx = this.db.transaction(DATA_STORES, 'readonly');
    const [checks, weights, workouts, settings, active] = await Promise.all([
      tx.objectStore('checks').getAll(),
      tx.objectStore('weights').getAll(),
      tx.objectStore('workouts').index('startedAt').getAll(),
      tx.objectStore('kv').get('settings'),
      tx.objectStore('kv').get('active'),
    ]);
    await tx.done;
    return {
      checks,
      weights,
      workouts,
      settings: settings?.key === 'settings' ? settings.value : DEFAULT_SETTINGS,
      active: active?.key === 'active' ? active.value : null,
    };
  }

  async load(): Promise<AppData> {
    return toAppData(await this.readAll());
  }

  async saveChecks(scope: CheckScope, period: string, items: Record<string, boolean>): Promise<void> {
    await this.db.put('checks', { id: checkId(scope, period), scope, period, items: { ...items }, updatedAt: this.now() });
  }

  async setWeight(date: string, kg: number): Promise<void> {
    await this.db.put('weights', { date, kg, updatedAt: this.now() });
  }

  async deleteWeight(date: string): Promise<void> {
    await this.db.delete('weights', date);
  }

  async saveWorkout(workout: Workout): Promise<void> {
    await this.db.put('workouts', { ...workout, updatedAt: this.now() });
  }

  async deleteWorkout(id: string): Promise<void> {
    await this.db.delete('workouts', id);
  }

  async saveActiveWorkout(active: ActiveWorkout | null): Promise<void> {
    await this.db.put('kv', { key: 'active', value: active });
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.db.put('kv', { key: 'settings', value: { ...settings, updatedAt: this.now() } });
  }

  async exportBackup(now: Date): Promise<Backup> {
    return buildBackup(await this.readAll(), now);
  }

  async importBackup(backup: Backup): Promise<void> {
    const { data } = backup;
    const tx = this.db.transaction(DATA_STORES, 'readwrite');
    const meta = await tx.objectStore('kv').get('meta');
    const scheduleKey = await tx.objectStore('kv').get('scheduleKey');
    const notify = await tx.objectStore('kv').get('notify');
    await Promise.all(DATA_STORES.map((s) => tx.objectStore(s).clear()));
    const ops: Promise<unknown>[] = [
      ...data.checks.map((c) => tx.objectStore('checks').put(c)),
      ...data.weights.map((w) => tx.objectStore('weights').put(w)),
      ...data.workouts.map((w) => tx.objectStore('workouts').put(w)),
      tx.objectStore('kv').put({ key: 'settings', value: data.settings }),
      tx.objectStore('kv').put({ key: 'active', value: data.active }),
    ];
    if (meta) ops.push(tx.objectStore('kv').put(meta));
    if (scheduleKey) ops.push(tx.objectStore('kv').put(scheduleKey));
    if (notify) ops.push(tx.objectStore('kv').put(notify));
    await Promise.all(ops);
    await tx.done;
  }

  async getMeta(): Promise<DeviceMeta> {
    const m = await this.db.get('kv', 'meta');
    return m?.key === 'meta' ? m.value : { lastExportAt: null };
  }

  async setMeta(meta: DeviceMeta): Promise<void> {
    await this.db.put('kv', { key: 'meta', value: meta });
  }

  async getScheduleKey(): Promise<CryptoKey | null> {
    const k = await this.db.get('kv', 'scheduleKey');
    return k?.key === 'scheduleKey' ? k.value : null;
  }

  async setScheduleKey(key: CryptoKey | null): Promise<void> {
    await this.db.put('kv', { key: 'scheduleKey', value: key });
  }

  async getNotifyState(): Promise<NotifyState | null> {
    const n = await this.db.get('kv', 'notify');
    return n?.key === 'notify' ? n.value : null;
  }

  async setNotifyState(state: NotifyState | null): Promise<void> {
    await this.db.put('kv', { key: 'notify', value: state });
  }
}
