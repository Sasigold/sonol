import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Delete a user, as an admin.
 *
 * Defect 4 of the original app: deleting removed only the profile row. The
 * auth account survived, so the "deleted" person could sign straight back in
 * and a fresh profile would be provisioned for them by the trigger.
 *
 * Deleting the AUTH user is the operation; `profiles` cascades from it via
 * `references auth.users(id) on delete cascade`.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ERRORS = {
  unauthorized: 'אין לך הרשאה לבצע פעולה זו',
  self: 'לא ניתן למחוק את המשתמש שלך',
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

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json({ error: ERRORS.unauthorized }, 401);

  const { data: isAdmin, error: adminError } = await caller.rpc('is_admin');
  if (adminError || isAdmin !== true) return json({ error: ERRORS.unauthorized }, 403);

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: ERRORS.generic }, 400);
  }

  const targetId = body.user_id ?? '';
  if (!targetId) return json({ error: ERRORS.generic }, 400);

  // An admin deleting themselves would leave them signed in with no account.
  if (targetId === userData.user.id) return json({ error: ERRORS.self }, 400);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
  if (deleteError) return json({ error: ERRORS.generic }, 400);

  return json({ ok: true });
});
