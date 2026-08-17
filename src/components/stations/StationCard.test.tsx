import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { fields, location } from '@/lib/copy';
import type { Station } from '@/hooks/useStations';

// Stub the map dialog so these tests never pull Leaflet into jsdom; it just
// reflects whether it was asked to open.
vi.mock('./StationMapDialog', () => ({
  StationMapDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="map-dialog" /> : null,
}));

// Imported after the mock is registered.
const { StationCard } = await import('./StationCard');

function makeStation(overrides: Partial<Station> = {}): Station {
  return {
    id: '1',
    name: 'תחנת בדיקה',
    sort_number: 1,
    area_id: 'area-1',
    fuel_type: 'regular',
    total: 1,
    flyers: 0,
    is_done: false,
    has_envelope: false,
    has_flyers_note: false,
    latitude: 32.1,
    longitude: 34.8,
    // Real rows carry these as null (not undefined), which the map affordance's
    // null checks depend on.
    completed_latitude: null,
    completed_longitude: null,
    completed_accuracy: null,
    ...overrides,
  } as unknown as Station;
}

const noop = () => undefined;

function renderCard(overrides: Partial<Station> = {}, isAdmin = false) {
  cleanup();
  const { container } = render(
    <StationCard
      station={makeStation(overrides)}
      isNext={false}
      isAdmin={isAdmin}
      onComplete={noop}
      onUncomplete={noop}
      onNavigate={noop}
      onToggleEnvelope={noop}
      onToggleFlyers={noop}
      onEdit={noop}
    />,
  );
  const card = container.querySelector('article');
  if (!card) throw new Error('StationCard did not render an <article>');
  return card;
}

/**
 * Delivering רגיל to a סופר station costs a return drive, so the fuel type is
 * signalled twice — a large tinted chip and a thick card edge — and never by
 * colour alone.
 */
describe('StationCard fuel type', () => {
  it('names the fuel type in words in both states', () => {
    renderCard({ fuel_type: 'super' });
    expect(screen.getByText(fields.fuelSuper)).toBeInTheDocument();

    renderCard({ fuel_type: 'regular' });
    expect(screen.getByText(fields.fuelRegular)).toBeInTheDocument();
  });

  it('marks the whole card on the inline-start edge when super', () => {
    // `border-s-*`, not `border-l-*`: under dir="rtl" this is the right-hand
    // edge, which is where the eye starts.
    expect(renderCard({ fuel_type: 'super' })).toHaveClass('border-s-4');
    expect(renderCard({ fuel_type: 'regular' })).not.toHaveClass('border-s-4');
  });

  it('gives סופר the large chip and רגיל the quiet one', () => {
    renderCard({ fuel_type: 'super' });
    expect(screen.getByText(fields.fuelSuper)).toHaveClass('text-body-strong');

    renderCard({ fuel_type: 'regular' });
    expect(screen.getByText(fields.fuelRegular)).toHaveClass('text-caption');
  });
});

describe('StationCard quantities', () => {
  it('shows both quantities as captioned figures', () => {
    renderCard({ total: 12, flyers: 45 });

    expect(screen.getByText(fields.total)).toBeInTheDocument();
    expect(screen.getByText(fields.flyers)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('emphasises a quantity above one, keeping the label either way', () => {
    const many = renderCard({ total: 3 });
    expect(many.querySelector('.bg-warning-bg')).not.toBeNull();
    expect(screen.getByText(fields.total)).toBeInTheDocument();

    const one = renderCard({ total: 1 });
    expect(one.querySelector('.bg-warning-bg')).toBeNull();
    expect(screen.getByText(fields.total)).toBeInTheDocument();
  });
});

/**
 * The completion-location map (§ F4): admin-only, opened from a completed
 * station whose coordinates are known.
 */
describe('StationCard completion map', () => {
  afterEach(cleanup);

  it('opens the map when an admin taps a completed station with a captured position', () => {
    renderCard(
      {
        is_done: true,
        completed_at: '2026-01-01T09:00:00Z',
        completed_by_name: 'דנה',
        completed_latitude: 32.02,
        completed_longitude: 34.8,
        completed_accuracy: 15,
      },
      true,
    );

    expect(screen.queryByTestId('map-dialog')).not.toBeInTheDocument();
    // ~8.7km away, so the leg is flagged far; tapping it opens the map.
    fireEvent.click(screen.getByText(location.farBadge));
    expect(screen.getByTestId('map-dialog')).toBeInTheDocument();
  });

  it('offers the map on a completed station even with no captured position', () => {
    renderCard({ is_done: true, completed_at: '2026-01-01T09:00:00Z' }, true);
    fireEvent.click(screen.getByText(location.showOnMap));
    expect(screen.getByTestId('map-dialog')).toBeInTheDocument();
  });

  it('shows no map affordance to a worker', () => {
    renderCard(
      {
        is_done: true,
        completed_at: '2026-01-01T09:00:00Z',
        completed_latitude: 32.02,
        completed_longitude: 34.8,
        completed_accuracy: 15,
      },
      false,
    );
    expect(screen.queryByText(location.showOnMap)).not.toBeInTheDocument();
    expect(screen.queryByText(location.farBadge)).not.toBeInTheDocument();
  });
});
