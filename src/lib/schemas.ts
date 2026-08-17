import { z } from 'zod';
import { validation } from './copy';

/**
 * Every form is validated before submit, with Hebrew messages (brief §3,
 * rule 7). The original app had no validation at all — the brief calls this
 * "the single biggest quality gap to close".
 *
 * Schemas live here rather than beside their forms so the messages stay
 * auditable in one place against §9.6.
 */

/**
 * `.min(1)` before the format check, via `.pipe()`, so an untouched field reads
 * "שדה חובה" rather than "כתובת אימייל לא תקינה" — telling someone their blank
 * field is malformed is the wrong message.
 *
 * zod 4 moved `email()` to the top level; `z.string().email()` is deprecated.
 */
const email = z
  .string()
  .trim()
  .min(1, { error: validation.required })
  .pipe(z.email({ error: validation.invalidEmail }));

/**
 * Sign-in (§8.1): "password required, min 6".
 *
 * Note this is 6, not 8. §8.1 says 6 while §9.6 supplies only an 8-character
 * message; rather than show an 8 message for a 6 rule, sign-in gets its own
 * string. Account CREATION (§8.8) uses `passwordCreate` below, which is 8.
 */
export const signInSchema = z.object({
  email,
  password: z
    .string()
    .min(1, { message: validation.required })
    .min(6, { message: validation.passwordMin6 }),
});

export type SignInValues = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({ email });

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/** Reused by user creation in phase 5. */
export const passwordCreate = z
  .string()
  .min(1, { message: validation.required })
  .min(8, { message: validation.passwordMin8 });
