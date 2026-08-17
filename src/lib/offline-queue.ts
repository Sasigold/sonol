import { createStore, del, get, set } from 'idb-keyval';
import { classifyMutationError } from './errors';
import { toggleStationRpc } from './rpc';

/**
 * The offline mutation queue.
 *
 * Only ONE mutation is queued: completing or uncompleting a station. It is the
 * only thing the field worker does away from a desk, and the only one that is
 * lost today when the signal drops mid-round. Admin writes — users, stations,
 * resetting the round — are done sitting down on wifi; queueing them would add
 * failure modes for no benefit, so they keep failing loudly.
 *
 * The module knows nothing about React, TanStack Query or toasts. It is handed
 * an `execute` and a pair of handlers, which makes the whole thing testable
 * without a browser.
 */

/**
 * One record PER STATION, not per tap.
 *
 * `done` is the intent, not a delta, and `baseline` is what the server believed
 * before the first offline tap on this station. Together they collapse a run of
 * taps to a single call: mark → undo → mark replays as one `complete_station`,
 * and mark → undo replays as nothing at all.
 */
export interface QueuedToggle {
  stationId: string;
  /** Kept so a successful replay can invalidate the right station list. */
  areaId: string;
  done: boolean;
  baseline: boolean;
  queuedAt: number;
  attempts: number;
}

export interface QueueStorage {
  read: () => Promise<QueuedToggle[]>;
  write: (records: QueuedToggle[]) => Promise<void>;
}

export interface QueueHandlers {
  /** The record will never be sent. Tell the user their tap did not take. */
  onDropped?: (record: QueuedToggle, error: unknown) => void;
  /** At least one record replayed successfully. Refresh, and say so. */
  onDrained?: (replayed: readonly QueuedToggle[]) => void;
}

const DB_NAME = 'sonol-offline';
const STORE_NAME = 'queue';
const KEY = 'toggles';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * IndexedDB, not localStorage: Safari evicts localStorage under storage
 * pressure, which is precisely the moment a queued round must survive.
 *
 * The store is opened lazily. `createStore` calls `indexedDB.open` eagerly, and
 * at module scope that throws outright in jsdom and in any environment where
 * IndexedDB is unavailable (private browsing, an embedded webview with storage
 * disabled). Failures are swallowed so the queue degrades to memory-only rather
 * than taking the app down — the taps are still replayed within the session,
 * they just do not survive a reload.
 */
function openStore(): ReturnType<typeof createStore> | null {
  if (typeof indexedDB === 'undefined') return null;
  try {
    return createStore(DB_NAME, STORE_NAME);
  } catch {
    return null;
  }
}

let cachedStore: ReturnType<typeof createStore> | null | undefined;

function store(): ReturnType<typeof createStore> | null {
  cachedStore ??= openStore();
  return cachedStore;
}

export const idbStorage: QueueStorage = {
  async read() {
    const target = store();
    if (!target) return [];
    try {
      return (await get<QueuedToggle[]>(KEY, target)) ?? [];
    } catch {
      return [];
    }
  },
  async write(records) {
    const target = store();
    if (!target) return;
    try {
      if (records.length === 0) await del(KEY, target);
      else await set(KEY, records, target);
    } catch {
      /* memory-only fallback; see openStore */
    }
  },
};

export interface OfflineQueueOptions {
  execute: (record: QueuedToggle) => Promise<void>;
  storage?: QueueStorage;
  now?: () => number;
  maxAttempts?: number;
  maxAgeMs?: number;
}

/**
 * Property syntax rather than method shorthand throughout: `count` and
 * `subscribe` are handed to `useSyncExternalStore` unbound, and a method
 * signature makes that an `unbound-method` error. They are closures over the
 * factory's state, so there is no `this` to lose.
 */
export interface OfflineQueue {
  enqueue: (input: Omit<QueuedToggle, 'queuedAt' | 'attempts'>) => Promise<void>;
  drain: () => Promise<void>;
  clear: () => Promise<void>;
  /** Synchronous, for `useSyncExternalStore`. */
  count: () => number;
  snapshot: () => readonly QueuedToggle[];
  subscribe: (listener: () => void) => () => void;
  setHandlers: (handlers: QueueHandlers) => void;
  hydrate: () => Promise<void>;
}

export function createOfflineQueue({
  execute,
  storage = idbStorage,
  now = () => Date.now(),
  maxAttempts = 5,
  maxAgeMs = DAY_MS,
}: OfflineQueueOptions): OfflineQueue {
  let records: QueuedToggle[] = [];
  let handlers: QueueHandlers = {};
  let hydration: Promise<void> | null = null;
  let inFlight: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function hydrate(): Promise<void> {
    hydration ??= storage.read().then((stored) => {
      records = stored;
      notify();
    });
    return hydration;
  }

  async function persist(): Promise<void> {
    notify();
    await storage.write(records);
  }

  async function enqueue(input: Omit<QueuedToggle, 'queuedAt' | 'attempts'>): Promise<void> {
    await hydrate();
    const existing = records.find((record) => record.stationId === input.stationId);

    if (existing === undefined) {
      // Nothing to send if the intent already matches the server.
      if (input.done === input.baseline) return;
      records = [...records, { ...input, queuedAt: now(), attempts: 0 }];
    } else if (input.done === existing.baseline) {
      // Tapped back to where it started — the whole record cancels out.
      records = records.filter((record) => record !== existing);
    } else {
      // A fresh instruction for the same station: keep its place in the queue
      // and its original timestamp, reset the retry count.
      records = records.map((record) =>
        record === existing
          ? { ...record, done: input.done, areaId: input.areaId, attempts: 0 }
          : record,
      );
    }

    await persist();
  }

  async function run(): Promise<void> {
    await hydrate();
    const replayed: QueuedToggle[] = [];

    // Iterate a copy: the loop rewrites `records` as it goes.
    for (const record of [...records]) {
      const expired = now() - record.queuedAt > maxAgeMs;
      if (expired || record.attempts >= maxAttempts) {
        // Both halves of the bound. Attempts alone never fires for a tap that
        // keeps meeting a dead network; age alone never fires for one failing
        // fast in a loop. Neither classifier above is trusted to be
        // exhaustive, so this is the backstop that stops a poison record
        // retrying for ever.
        records = records.filter((candidate) => candidate !== record);
        await persist();
        handlers.onDropped?.(record, new Error(expired ? 'queued too long' : 'too many attempts'));
        continue;
      }

      try {
        await execute(record);
        records = records.filter((candidate) => candidate !== record);
        await persist();
        replayed.push(record);
      } catch (error) {
        const kind = classifyMutationError(error);

        if (kind === 'permanent') {
          records = records.filter((candidate) => candidate !== record);
          await persist();
          handlers.onDropped?.(record, error);
          continue;
        }

        if (kind === 'unknown') {
          records = records.map((candidate) =>
            candidate === record ? { ...candidate, attempts: candidate.attempts + 1 } : candidate,
          );
          await persist();
        }

        // Offline or an unexplained failure: stop. The link is not healthy and
        // firing the rest of the queue at it would only burn retries.
        break;
      }
    }

    if (replayed.length > 0) handlers.onDrained?.(replayed);
  }

  function drain(): Promise<void> {
    // Mount, reconnect and tab-focus can all fire at once; only one drain runs.
    inFlight ??= run().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  async function clear(): Promise<void> {
    await hydrate();
    records = [];
    await persist();
  }

  return {
    enqueue,
    drain,
    clear,
    hydrate,
    count: () => records.length,
    snapshot: () => records,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setHandlers: (next) => {
      handlers = next;
    },
  };
}

/**
 * The instance the app uses. Replays through the same RPC wrapper the online
 * path calls, so there is exactly one definition of what "mark this station"
 * means.
 */
export const offlineQueue = createOfflineQueue({
  execute: (record) => toggleStationRpc(record.stationId, record.done),
});
