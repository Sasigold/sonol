import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('lets a later class win a conflict', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('drops falsy values', () => {
    expect(cn('bg-surface', false, undefined, null, 'text-text')).toBe('bg-surface text-text');
  });

  it('treats logical inline properties as conflicting with each other', () => {
    expect(cn('ms-2', 'ms-4')).toBe('ms-4');
    // ...but start and end are independent axes.
    expect(cn('ms-2', 'me-4')).toBe('ms-2 me-4');
  });

  describe('the custom type scale', () => {
    /**
     * Regression guard. tailwind-merge classifies `text-*` as a COLOUR unless
     * the suffix looks like a t-shirt size, so our `text-h1` / `text-body` /
     * `text-caption` were being treated as colours and silently dropped
     * whenever a real colour appeared beside them. It produced no error — the
     * font size and weight just stopped being applied.
     */
    it('keeps a size and a colour together', () => {
      expect(cn('text-h1', 'text-danger')).toBe('text-h1 text-danger');
      expect(cn('text-caption', 'text-text-muted')).toBe('text-caption text-text-muted');
      expect(cn('text-body-strong', 'text-primary-foreground')).toBe(
        'text-body-strong text-primary-foreground',
      );
      expect(cn('text-display', 'text-primary')).toBe('text-display text-primary');
    });

    it('still resolves a genuine size conflict', () => {
      expect(cn('text-h1', 'text-h2')).toBe('text-h2');
      expect(cn('text-body', 'text-small')).toBe('text-small');
    });

    it('preserves the real Button class string', () => {
      const out = cn('gap-2 rounded-md text-body-strong bg-primary text-primary-foreground h-12');
      expect(out).toContain('text-body-strong');
      expect(out).toContain('text-primary-foreground');
    });
  });

  describe('the custom shadow and radius scales', () => {
    // These needed no configuration — asserted so a future tailwind-merge
    // upgrade cannot regress them unnoticed.
    it('resolves shadows and radii correctly', () => {
      expect(cn('shadow-card', 'shadow-raised')).toBe('shadow-raised');
      expect(cn('shadow-card', 'text-danger')).toBe('shadow-card text-danger');
      expect(cn('rounded-md', 'rounded-lg')).toBe('rounded-lg');
    });
  });
});
