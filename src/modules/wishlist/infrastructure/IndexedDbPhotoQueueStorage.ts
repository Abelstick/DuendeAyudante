import type { QueuedPhoto, QueueStorage } from '../application/PhotoUploadQueue';

const DB_NAME = 'duende-ayudante';
const STORE = 'fotos-en-cola';

/**
 * Guarda la cola de fotos en el dispositivo (IndexedDB acepta archivos), para
 * que sobreviva si se cierra la app. Si el navegador no lo permite (modo
 * privado, almacenamiento bloqueado), la cola vive en memoria mientras la app esté abierta.
 */
export class IndexedDbPhotoQueueStorage implements QueueStorage {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('sin IndexedDB'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB bloqueado'));
    });
    // Si falla una vez, se vuelve a intentar abrir la próxima
    this.db.catch(() => (this.db = null));
    return this.db;
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  async load(): Promise<QueuedPhoto[]> {
    return (await this.tx('readonly', (s) => s.getAll())) as QueuedPhoto[];
  }

  async put(job: QueuedPhoto): Promise<void> {
    await this.tx('readwrite', (s) => s.put(job));
  }

  async remove(id: string): Promise<void> {
    await this.tx('readwrite', (s) => s.delete(id));
  }
}
