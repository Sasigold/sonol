import { describe, expect, it } from 'vitest';
import {
  areaSchema,
  forgotPasswordSchema,
  newPasswordSchema,
  normalisePhone,
  profileSchema,
  signInSchema,
} from './schemas';
import { validation } from './copy';

/** First error message for a given field, or null. */
function messageFor(
  result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } },
  field: string,
): string | null {
  if (result.success || !result.error) return null;
  const issue = result.error.issues.find((candidate) => candidate.path[0] === field);
  return issue?.message ?? null;
}

describe('signInSchema', () => {
  it('accepts a valid pair', () => {
    expect(signInSchema.safeParse({ email: 'a@sonol.co.il', password: 'secret1' }).success).toBe(
      true,
    );
  });

  it('rejects a blank email as required, not as malformed', () => {
    // Showing "invalid email address" for an untouched field is the wrong
    // message; blank must read as שדה חובה.
    const result = signInSchema.safeParse({ email: '', password: 'secret1' });
    expect(messageFor(result, 'email')).toBe(validation.required);
  });

  it('rejects a malformed email', () => {
    const result = signInSchema.safeParse({ email: 'not-an-email', password: 'secret1' });
    expect(messageFor(result, 'email')).toBe(validation.invalidEmail);
  });

  it('enforces the six-character boundary exactly', () => {
    // §8.1 says min 6 — NOT the 8 used for account creation.
    const five = signInSchema.safeParse({ email: 'a@b.co', password: '12345' });
    expect(messageFor(five, 'password')).toBe(validation.passwordMin6);

    expect(signInSchema.safeParse({ email: 'a@b.co', password: '123456' }).success).toBe(true);
  });

  it('reports a blank password as required', () => {
    const result = signInSchema.safeParse({ email: 'a@b.co', password: '' });
    expect(messageFor(result, 'password')).toBe(validation.required);
  });

  it('trims surrounding whitespace on the email', () => {
    const result = signInSchema.safeParse({ email: '  a@sonol.co.il  ', password: 'secret1' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('a@sonol.co.il');
  });

  it('sources every message from copy.ts rather than a local literal', () => {
    const result = signInSchema.safeParse({ email: 'x', password: '1' });
    if (result.success) throw new Error('expected failure');
    const known: string[] = Object.values(validation);
    for (const issue of result.error.issues) {
      expect(known).toContain(issue.message);
    }
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts a valid address and rejects a blank one', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@sonol.co.il' }).success).toBe(true);
    expect(messageFor(forgotPasswordSchema.safeParse({ email: '' }), 'email')).toBe(
      validation.required,
    );
  });
});

describe('newPasswordSchema', () => {
  it('accepts a matching pair of eight characters', () => {
    const result = newPasswordSchema.safeParse({
      password: 'sonol123',
      passwordConfirm: 'sonol123',
    });
    expect(result.success).toBe(true);
  });

  it('enforces the eight-character rule, not sign-in six', () => {
    const result = newPasswordSchema.safeParse({ password: 'sonol1', passwordConfirm: 'sonol1' });
    expect(messageFor(result, 'password')).toBe(validation.passwordMin8);
  });

  it('reports a mismatch under the confirmation field', () => {
    const result = newPasswordSchema.safeParse({
      password: 'sonol123',
      passwordConfirm: 'sonol124',
    });
    expect(messageFor(result, 'passwordConfirm')).toBe(validation.passwordsDoNotMatch);
  });
});

describe('normalisePhone', () => {
  it('accepts the shapes a person actually types', () => {
    expect(normalisePhone('050-123-4567')).toBe('0501234567');
    expect(normalisePhone('+972 50 123 4567')).toBe('0501234567');
    expect(normalisePhone('(03) 1234567')).toBe('031234567');
  });
});

describe('profileSchema', () => {
  it('accepts a name with no phone number at all', () => {
    // The column is nullable; a worker with no number on file must still be
    // able to save their display name.
    const result = profileSchema.safeParse({ display_name: 'דנה', phone_number: '' });
    expect(result.success).toBe(true);
  });

  it('normalises the number it stores', () => {
    const result = profileSchema.safeParse({
      display_name: 'דנה',
      phone_number: '050-123-4567',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone_number).toBe('0501234567');
  });

  it('rejects a number that is not an Israeli one', () => {
    const result = profileSchema.safeParse({ display_name: 'דנה', phone_number: '1234' });
    expect(messageFor(result, 'phone_number')).toBe(validation.invalidPhone);
  });

  it('rejects a one-character name', () => {
    const result = profileSchema.safeParse({ display_name: 'ד', phone_number: '' });
    expect(messageFor(result, 'display_name')).toBe(validation.nameMin2);
  });
});

describe('areaSchema', () => {
  it('accepts a real area and trims it', () => {
    const result = areaSchema.safeParse({ name: '  שרון  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('שרון');
  });

  it('rejects a blank name as required, and a one-character one as too short', () => {
    expect(messageFor(areaSchema.safeParse({ name: '   ' }), 'name')).toBe(validation.required);
    expect(messageFor(areaSchema.safeParse({ name: 'ש' }), 'name')).toBe(validation.nameMin2);
  });
});
