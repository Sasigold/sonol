import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as RouterModule from 'react-router-dom';
import type * as StationsModule from '@/hooks/useStations';
import { actions, dialogs } from '@/lib/copy';

/**
 * Three not-done stations in one area. a and b have no coordinates; c carries
 * coordinates far from the mocked GPS fix, so completing it trips the distance
 * warning while completing a or b does not.
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

describe('AreaPage distance-from-station warning', () => {
  it('shows the prominent far warning when the worker is far from the station', () => {
    renderPage();

    // station-c sits ~5.5km from the captured fix — well past the 100m threshold.
    const markButtons = screen.getAllByRole('button', { name: actions.markDone });
    fireEvent.click(markButtons[2]!);

    // The dedicated far dialog: its title, the named body, and the distance hero
    // (a kilometre reading at this range) — not the plain confirm.
    expect(screen.getByText(dialogs.farStation.title)).toBeInTheDocument();
    expect(screen.getByText(dialogs.farStation.body('תחנה ג'))).toBeInTheDocument();
    expect(screen.getByText(/ק״מ/)).toBeInTheDocument();
    expect(screen.queryByText(dialogs.confirmComplete.body('תחנה ג'))).not.toBeInTheDocument();
    // A warning, never a block — the override button is there and enabled.
    expect(screen.getByRole('button', { name: dialogs.farStation.confirm })).toBeEnabled();
  });

  it('shows the plain confirm, never the far warning, when close to the station', () => {
    renderPage();

    // station-a has null coordinates, so the distance cannot be judged.
    const markButtons = screen.getAllByRole('button', { name: actions.markDone });
    fireEvent.click(markButtons[0]!);

    expect(screen.getByText(dialogs.confirmComplete.body('תחנה א'))).toBeInTheDocument();
    expect(screen.queryByText(dialogs.farStation.title)).not.toBeInTheDocument();
  });
});
