import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { actions, fields, labels } from '@/lib/copy';
import type { Station } from '@/hooks/useStations';

vi.mock('./StationMapDialog', () => ({
  StationMapDialog: () => null,
}));

const { StationRow } = await import('./StationRow');

function makeStation(overrides: Partial<Station> = {}): Station {
  return {
    id: '1',
    name: 'תחנת בדיקה',
    sort_number: 1,
    area_id: 'area-1',
    fuel_type: 'regular',
    total: 2,
    flyers: 30,
    is_done: false,
    has_envelope: false,
    has_flyers_note: false,
    latitude: 32.1,
    longitude: 34.8,
    completed_latitude: null,
    completed_longitude: null,
    completed_accuracy: null,
    ...overrides,
  } as unknown as Station;
}

function renderRow(
  overrides: Partial<Station> = {},
  props: Partial<{ expanded: boolean; isAdmin: boolean; isNext: boolean }> = {},
) {
  const handlers = {
    onToggleExpanded: vi.fn(),
    onComplete: vi.fn(),
    onUncomplete: vi.fn(),
    onNavigate: vi.fn(),
    onToggleEnvelope: vi.fn(),
    onToggleFlyers: vi.fn(),
    onEdit: vi.fn(),
  };
  const { container } = render(
    <StationRow
      station={makeStation(overrides)}
      isNext={props.isNext ?? false}
      isAdmin={props.isAdmin ?? false}
      expanded={props.expanded ?? false}
      {...handlers}
    />,
  );
  const row = container.querySelector('article');
  if (!row) throw new Error('StationRow did not render an <article>');
  return { row, handlers };
}

describe('StationRow', () => {
  afterEach(cleanup);

  it('names the check box by the action it performs, in both states', () => {
    const outstanding = renderRow();
    fireEvent.click(screen.getByRole('button', { name: actions.markDone }));
    expect(outstanding.handlers.onComplete).toHaveBeenCalledOnce();
    cleanup();

    const done = renderRow({ is_done: true });
    fireEvent.click(screen.getByRole('button', { name: actions.undoDone }));
    expect(done.handlers.onUncomplete).toHaveBeenCalledOnce();
  });

  it('keeps the name alone in the heading', () => {
    renderRow({ fuel_type: 'super', has_envelope: true }, { isNext: true });
    expect(screen.getByRole('heading')).toHaveTextContent(/^תחנת בדיקה$/);
  });

  it('marks סופר with a labelled chip and the inline-start edge', () => {
    const { row } = renderRow({ fuel_type: 'super' });
    expect(row).toHaveClass('border-s-4');
    expect(screen.getByText(fields.fuelSuper)).toBeInTheDocument();
  });

  it('shows the envelope cue and the next badge in the collapsed row', () => {
    renderRow({ has_envelope: true }, { isNext: true });
    expect(screen.getByText(labels.hasEnvelope)).toBeInTheDocument();
    expect(screen.getByText(labels.next)).toBeInTheDocument();
  });

  it('keeps both quantities readable by a screen reader while collapsed', () => {
    renderRow();
    expect(screen.getByText(fields.total)).toHaveClass('sr-only');
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('opens and closes through an expand control that reports its state', () => {
    const { handlers } = renderRow();
    const toggle = screen.getByRole('button', { name: actions.stationDetails });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: actions.navigate })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(handlers.onToggleExpanded).toHaveBeenCalledOnce();
  });

  it('offers navigation and the fuel type once expanded', () => {
    const { handlers } = renderRow({}, { expanded: true });
    expect(screen.getByRole('button', { name: actions.stationDetails })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText(fields.fuelRegular)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: actions.navigate }));
    expect(handlers.onNavigate).toHaveBeenCalledOnce();
  });

  it('gives the admin menu only to an admin', () => {
    renderRow({}, { expanded: true });
    expect(screen.queryByRole('button', { name: actions.openMenu })).not.toBeInTheDocument();
  });
});
