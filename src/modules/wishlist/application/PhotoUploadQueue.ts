import { isAppError } from '@/shared/domain/errors';

/**
 * Cola de fotos por subir. El formulario se cierra al guardar y las fotos
 * suben aquí, de a una y en orden. Se guardan en el dispositivo (IndexedDB),
 * así que si se cierra la app o se corta el internet, siguen en cola y se
 * suben al volver.
 */
export interface QueuedPhoto {
  id: string;
  itemId: string;
  eventId: string;
  /** Cuenta que la puso en cola: solo esa sesión la sube. */
  userId: string;
  image: Blob;
  /** queued = esperando · uploading = subiendo ahora · failed = no se puede subir (la persona decide) */
  status: 'queued' | 'uploading' | 'failed';
  attempts: number;
  /** Código del último error (si lo hubo). */
  error: string | null;
  createdAt: number;
}

export interface QueueStorage {
  load(): Promise<QueuedPhoto[]>;
  put(job: QueuedPhoto): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface QueueOptions {
  /** Al subir una foto (p. ej. para refrescar la lista). */
  onUploaded?: (job: QueuedPhoto) => void;
  /** Espera antes de reintentar según el número de intento (ms). */
  retryDelays?: readonly number[];
  schedule?: (fn: () => void, ms: number) => unknown;
  newId?: () => string;
  now?: () => number;
}

/**
 * Errores pasajeros: se reintenta solo (sin internet, Google lento, sesión por renovar).
 * Los demás (sin Drive, sin permiso, máximo de fotos…) dejan la foto en "no se pudo subir".
 */
const TRANSIENT = new Set(['NETWORK', 'GOOGLE_ERROR', 'DRIVE_UPLOAD_FAILED', 'INTERNAL_ERROR', 'UNEXPECTED', 'NOT_AUTHENTICATED', 'TOO_MANY_ATTEMPTS']);
/** El regalo ya no existe: la foto se descarta sin molestar. */
const GONE = new Set(['NOT_FOUND']);

export function errorCode(err: unknown): string {
  return isAppError(err) ? err.code : 'NETWORK';
}

export class PhotoUploadQueue {
  private jobs: QueuedPhoto[] = [];
  private listeners = new Set<() => void>();
  private userId: string | null = null;
  private running = false;
  private started: Promise<void> | null = null;
  private waitingRetry = false;
  private readonly retryDelays: readonly number[];
  private readonly schedule: (fn: () => void, ms: number) => unknown;
  private readonly newId: () => string;
  private readonly now: () => number;

  constructor(
    private readonly storage: QueueStorage,
    private readonly upload: (itemId: string, image: Blob) => Promise<void>,
    private readonly options: QueueOptions = {},
  ) {
    this.retryDelays = options.retryDelays ?? [2_000, 5_000, 15_000, 30_000, 60_000];
    this.schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    this.newId = options.newId ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => Date.now());
  }

  // ---- Para React (useSyncExternalStore) -------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): readonly QueuedPhoto[] => this.jobs;

  private emit() {
    this.jobs = [...this.jobs]; // nueva referencia para que React vea el cambio
    this.listeners.forEach((l) => l());
  }

  private async save(job: QueuedPhoto) {
    try {
      await this.storage.put(job);
    } catch {
      // sin almacenamiento: la cola vive en memoria mientras la app esté abierta
    }
  }

  private async drop(id: string) {
    this.jobs = this.jobs.filter((j) => j.id !== id);
    this.emit();
    try {
      await this.storage.remove(id);
    } catch {
      // ya no está en memoria; si quedó guardada, se descartará al cargar si el regalo no existe
    }
  }

  // ---- Uso ---------------------------------------------------------------

  /** Quién tiene la sesión: solo se suben sus fotos. */
  setUser(userId: string | null) {
    this.userId = userId;
    if (userId) this.nudge();
  }

  /** Carga lo pendiente del dispositivo y empieza a subir. Se puede llamar varias veces. */
  start(): Promise<void> {
    this.started ??= (async () => {
      let stored: QueuedPhoto[] = [];
      try {
        stored = await this.storage.load();
      } catch {
        stored = [];
      }
      // Lo que quedó "subiendo" al cerrar la app vuelve a la cola
      const known = new Set(this.jobs.map((j) => j.id));
      const loaded = stored.filter((j) => !known.has(j.id)).map((j) => (j.status === 'uploading' ? { ...j, status: 'queued' as const } : j));
      this.jobs = [...loaded, ...this.jobs].sort((a, b) => a.createdAt - b.createdAt);
      this.emit();
    })();
    return this.started.then(() => this.nudge());
  }

  /** Pone fotos en cola para un regalo (ya achicadas). */
  async enqueue(itemId: string, eventId: string, images: readonly Blob[]) {
    if (!this.userId || images.length === 0) return;
    const base = this.now();
    const added = images.map<QueuedPhoto>((image, i) => ({
      id: this.newId(),
      itemId,
      eventId,
      userId: this.userId!,
      image,
      status: 'queued',
      attempts: 0,
      error: null,
      createdAt: base + i, // conserva el orden elegido
    }));
    this.jobs = [...this.jobs, ...added];
    this.emit();
    await Promise.all(added.map((j) => this.save(j)));
    this.nudge();
  }

  /** Vuelve a intentar una foto que no se pudo subir. */
  async retry(id: string) {
    const job = this.jobs.find((j) => j.id === id);
    if (!job || job.status !== 'failed') return;
    await this.update(job, { status: 'queued', attempts: 0, error: null });
    this.nudge();
  }

  /** Quita una foto de la cola (no se sube). */
  discard(id: string) {
    return this.drop(id);
  }

  /** Quita todas las fotos en cola de un regalo (p. ej. al borrarlo). */
  async discardItem(itemId: string) {
    for (const job of this.jobs.filter((j) => j.itemId === itemId)) await this.drop(job.id);
  }

  /** Cuántas fotos de este regalo están en cola o subiendo (para no pasar el máximo). */
  pendingCount(itemId: string) {
    return this.jobs.filter((j) => j.itemId === itemId && j.status !== 'failed').length;
  }

  /** Despierta la cola (al volver el internet, al iniciar sesión…). */
  nudge() {
    if (this.waitingRetry) return; // ya hay un reintento programado
    void this.run();
  }

  /** Reintenta ya, sin esperar el temporizador (p. ej. cuando vuelve el internet). */
  retryNow() {
    this.waitingRetry = false;
    void this.run();
  }

  private async update(job: QueuedPhoto, patch: Partial<QueuedPhoto>) {
    const next = { ...job, ...patch };
    this.jobs = this.jobs.map((j) => (j.id === job.id ? next : j));
    this.emit();
    await this.save(next);
    return next;
  }

  private nextJob() {
    return this.jobs.find((j) => j.status === 'queued' && j.userId === this.userId);
  }

  private async run() {
    if (this.running || !this.userId || !this.started) return;
    this.running = true;
    try {
      let job = this.nextJob();
      while (job) {
        const current = await this.update(job, { status: 'uploading' });
        try {
          await this.upload(current.itemId, current.image);
          await this.drop(current.id);
          this.options.onUploaded?.(current);
        } catch (err) {
          const code = errorCode(err);
          if (GONE.has(code)) {
            await this.drop(current.id);
          } else if (TRANSIENT.has(code)) {
            // Se queda en cola (primera de la fila) y se reintenta después
            const attempts = current.attempts + 1;
            await this.update(current, { status: 'queued', attempts, error: code });
            const delay = this.retryDelays[Math.min(attempts - 1, this.retryDelays.length - 1)] ?? 60_000;
            this.waitingRetry = true;
            this.schedule(() => {
              this.waitingRetry = false;
              void this.run();
            }, delay);
            return;
          } else {
            await this.update(current, { status: 'failed', error: code });
          }
        }
        job = this.nextJob();
      }
    } finally {
      this.running = false;
    }
  }
}
