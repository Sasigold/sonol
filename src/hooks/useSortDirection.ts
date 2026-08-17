import { useCallback, useState } from 'react';

/**
 * Sort direction for an area's not-done list, persisted PER AREA (§8.5).
 *
 * A worker who drives one area backwards should not have that imposed on the
 * next area they open.
 */
export function useSortDirection(areaId: string | undefined) {
  const storageKey = areaId ? `sonol-sort:${areaId}` : null;

  const [descending, setDescending] = useState<boolean>(() => {
    if (!storageKey) return false;
    try {
      return localStorage.getItem(storageKey) === 'desc';
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setDescending((current) => {
      const next = !current;
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, next ? 'desc' : 'asc');
        } catch {
          // private browsing — the choice simply will not persist
        }
      }
      return next;
    });
  }, [storageKey]);

  return { descending, toggle };
}
