import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createOfflineQueue,
  type OfflineQueue,
  type QueuedToggle,
  type QueueStorage,
} from './offline-queue';

/** An in-memory stand-in for IndexedDB, so the queue is testable in jsdom. */
function memoryStorage(initial: QueuedToggle[] = []): QueueStorage & { rows: QueuedToggle[] } {
  const state = { rows: initial };
  return {
    get rows() {
      return state.rows;
    },
    read: () => Promise.resolve(state.rows),
    write: (records) => {
      state.rows = records;
      return Promise.resolve();
    },
  };
}

function toggle(
  overrides: Partial<QueuedToggle> = {},
): Omit<QueuedToggle, 'queuedAt' | 'attempts'> {
  return {
    stationId: 'station-1',
    areaId: 'area-1',
    done: true,
    baseline: false,
    ...overrides,
  };
}

/** supabase-js surfaces a dropped connection as a bare TypeError from fetch. */
const offlineError = new TypeError('Failed to fetch');

const permissionError = Object.assign(new Error('permission denied for table stations'), {
  code: '42501',
});

describe('createOfflineQueue', () => {
  beforeEach(() => {
    // classifyMutationError consults navigator.onLine; keep it deterministic.
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });

  describe('enqueue', () => {
    it('stores a tap that differs from what the server believes', async () => {
      const storage = memoryStorage();
      const queue = createOfflineQueue({ storage, execute: vi.fn() });

      await queue.enqueue(toggle());

      expect(queue.count()).toBe(1);
      expect(storage.rows).toHaveLength(1);
    });

    it('stores nothing when the intent already matches the server', async () => {
      const queue = createOfflineQueue({ storage: memoryStorage(), execute: vi.fn() });

      await queue.enqueue(toggle({ done: true, baseline: true }));

      expect(queue.count()).toBe(0);
    });

    it('collapses repeated taps on one station to a single record', async () => {
      const queue = createOfflineQueue({ storage: memoryStorage(), execute: vi.fn() });

      // The caller passes the row as the cache held it just before the tap, and
      // offline that cache carries the optimistic result of the previous tap.
      // Modelled here so the sequence is the one the app actually produces.
      let cached = false;
      async function tap(done: boolean): Promise<void> {
        await queue.enqueue(toggle({ done, baseline: cached }));
        cached = done;
      }

      await tap(true);
      await tap(false);
      await tap(true);

      expect(queue.count()).toBe(1);
      expect(queue.snapshot()[0]?.done).toBe(true);
    });

    it('trusts its own baseline over the optimistic one a caller sends', async () => {
      const queue = createOfflineQueue({ storage: memoryStorage(), execute: vi.fn() });

      await queue.enqueue(toggle({ done: true, baseline: false }));
      // `baseline: true` here is the optimistic row, not the server's answer.
      // Believing it would make this look like a no-op and drop a real tap.
      await queue.enqueue(toggle({ done: true, baseline: true }));

      expect(queue.count()).toBe(1);
      expect(queue.snapshot()[0]?.baseline).toBe(false);
    });

    it('cancels the record entirely when the taps net out to nothing', async () => {
      const queue = createOfflineQueue({ storage: memoryStorage(), execute: vi.fn() });

      await queue.enqueue(toggle({ done: true, baseline: false }));
      await queue.enqueue(toggle({ done: false, baseline: true }));

      // Marking and unmarking offline must replay as nothing at all.
      expect(queue.count()).toBe(0);
    });

    it('keeps stations independent', async () => {
      const queue = createOfflineQueue({ storage: memoryStorage(), execute: vi.fn() });

      await queue.enqueue(toggle({ stationId: 'a' }));
      await queue.enqueue(toggle({ stationId: 'b' }));

      expect(queue.count()).toBe(2);
    });

    it('recovers a queue persisted by a previous session', async () => {
      const stored: QueuedToggle = { ...toggle(), queuedAt: 1_000, attempts: 0 };
      const queue = createOfflineQueue({ storage: memoryStorage([stored]), execute: vi.fn() });

      await queue.hydrate();

      expect(queue.count()).toBe(1);
    });
  });

  describe('drain', () => {
    it('replays in the order the taps were made', async () => {
      const seen: string[] = [];
      const queue = createOfflineQueue({
        storage: memoryStorage(),
        execute: (record) => {
          seen.push(record.stationId);
          return Promise.resolve();
        },
      });

      await queue.enqueue(toggle({ stationId: 'first' }));
      await queue.enqueue(toggle({ stationId: 'second' }));
      await queue.enqueue(toggle({ stationId: 'third' }));
      await queue.drain();

      expect(seen).toEqual(['first', 'second', 'third']);
      expect(queue.count()).toBe(0);
    });

    it('reports the replayed records once', async () => {
      const onDrained = vi.fn();
      const queue = createOfflineQueue({ storage: memoryStorage(), execute: vi.fn() });
      queue.setHandlers({ onDrained });

      await queue.enqueue(toggle({ stationId: 'a' }));
      await queue.enqueue(toggle({ stationId: 'b', areaId: 'area-2' }));
      await queue.drain();

      expect(onDrained).toHaveBeenCalledTimes(1);
      expect(onDrained.mock.calls[0]?.[0]).toHaveLength(2);
    });

    it('does not announce a drain that replayed nothing', async () => {
      const onDrained = vi.fn();
      const queue = createOfflineQueue({ storage: memoryStorage(), execute: vi.fn() });
      queue.setHandlers({ onDrained });

      await queue.drain();

      expect(onDrained).not.toHaveBeenCalled();
    });

    it('keeps the record and stops on a transient failure', async () => {
      const execute = vi.fn().mockRejectedValue(offlineError);
      const queue = createOfflineQueue({ storage: memoryStorage(), execute });

      await queue.enqueue(toggle({ stationId: 'a' }));
      await queue.enqueue(toggle({ stationId: 'b' }));
      await queue.drain();

      expect(queue.count()).toBe(2);
      // Stopped after the first refusal rather than hammering a dead link.
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('does not count a lost connection against the retry bound', async () => {
      const queue = createOfflineQueue({
        storage: memoryStorage(),
        execute: vi.fn().mockRejectedValue(offlineError),
      });

      await queue.enqueue(toggle());
      for (let attempt = 0; attempt < 10; attempt++) await queue.drain();

      // Ten failed reconnects must not discard a worker's round.
      expect(queue.count()).toBe(1);
      expect(queue.snapshot()[0]?.attempts).toBe(0);
    });

    it('drops a record the server will never accept, and says so', async () => {
      const onDropped = vi.fn();
      const queue = createOfflineQueue({
        storage: memoryStorage(),
        execute: vi.fn().mockRejectedValue(permissionError),
      });
      queue.setHandlers({ onDropped });

      await queue.enqueue(toggle());
      await queue.drain();

      expect(queue.count()).toBe(0);
      expect(onDropped).toHaveBeenCalledTimes(1);
    });

    it('bounds an unexplained failure by attempts', async () => {
      const onDropped = vi.fn();
      const execute = vi.fn().mockRejectedValue(new Error('internal server error'));
      const queue = createOfflineQueue({ storage: memoryStorage(), execute, maxAttempts: 3 });
      queue.setHandlers({ onDropped });

      await queue.enqueue(toggle());
      // Three drains raise `attempts` to 3; the fourth sees the bound and drops.
      for (let attempt = 0; attempt < 4; attempt++) await queue.drain();

      expect(queue.count()).toBe(0);
      expect(onDropped).toHaveBeenCalledTimes(1);
      // The bound stops the retries — no fourth call to the server.
      expect(execute).toHaveBeenCalledTimes(3);
    });

    it('drops a record that has sat in the queue too long', async () => {
      const onDropped = vi.fn();
      let clock = 0;
      const execute = vi.fn();
      const queue = createOfflineQueue({
        storage: memoryStorage(),
        execute,
        now: () => clock,
        maxAgeMs: 1_000,
      });
      queue.setHandlers({ onDropped });

      await queue.enqueue(toggle());
      clock = 5_000;
      await queue.drain();

      expect(queue.count()).toBe(0);
      expect(execute).not.toHaveBeenCalled();
      expect(onDropped).toHaveBeenCalledTimes(1);
    });

    it('keeps draining after dropping a poison record', async () => {
      const execute = vi.fn(({ stationId }: QueuedToggle) =>
        stationId === 'bad' ? Promise.reject(permissionError) : Promise.resolve(),
      );
      const queue = createOfflineQueue({ storage: memoryStorage(), execute });

      await queue.enqueue(toggle({ stationId: 'bad' }));
      await queue.enqueue(toggle({ stationId: 'good' }));
      await queue.drain();

      // One bad record must not strand every tap behind it.
      expect(queue.count()).toBe(0);
      expect(execute).toHaveBeenCalledTimes(2);
    });

    it('runs one drain at a time', async () => {
      let inFlight = 0;
      let overlapped = false;
      const queue = createOfflineQueue({
        storage: memoryStorage(),
        execute: async () => {
          inFlight++;
          if (inFlight > 1) overlapped = true;
          await Promise.resolve();
          inFlight--;
        },
      });

      await queue.enqueue(toggle({ stationId: 'a' }));
      await queue.enqueue(toggle({ stationId: 'b' }));
      // Mount, reconnect and tab-focus can all fire at once.
      await Promise.all([queue.drain(), queue.drain(), queue.drain()]);

      expect(overlapped).toBe(false);
      expect(queue.count()).toBe(0);
    });
  });

  describe('subscribers', () => {
    it('notifies on change and stops after unsubscribing', async () => {
      const listener = vi.fn();
      const queue = createOfflineQueue({ storage: memoryStorage(), execute: vi.fn() });

      const unsubscribe = queue.subscribe(listener);
      await queue.enqueue(toggle());
      expect(listener).toHaveBeenCalled();

      unsubscribe();
      const before = listener.mock.calls.length;
      await queue.enqueue(toggle({ stationId: 'other' }));
      expect(listener.mock.calls.length).toBe(before);
    });
  });

  describe('clear', () => {
    it('empties the queue and the store', async () => {
      const storage = memoryStorage();
      const queue: OfflineQueue = createOfflineQueue({ storage, execute: vi.fn() });

      await queue.enqueue(toggle());
      await queue.clear();

      // Sign-out must leave nothing to replay under the next account.
      expect(queue.count()).toBe(0);
      expect(storage.rows).toHaveLength(0);
    });
  });
});
