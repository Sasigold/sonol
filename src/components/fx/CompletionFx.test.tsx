import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { celebrate, labels } from '@/lib/copy';
import { CompletionFx } from './CompletionFx';

function renderFx(doneBefore: number, total: number, onFinished = vi.fn()) {
  render(
    <CompletionFx
      stationName="תחנת בדיקה"
      areaName="מרכז"
      doneBefore={doneBefore}
      total={total}
      onFinished={onFinished}
    />,
  );
  return onFinished;
}

describe('CompletionFx', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the station and the area progress AFTER this completion', () => {
    renderFx(2, 6);
    expect(screen.getByText(celebrate.stationDone)).toBeInTheDocument();
    expect(screen.getByText('תחנת בדיקה')).toBeInTheDocument();
    expect(screen.getByText(labels.roundProgress(3, 6))).toBeInTheDocument();
  });

  it('celebrates the whole area on its last station', () => {
    renderFx(5, 6);
    expect(screen.getByText(celebrate.areaDone)).toBeInTheDocument();
    expect(screen.getByText(celebrate.areaDoneBody('מרכז'))).toBeInTheDocument();
    expect(screen.queryByText(celebrate.stationDone)).not.toBeInTheDocument();
  });

  it('never takes a tap: the overlay ignores pointer events and is hidden from AT', () => {
    renderFx(0, 3);
    const overlay = document.body.querySelector('.fx-complete');
    expect(overlay).toHaveClass('pointer-events-none');
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
  });

  it('removes itself once it has played', () => {
    const onFinished = renderFx(0, 3);
    expect(onFinished).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('buzzes where the Vibration API exists, longer for a finished area', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });

    renderFx(0, 3);
    renderFx(2, 3);

    expect(vibrate).toHaveBeenCalledTimes(2);
    const [station, area] = vibrate.mock.calls.map((call: unknown[]) => call[0] as number[]);
    expect(area?.length ?? 0).toBeGreaterThan(station?.length ?? 0);
    Reflect.deleteProperty(navigator, 'vibrate');
  });

  it('does not throw where there is no Vibration API (iOS Safari)', () => {
    expect(() => renderFx(0, 3)).not.toThrow();
  });
});
