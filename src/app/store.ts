// Estado en memoria + acciones. Cada acción actualiza la memoria al momento (la UI se pinta
// desde aquí, de forma síncrona) y guarda en el repositorio en segundo plano.

import { ROUTINES } from '../config/routines';
import { CATEGORY_LABELS, ENCRYPTED_SCHEDULE } from '../config/schedule';
import { decryptWithKey, decryptWithPassword, type EncryptedPayload } from '../domain/crypto';
import { parseSchedulePayload, toSchedule, type Schedule } from '../domain/schedule';
import { parseBackupText, backupFileName, type Backup } from '../domain/backup';
import { phaseFor } from '../domain/plan';
import type { ActiveWorkout, AppData, CheckScope, Workout } from '../domain/types';
import { addSet, createActiveWorkout, finishWorkout, removeSet, toggleSet, type ToggleResult } from '../domain/workout';
import type { DeviceMeta, Repository } from '../data/repository';

export const BACKUP_REMINDER_DAYS = 7;

export interface ExportResult {
  name: string;
  json: string;
  backup: Backup;
}

export class Store {
  /** Se incrementa con cada cambio; sirve para saber si la exportación precalculada sigue valiendo. */
  private rev = 0;
  private exportCache: { rev: number; result: ExportResult } | null = null;
  /** Se llama tras cada cambio (urgent = afecta al descanso en curso). Lo usan las notificaciones. */
  onChange: ((urgent: boolean) => void) | null = null;
  /** Horario descifrado; null mientras no se haya desbloqueado en este dispositivo. */
  schedule: Schedule | null = null;

  constructor(
    private readonly repo: Repository,
    public data: AppData,
    public meta: DeviceMeta,
    private readonly onError: (e: unknown) => void,
    private readonly encrypted: EncryptedPayload = ENCRYPTED_SCHEDULE,
  ) {}

  static async load(
    repo: Repository,
    onError: (e: unknown) => void,
    encrypted: EncryptedPayload = ENCRYPTED_SCHEDULE,
  ): Promise<Store> {
    const [data, meta] = await Promise.all([repo.load(), repo.getMeta()]);
    const store = new Store(repo, data, meta, onError, encrypted);
    await store.loadSchedule();
    return store;
  }

  // ---------- Horario ----------

  /** Descifra el horario con la clave guardada en el dispositivo (si la hay y sigue valiendo). */
  private async loadSchedule(): Promise<void> {
    const key = await this.repo.getScheduleKey();
    if (!key) return;
    try {
      this.schedule = toSchedule(parseSchedulePayload(await decryptWithKey(this.encrypted, key)), CATEGORY_LABELS);
    } catch {
      // La clave del horario ha cambiado: habrá que volver a escribirla.
      this.schedule = null;
      await this.repo.setScheduleKey(null);
    }
  }

  /** Intenta desbloquear el horario con la contraseña. Devuelve false si no es correcta. */
  async unlockSchedule(password: string): Promise<boolean> {
    let result: { value: unknown; key: CryptoKey };
    try {
      result = await decryptWithPassword(this.encrypted, password.trim());
    } catch {
      return false;
    }
    this.schedule = toSchedule(parseSchedulePayload(result.value), CATEGORY_LABELS);
    // Si no se pudiera guardar la clave, el horario sigue visible en esta sesión.
    await this.repo.setScheduleKey(result.key).catch(this.onError);
    this.onChange?.(false);
    return true;
  }

  get syncLabel(): string {
    return this.repo.syncLabel;
  }
  get synced(): boolean {
    return this.repo.synced;
  }

  private persist(p: Promise<unknown>, urgent = false): void {
    this.rev++;
    p.catch(this.onError);
    this.onChange?.(urgent);
  }

  // ---------- Checklists y ajustes ----------

  toggleCheck(scope: CheckScope, period: string, itemId: string): void {
    const items = (this.data.checks[scope][period] ??= {});
    items[itemId] = !items[itemId];
    this.persist(this.repo.saveChecks(scope, period, items));
  }

  setExamMode(on: boolean): void {
    this.data.settings.examMode = on;
    this.persist(this.repo.saveSettings(this.data.settings));
  }

  // ---------- Peso ----------

  setWeight(date: string, kg: number): void {
    this.data.weights[date] = kg;
    this.persist(this.repo.setWeight(date, kg));
  }

  deleteWeight(date: string): void {
    delete this.data.weights[date];
    this.persist(this.repo.deleteWeight(date));
  }

  // ---------- Entreno en curso ----------

  get active(): ActiveWorkout | null {
    return this.data.active;
  }

  private saveActive(urgent = false): void {
    this.persist(this.repo.saveActiveWorkout(this.data.active), urgent);
  }

  startWorkout(routineId: string, now: Date): void {
    const routine = ROUTINES.find((r) => r.id === routineId);
    if (!routine) return;
    const phase = phaseFor(now, this.data.settings.examMode);
    this.data.active = createActiveWorkout(routine, this.data.workouts, phase.sets, now.getTime());
    this.saveActive();
  }

  setSetField(ei: number, si: number, field: 'kg' | 'reps', value: string): void {
    const set = this.data.active?.exercises[ei]?.sets[si];
    if (!set) return;
    set[field] = value;
    this.saveActive();
  }

  toggleSet(ei: number, si: number): ToggleResult | null {
    const set = this.data.active?.exercises[ei]?.sets[si];
    if (!set) return null;
    const r = toggleSet(set);
    if (r.ok) this.saveActive();
    return r;
  }

  addSet(ei: number): void {
    const ex = this.data.active?.exercises[ei];
    if (!ex) return;
    addSet(ex);
    this.saveActive();
  }

  removeSet(ei: number): void {
    const ex = this.data.active?.exercises[ei];
    if (!ex) return;
    removeSet(ex);
    this.saveActive();
  }

  setRest(endsAt: number | null): void {
    if (!this.data.active || this.data.active.restEndsAt === endsAt) return;
    this.data.active.restEndsAt = endsAt;
    this.saveActive(true);
  }

  /** Guarda el entreno en curso. Null si no hay ninguna serie marcada. */
  finishWorkout(now: number): Workout | null {
    if (!this.data.active) return null;
    const w = finishWorkout(this.data.active, now);
    if (!w) return null;
    this.data.workouts.push(w);
    this.data.workouts.sort((a, b) => a.startedAt - b.startedAt);
    this.data.active = null;
    this.persist(this.repo.saveWorkout(w));
    this.saveActive(true);
    return w;
  }

  discardWorkout(): void {
    this.data.active = null;
    this.saveActive(true);
  }

  deleteWorkout(id: string): void {
    this.data.workouts = this.data.workouts.filter((w) => w.id !== id);
    this.persist(this.repo.deleteWorkout(id));
  }

  // ---------- Backup ----------

  /** Días desde la última exportación, o null si nunca se ha exportado. */
  daysSinceExport(now: number): number | null {
    return this.meta.lastExportAt == null ? null : Math.floor((now - this.meta.lastExportAt) / 86_400_000);
  }

  hasData(): boolean {
    const d = this.data;
    return (
      d.workouts.length > 0 ||
      Object.keys(d.weights).length > 0 ||
      Object.values(d.checks).some((scope) => Object.keys(scope).length > 0)
    );
  }

  /** ¿Toca recordar que exporte? (hay datos y más de 7 días sin copia). */
  needsBackup(now: number): boolean {
    if (!this.hasData()) return false;
    const days = this.daysSinceExport(now);
    return days == null || days >= BACKUP_REMINDER_DAYS;
  }

  async exportBackup(now: Date): Promise<ExportResult> {
    const backup = await this.repo.exportBackup(now);
    return { name: backupFileName(now), json: JSON.stringify(backup, null, 2), backup };
  }

  /**
   * Prepara la exportación por adelantado. En iOS la hoja de compartir tiene que abrirse
   * justo al pulsar el botón, sin esperas asíncronas de por medio.
   */
  async warmExport(): Promise<void> {
    const rev = this.rev;
    if (this.exportCache?.rev === rev) return;
    const result = await this.exportBackup(new Date());
    if (rev === this.rev) this.exportCache = { rev, result };
  }

  /** Exportación precalculada si sigue al día con los datos. */
  cachedExport(): ExportResult | null {
    return this.exportCache?.rev === this.rev ? this.exportCache.result : null;
  }

  async markExported(now: number): Promise<void> {
    this.meta = { ...this.meta, lastExportAt: now };
    await this.repo.setMeta(this.meta);
    this.onChange?.(false);
  }

  /** Valida el texto y, si es correcto, devuelve una función que aplica la importación. */
  prepareImport(text: string): { ok: true; summary: string; apply: () => Promise<void> } | { ok: false; error: string } {
    const r = parseBackupText(text);
    if (!r.ok) return r;
    const { data } = r.backup;
    const summary = `${data.workouts.length} entrenos, ${data.weights.length} pesajes y ${data.checks.length} checklists`;
    return {
      ok: true,
      summary,
      apply: async () => {
        await this.repo.importBackup(r.backup);
        this.data = await this.repo.load();
        this.rev++;
        this.onChange?.(false);
      },
    };
  }
}
