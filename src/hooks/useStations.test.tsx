import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toggleStationRpc } from '@/lib/rpc';
import { offlineQueue } from '@/lib/offline-queue';
import { filterStations, stationKeys, useToggleStation, type Station } from './useStations';

vi.mock('@/lib/rpc', () => ({ toggleStationRpc: vi.fn() }));

const rpc = vi.mocked(toggleStationRpc);

const AREA_ID = 'area-1';

function station(overrides: Partial<Station> = {}): Station {
  return {
    id: 'station-1',
    area_id: AREA_ID,
    name: 'תחנה 1',
    sort_number: 1,
    fuel_type: 'regular',
    total: 0,
    flyers: 0,
    has_envelope: false,
    has_flyers_note: false,
    is_done: false,
    completed_at: null,
    completed_by: null,
    completed_by_name: null,
    completed_latitude: null,
    completed_longitude: null,
    completed_accuracy: null,
    latitude: null,
    longitude: null,
    waze_link: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData<Station[]>(stationKeys.byArea(AREA_ID), [station()]);

  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  const { result } = renderHook(() => useToggleStation(AREA_ID), { wrapper });
  return { client, result };
}

function cached(client: QueryClient): Station | undefined {
  return client.getQueryData<Station[]>(stationKeys.byArea(AREA_ID))?.[0];
}

describe('useToggleStation', () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });

  afterEach(async () => {
    onlineManager.setOnline(true);
    await offlineQueue.clear();
  });

  it('marks the station through the RPC, not queued, no position when there is no fix', async () => {
    rpc.mockResolvedValue(undefined);
    const { result } = setup();

    result.current.mutate({ station: station(), done: true });

    // The online path sends queued=false. If it ever sends true, a live tap
    // would be miscounted as an offline replay and dropped from the pace stats.
    // coords null when the caller passes none.
    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('station-1', true, false, null);
    });
    expect(offlineQueue.count()).toBe(0);
  });

  it('passes the captured position through on the online path', async () => {
    rpc.mockResolvedValue(undefined);
    const { result } = setup();
    const coords = { latitude: 32.1, longitude: 34.8, accuracy: 9 };

    result.current.mutate({ station: station(), done: true, coords });

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('station-1', true, false, coords);
    });
  });

  it('rolls the list back when the server refuses', async () => {
    rpc.mockRejectedValue(Object.assign(new Error('permission denied'), { code: '42501' }));
    const { client, result } = setup();

    result.current.mutate({ station: station(), done: true });

    // A failed call must never leave the screen claiming work that did not
    // happen — and it must not be queued for replay either.
    await waitFor(() => {
      expect(cached(client)?.is_done).toBe(false);
    });
    expect(offlineQueue.count()).toBe(0);
  });

  it('keeps the mark and queues the tap when the connection is gone', async () => {
    rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    const { client, result } = setup();

    result.current.mutate({ station: station(), done: true });

    // The whole point: the worker sees the station marked, and it syncs later.
    await waitFor(() => {
      expect(offlineQueue.count()).toBe(1);
    });
    expect(cached(client)?.is_done).toBe(true);
    expect(offlineQueue.snapshot()[0]).toMatchObject({
      stationId: 'station-1',
      areaId: AREA_ID,
      done: true,
      baseline: false,
    });
  });

  it('still attempts the call when the browser reports itself offline', async () => {
    // Regression guard for `networkMode: 'always'`.
    //
    // TanStack Query's default is to PAUSE a mutation while offline — the
    // request is never sent, `onError` never runs, and the tap is held in
    // memory only, so a reload loses it. Found in a browser, where nothing
    // ever reached the durable queue. If this test starts failing, the
    // offline queue has been quietly disconnected again.
    rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    onlineManager.setOnline(false);
    const { result } = setup();

    result.current.mutate({ station: station(), done: true });

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(offlineQueue.count()).toBe(1);
    });
  });

  it('does not refetch over a queued tap', async () => {
    rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    const { client, result } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    result.current.mutate({ station: station(), done: true });

    await waitFor(() => {
      expect(offlineQueue.count()).toBe(1);
    });
    // Invalidating here would replace the optimistic row with the server's
    // stale answer and un-mark the station in front of the worker.
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('replays a queued tap with the queued flag set', async () => {
    // The offline queue drains through the same RPC wrapper, but with
    // `queued = true` so the burst of replayed completions on reconnect is
    // excluded from the pace stats rather than read as travel time.
    rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = setup();

    result.current.mutate({ station: station(), done: true });
    await waitFor(() => {
      expect(offlineQueue.count()).toBe(1);
    });

    rpc.mockReset();
    rpc.mockResolvedValue(undefined);
    await offlineQueue.drain();

    expect(rpc).toHaveBeenCalledWith('station-1', true, true, null);
    expect(offlineQueue.count()).toBe(0);
  });

  it('replays a queued completion with the position captured at tap time', async () => {
    // The whole point of capturing at tap time: the fix taken in the dead zone
    // must ride the queue and be replayed, not a fix taken on reconnect
    // somewhere else entirely.
    rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = setup();
    const coords = { latitude: 32.5, longitude: 34.9, accuracy: 15 };

    result.current.mutate({ station: station(), done: true, coords });
    await waitFor(() => {
      expect(offlineQueue.count()).toBe(1);
    });
    expect(offlineQueue.snapshot()[0]?.coords).toEqual(coords);

    rpc.mockReset();
    rpc.mockResolvedValue(undefined);
    await offlineQueue.drain();

    expect(rpc).toHaveBeenCalledWith('station-1', true, true, coords);
    expect(offlineQueue.count()).toBe(0);
  });
});

describe('filterStations', () => {
  const list = [
    station({ id: 'a', name: 'תחנת רמלה', sort_number: 12 }),
    station({ id: 'b', name: 'תחנת לוד', sort_number: 12.5 }),
    station({ id: 'c', name: 'פז אשדוד', sort_number: 3 }),
  ];

  function ids(term: string): string[] {
    return filterStations(list, term).map((match) => match.id);
  }

  it('returns everything for an empty or whitespace term', () => {
    expect(ids('')).toEqual(['a', 'b', 'c']);
    expect(ids('   ')).toEqual(['a', 'b', 'c']);
  });

  it('matches part of a name', () => {
    expect(ids('רמלה')).toEqual(['a']);
    expect(ids('תחנת')).toEqual(['a', 'b']);
  });

  it('matches the station number as a prefix, so 12 finds 12 and 12.5', () => {
    expect(ids('12')).toEqual(['a', 'b']);
    expect(ids('12.5')).toEqual(['b']);
  });

  it('returns nothing when nothing matches', () => {
    expect(ids('חיפה')).toEqual([]);
  });

  it('does not mutate or reorder the input', () => {
    const before = list.map((item) => item.id);
    filterStations(list, 'תחנת');
    expect(list.map((item) => item.id)).toEqual(before);
  });
});
