import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/domain/errors';
import { PhotoUploadQueue, type QueuedPhoto, type QueueStorage } from './PhotoUploadQueue';

function memoryStorage(initial: QueuedPhoto[] = []): QueueStorage & { data: Map<string, QueuedPhoto> } {
  const data = new Map(initial.map((j) => [j.id, j]));
  return {
    data,
    load: async () => [...data.values()],
    put: async (j) => void data.set(j.id, j),
    remove: async (id) => void data.delete(id),
  };
}

function setup(upload = vi.fn().mockResolvedValue(undefined), storage = memoryStorage()) {
  let n = 0;
  const timers: { fn: () => void; ms: number }[] = [];
  const onUploaded = vi.fn();
  const queue = new PhotoUploadQueue(storage, upload, {
    onUploaded,
    newId: () => `job-${++n}`,
    now: () => 1000,
    schedule: (fn, ms) => timers.push({ fn, ms }),
  });
  return { queue, upload, storage, timers, onUploaded };
}

const img = () => new Blob(['x'], { type: 'image/jpeg' });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('PhotoUploadQueue', () => {
  it('sube en orden, de a una, y avisa cada foto subida', async () => {
    const { queue, upload, storage, onUploaded } = setup();
    queue.setUser('u1');
    await queue.start();
    await queue.enqueue('item-1', 'ev', [img(), img()]);
    await flush();
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls.map((c) => c[0])).toEqual(['item-1', 'item-1']);
    expect(onUploaded).toHaveBeenCalledTimes(2);
    expect(queue.getSnapshot()).toEqual([]);
    expect(storage.data.size).toBe(0);
  });

  it('sin internet la foto se queda en cola y se reintenta después', async () => {
    const upload = vi.fn().mockRejectedValueOnce(new AppError('NETWORK')).mockResolvedValue(undefined);
    const { queue, timers } = setup(upload);
    queue.setUser('u1');
    await queue.start();
    await queue.enqueue('item-1', 'ev', [img()]);
    await flush();
    expect(queue.getSnapshot()[0]).toMatchObject({ status: 'queued', attempts: 1, error: 'NETWORK' });
    expect(timers).toHaveLength(1);

    timers[0]!.fn(); // pasa el tiempo de espera
    await flush();
    expect(upload).toHaveBeenCalledTimes(2);
    expect(queue.getSnapshot()).toEqual([]);
  });

  it('un error permanente deja la foto como "no se pudo subir"; se puede reintentar o quitar', async () => {
    const upload = vi.fn().mockRejectedValueOnce(new AppError('DRIVE_NOT_CONNECTED')).mockResolvedValue(undefined);
    const { queue } = setup(upload);
    queue.setUser('u1');
    await queue.start();
    await queue.enqueue('item-1', 'ev', [img(), img()]);
    await flush();
    // La primera falló; la segunda siguió y subió
    expect(queue.getSnapshot()).toEqual([expect.objectContaining({ id: 'job-1', status: 'failed', error: 'DRIVE_NOT_CONNECTED' })]);

    await queue.retry('job-1');
    await flush();
    expect(queue.getSnapshot()).toEqual([]);
  });

  it('si el regalo ya no existe, la foto se descarta sola', async () => {
    const { queue } = setup(vi.fn().mockRejectedValue(new AppError('NOT_FOUND')));
    queue.setUser('u1');
    await queue.start();
    await queue.enqueue('item-1', 'ev', [img()]);
    await flush();
    expect(queue.getSnapshot()).toEqual([]);
  });

  it('al abrir la app retoma lo pendiente (incluso lo que quedó "subiendo") solo para la misma cuenta', async () => {
    const pending = (id: string, userId: string, status: QueuedPhoto['status']): QueuedPhoto => ({
      id,
      itemId: 'item-1',
      eventId: 'ev',
      userId,
      image: img(),
      status,
      attempts: 0,
      error: null,
      createdAt: id === 'a' ? 1 : 2,
    });
    const storage = memoryStorage([pending('a', 'u1', 'uploading'), pending('b', 'otra', 'queued')]);
    const { queue, upload } = setup(undefined, storage);
    queue.setUser('u1');
    await queue.start();
    await flush();
    expect(upload).toHaveBeenCalledTimes(1);
    // La de otra cuenta espera a que esa cuenta entre
    expect(queue.getSnapshot().map((j) => j.id)).toEqual(['b']);
  });

  it('cuenta las pendientes de un regalo y las descarta al borrarlo', async () => {
    const { queue } = setup(vi.fn(() => new Promise<void>(() => {}))); // nunca termina de subir
    queue.setUser('u1');
    await queue.start();
    await queue.enqueue('item-1', 'ev', [img(), img()]);
    await queue.enqueue('item-2', 'ev', [img()]);
    expect(queue.pendingCount('item-1')).toBe(2);
    await queue.discardItem('item-1');
    expect(queue.pendingCount('item-1')).toBe(0);
    expect(queue.pendingCount('item-2')).toBe(1);
  });
});
