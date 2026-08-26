import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as RouterModule from 'react-router-dom';
import type * as StationsModule from '@/hooks/useStations';
import { actions, dialogs } from '@/lib/copy';

/**
 * Two not-done stations in one area, so the screen shows two "mark done"
 * buttons and we can complete one then reach for the next.
 */
const { STATIONS, AREAS } = vi.hoisted(() => {
  const station = (id: string, name: string, sortNumber: number) => ({
    id,
    area_id: 'area-1',
    name,
    sort_number: sortNumber,
    fuel_type: 'regular' as const,
    total: 1,
    flyers: 0,
    has_envelope: false,
    has_flyers_note: false,
    is_done: false,
    completed_at: null,
    completed_by: null,
    completed_by_name: null,
    latitude: null,
    longitude: null,
    waze_link: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  });
  // station-c carries coordinates far from the mocked GPS fix below, to exercise
  // the at-completion distance warning. a and b keep null coordinates, so the
  // rapid-completion tests never trip the distance path.
  const withCoords = { latitude: 32.0, longitude: 34.0 };
  return {
    STATIONS: [
      station('station-a', 'תחנה א', 1),
      station('station-b', 'תחנה ב', 2),
      { ...station('station-c', 'תחנה ג', 3), ...withCoords },
    ],
    AREAS: [
      {
        area_id: 'area-1',
        area_name: 'אזור בדיקה',
        done_count: 0,
        remaining_count: 2,
        sort_order: 0,
        station_count: 2,
      },
    ],
  };
});

vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof RouterModule>()),
  useParams: () => ({ areaId: 'area-1' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    state: {
      status: 'signedIn',
      session: {},
      profile: { id: 'u1', display_name: 'עובד', is_admin: false, is_authorized: true },
    },
    signOut: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAreas', () => ({
  useMyAreas: () => ({ data: AREAS, isPending: false, isError: false }),
}));

vi.mock('@/hooks/useRealtimeStations', () => ({
  useRealtimeStations: () => undefined,
}));

// A warm, tight GPS fix ~5.5km north of station-c (and nowhere near a/b, which
// have no coordinates anyway). Synchronous, like the real hook at confirm time.
vi.mock('@/hooks/useGeolocationCapture', () => ({
  useGeolocationCapture: () => ({
    capture: () => ({ latitude: 32.05, longitude: 34.0, accuracy: 10 }),
  }),
}));

vi.mock('@/hooks/useSortDirection', () => ({
  useSortDirection: () => ({ descending: false, toggle: vi.fn() }),
}));

vi.mock('@/hooks/useStations', async (orig) => {
  const actual = await orig<typeof StationsModule>();
  return {
    ...actual,
    useAreaStations: () => ({ data: STATIONS, isPending: false, isError: false, refetch: vi.fn() }),
    useToggleStation: () => ({ mutate: vi.fn(), isPending: false }),
    useSetMarkers: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

// Imported after the mocks are registered.
const { AreaPage } = await import('./AreaPage');

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<AreaPage />, { wrapper });
}

/** Complete station A at the current (fake) time and let its dialog close. */
function completeStationA() {
  const markButtons = screen.getAllByRole('button', { name: actions.markDone });
  fireEvent.click(markButtons[0]!);
  fireEvent.click(screen.getByRole('button', { name: actions.confirm }));
}

describe('AreaPage rapid double-completion warning', () => {
  const T0 = Date.UTC(2026, 5, 1, 8, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('warns when a second station is completed within the window', () => {
    renderPage();

    completeStationA();

    // 30 seconds later the worker taps the next station.
    vi.setSystemTime(T0 + 30_000);
    const markButtons = screen.getAllByRole('button', { name: actions.markDone });
    fireEvent.click(markButtons[1]!);

    // The confirm body is the warning, naming the previous station, followed by
    // the closing question.
    const rapidBody = `${dialogs.completeWarning.rapid(0, 'תחנה א')} ${dialogs.completeWarning.question('תחנה ב')}`;
    expect(screen.getByText(rapidBody)).toBeInTheDocument();
    // ...and it is still just a confirm, not a block.
    expect(screen.getByRole('button', { name: actions.confirm })).toBeEnabled();
  });

  it('does not warn once the window has passed', () => {
    renderPage();

    completeStationA();

    // Three minutes later — a normal gap, not a fat-finger double tap.
    vi.setSystemTime(T0 + 3 * 60_000);
    const markButtons = screen.getAllByRole('button', { name: actions.markDone });
    fireEvent.click(markButtons[1]!);

    expect(screen.getByText(dialogs.confirmComplete.body('תחנה ב'))).toBeInTheDocument();
    expect(
      screen.queryByText(new RegExp(dialogs.completeWarning.rapid(0, 'תחנה א'))),
    ).not.toBeInTheDocument();
  });
});

describe('AreaPage distance-from-station warning', () => {
  it('warns when the worker is far from the station being completed', () => {
    renderPage();

    // station-c sits ~5.5km from the captured fix — well past the 100m threshold.
    const markButtons = screen.getAllByRole('button', { name: actions.markDone });
    fireEvent.click(markButtons[2]!);

    // The warning names the distance concern; the plain confirm is not shown.
    expect(screen.getByText(/ייתכן שאינך נמצא בתחנה הנכונה/)).toBeInTheDocument();
    expect(screen.queryByText(dialogs.confirmComplete.body('תחנה ג'))).not.toBeInTheDocument();
    // A warning, never a block — the worker can still confirm.
    expect(screen.getByRole('button', { name: actions.confirm })).toBeEnabled();
  });

  it('does not warn when the station has no coordinates to compare against', () => {
    renderPage();

    // station-a has null coordinates, so the distance cannot be judged.
    const markButtons = screen.getAllByRole('button', { name: actions.markDone });
    fireEvent.click(markButtons[0]!);

    expect(screen.getByText(dialogs.confirmComplete.body('תחנה א'))).toBeInTheDocument();
    expect(screen.queryByText(/ייתכן שאינך נמצא בתחנה הנכונה/)).not.toBeInTheDocument();
  });
});
