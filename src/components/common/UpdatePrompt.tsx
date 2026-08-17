import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { offlineQueue } from '@/lib/offline-queue';
import { update } from '@/lib/copy';

/**
 * New-version handling. Renders nothing; it exists for the side effect.
 *
 * §11 asks for both automatic updates and a "refresh" prompt, which sound
 * contradictory. They are not, once the reload is separated from the install:
 * the new service worker always installs and takes over by itself, and this
 * component decides only WHEN the page reloads onto it.
 *
 * Providing `onNeedReload` is what suspends the plugin's own automatic reload
 * and hands that decision here.
 *
 * The hold: an unsynced tap lives in IndexedDB and survives a reload, but the
 * optimistic row showing it does not. Reloading a worker mid-round with taps
 * still queued would refetch the server's answer and visibly un-mark stations
 * they know they marked — self-correcting once the queue drains, alarming in
 * the meantime, and worst on the bad connection that caused the queue. So the
 * reload waits for an empty queue, and the toast lets the user take it sooner.
 */
export function UpdatePrompt() {
  useRegisterSW({
    immediate: true,

    onNeedReload() {
      if (offlineQueue.count() === 0) {
        window.location.reload();
        return;
      }

      toast(update.available, {
        duration: Infinity,
        action: {
          label: update.action,
          onClick: () => {
            window.location.reload();
          },
        },
      });

      const unsubscribe = offlineQueue.subscribe(() => {
        if (offlineQueue.count() === 0) {
          unsubscribe();
          window.location.reload();
        }
      });
    },
  });

  return null;
}
