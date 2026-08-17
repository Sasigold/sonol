import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted so the mock factory can close over it (vi.mock is hoisted above imports).
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { rpc } }));

import { toggleStationRpc } from './rpc';

describe('toggleStationRpc', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
  });

  it('completes, defaulting the queued flag to false', async () => {
    await toggleStationRpc('station-1', true);
    expect(rpc).toHaveBeenCalledWith('complete_station', {
      p_station_id: 'station-1',
      p_queued: false,
    });
  });

  it('uncompletes, defaulting the queued flag to false', async () => {
    await toggleStationRpc('station-1', false);
    expect(rpc).toHaveBeenCalledWith('uncomplete_station', {
      p_station_id: 'station-1',
      p_queued: false,
    });
  });

  it('marks the row as queued when replaying from the offline queue', async () => {
    await toggleStationRpc('station-1', true, true);
    expect(rpc).toHaveBeenCalledWith('complete_station', {
      p_station_id: 'station-1',
      p_queued: true,
    });
  });

  it('sends the captured position on a completion', async () => {
    await toggleStationRpc('station-1', true, false, {
      latitude: 32.1,
      longitude: 34.8,
      accuracy: 12,
    });
    expect(rpc).toHaveBeenCalledWith('complete_station', {
      p_station_id: 'station-1',
      p_queued: false,
      p_latitude: 32.1,
      p_longitude: 34.8,
      p_accuracy: 12,
    });
  });

  it('omits position keys entirely when there is no fix', async () => {
    await toggleStationRpc('station-1', true, false, null);
    expect(rpc).toHaveBeenCalledWith('complete_station', {
      p_station_id: 'station-1',
      p_queued: false,
    });
  });

  it('never sends a position on an uncomplete', async () => {
    await toggleStationRpc('station-1', false, false, {
      latitude: 32.1,
      longitude: 34.8,
      accuracy: 12,
    });
    expect(rpc).toHaveBeenCalledWith('uncomplete_station', {
      p_station_id: 'station-1',
      p_queued: false,
    });
  });

  it('throws when Supabase returns an error', async () => {
    rpc.mockResolvedValue({ error: new Error('boom') });
    await expect(toggleStationRpc('station-1', true)).rejects.toThrow('boom');
  });
});
