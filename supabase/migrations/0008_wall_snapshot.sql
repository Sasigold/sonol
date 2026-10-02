-- =============================================================================
-- Sonol Field Ops — read-only snapshot for the ViperGroup wall display
--
-- ViperGroup is a wall screen in the office that shows the whole business at
-- once; Sonol's panel is station progress, pace, ETA, who is working and a map.
-- The contract is docs/FEEDS.md §2 in the ViperGroup repo — change it there
-- first, then here.
--
-- Nothing that exists can serve it from outside the app:
--   * every stats view is `security_invoker`, so for anyone who is not a
--     signed-in admin it answers with the caller's own rows or none at all;
--   * `my_areas` filters on auth.uid(), which is NULL for a server caller;
--   * `global_stats.total_super` is fuel VOLUME (sum of stations.total), not a
--     station count, so "super remaining" cannot be read off it.
-- And the wall must never hold a service-role key or a user's password.
--
-- So the snapshot is computed here, behind a shared secret:
--   edge function `wall-feed` (verify_jwt = false) reads the `x-wall-secret`
--   header and calls `wall_snapshot(p_secret)` with the service-role key it is
--   injected with. Only service_role may execute it.
--
-- The secret itself is never stored. Vault holds its sha256 (hex), one row per
-- caller, under any name that starts with `wall_feed_secret`; a secret is
-- accepted when its hash equals ANY of those rows, so each deployment of the
-- wall has its own secret and can be rotated or revoked without touching the
-- others:
--   wall_feed_secret          the Vercel deployment
--   wall_feed_secret_minipc   the Mini PC that drives the TV
-- Rows are created and rotated with SQL, never in a migration:
--   select vault.create_secret(encode(sha256(convert_to('<secret>','UTF8')),'hex'),
--                              'wall_feed_secret', 'sha256 of the ViperGroup wall secret');
--   select vault.create_secret(encode(sha256(convert_to('<secret>','UTF8')),'hex'),
--                              'wall_feed_secret_minipc', 'sha256 of the Mini PC wall secret');
--   select vault.update_secret((select id from vault.secrets where name = 'wall_feed_secret_minipc'),
--                              encode(sha256(convert_to('<new secret>','UTF8')),'hex'));
-- Revoke one with `delete from vault.secrets where name = '<that name>'`.
--
-- Error codes are the edge function's whole interface to this file:
--   28P01 (invalid_password)              bad or short secret    -> 401
--   55000 (object_not_in_prerequisite_state) no usable hash in Vault -> 503
--
-- What counts:
--   * a completion is a STANDING one — `stations.is_done` with `completed_at`,
--     the current round's state. An undo removes it; the audit log
--     (`station_completions`) is not what the wall counts, except for the
--     far-from-station alert, which `completion_locations` (0005) already
--     restricts to the standing event.
--   * "today" is the Israel date, `(p_now at time zone 'Asia/Jerusalem')::date`
--     — the database runs in UTC, and a 23:30 tap belongs to the worker's day
--     (same reasoning as round_daily_stats in 0003).
--   * pace never divides by `rounds.started_at`: rounds are opened days before
--     anyone drives, and a round-long average reads as near zero. It is the
--     last 60 minutes, or today's rate since the first completion of the day.
--
-- Contents:
--   1. wall_feed_check     — the Vault hash check
--   2. wall_snapshot_at    — all the logic, with the clock as a parameter
--   3. wall_snapshot       — the entry point the edge function calls
--   4. Grants — REVOKE FIRST
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. wall_feed_check — compare the caller's secret to the hashes in Vault
--
-- Every Vault row whose name STARTS WITH `wall_feed_secret` is a candidate
-- (`wall_feed_secret`, `wall_feed_secret_minipc`, ...). `starts_with()` is a
-- literal prefix test: a LIKE pattern would read the underscores as wildcards
-- and let `wallXfeedXsecret` in. A name that merely contains the prefix
-- (`my_wall_feed_secret`), an unrelated name (`other_secret`) and a row with no
-- name are never candidates, whatever they hold.
--
-- A candidate counts only if its value is a sha256 in hex (64 hex digits,
-- case and surrounding spaces ignored). Anything else — a typo, a half-pasted
-- hash, the plaintext secret stored by mistake — is skipped, so one bad row
-- cannot lock out the others, and a plaintext secret can never authenticate.
-- No usable row at all -> 55000 (not configured), before the caller's secret is
-- even looked at; the one that misses every hash -> 28P01.
--
-- Built-in sha256() (PG 11+), not pgcrypto's digest(): nothing here needs an
-- extension. A length floor of 32 rejects a short or empty secret before it is
-- hashed, so a weak secret cannot be configured by accident on the wall side.
-- Comparing digests leaks nothing useful through timing — the caller does not
-- control the stored digests' prefixes.
-- -----------------------------------------------------------------------------
create or replace function public.wall_feed_check(p_secret text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hashes text[];
begin
  select array_agg(lower(btrim(decrypted_secret)))
    into v_hashes
    from vault.decrypted_secrets
   where starts_with(name, 'wall_feed_secret')
     and lower(btrim(decrypted_secret)) ~ '^[0-9a-f]{64}$';

  if v_hashes is null then
    raise exception 'wall feed not configured' using errcode = '55000';
  end if;

  if coalesce(length(p_secret), 0) < 32
     or (encode(sha256(convert_to(p_secret, 'UTF8')), 'hex') = any (v_hashes)) is not true then
    raise exception 'bad wall secret' using errcode = '28P01';
  end if;
end;
$$;

comment on function public.wall_feed_check(text) is
  'Raises 28P01 unless sha256(p_secret) equals the hex hash held by ANY Vault secret whose name starts with "wall_feed_secret" (one per wall deployment); 55000 when there is no such secret with a valid 64-hex hash. Internal to wall_snapshot.';


-- -----------------------------------------------------------------------------
-- 2. wall_snapshot_at — the whole payload, as of p_now
--
-- `p_now` replaces now() everywhere, so a test can pin the clock (and the
-- Israel-midnight boundary) without touching the data. In production it is
-- only ever called by wall_snapshot() with now().
--
-- Every time-windowed figure (today, last 15/60 minutes, series, first/last
-- completion) runs up to p_now, never past it. Counts of done / not done are
-- the stations' current state — that table has no history to rewind — so a
-- pinned p_now moves the windows, not the state.
--
-- `set timezone = 'UTC'`: jsonb renders a timestamptz in the session's zone at
-- build time. Pinning it makes every timestamp in the payload read
-- "...+00:00" whatever the caller's session says. Nothing below depends on the
-- session zone for arithmetic — Israel days are computed with explicit
-- `at time zone 'Asia/Jerusalem'`.
--
-- Runs as the owner (security definer), so the security_invoker views it reads
-- (area_stats, completion_locations) see every row; RLS would otherwise hand a
-- server caller nothing. It never reads `my_areas` (auth.uid()-scoped).
--
-- Payload (docs/FEEDS.md §2): v, source, generated_at, today, round, totals,
-- areas, pace, series, workers, alerts, stations. Every array is present, even
-- when empty; `round` is null when no round is open. No phone numbers, no
-- e-mail addresses.
-- -----------------------------------------------------------------------------
create or replace function public.wall_snapshot_at(p_now timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set timezone = 'UTC'
as $$
declare
  -- Israel calendar day containing p_now. "Today so far" is the absolute
  -- range [v_day_start, p_now]: p_now always falls before the day's end.
  v_today     date        := (p_now at time zone 'Asia/Jerusalem')::date;
  v_day_start timestamptz := v_today::timestamp at time zone 'Asia/Jerusalem';

  v_round     public.rounds;
  v_s         record;
  v_per_hour  numeric := 0;
  v_eta       timestamptz;
  v_far       bigint;
  v_areas     jsonb;
  v_series    jsonb;
  v_workers   jsonb;
  v_stations  jsonb;
begin
  -- 2.1 the open round (same rule as current_round_id()) ----------------------
  select * into v_round
    from public.rounds
   where ended_at is null
   order by started_at desc
   limit 1;

  -- 2.2 totals and pace inputs, one scan of stations --------------------------
  -- super_* are COUNTS of stations with fuel_type = 'super'. Markers are
  -- "pending" only on a station not yet done: once it is done the envelope or
  -- the flyers went with it.
  select
    count(*)                                                        as station_count,
    count(*) filter (where s.is_done)                               as done_count,
    count(*) filter (where not s.is_done)                           as remaining_count,
    count(*) filter (where s.fuel_type = 'super')                   as super_count,
    count(*) filter (where s.fuel_type = 'super' and not s.is_done) as super_remaining,
    count(*) filter (where s.has_envelope    and not s.is_done)     as envelopes_pending,
    count(*) filter (where s.has_flyers_note and not s.is_done)     as flyers_pending,
    count(*) filter (where s.is_done
                       and s.completed_at >= v_day_start
                       and s.completed_at <= p_now)                 as done_today,
    count(*) filter (where s.is_done
                       and s.completed_at >  p_now - interval '15 minutes'
                       and s.completed_at <= p_now)                 as done_15m,
    count(*) filter (where s.is_done
                       and s.completed_at >  p_now - interval '60 minutes'
                       and s.completed_at <= p_now)                 as done_60m,
    min(s.completed_at) filter (where s.is_done
                       and s.completed_at >= v_day_start
                       and s.completed_at <= p_now)                 as first_completed_today,
    max(s.completed_at) filter (where s.is_done
                       and s.completed_at <= p_now)                 as last_completed_at
  into v_s
  from public.stations s;

  -- 2.3 pace ------------------------------------------------------------------
  -- Stations per hour: the last 60 minutes when anything happened in them;
  -- otherwise today's average since the day's first completion. The 0.25 h
  -- floor on the elapsed time is the contract's guard against dividing by
  -- ~zero; on this branch the first completion is already over an hour old, so
  -- it never bites today. Zero when nothing was done today.
  if v_s.done_60m > 0 then
    v_per_hour := v_s.done_60m;
  elsif v_s.done_today > 0 then
    v_per_hour := round(
      v_s.done_today
        / greatest(extract(epoch from (p_now - v_s.first_completed_today)) / 3600.0, 0.25),
      2);
  end if;

  -- ETA from the reported (rounded) rate, so the wall can reproduce it.
  if v_s.remaining_count > 0 and v_per_hour > 0 then
    v_eta := date_trunc('second',
               p_now + interval '1 hour' * (v_s.remaining_count / v_per_hour)::double precision);
  end if;

  -- 2.4 areas, from area_stats (0001 §8.1) ------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'area_id',         a.area_id,
           'name',            a.area_name,
           'sort_order',      a.sort_order,
           'station_count',   a.station_count,
           'done_count',      a.done_count,
           'remaining_count', a.remaining_count
         ) order by a.sort_order, a.area_name), '[]'::jsonb)
    into v_areas
    from public.area_stats a;

  -- 2.5 series — today's standing completions in 15-minute buckets ------------
  -- Binned from Israel midnight. Israel's UTC offset is whole hours, so these
  -- are also clean quarter-hours in UTC. Empty buckets are omitted.
  select coalesce(jsonb_agg(jsonb_build_object('t', b.t, 'n', b.n) order by b.t), '[]'::jsonb)
    into v_series
    from (
      select date_bin(interval '15 minutes', s.completed_at, v_day_start) as t,
             count(*)                                                     as n
        from public.stations s
       where s.is_done
         and s.completed_at >= v_day_start
         and s.completed_at <= p_now
       group by 1
    ) b;

  -- 2.6 workers — who holds the round's standing completions ------------------
  -- `stations` IS the open round's state (reset_round wipes it), so grouping
  -- its completions by completer is "per worker, this round". The name is the
  -- denormalised snapshot complete_station() signs in (it survives the account
  -- being deleted — the 0002 round_user_stats pattern), falling back to the
  -- profile. A completion whose completer is gone entirely (no id, no name)
  -- belongs to nobody the wall could show, and is left out of this list only.
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id',           w.user_id,
           'name',              coalesce(w.snapshot_name, nullif(btrim(p.display_name), '')),
           'done_today',        w.done_today,
           'done_round',        w.done_round,
           'last_completed_at', w.last_completed_at
         ) order by w.done_today desc, w.done_round desc,
                    coalesce(w.snapshot_name, nullif(btrim(p.display_name), ''))), '[]'::jsonb)
    into v_workers
    from (
      select
        s.completed_by                                                    as user_id,
        (array_agg(nullif(btrim(s.completed_by_name), '') order by s.completed_at desc)
           filter (where nullif(btrim(s.completed_by_name), '') is not null))[1] as snapshot_name,
        count(*) filter (where s.completed_at >= v_day_start
                           and s.completed_at <= p_now)                  as done_today,
        count(*)                                                          as done_round,
        max(s.completed_at)                                               as last_completed_at
      from public.stations s
      where s.is_done
        and (s.completed_by is not null or nullif(btrim(s.completed_by_name), '') is not null)
      -- a deleted account (completed_by set null) groups by its snapshot name
      group by s.completed_by,
               case when s.completed_by is null then btrim(s.completed_by_name) end
    ) w
    left join public.profiles p on p.id = w.user_id;

  -- 2.7 far-from-station completions in the open round ------------------------
  -- completion_locations (0005) owns the definition: the STANDING completion's
  -- captured position more than 500m from the station, allowing for the fix's
  -- accuracy. The round_id predicate is pushed into its DISTINCT ON, so this
  -- reads one round's audit rows. No open round -> 0.
  select count(*)
    into v_far
    from public.completion_locations cl
   where cl.round_id = v_round.id
     and cl.is_far;

  -- 2.8 stations for the map — those with coordinates -------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',           s.id,
           'name',         s.name,
           'area_id',      s.area_id,
           'lat',          s.latitude,
           'lng',          s.longitude,
           'is_done',      s.is_done,
           'fuel_type',    s.fuel_type,
           'completed_at', s.completed_at
         ) order by a.sort_order, a.name, s.sort_number), '[]'::jsonb)
    into v_stations
    from public.stations s
    join public.areas a on a.id = s.area_id
   where s.latitude  is not null
     and s.longitude is not null;

  -- 2.9 assemble ---------------------------------------------------------------
  return jsonb_build_object(
    'v',            1,
    'source',       'sonol',
    'generated_at', p_now,
    'today',        v_today,
    'round',        case when v_round.id is null then null
                         else jsonb_build_object(
                                'id',         v_round.id,
                                'label',      v_round.label,
                                'started_at', v_round.started_at)
                    end,
    'totals', jsonb_build_object(
      'station_count',     v_s.station_count,
      'done_count',        v_s.done_count,
      'remaining_count',   v_s.remaining_count,
      'super_count',       v_s.super_count,
      'super_remaining',   v_s.super_remaining,
      'envelopes_pending', v_s.envelopes_pending,
      'flyers_pending',    v_s.flyers_pending
    ),
    'areas', v_areas,
    'pace', jsonb_build_object(
      'done_today',            v_s.done_today,
      'done_15m',              v_s.done_15m,
      'done_60m',              v_s.done_60m,
      'per_hour',              trim_scale(v_per_hour),
      'eta_at',                v_eta,
      'first_completed_today', v_s.first_completed_today,
      'last_completed_at',     v_s.last_completed_at
    ),
    'series',  v_series,
    'workers', v_workers,
    'alerts',  jsonb_build_object('far_completions', v_far),
    'stations', v_stations
  );
end;
$$;

comment on function public.wall_snapshot_at(timestamptz) is
  'The ViperGroup wall feed payload (ViperGroup docs/FEEDS.md §2) as of p_now. Internal: executable by nobody but its owner; call wall_snapshot().';


-- -----------------------------------------------------------------------------
-- 3. wall_snapshot — the entry point
--
-- Check the secret, then build the snapshot at the real clock. `stable`, like
-- the two functions it calls: it only reads, so PostgREST may run it in a
-- read-only transaction.
-- -----------------------------------------------------------------------------
create or replace function public.wall_snapshot(p_secret text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.wall_feed_check(p_secret);
  return public.wall_snapshot_at(now());
end;
$$;

comment on function public.wall_snapshot(text) is
  'ViperGroup wall feed. service_role only (edge function wall-feed). Raises 28P01 on a bad secret, 55000 when Vault has no wall_feed_secret% hash.';


-- -----------------------------------------------------------------------------
-- 4. Grants — REVOKE FIRST (CLAUDE.md §4)
--
-- Functions are born executable by PUBLIC, and Supabase's default privileges
-- add anon, authenticated and service_role on top. The two internal functions
-- lose all of them — service_role included: calling wall_snapshot_at directly
-- would skip the secret, and nothing needs to. wall_snapshot is executable by
-- service_role only; the definer owner calls the other two.
-- -----------------------------------------------------------------------------
revoke all on function public.wall_feed_check(text)         from public, anon, authenticated, service_role;
revoke all on function public.wall_snapshot_at(timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.wall_snapshot(text)           from public, anon, authenticated;

grant execute on function public.wall_snapshot(text) to service_role;
