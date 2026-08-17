import { describe, expect, it } from 'vitest';
import { forgotPasswordSchema, signInSchema } from './schemas';
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
