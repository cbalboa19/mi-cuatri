// Estado en memoria + acciones. Cada acción actualiza la memoria al momento (la UI se pinta
// desde aquí, de forma síncrona) y guarda en el repositorio en segundo plano.

import { CATEGORY_LABELS, ENCRYPTED_PROFILE } from '../config/schedule';
import { decryptWithKey, decryptWithPassword, type EncryptedPayload } from '../domain/crypto';
import { parseProfilePayload, profileOf, type Profile } from '../domain/profile';
import { toSchedule, type Schedule } from '../domain/schedule';
import { parseBackupText, backupFileName, type Backup } from '../domain/backup';
import { resolveConfig, type Config, type UserConfig } from '../domain/config';
import { adjustSets, phaseFor } from '../domain/plan';
import type { ActiveWorkout, AppData, CheckScope, ExerciseDef, Workout } from '../domain/types';
import {
  addSet,
  createActiveExercise,
  createActiveWorkout,
  finishWorkout,
  moveItem,
  removeSet,
  toEditable,
  toggleSet,
  type ToggleResult,
} from '../domain/workout';
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
  private decryptedSchedule: Schedule | null = null;
  /** Configuración propia del perfil cifrado (null si este dispositivo no tiene la clave). */
  private profile: Profile | null = null;
  private cfgCache: { src: UserConfig; profile: Profile | null; cfg: Config } | null = null;

  constructor(
    private readonly repo: Repository,
    public data: AppData,
    public meta: DeviceMeta,
    private readonly onError: (e: unknown) => void,
    private readonly encrypted: EncryptedPayload = ENCRYPTED_PROFILE,
  ) {}

  static async load(
    repo: Repository,
    onError: (e: unknown) => void,
    encrypted: EncryptedPayload = ENCRYPTED_PROFILE,
  ): Promise<Store> {
    const [data, meta] = await Promise.all([repo.load(), repo.getMeta()]);
    const store = new Store(repo, data, meta, onError, encrypted);
    await store.loadSchedule();
    return store;
  }

  // ---------- Configuración ----------

  /** Configuración efectiva: valores por defecto + cambios del usuario. */
  get cfg(): Config {
    const c = this.cfgCache;
    if (c?.src !== this.data.config || c.profile !== this.profile) {
      this.cfgCache = { src: this.data.config, profile: this.profile, cfg: resolveConfig(this.data.config, this.profile) };
    }
    return this.cfgCache!.cfg;
  }

  /**
   * Cambia una sección de la configuración. `edit` recibe una copia de la configuración efectiva;
   * las secciones indicadas en `sections` se guardan enteras como cambios del usuario.
   */
  updateConfig(sections: (keyof UserConfig)[], edit: (c: Config & { schedule: UserConfig['schedule'] }) => void): void {
    const draft = {
      ...structuredClone(this.cfg),
      schedule: structuredClone(this.data.config.schedule ?? this.scheduleAsPayload() ?? { week: [[], [], [], [], [], [], []] }),
    };
    edit(draft);
    const next: UserConfig = { ...this.data.config };
    for (const k of sections) (next as Record<string, unknown>)[k] = structuredClone(draft[k as keyof typeof draft]);
    this.data.config = next;
    this.persist(this.repo.saveConfig(next));
  }

  /** Vuelve a los valores por defecto de una sección. */
  resetConfig(section: keyof UserConfig): void {
    const next: UserConfig = { ...this.data.config };
    delete next[section];
    this.data.config = next;
    this.persist(this.repo.saveConfig(next));
  }

  isCustomized(section: keyof UserConfig): boolean {
    return this.data.config[section] !== undefined;
  }

  /** Definición de un ejercicio en cualquier rutina. */
  findExercise(exerciseId: string): ExerciseDef | undefined {
    for (const r of this.cfg.routines) {
      const e = r.exercises.find((x) => x.id === exerciseId);
      if (e) return e;
    }
    return undefined;
  }

  /** ¿Este dispositivo tiene cargado el perfil (clave)? */
  get hasProfile(): boolean {
    return this.profile != null || this.decryptedSchedule != null;
  }

  // ---------- Horario ----------

  /** Horario en uso: el editado en el dispositivo o, si no hay, el que viene con la app. */
  get schedule(): Schedule | null {
    const own = this.data.config.schedule;
    return own ? toSchedule(own, CATEGORY_LABELS) : this.decryptedSchedule;
  }

  private scheduleAsPayload() {
    const s = this.decryptedSchedule;
    return s ? { labels: { ...s.labels }, week: structuredClone(s.week) } : undefined;
  }

  private applyProfile(value: unknown): void {
    const payload = parseProfilePayload(value);
    this.decryptedSchedule = toSchedule(payload, CATEGORY_LABELS);
    this.profile = profileOf(payload);
  }

  /** Descifra el perfil con la clave guardada en el dispositivo (si la hay y sigue valiendo). */
  private async loadSchedule(): Promise<void> {
    const key = await this.repo.getScheduleKey();
    if (!key) return;
    let value: unknown;
    try {
      value = await decryptWithKey(this.encrypted, key);
    } catch {
      // La clave ha cambiado: habrá que volver a escribirla.
      await this.repo.setScheduleKey(null);
      return;
    }
    try {
      this.applyProfile(value);
    } catch (e) {
      // Perfil con un formato inesperado: se ignora sin borrar la clave.
      this.onError(e);
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
    this.applyProfile(result.value);
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

  private phaseSets(now: Date) {
    return this.phase(now).sets;
  }

  /** Fase del plan en una fecha (con el texto de modo exámenes ajustado a las rutinas). */
  phase(now: Date) {
    const examDays = this.cfg.routines.filter((r) => r.exam && r.day != null).length;
    return phaseFor(now, this.data.settings.examMode, this.cfg.planStart, examDays);
  }

  startWorkout(routineId: string, now: Date): void {
    const routine = this.cfg.routines.find((r) => r.id === routineId);
    if (!routine) return;
    const deload = this.phase(now).key === 'deload';
    this.data.active = createActiveWorkout(routine, this.data.workouts, this.phaseSets(now), now.getTime(), deload);
    this.saveActive();
  }

  /** Abre un entreno guardado para corregirlo. False si hay otro entreno en curso. */
  editWorkout(id: string): boolean {
    if (this.data.active) return false;
    const w = this.data.workouts.find((x) => x.id === id);
    if (!w) return false;
    this.data.active = toEditable(w, (exId) => this.findExercise(exId));
    this.saveActive();
    return true;
  }

  /** Descanso del ejercicio `ei` del entreno en curso (s). */
  restFor(ei: number): number {
    const ex = this.data.active?.exercises[ei];
    return ex?.restSec ?? (ex ? this.findExercise(ex.exerciseId)?.restSec : undefined) ?? 90;
  }

  /** Añade un ejercicio al entreno en curso (y opcionalmente a su rutina). */
  addExerciseToActive(def: ExerciseDef, sets: number, alsoToRoutine: boolean): void {
    const active = this.data.active;
    if (!active) return;
    const n = active.editOf ? sets : adjustSets(sets, this.phaseSets(new Date()));
    const deload = !active.editOf && this.phase(new Date()).key === 'deload';
    active.exercises.push(createActiveExercise(def, this.data.workouts, n, deload));
    this.saveActive();
    if (alsoToRoutine && this.cfg.routines.some((r) => r.id === active.routineId)) {
      this.updateConfig(['routines'], (c) => {
        const r = c.routines.find((x) => x.id === active.routineId);
        if (r && !r.exercises.some((e) => e.id === def.id)) r.exercises.push(structuredClone(def));
      });
    }
  }

  removeExerciseFromActive(ei: number): void {
    this.data.active?.exercises.splice(ei, 1);
    this.saveActive();
  }

  moveExerciseInActive(ei: number, dir: -1 | 1): void {
    if (!this.data.active) return;
    moveItem(this.data.active.exercises, ei, dir);
    this.saveActive();
  }

  setExerciseRest(ei: number, restSec: number, alsoToRoutine: boolean): void {
    const active = this.data.active;
    const ex = active?.exercises[ei];
    if (!active || !ex) return;
    ex.restSec = restSec;
    this.saveActive();
    if (alsoToRoutine) {
      this.updateConfig(['routines'], (c) => {
        for (const r of c.routines) for (const e of r.exercises) if (e.id === ex.exerciseId) e.restSec = restSec;
      });
    }
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
    if (r.ok && r.completed && this.data.active) this.data.active.lastSetAt = Date.now();
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
    this.data.workouts = this.data.workouts.filter((x) => x.id !== w.id);
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
