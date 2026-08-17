import { describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StationCard } from './StationCard';
import { fields } from '@/lib/copy';
import type { Station } from '@/hooks/useStations';

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
    ...overrides,
  } as unknown as Station;
}

const noop = () => undefined;

/**
 * Cleans up first, so cases that render both fuel types in turn compare two
 * independent cards rather than querying a document holding both.
 */
function renderCard(overrides: Partial<Station> = {}) {
  cleanup();
  const { container } = render(
    <StationCard
      station={makeStation(overrides)}
      isNext={false}
      isAdmin={false}
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
