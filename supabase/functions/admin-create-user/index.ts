import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Create a user, as an admin.
 *
 * Defect 3 of the original app: this ran client-side, and creating a user
 * REPLACED THE ADMIN'S OWN SESSION with the new user's — the admin was
 * suddenly signed in as the person they had just created.
 *
 * The service-role client here never touches the browser, so the caller's
 * session is untouched.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Hebrew only — an English error surfacing in this app is a bug (§9.6). */
const ERRORS = {
  unauthorized: 'אין לך הרשאה לבצע פעולה זו',
  emailExists: 'כתובת האימייל כבר רשומה במערכת',
  passwordShort: 'הסיסמה חייבת להכיל לפחות 8 תווים',
  invalidEmail: 'כתובת אימייל לא תקינה',
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

  let body: {
    email?: string;
    password?: string;
    display_name?: string;
    is_admin?: boolean;
    area_ids?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: ERRORS.generic }, 400);
  }

  const email = (body.email ?? '').trim();
  const password = body.password ?? '';
  const displayName = (body.display_name ?? '').trim();

  if (!email.includes('@')) return json({ error: ERRORS.invalidEmail }, 400);
  if (password.length < 8) return json({ error: ERRORS.passwordShort }, 400);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (createError || !created.user) {
    const message = createError?.message ?? '';
    if (/already been registered|already exists/i.test(message)) {
      return json({ error: ERRORS.emailExists }, 409);
    }
    return json({ error: ERRORS.generic }, 400);
  }

  const newUserId = created.user.id;

  /**
   * The flag and area RPCs run through the CALLER's client, not the
   * service-role one.
   *
   * `admin_set_user_flags` checks `public.is_admin()`, which reads
   * `auth.uid()`. Under the service-role key `auth.uid()` is NULL, so
   * `is_admin()` returns false and the RPC raises 'admin only'. The account
   * has to be created with the service-role client and then configured through
   * a client that carries the admin's own JWT.
   */
  const { error: flagsError } = await caller.rpc('admin_set_user_flags', {
    p_user_id: newUserId,
    p_is_authorized: true,
    p_is_admin: body.is_admin === true,
  });

  if (flagsError) {
    // Do not leave a half-created account behind that nobody configured.
    await admin.auth.admin.deleteUser(newUserId);
    return json({ error: ERRORS.generic }, 500);
  }

  const { error: areasError } = await caller.rpc('admin_set_user_areas', {
    p_user_id: newUserId,
    p_area_ids: body.area_ids ?? [],
  });

  if (areasError) {
    await admin.auth.admin.deleteUser(newUserId);
    return json({ error: ERRORS.generic }, 500);
  }

  return json({ id: newUserId });
});
