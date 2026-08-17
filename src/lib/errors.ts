import { AuthError, type PostgrestError } from '@supabase/supabase-js';
import { errors } from './copy';

/**
 * Supabase error → Hebrew (brief §9.6).
 *
 * Defect 19 of the original app was English error text surfacing inside a
 * Hebrew UI. Nothing in this app shows a raw Supabase message: everything the
 * user sees passes through here, and anything unrecognised falls back to a
 * generic Hebrew sentence rather than leaking the original.
 */

/** Postgres/PostgREST codes worth distinguishing. */
const PERMISSION_CODES = new Set([
  '42501', // insufficient_privilege — a grant refused the write
  'PGRST301', // JWT expired / not authorised
  '42S01',
]);

/** Message fragments Supabase Auth returns, matched case-insensitively. */
const AUTH_MESSAGE_MAP: readonly (readonly [RegExp, string])[] = [
  [/invalid login credentials/i, errors.invalidCredentials],
  [/email not confirmed/i, errors.emailNotConfirmed],
  [/user already registered/i, errors.emailAlreadyRegistered],
  [/already been registered/i, errors.emailAlreadyRegistered],
  [/password should be at least/i, errors.passwordTooShort],
  [/password.*too short/i, errors.passwordTooShort],
];

function isOfflineLike(message: string): boolean {
  // supabase-js surfaces a dropped connection as a bare TypeError from fetch;
  // the wording differs per browser, hence the several patterns.
  return (
    /failed to fetch/i.test(message) ||
    /network ?error/i.test(message) ||
    /load failed/i.test(message) ||
    /networkerror when attempting to fetch/i.test(message) ||
    /fetch failed/i.test(message)
  );
}

function hasStringProp<K extends string>(value: unknown, key: K): value is Record<K, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    key in value &&
    typeof (value as Record<string, unknown>)[key] === 'string'
  );
}

/**
 * Translate anything thrown by supabase-js into a Hebrew sentence.
 *
 * Deliberately total: it accepts `unknown` and always returns a string, so a
 * call site can never accidentally render an English message by forgetting a
 * branch.
 */
export function toHebrewError(error: unknown): string {
  if (error == null) return errors.generic;

  // Offline is checked first: a fetch failure carries no useful code, and the
  // brief wants the "will sync later" wording rather than a generic failure.
  const message = hasStringProp(error, 'message') ? error.message : '';
  if (isOfflineLike(message)) return errors.offline;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return errors.offline;
  }

  const code = hasStringProp(error, 'code') ? error.code : '';
  if (PERMISSION_CODES.has(code)) return errors.permissionDenied;

  if (/permission denied/i.test(message) || /row-level security/i.test(message)) {
    return errors.permissionDenied;
  }

  for (const [pattern, hebrew] of AUTH_MESSAGE_MAP) {
    if (pattern.test(message)) return hebrew;
  }

  // The RPCs raise plain-text exceptions; map the ones a user can trigger.
  if (/admin only/i.test(message)) return errors.permissionDenied;
  if (/not allowed to work in this area/i.test(message)) return errors.permissionDenied;
  if (/cannot revoke your own admin role/i.test(message)) return errors.permissionDenied;

  return errors.generic;
}

/** Narrowing helpers, so call sites never reach for a non-null assertion. */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export function isPostgrestError(error: unknown): error is PostgrestError {
  return hasStringProp(error, 'message') && hasStringProp(error, 'code');
}
