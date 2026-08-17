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

/** Reused by user creation (§8.8) and by both new-password forms. */
export const passwordCreate = z
  .string()
  .min(1, { message: validation.required })
  .min(8, { message: validation.passwordMin8 });

/**
 * Choosing a new password — the recovery screen and the profile screen.
 *
 * Same 8-character rule as user creation, and the same client-side-only
 * caveat: Supabase Auth's server minimum stays at its default of 6, so this
 * governs the UI and not the API.
 */
export const newPasswordSchema = z
  .object({
    password: passwordCreate,
    passwordConfirm: z.string().min(1, { message: validation.required }),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: validation.passwordsDoNotMatch,
    path: ['passwordConfirm'],
  });

export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

/**
 * Israeli phone numbers, normalised before validation so a user may type
 * `050-123-4567`, `0501234567` or `+972 50 123 4567` and be believed.
 *
 * Optional: the column is nullable and a field worker without a number on
 * file must still be able to save their display name.
 */
export function normalisePhone(input: string): string {
  return input.replace(/[\s\-()]/g, '').replace(/^\+972/, '0');
}

const phone = z
  .string()
  .trim()
  .transform(normalisePhone)
  .refine((value) => value.length === 0 || /^0\d{8,9}$/.test(value), {
    message: validation.invalidPhone,
  });

/** The user's own contact details — the only profile columns they may write. */
export const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, { message: validation.required })
    .min(2, { message: validation.nameMin2 })
    .max(60, { message: validation.nameMin2 }),
  phone_number: phone,
});

export type ProfileValues = z.infer<typeof profileSchema>;

/**
 * Area add / rename.
 *
 * Only the name. `sort_order` is never typed — areas are reordered with the
 * up/down buttons, which swap two rows' existing values — so there is no user
 * input to validate and no way to enter a number that collides.
 */
export const areaSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: validation.required })
    .min(2, { message: validation.nameMin2 })
    .max(60, { message: validation.nameMin2 }),
});

export type AreaValues = z.infer<typeof areaSchema>;

/**
 * Station add/edit (§8.6).
 *
 * `sort_number` is `numeric(10,2)` in the database precisely so a station can
 * be slotted between 12 and 13 as 12.5 without renumbering the whole area — so
 * this accepts up to two decimals rather than an integer.
 */
export const stationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: validation.required })
    .min(2, { message: validation.nameMin2 })
    .max(100, { message: validation.nameMin2 }),
  sort_number: z
    .number({ message: validation.positiveNumber })
    .positive({ message: validation.positiveNumber })
    .refine((value) => Number.isInteger(Math.round(value * 100)), {
      message: validation.positiveNumber,
    }),
  area_id: z.string().min(1, { message: validation.required }),
  fuel_type: z.enum(['regular', 'super']),
  total: z.number().int().min(0, { message: validation.positiveNumber }),
  flyers: z.number().int().min(0, { message: validation.positiveNumber }),
  waze_link: z.string().trim(),
});

export type StationValues = z.infer<typeof stationSchema>;

/** User creation (§8.8). Password is min 8 here, unlike sign-in's min 6. */
export const createUserSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(1, { message: validation.required })
      .min(2, { message: validation.nameMin2 }),
    email,
    password: passwordCreate,
    passwordConfirm: z.string().min(1, { message: validation.required }),
    is_admin: z.boolean(),
    area_ids: z.array(z.string()),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: validation.passwordsDoNotMatch,
    // Attach to the confirmation field so the message appears under it.
    path: ['passwordConfirm'],
  });

export type CreateUserValues = z.infer<typeof createUserSchema>;
