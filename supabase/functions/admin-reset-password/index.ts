import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Set a new password for another user, as an admin.
 *
 * The self-service route (/forgot-password) requires the worker to reach their
 * own inbox. A field worker who has forgotten their password and has no mail
 * access on the vehicle tablet cannot use it, and there was no other way back
 * in — the admin could delete and recreate the account, which loses the
 * account's history.
 *
 * Runs in an Edge Function for the same reason creation does: only the
 * service-role key may touch another user's auth record, and it must never
 * reach the browser. `admin.auth.admin.updateUserById` also leaves the
 * caller's own session alone.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Hebrew only — an English error surfacing in this app is a bug (§9.6). */
const ERRORS = {
  unauthorized: 'אין לך הרשאה לבצע פעולה זו',
  passwordShort: 'הסיסמה חייבת להכיל לפחות 8 תווים',
  userNotFound: 'המשתמש לא נמצא',
  generic: 'אירעה שגיאה. נסה שוב.',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: ERRORS.unauthorized }, 401);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // The CALLER's client — carries their JWT, so auth.uid() resolves to them.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json({ error: ERRORS.unauthorized }, 401);

  // Verify admin against the DATABASE, never against anything the client sent.
  const { data: isAdmin, error: adminError } = await caller.rpc('is_admin');
  if (adminError || isAdmin !== true) return json({ error: ERRORS.unauthorized }, 403);

  let body: { user_id?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: ERRORS.generic }, 400);
  }

  const userId = (body.user_id ?? '').trim();
  const password = body.password ?? '';

  if (userId.length === 0) return json({ error: ERRORS.userNotFound }, 400);
  // The same 8-character rule the UI applies. Supabase Auth's own minimum is
  // left at its default of 6, so this endpoint enforces it rather than
  // trusting the form that called it.
  if (password.length < 8) return json({ error: ERRORS.passwordShort }, 400);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password });

  if (updateError) {
    const message = updateError.message;
    if (/user not found/i.test(message)) return json({ error: ERRORS.userNotFound }, 404);
    if (/password/i.test(message)) return json({ error: ERRORS.passwordShort }, 400);
    return json({ error: ERRORS.generic }, 400);
  }

  // Deliberately returns nothing about the account — the caller already knows
  // who they asked for, and an echo is one more place for a password-adjacent
  // detail to end up in a log.
  return json({ ok: true });
});
