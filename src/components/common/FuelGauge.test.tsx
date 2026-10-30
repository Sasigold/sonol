import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FuelGauge } from './FuelGauge';

describe('FuelGauge', () => {
  it('exposes the round as a progressbar with its real values', () => {
    render(<FuelGauge done={19} total={39} caption="caption" />);
    const bar = screen.getByRole('progressbar', { name: 'caption' });
    expect(bar).toHaveAttribute('aria-valuenow', '19');
    expect(bar).toHaveAttribute('aria-valuemax', '39');
  });

  it('states the settled percentage for assistive tech, whatever the count-up shows', () => {
    render(<FuelGauge done={19} total={39} caption="caption" />);
    // 19/39 = 48.7% → 49
    expect(screen.getByText('49')).toHaveClass('sr-only');
  });

  it('reads 0 for an empty round rather than dividing by zero', () => {
    render(<FuelGauge done={0} total={0} caption="caption" />);
    expect(screen.getByText('0', { selector: '.sr-only' })).toBeInTheDocument();
  });
});
