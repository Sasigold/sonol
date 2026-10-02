import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Read-only snapshot of the round for the ViperGroup wall display.
 *
 * ViperGroup is the office wall screen that shows the whole business at once.
 * Its Sonol panel — station progress, pace, ETA, who is working, the map —
 * polls this endpoint server-to-server (from its own API route, never from a
 * browser). The payload contract is docs/FEEDS.md §2 in the ViperGroup repo.
 *
 * Why a function and not a REST call: every stats view is security_invoker, so
 * without a signed-in admin they answer with nothing, and the wall must hold
 * neither a service-role key nor a user's password. Instead the wall holds one
 * revocable secret. It arrives in `x-wall-secret` and is checked IN THE
 * DATABASE: `wall_snapshot(p_secret)` compares its sha256 with the hash kept in
 * Vault as `wall_feed_secret` (0008_wall_snapshot.sql), and only service_role
 * may execute it — which is why the client below uses the injected
 * service-role key. The key never leaves this function.
 *
 * Deployed with verify_jwt = false: the caller has no Supabase JWT, and the
 * gateway would otherwise refuse it before this code runs. The secret is the
 * authentication.
 *
 * No CORS on purpose — the endpoint is server-to-server only, so there is no
 * preflight to answer. Errors are short English codes for the calling server,
 * never shown in the Sonol UI; database messages are not passed through.
 *
 *   28P01 (bad or short secret)          -> 401 { error: 'unauthorized' }
 *   55000 (no hash in Vault)             -> 503 { error: 'not configured' }
 *   anything else                        -> 500 { error: 'internal' }
 */

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // a snapshot is stale the moment it is sent; never let anything cache it
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405, { Allow: 'GET, POST' });
  }

  const secret = req.headers.get('x-wall-secret');
  if (!secret) return json({ error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data, error } = await admin.rpc('wall_snapshot', { p_secret: secret });

    if (error) {
      if (error.code === '28P01') return json({ error: 'unauthorized' }, 401);
      if (error.code === '55000') return json({ error: 'not configured' }, 503);
      // The code only — a message could carry SQL detail into a log reader's hands.
      console.error('wall_snapshot failed', error.code);
      return json({ error: 'internal' }, 500);
    }

    return json(data);
  } catch {
    console.error('wall_snapshot threw');
    return json({ error: 'internal' }, 500);
  }
});
