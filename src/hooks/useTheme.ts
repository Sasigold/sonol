import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'sonol-theme';

function readInitialTheme(): Theme {
  // index.html has already applied the class before first paint; read back from
  // the DOM so the hook and the document can never disagree.
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * Light/dark theme, persisted. Field workers use this app at night, so dark
 * mode is a real requirement rather than a preference (brief §6.1).
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // private browsing — the theme simply will not persist
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggle };
}
