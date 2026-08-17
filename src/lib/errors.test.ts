import { afterEach, describe, expect, it, vi } from 'vitest';
import { toHebrewError } from './errors';
import { errors } from './copy';

/**
 * Defect 19: English error messages surfacing inside a Hebrew app.
 * The contract is that NOTHING reaches the UI untranslated.
 */
describe('toHebrewError', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps every auth message from the brief §9.6', () => {
    expect(toHebrewError({ message: 'Invalid login credentials' })).toBe(errors.invalidCredentials);
    expect(toHebrewError({ message: 'Email not confirmed' })).toBe(errors.emailNotConfirmed);
    expect(toHebrewError({ message: 'User already registered' })).toBe(
      errors.emailAlreadyRegistered,
    );
    expect(toHebrewError({ message: 'Password should be at least 6 characters' })).toBe(
      errors.passwordTooShort,
    );
  });

  it('treats a dropped connection as offline, whatever the browser calls it', () => {
    for (const message of [
      'Failed to fetch',
      'NetworkError when attempting to fetch resource.',
      'Load failed',
      'fetch failed',
    ]) {
      expect(toHebrewError({ message })).toBe(errors.offline);
    }
  });

  it('maps RLS and grant refusals to a permission message', () => {
    expect(toHebrewError({ code: '42501', message: 'permission denied for table profiles' })).toBe(
      errors.permissionDenied,
    );
    expect(toHebrewError({ message: 'new row violates row-level security policy' })).toBe(
      errors.permissionDenied,
    );
  });

  it('maps the RPC exceptions a user can actually trigger', () => {
    expect(toHebrewError({ message: 'admin only' })).toBe(errors.permissionDenied);
    expect(toHebrewError({ message: 'not allowed to work in this area' })).toBe(
      errors.permissionDenied,
    );
    expect(toHebrewError({ message: 'cannot revoke your own admin role' })).toBe(
      errors.permissionDenied,
    );
  });

  it('falls back to the generic Hebrew message rather than leaking English', () => {
    expect(toHebrewError({ message: 'Some brand new upstream failure' })).toBe(errors.generic);
    expect(toHebrewError(new Error('kaboom'))).toBe(errors.generic);
    expect(toHebrewError(null)).toBe(errors.generic);
    expect(toHebrewError(undefined)).toBe(errors.generic);
    expect(toHebrewError('a bare string')).toBe(errors.generic);
    expect(toHebrewError(42)).toBe(errors.generic);
  });

  it('never returns Latin text, for any input', () => {
    const inputs: unknown[] = [
      null,
      undefined,
      42,
      'boom',
      new Error('Invalid login credentials'),
      { message: 'Failed to fetch' },
      { code: '42501', message: 'permission denied' },
      { message: 'totally unknown' },
    ];
    for (const input of inputs) {
      expect(toHebrewError(input)).not.toMatch(/[A-Za-z]/);
    }
  });

  it('reports offline when the browser says so, whatever the error says', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(toHebrewError({ message: 'totally unknown' })).toBe(errors.offline);
  });
});
