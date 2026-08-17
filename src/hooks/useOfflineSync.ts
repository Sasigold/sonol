import { useEffect, useSyncExternalStore } from 'react';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { offlineQueue } from '@/lib/offline-queue';
import { stationKeys } from '@/hooks/useStations';
import { offline } from '@/lib/copy';

/**
 * Connects the offline queue to the rest of the app. Mounted ONCE, in AppShell.
 *
 * Returns both signals the banner needs: whether the browser thinks it is
 * online, and how many taps are still waiting.
 */
export function useOfflineSync(): { online: boolean; pending: number } {
  const queryClient = useQueryClient();

  const pending = useSyncExternalStore(
    offlineQueue.subscribe,
    offlineQueue.count,
    // The server render has no queue.
    () => 0,
  );

  // TanStack Query already owns the online signal and already listens to the
  // browser events for it. A second `window.addEventListener('online')` here
  // would be a second source of truth that can disagree with the first.
  const online = useSyncExternalStore(
    onlineManager.subscribe.bind(onlineManager),
    () => onlineManager.isOnline(),
    () => true,
  );

  useEffect(() => {
    offlineQueue.setHandlers({
      onDrained: (replayed) => {
        for (const areaId of new Set(replayed.map((record) => record.areaId))) {
          void queryClient.invalidateQueries({ queryKey: stationKeys.byArea(areaId) });
        }
        void queryClient.invalidateQueries({ queryKey: ['my_areas'] });
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        toast.success(offline.synced);
      },

      onDropped: (record) => {
        // The optimistic row is a lie now — put the server's answer back, and
        // say so. Silently discarding the tap would leave the worker believing
        // a station was marked.
        void queryClient.invalidateQueries({ queryKey: stationKeys.byArea(record.areaId) });
        toast.error(offline.syncFailed);
      },
    });

    return () => {
      offlineQueue.setHandlers({});
    };
  }, [queryClient]);

  useEffect(() => {
    // Three triggers, one drain (the queue guards against overlap):
    // the app opening, the connection returning, and the tab coming back —
    // a phone that slept through the reconnect fires no `online` event.
    void offlineQueue.drain();

    const unsubscribe = onlineManager.subscribe((isOnline) => {
      if (isOnline) void offlineQueue.drain();
    });

    function onVisible(): void {
      if (document.visibilityState === 'visible' && onlineManager.isOnline()) {
        void offlineQueue.drain();
      }
    }

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { online, pending };
}
