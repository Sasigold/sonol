import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OfflineBanner } from './OfflineBanner';
import { offlineQueue } from '@/lib/offline-queue';
import { offline } from '@/lib/copy';

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OfflineBanner />
    </QueryClientProvider>,
  );
}

describe('OfflineBanner', () => {
  afterEach(async () => {
    onlineManager.setOnline(true);
    await offlineQueue.clear();
  });

  it('stays out of the way when there is nothing to report', () => {
    renderBanner();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says the connection is gone', async () => {
    renderBanner();
    onlineManager.setOnline(false);

    expect(await screen.findByRole('status')).toHaveTextContent(offline.noConnection);
  });

  it('keeps reporting queued taps after the connection returns', async () => {
    renderBanner();
    await offlineQueue.enqueue({
      stationId: 'station-1',
      areaId: 'area-1',
      done: true,
      baseline: false,
    });

    // Online again, but the round is still in flight — the worker needs to know
    // their taps have not landed yet.
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(offline.pendingOperations(1));
    });
  });
});
