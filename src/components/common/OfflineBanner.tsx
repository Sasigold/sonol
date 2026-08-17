import { CloudUpload, WifiOff } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { offline } from '@/lib/copy';

/**
 * The connection strip, under the header on every signed-in screen.
 *
 * Two separate facts, and it can show both: the connection is gone, and there
 * are taps that have not reached the server yet. They are not the same thing —
 * the queue survives a reconnect until it has drained, and a worker who has
 * just regained signal needs to know their round is still in flight.
 *
 * Amber, an icon and a sentence. Colour never carries the meaning alone.
 * `role="status"` rather than `alert`: it is information, not an interruption,
 * and a screen reader should announce it politely.
 */
export function OfflineBanner() {
  const { online, pending } = useOfflineSync();

  if (online && pending === 0) return null;

  return (
    <div
      role="status"
      className="bg-warning-bg text-text border-border flex items-center justify-center gap-2 border-b p-3"
    >
      {online ? (
        <CloudUpload className="text-warning size-5 shrink-0" aria-hidden />
      ) : (
        <WifiOff className="text-warning size-5 shrink-0" aria-hidden />
      )}
      <span className="text-small">
        {!online ? offline.noConnection : offline.pendingOperations(pending)}
      </span>
      {/* Offline AND queued: the count is the second half of the sentence. */}
      {!online && pending > 0 ? (
        <span className="text-small text-text-muted">
          {'·'} {offline.pendingOperations(pending)}
        </span>
      ) : null}
    </div>
  );
}
