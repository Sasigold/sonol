import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted so the mock factory can close over it (vi.mock is hoisted above imports).
const { rpc, getSession } = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn() }));
vi.mock('./supabase', () => ({
  supabase: { rpc, auth: { getSession } },
  AUTH_STORAGE_KEY: 'sonol-auth',
}));

import { toggleStationRpc } from './rpc';
import { SessionUnavailableError, classifyMutationError } from './errors';

const STORED_SESSION = {
  access_token: 'expired-access',
  refresh_token: 'refresh',
  expires_at: 1,
  user: { id: 'user-1' },
};

describe('toggleStationRpc', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: STORED_SESSION }, error: null });
    localStorage.clear();
  });

  it('holds the write when the stored session cannot be refreshed', async () => {
    // The refresh failed on the network: supabase-js answers null, but the
    // session is still in storage. Sending now would go out on the anon key.
    localStorage.setItem('sonol-auth', JSON.stringify(STORED_SESSION));
    getSession.mockResolvedValue({ data: { session: null }, error: new Error('Load failed') });

    const attempt = toggleStationRpc('station-1', true);

    await expect(attempt).rejects.toBeInstanceOf(SessionUnavailableError);
    expect(rpc).not.toHaveBeenCalled();
    // …and the queue keeps it rather than dropping it as a refused write.
    expect(classifyMutationError(await attempt.catch((error: unknown) => error))).toBe('offline');
  });

  it('still sends when there is no stored session at all', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await toggleStationRpc('station-1', true);
    expect(rpc).toHaveBeenCalledTimes(1);
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
