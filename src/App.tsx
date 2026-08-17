import { useEffect, useState } from 'react';
import { Moon, Sun, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { copy } from '@/lib/copy';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

/**
 * Phase-1 shell only.
 *
 * This page exists to prove three things and nothing else:
 *   1. the page is right-to-left and renders Heebo,
 *   2. the token layer resolves and swaps under `.dark`,
 *   3. the typed Supabase client reaches the project and RLS is live.
 *
 * Phase 2 replaces all of it with the router.
 */

type ProbeState =
  | { status: 'checking' }
  | { status: 'protected'; detail: string }
  | { status: 'open'; detail: string }
  | { status: 'unreachable'; detail: string };

/**
 * Reads `areas` while signed out. `anon` holds no grant on any table, so a
 * healthy project MUST refuse this. A successful read would mean RLS or the
 * grants are not in force — which is the exact class of defect this rebuild
 * exists to eliminate (brief §4, defect 1).
 */
function useRlsProbe(): ProbeState {
  const [state, setState] = useState<ProbeState>({ status: 'checking' });

  useEffect(() => {
    // An AbortController rather than a `let cancelled` flag: the type-checker
    // narrows a boolean local to its initialiser and then flags the guard as
    // dead code, which it is not.
    const controller = new AbortController();

    void (async () => {
      const { data, error } = await supabase.from('areas').select('id').limit(1);
      if (controller.signal.aborted) return;

      if (error) {
        const isDenied = error.code === '42501' || /permission denied/i.test(error.message);
        setState(
          isDenied
            ? { status: 'protected', detail: `${error.code} ${error.message}`.trim() }
            : { status: 'unreachable', detail: error.message },
        );
        return;
      }

      setState({
        status: 'open',
        detail: `anon read ${String(data.length)} row(s) from public.areas`,
      });
    })();

    return () => {
      controller.abort();
    };
  }, []);

  return state;
}

const TYPE_SPECIMEN = [
  { className: 'text-display', label: 'display 32/700', sample: 'סונול — ניהול סבבי הפצה' },
  { className: 'text-h1', label: 'h1 24/700', sample: 'רשימת אזורים' },
  { className: 'text-h2', label: 'h2 20/600', sample: 'תחנות באזור השרון' },
  { className: 'text-h3', label: 'h3 17/600', sample: 'תחנת דלק מרכזית' },
  { className: 'text-body', label: 'body 16/400', sample: 'הושלמו 12 מתוך 30 תחנות' },
  { className: 'text-body-strong', label: 'body-strong 16/600', sample: 'סמן כבוצע' },
  { className: 'text-small', label: 'small 14/400', sample: 'בוצע ב-14/3 09:20' },
  { className: 'text-caption', label: 'caption 13/500', sample: 'פליירים 4' },
] as const;

const SEMANTIC_SWATCHES = [
  { name: 'success', text: 'text-success', bg: 'bg-success-bg', label: copy.labels.done },
  { name: 'warning', text: 'text-warning', bg: 'bg-warning-bg', label: copy.labels.hasEnvelope },
  { name: 'danger', text: 'text-danger', bg: 'bg-danger-bg', label: copy.fields.fuelSuper },
  { name: 'info', text: 'text-info', bg: 'bg-info-bg', label: copy.labels.hasFlyers },
] as const;

function ConnectionRow({ probe }: { probe: ProbeState }) {
  if (probe.status === 'checking') {
    return (
      <p className="text-small text-text-muted flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        בודק חיבור…
      </p>
    );
  }

  const ok = probe.status === 'protected';
  const Icon = ok ? ShieldCheck : ShieldAlert;

  return (
    <div className="flex flex-col gap-1">
      <p
        className={cn(
          'text-body-strong flex items-center gap-2',
          ok ? 'text-success' : 'text-danger',
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden />
        {ok
          ? 'החיבור תקין — הגישה ללא הרשאה נחסמה'
          : probe.status === 'open'
            ? 'אזהרה: קריאה ללא הרשאה הצליחה'
            : 'לא ניתן להתחבר לשרת'}
      </p>
      <p className="text-caption text-text-muted ltr-isolate font-mono">{probe.detail}</p>
    </div>
  );
}

export default function App() {
  const { theme, toggle } = useTheme();
  const probe = useRlsProbe();

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-display text-primary">{copy.app.name}</h1>
          <p className="text-small text-text-muted">שלב 1 — תשתית, טוקנים וחיבור לשרת</p>
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-label={copy.app.toggleTheme}
          className="border-border bg-surface text-text hover:bg-surface-alt shadow-card flex size-12 items-center justify-center rounded-md border transition-colors"
        >
          {theme === 'dark' ? (
            <Moon className="size-5" aria-hidden />
          ) : (
            <Sun className="size-5" aria-hidden />
          )}
        </button>
      </header>

      <section className="bg-surface border-border shadow-card flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-h2">חיבור ל-Supabase</h2>
        <ConnectionRow probe={probe} />
      </section>

      <section className="bg-surface border-border shadow-card flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-h2">סולם הטיפוגרפיה</h2>
        <ul className="flex flex-col gap-3">
          {TYPE_SPECIMEN.map((item) => (
            <li key={item.className} className="flex flex-col gap-1">
              <span className="text-caption text-text-muted ltr-isolate">{item.label}</span>
              <span className={item.className}>{item.sample}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-surface border-border shadow-card flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-h2">צבעים סמנטיים</h2>
        <div className="flex flex-wrap gap-2">
          {SEMANTIC_SWATCHES.map((swatch) => (
            <span
              key={swatch.name}
              className={cn(
                'text-caption inline-flex items-center gap-1 rounded-full px-3 py-2',
                swatch.bg,
                swatch.text,
              )}
            >
              {swatch.label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="bg-brand-800 text-text-inverse text-caption rounded-sm px-3 py-2">
            brand-800
          </span>
          <span className="bg-brand-600 text-text-inverse text-caption rounded-sm px-3 py-2">
            brand-600
          </span>
          <span className="bg-brand-100 text-brand-800 text-caption rounded-sm px-3 py-2">
            brand-100
          </span>
          <span className="bg-surface-alt text-text-muted text-caption rounded-sm px-3 py-2">
            surface-alt
          </span>
        </div>
      </section>

      <section className="bg-surface border-border shadow-card flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-h2">גובה (Elevation)</h2>
        <div className="flex flex-wrap gap-4">
          <div className="bg-surface shadow-card text-caption rounded-lg p-4">card</div>
          <div className="bg-surface shadow-raised text-caption rounded-lg p-4">raised</div>
          <div className="bg-surface shadow-overlay text-caption rounded-lg p-4">overlay</div>
        </div>
      </section>
    </main>
  );
}
