-- =============================================================================
-- Wall feed suite — 0008_wall_snapshot.sql
--
-- Run with ./supabase/tests/run-wall-snapshot.sh (PG16+, root), which builds a
-- scratch cluster, stubs what Supabase provides, applies every migration and
-- then runs this file. Each assertion prints one `pass` or `FAIL` line.
--
-- Covers:
--   * grants: anon / authenticated execute none of the three functions;
--     service_role executes wall_snapshot only;
--   * the secret: unset -> 55000, wrong / short / null -> 28P01, right -> JSON,
--     rotation through vault.update_secret;
--   * several secrets (one Vault row per wall deployment, any name starting
--     with wall_feed_secret): each is accepted, an unknown one is 28P01, rotating
--     one row leaves the others working, unrelated / look-alike names never
--     count, malformed rows are ignored, no valid row at all -> 55000;
--   * the numbers, at pinned clocks: totals (super as a station COUNT, markers
--     pending only on stations not done), areas, pace (60m rate, today's
--     average fallback, ETA), 15-minute series, workers, far completions,
--     map stations;
--   * Israel days: a 23:30 UTC completion is "today" in Israel, a 20:30 UTC one
--     the day before is not, and the day turns at Israel midnight;
--   * the payload's keys match ViperGroup docs/FEEDS.md §2 exactly.
--
-- The session runs in America/New_York on purpose: the payload must render
-- every timestamp in UTC ("+00:00") whatever the caller's zone is.
-- =============================================================================

set client_min_messages = warning;
set timezone = 'America/New_York';

-- ===== assertion helpers (security invoker: run as whoever calls them) =======
create schema t;
grant usage on schema t to anon, authenticated, service_role;

create function t.eq(p_label text, p_actual anyelement, p_expected anyelement)
returns text language plpgsql as $$
begin
  if p_actual is not distinct from p_expected then
    return 'pass  ' || p_label;
  end if;
  return 'FAIL  ' || p_label || ' — got ' || coalesce(p_actual::text, 'null')
       || ', expected ' || coalesce(p_expected::text, 'null');
end $$;

-- Runs p_sql and passes only if it raises exactly SQLSTATE p_state.
create function t.raises(p_label text, p_sql text, p_state text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return 'FAIL  ' || p_label || ' — succeeded, expected SQLSTATE ' || p_state;
exception when others then
  if sqlstate = p_state then
    return 'pass  ' || p_label;
  end if;
  return 'FAIL  ' || p_label || ' — SQLSTATE ' || sqlstate || ' (' || sqlerrm || '), expected ' || p_state;
end $$;

create function t.ok(p_label text, p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return 'pass  ' || p_label;
exception when others then
  return 'FAIL  ' || p_label || ' — ' || sqlstate || ' ' || sqlerrm;
end $$;

-- sha256 of a secret, in hex: what Vault holds
create function t.h(p_secret text)
returns text language sql immutable as $$
  select encode(sha256(convert_to(p_secret, 'UTF8')), 'hex')
$$;

-- Calls wall_snapshot(p_secret) AS service_role (the only role that may), then
-- goes back to the caller's role, so a test can alternate between changing
-- Vault (superuser; the stub gives service_role no access to it) and calling
-- the feed. p_expected is the SQLSTATE the call must raise, or null if it must
-- succeed.
create function t.wall(p_label text, p_secret text, p_expected text default null)
returns text language plpgsql as $$
declare
  v_prev text := current_user;
begin
  perform set_config('role', 'service_role', true);
  begin
    perform public.wall_snapshot(p_secret);
  exception when others then
    perform set_config('role', v_prev, true);   -- the subtransaction rolled it back
    if sqlstate = p_expected then
      return 'pass  ' || p_label;
    end if;
    return 'FAIL  ' || p_label || ' — SQLSTATE ' || sqlstate || ' (' || sqlerrm || '), expected '
        || coalesce(p_expected, 'success');
  end;
  perform set_config('role', v_prev, true);
  if p_expected is null then
    return 'pass  ' || p_label;
  end if;
  return 'FAIL  ' || p_label || ' — succeeded, expected SQLSTATE ' || p_expected;
end $$;

-- Sorted top-level keys of a JSON object, for contract checks.
create function t.keys(p_obj jsonb)
returns text[] language sql immutable as $$
  select coalesce(array_agg(k order by k), '{}') from jsonb_object_keys(p_obj) k
$$;


-- ===== seed ===================================================================
-- Clock for the main snapshot: 2026-10-02 09:00 UTC = 12:00 in Israel (IDT,
-- UTC+3). Israel "today" = 2026-10-02 = [2026-10-01 21:00 UTC, ...).
--
-- UUID prefixes: a0 areas, b0 stations, c0 users, d0 rounds.

insert into auth.users (id, email, raw_user_meta_data) values
  ('c0000000-0000-0000-0000-000000000001', 'dana@test.local',  '{"display_name": "דנה"}'),
  ('c0000000-0000-0000-0000-000000000002', 'yossi@test.local', '{"display_name": "יוסי כהן"}'),
  ('c0000000-0000-0000-0000-000000000003', 'avi@test.local',   '{"display_name": "אבי"}');

-- close 0001's seeded round; one old closed round and the open one
update public.rounds set ended_at = started_at where ended_at is null;
insert into public.rounds (id, label, started_at, ended_at) values
  ('d0000000-0000-0000-0000-000000000001', '2026-09-10', '2026-09-10 05:00+00', '2026-09-20 15:00+00'),
  ('d0000000-0000-0000-0000-000000000002', '2026-09-28', '2026-09-28 05:00+00', null);

insert into public.areas (id, name, sort_order) values
  ('a0000000-0000-0000-0000-000000000001', 'צפון', 1),
  ('a0000000-0000-0000-0000-000000000002', 'מרכז', 2),
  ('a0000000-0000-0000-0000-000000000003', 'דרום', 3);   -- no stations

--  st  area #  fuel     coords      state
--  01  A1   1  regular  yes         done 10-02 08:50 UTC  dana
--  02  A1   2  super    yes         done 10-02 08:20 UTC  dana
--  03  A1   3  regular  yes         done 10-02 07:10 UTC  yossi (old name snapshot)
--  04  A1   4  super    yes         not done, envelope
--  05  A1   5  regular  NO          not done, flyers note
--  11  A1   6  regular  yes         done 10-02 08:46 UTC  yossi
--  06  A2   1  regular  yes         done 10-01 23:30 UTC  yossi — 02:30 in Israel: TODAY
--  07  A2   2  super    yes         done 10-01 20:30 UTC  avi, no snapshot — 23:30 in Israel: yesterday
--  08  A2   3  regular  yes         done 09-30 10:00 UTC  deleted account, envelope (done -> not pending)
--  09  A2   4  super    yes         not done
--  10  A2   5  regular  yes         not done, envelope + flyers note
--  12  A2   6  regular  yes         done 09-29 09:00 UTC  no completer at all (pre-app import)
insert into public.stations
  (id, area_id, name, sort_number, fuel_type, latitude, longitude,
   is_done, completed_at, completed_by, completed_by_name, has_envelope, has_flyers_note)
values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'תחנה 1',  1, 'regular', 32.01, 34.8,
   true,  '2026-10-02 08:50+00', 'c0000000-0000-0000-0000-000000000001', 'דנה',        false, false),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'תחנה 2',  2, 'super',   32.02, 34.8,
   true,  '2026-10-02 08:20+00', 'c0000000-0000-0000-0000-000000000001', 'דנה',        false, false),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'תחנה 3',  3, 'regular', 32.03, 34.8,
   true,  '2026-10-02 07:10+00', 'c0000000-0000-0000-0000-000000000002', 'יוסי ישן',   false, false),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'תחנה 4',  4, 'super',   32.04, 34.8,
   false, null, null, null,                                                             true,  false),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'תחנה 5',  5, 'regular', null,  null,
   false, null, null, null,                                                             false, true),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'תחנה 11', 6, 'regular', 32.11, 34.8,
   true,  '2026-10-02 08:46+00', 'c0000000-0000-0000-0000-000000000002', 'יוסי',       false, false),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'תחנה 6',  1, 'regular', 32.06, 34.8,
   true,  '2026-10-01 23:30+00', 'c0000000-0000-0000-0000-000000000002', 'יוסי ישן',   false, false),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'תחנה 7',  2, 'super',   32.07, 34.8,
   true,  '2026-10-01 20:30+00', 'c0000000-0000-0000-0000-000000000003', null,         false, false),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', 'תחנה 8',  3, 'regular', 32.08, 34.8,
   true,  '2026-09-30 10:00+00', null, 'עובד לשעבר',                                    true,  false),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', 'תחנה 9',  4, 'super',   32.09, 34.8,
   false, null, null, null,                                                             false, false),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000002', 'תחנה 10', 5, 'regular', 32.10, 34.8,
   false, null, null, null,                                                             true,  true),
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000002', 'תחנה 12', 6, 'regular', 32.12, 34.8,
   true,  '2026-09-29 09:00+00', null, null,                                            false, false);

-- Audit rows for the far-from-station alert (completion_locations, 0005).
-- 0.01 degree of latitude is ~1.1 km.
insert into public.station_completions
  (station_id, round_id, user_id, user_name, action, created_at, latitude, longitude, accuracy)
values
  -- st 01: at the station -> not far
  ('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000001', 'דנה', 'completed', '2026-10-02 08:50+00', 32.01, 34.8, 10),
  -- st 01 in the CLOSED round, far -> other round, not counted
  ('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 'דנה', 'completed', '2026-09-12 08:00+00', 32.20, 34.8, 10),
  -- st 02: ~2.2 km away -> FAR
  ('b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000001', 'דנה', 'completed', '2026-10-02 08:20+00', 32.04, 34.8, 10),
  -- st 03: near, undone, then completed ~3.3 km away -> the standing one is FAR
  ('b0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000002', 'יוסי', 'completed',   '2026-10-02 07:00+00', 32.03, 34.8, 10),
  ('b0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000002', 'יוסי', 'uncompleted', '2026-10-02 07:05+00', null,  null, null),
  ('b0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000002', 'יוסי', 'completed',   '2026-10-02 07:10+00', 32.06, 34.8, 10),
  -- st 04: far, then undone -> no standing completion, not counted
  ('b0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000002', 'יוסי', 'completed',   '2026-10-02 06:00+00', 32.10, 34.8, 10),
  ('b0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000002', 'יוסי', 'uncompleted', '2026-10-02 06:30+00', null,  null, null),
  -- st 06: ~556 m away, but a 100 m fix -> within the allowance, not far
  ('b0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000002', 'יוסי', 'completed', '2026-10-01 23:30+00', 32.065, 34.8, 100),
  -- st 11: no position captured -> not in completion_locations
  ('b0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000002', 'יוסי', 'completed', '2026-10-02 08:46+00', null,  null, null);


-- ===== 1. grants ==============================================================
select t.eq('anon has no EXECUTE on wall_snapshot',
  has_function_privilege('anon', 'public.wall_snapshot(text)', 'execute'), false);
select t.eq('authenticated has no EXECUTE on wall_snapshot',
  has_function_privilege('authenticated', 'public.wall_snapshot(text)', 'execute'), false);
select t.eq('service_role has EXECUTE on wall_snapshot',
  has_function_privilege('service_role', 'public.wall_snapshot(text)', 'execute'), true);
select t.eq('service_role has no EXECUTE on wall_snapshot_at',
  has_function_privilege('service_role', 'public.wall_snapshot_at(timestamptz)', 'execute'), false);
select t.eq('service_role has no EXECUTE on wall_feed_check',
  has_function_privilege('service_role', 'public.wall_feed_check(text)', 'execute'), false);

set role anon;
select t.raises('anon: wall_snapshot is permission denied',
  $$select public.wall_snapshot('x')$$, '42501');
select t.raises('anon: wall_snapshot_at is permission denied',
  $$select public.wall_snapshot_at(now())$$, '42501');
select t.raises('anon: wall_feed_check is permission denied',
  $$select public.wall_feed_check('x')$$, '42501');
reset role;

set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', false); end $$;
select t.raises('authenticated: wall_snapshot is permission denied',
  $$select public.wall_snapshot('x')$$, '42501');
select t.raises('authenticated: wall_snapshot_at is permission denied',
  $$select public.wall_snapshot_at(now())$$, '42501');
select t.raises('authenticated: wall_feed_check is permission denied',
  $$select public.wall_feed_check('x')$$, '42501');
do $$ begin perform set_config('request.jwt.claim.sub', '', false); end $$;
reset role;

set role service_role;
select t.raises('service_role: wall_snapshot_at directly is permission denied (would skip the secret)',
  $$select public.wall_snapshot_at(now())$$, '42501');


-- ===== 2. the secret ==========================================================
select t.raises('no hash in Vault -> 55000 (not configured)',
  $$select public.wall_snapshot('test-wall-secret-0123456789abcdef-XYZ')$$, '55000');
reset role;

-- the exact command the README documents
select t.ok('configure: the documented vault.create_secret command',
  $q$select vault.create_secret(encode(sha256(convert_to('test-wall-secret-0123456789abcdef-XYZ','UTF8')),'hex'),'wall_feed_secret','sha256 of the ViperGroup wall secret')$q$);

set role service_role;
select t.raises('wrong secret -> 28P01',
  $$select public.wall_snapshot('test-wall-secret-0123456789abcdef-XYW')$$, '28P01');
select t.raises('empty secret -> 28P01',
  $$select public.wall_snapshot('')$$, '28P01');
select t.raises('null secret -> 28P01',
  $$select public.wall_snapshot(null)$$, '28P01');
select t.ok('right secret -> snapshot',
  $$select public.wall_snapshot('test-wall-secret-0123456789abcdef-XYZ')$$);
select t.eq('right secret: v = 1, source = sonol',
  (select j->>'v' || '/' || (j->>'source')
     from (select public.wall_snapshot('test-wall-secret-0123456789abcdef-XYZ') j) x),
  '1/sonol');
select t.eq('right secret: today is the Israel date of now()',
  (select j->>'today' from (select public.wall_snapshot('test-wall-secret-0123456789abcdef-XYZ') j) x),
  ((now() at time zone 'Asia/Jerusalem')::date)::text);
select t.eq('right secret: generated_at renders in UTC',
  (select right(j->>'generated_at', 6) from (select public.wall_snapshot('test-wall-secret-0123456789abcdef-XYZ') j) x),
  '+00:00');
reset role;

-- a matching hash does not let a short secret through: the 32-char floor holds
begin;
do $$ begin
  perform vault.update_secret((select id from vault.secrets where name = 'wall_feed_secret'),
                              encode(sha256(convert_to('short-secret-31-chars-xxxxxxxxx', 'UTF8')), 'hex'));
end $$;
set local role service_role;
select t.raises('31-char secret whose hash matches -> 28P01',
  $$select public.wall_snapshot('short-secret-31-chars-xxxxxxxxx')$$, '28P01');
rollback;

-- rotation, with the command the README documents
select t.ok('rotate: the documented vault.update_secret command',
  $q$select vault.update_secret((select id from vault.secrets where name = 'wall_feed_secret'), encode(sha256(convert_to('rotated-wall-secret-0123456789abcdef','UTF8')),'hex'))$q$);
set role service_role;
select t.raises('after rotation: old secret -> 28P01',
  $$select public.wall_snapshot('test-wall-secret-0123456789abcdef-XYZ')$$, '28P01');
select t.ok('after rotation: new secret -> snapshot',
  $$select public.wall_snapshot('rotated-wall-secret-0123456789abcdef')$$);
reset role;


-- ===== 2b. several secrets: wall_feed_secret% ==================================
-- One Vault row per wall deployment: `wall_feed_secret` (Vercel) and
-- `wall_feed_secret_minipc` (Mini PC). A secret is accepted if its hash equals
-- ANY row whose name starts with `wall_feed_secret`. Everything below runs in
-- one transaction that is rolled back, so Vault ends as section 2 left it: a
-- single `wall_feed_secret` row holding the rotated secret.
--
--   V  vercel-wall-secret-...-01   Vercel          M  minipc-wall-secret-...-02  Mini PC
--   V2 / M2 their rotations        U  a secret no row holds
--   D  a secret held only by rows that must NOT count (decoys)
begin;

delete from vault.secrets where starts_with(name, 'wall_feed_secret');

-- decoys, all holding the hash of D, kept for the whole section
do $$ begin
  perform vault.create_secret(t.h('decoy-wall-secret-0123456789abcdef-99'), 'other_secret', 'unrelated');
  perform vault.create_secret(t.h('decoy-wall-secret-0123456789abcdef-99'), 'my_wall_feed_secret', 'prefix is not at the start');
  perform vault.create_secret(t.h('decoy-wall-secret-0123456789abcdef-99'), 'wallXfeedXsecret', 'underscores are not LIKE wildcards');
  perform vault.create_secret(t.h('decoy-wall-secret-0123456789abcdef-99'), 'wall_feed_secre', 'one letter short of the prefix');
  perform vault.create_secret(t.h('decoy-wall-secret-0123456789abcdef-99'), null, 'no name');
end $$;

select t.wall('only decoy rows in Vault (unrelated, suffix, "_"-as-wildcard, short prefix, unnamed) -> 55000',
  'decoy-wall-secret-0123456789abcdef-99', '55000');

-- 2b.1 two rows, the commands the README documents
select t.ok('configure Vercel: the documented vault.create_secret command',
  $q$select vault.create_secret(encode(sha256(convert_to('vercel-wall-secret-0123456789abcdef-01','UTF8')),'hex'),'wall_feed_secret','sha256 of the ViperGroup wall secret')$q$);
select t.ok('configure Mini PC: the documented vault.create_secret command',
  $q$select vault.create_secret(encode(sha256(convert_to('minipc-wall-secret-0123456789abcdef-02','UTF8')),'hex'),'wall_feed_secret_minipc','sha256 of the Mini PC wall secret')$q$);

select t.wall('two rows: the Vercel secret is accepted',
  'vercel-wall-secret-0123456789abcdef-01');
select t.wall('two rows: the Mini PC secret is accepted',
  'minipc-wall-secret-0123456789abcdef-02');
select t.wall('two rows: a third, unknown secret -> 28P01',
  'unknown-wall-secret-0123456789abcdef-3', '28P01');
select t.wall('two rows: a one-character change in either secret -> 28P01',
  'minipc-wall-secret-0123456789abcdef-03', '28P01');
select t.wall('two rows: empty secret -> 28P01', '', '28P01');
select t.wall('two rows: null secret -> 28P01', null, '28P01');
select t.eq('two rows: the Mini PC secret gets the real payload',
  (select j->>'source' from (select public.wall_snapshot('minipc-wall-secret-0123456789abcdef-02') j) x),
  'sonol');

-- 2b.2 the decoys hold hash(D), and still do not count
select t.wall('decoy rows hold the hash of D, which is NOT accepted (other_secret and look-alikes)',
  'decoy-wall-secret-0123456789abcdef-99', '28P01');

-- 2b.3 rotating one row leaves the other working
select t.ok('rotate Mini PC: vault.update_secret on its own row',
  $q$select vault.update_secret((select id from vault.secrets where name = 'wall_feed_secret_minipc'), encode(sha256(convert_to('minipc-rotated-secret-0123456789abcdef-02','UTF8')),'hex'))$q$);
select t.wall('after rotating Mini PC: its old secret -> 28P01',
  'minipc-wall-secret-0123456789abcdef-02', '28P01');
select t.wall('after rotating Mini PC: its new secret is accepted',
  'minipc-rotated-secret-0123456789abcdef-02');
select t.wall('after rotating Mini PC: Vercel is untouched',
  'vercel-wall-secret-0123456789abcdef-01');

select t.ok('rotate Vercel: vault.update_secret on its own row',
  $q$select vault.update_secret((select id from vault.secrets where name = 'wall_feed_secret'), encode(sha256(convert_to('vercel-rotated-secret-0123456789abcdef-01','UTF8')),'hex'))$q$);
select t.wall('after rotating Vercel: its old secret -> 28P01',
  'vercel-wall-secret-0123456789abcdef-01', '28P01');
select t.wall('after rotating Vercel: its new secret is accepted',
  'vercel-rotated-secret-0123456789abcdef-01');
select t.wall('after rotating Vercel: the rotated Mini PC secret still works',
  'minipc-rotated-secret-0123456789abcdef-02');

-- 2b.4 any name that starts with wall_feed_secret is a row; the hash may be
--      upper case or padded with spaces
do $$ begin
  perform vault.create_secret(t.h('unknown-wall-secret-0123456789abcdef-3'), 'wall_feed_secret_staging', 'a third caller');
end $$;
select t.wall('a third row, wall_feed_secret_staging: its secret is accepted',
  'unknown-wall-secret-0123456789abcdef-3');
delete from vault.secrets where name = 'wall_feed_secret_staging';
select t.wall('the third row deleted (revoked): its secret -> 28P01',
  'unknown-wall-secret-0123456789abcdef-3', '28P01');
select t.wall('the third row revoked: the other two still work',
  'vercel-rotated-secret-0123456789abcdef-01');

do $$ begin
  perform vault.create_secret('  ' || upper(t.h('unknown-wall-secret-0123456789abcdef-3')) || ' ', 'wall_feed_secret_staging', 'upper case, padded');
end $$;
select t.wall('an upper-case, space-padded hash is accepted',
  'unknown-wall-secret-0123456789abcdef-3');
delete from vault.secrets where name = 'wall_feed_secret_staging';

-- 2b.5 a malformed row is ignored; the valid rows keep working
do $$ begin
  perform vault.create_secret('not-a-hash',                                  'wall_feed_secret_bad1', 'garbage');
  perform vault.create_secret(repeat('z', 64),                               'wall_feed_secret_bad2', '64 chars, not hex');
  perform vault.create_secret('',                                            'wall_feed_secret_bad3', 'empty');
  -- the secret itself, stored by mistake instead of its hash
  perform vault.create_secret('unknown-wall-secret-0123456789abcdef-3',      'wall_feed_secret_bad4', 'plaintext secret');
  perform vault.create_secret(left(t.h('unknown-wall-secret-0123456789abcdef-3'), 63), 'wall_feed_secret_bad5', 'hash, one digit short');
  perform vault.create_secret(t.h('unknown-wall-secret-0123456789abcdef-3') || '0',    'wall_feed_secret_bad6', 'hash, one digit long');
end $$;
select t.wall('malformed rows present: the Vercel secret still works',
  'vercel-rotated-secret-0123456789abcdef-01');
select t.wall('malformed rows present: the Mini PC secret still works',
  'minipc-rotated-secret-0123456789abcdef-02');
select t.wall('malformed rows present: a secret stored in plaintext does not authenticate',
  'unknown-wall-secret-0123456789abcdef-3', '28P01');
select t.wall('malformed rows present: an unknown secret -> 28P01 (not 55000)',
  'unknown-wall-secret-0123456789abcdef-4', '28P01');

-- 2b.6 no valid row left -> 55000, as with an invalid value before
delete from vault.secrets where name in ('wall_feed_secret', 'wall_feed_secret_minipc');
select t.wall('only malformed rows left -> 55000 (not configured)',
  'vercel-rotated-secret-0123456789abcdef-01', '55000');
select t.wall('only malformed rows left: the plaintext-stored secret -> 55000 too',
  'unknown-wall-secret-0123456789abcdef-3', '55000');

-- 2b.7 none at all -> 55000, whatever the decoys hold
delete from vault.secrets where starts_with(name, 'wall_feed_secret');
select t.wall('no wall_feed_secret% row, decoys still there -> 55000',
  'decoy-wall-secret-0123456789abcdef-99', '55000');
select t.wall('no wall_feed_secret% row: a null secret -> 55000 as well (configuration first)',
  null, '55000');

-- 2b.8 the 32-character floor holds for every row, not only the first
do $$ begin
  perform vault.create_secret(t.h('short-secret-31-chars-xxxxxxxxx'), 'wall_feed_secret_minipc', 'short secret');
  perform vault.create_secret(t.h('vercel-wall-secret-0123456789abcdef-01'), 'wall_feed_secret', 'long enough');
end $$;
select t.wall('a 31-char secret whose hash matches the second row -> 28P01',
  'short-secret-31-chars-xxxxxxxxx', '28P01');
select t.wall('...while the long one is accepted',
  'vercel-wall-secret-0123456789abcdef-01');

rollback;

select t.wall('Vault is back to one row: the rotated secret from 2 works',
  'rotated-wall-secret-0123456789abcdef');
select t.eq('Vault is back to one row: wall_feed_secret% rows',
  (select count(*) from vault.secrets where starts_with(name, 'wall_feed_secret')), 1::bigint);


-- ===== 3. the payload at pinned clocks ========================================
create temp table snap (k text primary key, j jsonb not null);
insert into snap values
  ('0900',   public.wall_snapshot_at('2026-10-02 09:00+00')),     -- 12:00 Israel
  ('1030',   public.wall_snapshot_at('2026-10-02 10:30+00')),     -- nothing in the last hour
  ('2345',   public.wall_snapshot_at('2026-10-01 23:45+00')),     -- 02:45 Israel, Oct 2
  ('205959', public.wall_snapshot_at('2026-10-01 20:59:59+00')),  -- 23:59:59 Israel, Oct 1
  ('2100',   public.wall_snapshot_at('2026-10-01 21:00+00')),     -- 00:00 Israel, Oct 2
  ('quiet',  public.wall_snapshot_at('2026-10-05 09:00+00'));     -- a day with no work

-- 3.1 contract: keys exactly as docs/FEEDS.md §2
select t.eq('keys: top level',
  t.keys((select j from snap where k = '0900')),
  array['alerts','areas','generated_at','pace','round','series','source','stations','today','totals','v','workers']);
select t.eq('keys: round',
  t.keys((select j->'round' from snap where k = '0900')), array['id','label','started_at']);
select t.eq('keys: totals',
  t.keys((select j->'totals' from snap where k = '0900')),
  array['done_count','envelopes_pending','flyers_pending','remaining_count','station_count','super_count','super_remaining']);
select t.eq('keys: areas[]',
  t.keys((select j->'areas'->0 from snap where k = '0900')),
  array['area_id','done_count','name','remaining_count','sort_order','station_count']);
select t.eq('keys: pace',
  t.keys((select j->'pace' from snap where k = '0900')),
  array['done_15m','done_60m','done_today','eta_at','first_completed_today','last_completed_at','per_hour']);
select t.eq('keys: series[]',
  t.keys((select j->'series'->0 from snap where k = '0900')), array['n','t']);
select t.eq('keys: workers[]',
  t.keys((select j->'workers'->0 from snap where k = '0900')),
  array['done_round','done_today','last_completed_at','name','user_id']);
select t.eq('keys: alerts',
  t.keys((select j->'alerts' from snap where k = '0900')), array['far_completions']);
select t.eq('keys: stations[]',
  t.keys((select j->'stations'->0 from snap where k = '0900')),
  array['area_id','completed_at','fuel_type','id','is_done','lat','lng','name']);

-- 3.2 header
select t.eq('09:00: v = 1',            (select j->'v' from snap where k = '0900'), '1'::jsonb);
select t.eq('09:00: generated_at is p_now, in UTC despite a New York session',
  (select j->>'generated_at' from snap where k = '0900'), '2026-10-02T09:00:00+00:00');
select t.eq('09:00: today',            (select j->>'today' from snap where k = '0900'), '2026-10-02');
select t.eq('09:00: round is the open one',
  (select j->'round' from snap where k = '0900'),
  '{"id": "d0000000-0000-0000-0000-000000000002", "label": "2026-09-28", "started_at": "2026-09-28T05:00:00+00:00"}'::jsonb);

-- 3.3 totals
select t.eq('09:00: totals',
  (select j->'totals' from snap where k = '0900'),
  '{"station_count": 12, "done_count": 8, "remaining_count": 4,
    "super_count": 4, "super_remaining": 2,
    "envelopes_pending": 2, "flyers_pending": 2}'::jsonb);

-- 3.4 areas — from area_stats, in sort order, the empty area included
select t.eq('09:00: areas',
  (select j->'areas' from snap where k = '0900'),
  '[{"area_id": "a0000000-0000-0000-0000-000000000001", "name": "צפון", "sort_order": 1,
     "station_count": 6, "done_count": 4, "remaining_count": 2},
    {"area_id": "a0000000-0000-0000-0000-000000000002", "name": "מרכז", "sort_order": 2,
     "station_count": 6, "done_count": 4, "remaining_count": 2},
    {"area_id": "a0000000-0000-0000-0000-000000000003", "name": "דרום", "sort_order": 3,
     "station_count": 0, "done_count": 0, "remaining_count": 0}]'::jsonb);

-- 3.5 pace at 09:00: 3 in the last hour -> 3/h; 4 left -> ETA 10:20
--   today = st 06 (23:30 UTC the day before), 03, 02, 11, 01 = 5;
--   st 07 (20:30 UTC = 23:30 Israel, Oct 1) is NOT today.
select t.eq('09:00: pace',
  (select j->'pace' from snap where k = '0900'),
  '{"done_today": 5, "done_15m": 2, "done_60m": 3, "per_hour": 3,
    "eta_at": "2026-10-02T10:20:00+00:00",
    "first_completed_today": "2026-10-01T23:30:00+00:00",
    "last_completed_at": "2026-10-02T08:50:00+00:00"}'::jsonb);

-- 3.6 series: 15-minute buckets from Israel midnight, empty ones omitted
select t.eq('09:00: series',
  (select j->'series' from snap where k = '0900'),
  '[{"t": "2026-10-01T23:30:00+00:00", "n": 1},
    {"t": "2026-10-02T07:00:00+00:00", "n": 1},
    {"t": "2026-10-02T08:15:00+00:00", "n": 1},
    {"t": "2026-10-02T08:45:00+00:00", "n": 2}]'::jsonb);

-- 3.7 workers: done_today desc, done_round desc, name.
--   yossi: latest name snapshot wins over the older one and over the profile;
--   avi: no snapshot -> profile name; a deleted account keeps its snapshot
--   with user_id null; st 12 (no id, no name) belongs to nobody -> left out.
select t.eq('09:00: workers',
  (select j->'workers' from snap where k = '0900'),
  '[{"user_id": "c0000000-0000-0000-0000-000000000002", "name": "יוסי",
     "done_today": 3, "done_round": 3, "last_completed_at": "2026-10-02T08:46:00+00:00"},
    {"user_id": "c0000000-0000-0000-0000-000000000001", "name": "דנה",
     "done_today": 2, "done_round": 2, "last_completed_at": "2026-10-02T08:50:00+00:00"},
    {"user_id": "c0000000-0000-0000-0000-000000000003", "name": "אבי",
     "done_today": 0, "done_round": 1, "last_completed_at": "2026-10-01T20:30:00+00:00"},
    {"user_id": null, "name": "עובד לשעבר",
     "done_today": 0, "done_round": 1, "last_completed_at": "2026-09-30T10:00:00+00:00"}]'::jsonb);

-- 3.8 far completions: st 02 and st 03's standing completion. Not st 01
--   (near), not the closed round, not st 04 (undone), not st 06 (accuracy),
--   not st 11 (no position).
select t.eq('09:00: alerts.far_completions',
  (select j->'alerts' from snap where k = '0900'), '{"far_completions": 2}'::jsonb);

-- 3.9 stations for the map
select t.eq('09:00: stations with coordinates only (11 of 12)',
  (select jsonb_array_length(j->'stations') from snap where k = '0900'), 11);
select t.eq('09:00: station without coordinates left out',
  (select count(*) from snap, jsonb_array_elements(j->'stations') s
    where k = '0900' and s->>'id' = 'b0000000-0000-0000-0000-000000000005'), 0::bigint);
select t.eq('09:00: first station, in area then drive order',
  (select j->'stations'->0 from snap where k = '0900'),
  '{"id": "b0000000-0000-0000-0000-000000000001", "name": "תחנה 1",
    "area_id": "a0000000-0000-0000-0000-000000000001", "lat": 32.01, "lng": 34.8,
    "is_done": true, "fuel_type": "regular", "completed_at": "2026-10-02T08:50:00+00:00"}'::jsonb);
select t.eq('09:00: a station not done has completed_at null',
  (select s from snap, jsonb_array_elements(j->'stations') s
    where k = '0900' and s->>'id' = 'b0000000-0000-0000-0000-000000000009'),
  '{"id": "b0000000-0000-0000-0000-000000000009", "name": "תחנה 9",
    "area_id": "a0000000-0000-0000-0000-000000000002", "lat": 32.09, "lng": 34.8,
    "is_done": false, "fuel_type": "super", "completed_at": null}'::jsonb);

-- 3.10 nothing in the last hour -> today's average since the first completion:
--   5 stations / 11 h = 0.4545 -> 0.45/h; 4 / 0.45 h = 8:53:20 -> 19:23:20
select t.eq('10:30: pace falls back to today''s average',
  (select j->'pace' from snap where k = '1030'),
  '{"done_today": 5, "done_15m": 0, "done_60m": 0, "per_hour": 0.45,
    "eta_at": "2026-10-02T19:23:20+00:00",
    "first_completed_today": "2026-10-01T23:30:00+00:00",
    "last_completed_at": "2026-10-02T08:50:00+00:00"}'::jsonb);

-- 3.11 a 23:30 UTC completion is Israel's today (02:30, Oct 2)
select t.eq('23:45 UTC: today is already Oct 2 in Israel',
  (select j->>'today' from snap where k = '2345'), '2026-10-02');
select t.eq('23:45 UTC: the 23:30 UTC completion counts as today',
  (select (j->'pace'->'done_today')::int from snap where k = '2345'), 1);
select t.eq('23:45 UTC: series holds it',
  (select j->'series' from snap where k = '2345'), '[{"t": "2026-10-01T23:30:00+00:00", "n": 1}]'::jsonb);

-- 3.12 the day turns at Israel midnight, not UTC midnight
select t.eq('20:59:59 UTC: still Oct 1 in Israel',
  (select j->>'today' from snap where k = '205959'), '2026-10-01');
select t.eq('20:59:59 UTC: the 20:30 UTC completion is Oct 1''s',
  (select j->'series' from snap where k = '205959'), '[{"t": "2026-10-01T20:30:00+00:00", "n": 1}]'::jsonb);
select t.eq('21:00 UTC: Oct 2 in Israel',
  (select j->>'today' from snap where k = '2100'), '2026-10-02');
select t.eq('21:00 UTC: nothing done yet today, the last hour still sets the pace',
  (select j->'pace' from snap where k = '2100'),
  '{"done_today": 0, "done_15m": 0, "done_60m": 1, "per_hour": 1,
    "eta_at": "2026-10-02T01:00:00+00:00",
    "first_completed_today": null,
    "last_completed_at": "2026-10-01T20:30:00+00:00"}'::jsonb);
select t.eq('21:00 UTC: series empty but present',
  (select j->'series' from snap where k = '2100'), '[]'::jsonb);

-- 3.13 a quiet day: no rate, no ETA, every array still present
select t.eq('quiet day: pace',
  (select j->'pace' from snap where k = 'quiet'),
  '{"done_today": 0, "done_15m": 0, "done_60m": 0, "per_hour": 0, "eta_at": null,
    "first_completed_today": null, "last_completed_at": "2026-10-02T08:50:00+00:00"}'::jsonb);
select t.eq('quiet day: series is []',
  (select j->'series' from snap where k = 'quiet'), '[]'::jsonb);
select t.eq('quiet day: workers still listed, none today',
  (select array_agg((w->>'done_today')::int order by o) from snap,
          jsonb_array_elements(j->'workers') with ordinality x(w, o) where k = 'quiet'),
  array[0, 0, 0, 0]);

-- 3.14 round complete: nothing left, no ETA, no pending markers
begin;
update public.stations
   set is_done = true, completed_at = '2026-10-02 08:55+00',
       completed_by = 'c0000000-0000-0000-0000-000000000001', completed_by_name = 'דנה'
 where not is_done;
select t.eq('round complete: totals',
  (select j->'totals' from (select public.wall_snapshot_at('2026-10-02 09:00+00') j) x),
  '{"station_count": 12, "done_count": 12, "remaining_count": 0,
    "super_count": 4, "super_remaining": 0,
    "envelopes_pending": 0, "flyers_pending": 0}'::jsonb);
select t.eq('round complete: per_hour 7, eta null',
  (select (j->'pace'->>'per_hour') || '/' || coalesce(j->'pace'->>'eta_at', 'null')
     from (select public.wall_snapshot_at('2026-10-02 09:00+00') j) x),
  '7/null');
rollback;

-- 3.15 no open round: round null, no far alert, the rest unchanged
begin;
update public.rounds set ended_at = '2026-10-02 09:30+00' where ended_at is null;
select t.eq('no open round: round is null',
  (select j->'round' from (select public.wall_snapshot_at('2026-10-02 09:00+00') j) x), 'null'::jsonb);
select t.eq('no open round: far_completions 0',
  (select j->'alerts' from (select public.wall_snapshot_at('2026-10-02 09:00+00') j) x),
  '{"far_completions": 0}'::jsonb);
rollback;

-- 3.16 one real payload, for the record
select 'info  sample: ' || jsonb_pretty(j - 'stations')
       || E'\n      stations[0]: ' || (j->'stations'->0)::text
  from snap where k = '0900';
