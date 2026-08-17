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

  it('throws when Supabase returns an error', async () => {
    rpc.mockResolvedValue({ error: new Error('boom') });
    await expect(toggleStationRpc('station-1', true)).rejects.toThrow('boom');
  });
});
