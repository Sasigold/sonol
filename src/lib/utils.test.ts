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
});
