import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StationForm } from './StationForm';
import type { Area } from '@/hooks/useAreas';
import type { Station } from '@/hooks/useStations';
import { fields } from '@/lib/copy';

const AREAS: Area[] = [
  { id: 'area-north', name: 'צפון', sort_order: 1, created_at: '', updated_at: '' },
  { id: 'area-center', name: 'מרכז', sort_order: 2, created_at: '', updated_at: '' },
];

function makeStation(overrides: Partial<Station> = {}): Station {
  return {
    id: 'station-1',
    area_id: 'area-center',
    name: 'סונול רמת גן',
    sort_number: 7.5,
    fuel_type: 'super',
    total: 3,
    flyers: 2,
    waze_link: 'https://embed.waze.com/iframe?zoom=15&lat=32.082300&lon=34.814600',
    latitude: 32.0823,
    longitude: 34.8146,
    is_done: false,
    completed_at: null,
    completed_by: null,
    completed_by_name: null,
    completed_latitude: null,
    completed_longitude: null,
    completed_accuracy: null,
    has_envelope: false,
    has_flyers_note: false,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

function renderForm(props: Partial<Parameters<typeof StationForm>[0]> = {}) {
  // The form owns its (area, number) uniqueness query, so it needs a client.
  // `retry: false` keeps a failed fetch from stalling the test.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StationForm areas={AREAS} pending={false} onSubmit={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

describe('StationForm', () => {
  /**
   * Defect 11: editing a station silently moved it to a different area,
   * because the area field was seeded from the BROWSING CONTEXT instead of
   * from the station itself.
   *
   * The test deliberately passes a `defaultAreaId` that DISAGREES with the
   * station's own area. The station must win.
   */
  it('seeds the area from the station, not from the browsing context', () => {
    renderForm({
      station: makeStation({ area_id: 'area-center' }),
      defaultAreaId: 'area-north',
    });

    // Radix renders the chosen option's text inside the trigger.
    expect(screen.getByRole('combobox')).toHaveTextContent('מרכז');
    expect(screen.getByRole('combobox')).not.toHaveTextContent('צפון');
  });

  it('seeds every other field from the station too', () => {
    renderForm({ station: makeStation(), defaultAreaId: 'area-north' });

    expect(screen.getByLabelText(fields.stationName)).toHaveValue('סונול רמת גן');
    expect(screen.getByLabelText(fields.stationNumber)).toHaveValue(7.5);
    expect(screen.getByLabelText(fields.total)).toHaveValue(3);
    expect(screen.getByLabelText(fields.flyers)).toHaveValue(2);
    // Segmented control, so assert the pressed state rather than a value.
    expect(screen.getByRole('button', { name: fields.fuelSuper })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('uses the browsing context only when ADDING', () => {
    renderForm({ defaultAreaId: 'area-north' });
    expect(screen.getByRole('combobox')).toHaveTextContent('צפון');
  });

  it('keeps a non-integer sort_number intact — 12.5 must survive a round trip', () => {
    // numeric(10,2) exists precisely so a station can be slotted between 12
    // and 13 without renumbering the area.
    renderForm({ station: makeStation({ sort_number: 12.5 }) });
    expect(screen.getByLabelText(fields.stationNumber)).toHaveValue(12.5);
  });

  it('shows the parsed coordinates as confirmation', () => {
    renderForm({ station: makeStation() });
    expect(screen.getByText('32.082300, 34.814600')).toBeInTheDocument();
  });

  it('offers delete only in edit mode', () => {
    const onDelete = vi.fn();
    const { unmount } = renderForm({ station: makeStation(), onDelete });
    expect(screen.getByRole('button', { name: /מחק/ })).toBeInTheDocument();
    unmount();

    renderForm();
    expect(screen.queryByRole('button', { name: /מחק/ })).not.toBeInTheDocument();
  });

  it('keeps the submit button visible while disabling it', () => {
    // The original hid the button, leaving no explanation for why saving was
    // impossible.
    renderForm({ station: makeStation({ name: 'א' }) });
    const submit = screen.getByRole('button', { name: /עדכן/ });
    expect(submit).toBeInTheDocument();
    expect(submit).toBeDisabled();
  });
});
