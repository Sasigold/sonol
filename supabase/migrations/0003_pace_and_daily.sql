-- =============================================================================
-- Sonol Field Ops — pace between stations, anomalies, and daily progress
--
-- The manager wanted to see how long a worker takes between stations and to be
-- told when a leg is abnormally long, plus a day-by-day progress chart and the
-- real work span of each round. The raw material has existed since 0001:
-- `station_completions.created_at` is server time and survives `reset_round`.
--
-- The one hazard is the offline queue. A worker who marks 15 stations in a dead
-- zone replays them all within a few hundred milliseconds on reconnect
-- (src/lib/offline-queue.ts drains sequentially), so a naive inter-completion
-- gap would read fourteen near-zero deltas and one enormous one. We add a
-- `queued` flag written only by the replay path and drop any leg that touches a
-- replayed row from the pace stats. Rows predating this column all read
-- `queued = false`; the >= 60s leg filter below is their only shield.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The offline-replay marker
--
-- `not null default false` is a metadata-only default on PG 11+, so this does
-- not rewrite the table. Every historical row reads false.
-- -----------------------------------------------------------------------------
alter table public.station_completions
  add column if not exists queued boolean not null default false;

comment on column public.station_completions.queued is
  'True when this row was written by the offline queue replaying a tap made in a dead spot, not by a live call. Legs touching such a row are excluded from pace stats — their timing is the reconnect burst, not real travel.';


-- -----------------------------------------------------------------------------
-- 2. complete_station / uncomplete_station — add p_queued
--
-- DROP + CREATE, never CREATE OR REPLACE with a wider arg list. A second
-- function `complete_station(uuid, boolean)` living beside the 0001
-- `complete_station(uuid)` gives PostgREST two candidates both callable with
-- `{p_station_id}` — it answers PGRST203 (ambiguous) and every completion tap
-- 500s. Dropping the old signature first leaves exactly one function; the new
-- DEFAULT keeps a still-deployed (precached) PWA that calls without p_queued
-- working through the rollout.
--
-- Bodies are the 0001 §7.1 / §7.2 bodies verbatim; the only change is that the
-- audit insert carries `queued`.
-- -----------------------------------------------------------------------------
drop function public.complete_station(uuid);
create function public.complete_station(
  p_station_id uuid,
  p_queued     boolean default false
)
returns public.stations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station public.stations;
  v_name    text;
begin
  select * into v_station from public.stations where id = p_station_id for update;
  if not found then
    raise exception 'station not found';
  end if;

  if not public.can_access_area(v_station.area_id) then
    raise exception 'not allowed to work in this area';
  end if;

  if v_station.is_done then
    return v_station;                        -- idempotent
  end if;

  select display_name into v_name from public.profiles where id = auth.uid();

  update public.stations
     set is_done           = true,
         completed_at      = now(),
         completed_by      = auth.uid(),
         completed_by_name = v_name
   where id = p_station_id
  returning * into v_station;

  update public.profiles
     set completed_count = completed_count + 1
   where id = auth.uid();

  insert into public.station_completions (station_id, round_id, user_id, user_name, action, queued)
  values (p_station_id, public.current_round_id(), auth.uid(), v_name, 'completed', coalesce(p_queued, false));

  return v_station;
end;
$$;


drop function public.uncomplete_station(uuid);
create function public.uncomplete_station(
  p_station_id uuid,
  p_queued     boolean default false
)
returns public.stations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station public.stations;
  v_owner   uuid;
begin
  select * into v_station from public.stations where id = p_station_id for update;
  if not found then
    raise exception 'station not found';
  end if;

  if not public.can_access_area(v_station.area_id) then
    raise exception 'not allowed to work in this area';
  end if;

  if not v_station.is_done then
    return v_station;                        -- idempotent
  end if;

  v_owner := v_station.completed_by;

  update public.stations
     set is_done           = false,
         completed_at      = null,
         completed_by      = null,
         completed_by_name = null
   where id = p_station_id
  returning * into v_station;

  -- decrement the ORIGINAL completer, never blindly the caller
  if v_owner is not null then
    update public.profiles
       set completed_count = greatest(completed_count - 1, 0)
     where id = v_owner;
  end if;

  insert into public.station_completions (station_id, round_id, user_id, user_name, action, queued)
  values (p_station_id, public.current_round_id(), auth.uid(),
          (select display_name from public.profiles where id = auth.uid()),
          'uncompleted', coalesce(p_queued, false));

  return v_station;
end;
$$;

-- DROP discarded the 0001 grants — restate them for the new signatures.
revoke all on function public.complete_station(uuid, boolean)   from public, anon;
revoke all on function public.uncomplete_station(uuid, boolean) from public, anon;
grant execute on function public.complete_station(uuid, boolean)   to authenticated;
grant execute on function public.uncomplete_station(uuid, boolean) to authenticated;


-- -----------------------------------------------------------------------------
-- 3. Pace views (F1)
--
-- The window scan orders each worker's completions within a round by time;
-- completions_round_user_idx (round_id, user_id) from 0001 cannot serve that
-- ordering, so add a covering index.
-- -----------------------------------------------------------------------------
create index if not exists completions_round_user_created_idx
  on public.station_completions (round_id, user_id, created_at);


-- One leg per pair of consecutive completions by the same worker in the same
-- round. This single view owns the leg definition, the exclusions, the median
-- and the 3x threshold, so the per-leg list and the aggregate below can never
-- disagree.
--
-- RLS x window functions: this is `security_invoker`, so `completions_select`
-- filters the base rows BEFORE lag() runs. An admin computes legs over every
-- row; a worker computes lag() over only their own rows — their own legs and
-- their own median, never able to see or infer another worker's. That is both
-- private and correct, so the view needs no is_admin() gate; limiting the
-- screen to admins is a UI routing fact, not a data-leak concern.
create or replace view public.completion_gaps
with (security_invoker = on) as
with completed as (
  select
    c.round_id,
    c.user_id,
    c.user_name,
    c.station_id,
    c.created_at,
    c.queued,
    lag(c.station_id) over w as prev_station_id,
    lag(c.created_at) over w as prev_created_at,
    lag(c.queued)     over w as prev_queued
  from public.station_completions c
  where c.action = 'completed'
    and c.round_id is not null
    and c.user_id  is not null
  window w as (partition by c.round_id, c.user_id order by c.created_at, c.id)
),
legs as (
  select
    round_id,
    user_id,
    user_name,
    prev_station_id                                         as from_station_id,
    station_id                                              as to_station_id,
    created_at                                              as completed_at,
    extract(epoch from (created_at - prev_created_at))::int as gap_seconds
  from completed
  where prev_created_at is not null
    and not queued and not prev_queued           -- a replayed row breaks the chain both ways
    and created_at - prev_created_at >= interval '60 seconds'  -- shield pre-0003 replay bursts
),
medians as (
  select
    round_id,
    user_id,
    percentile_cont(0.5) within group (order by gap_seconds) as median_gap_seconds
  from legs
  group by round_id, user_id
)
select
  l.round_id,
  l.user_id,
  l.user_name,
  l.from_station_id,
  sf.name as from_station_name,
  l.to_station_id,
  st.name as to_station_name,
  l.completed_at,
  l.gap_seconds,
  m.median_gap_seconds,
  (l.gap_seconds > 3 * m.median_gap_seconds) as is_anomaly
from legs l
join medians m using (round_id, user_id)
left join public.stations sf on sf.id = l.from_station_id
left join public.stations st on st.id = l.to_station_id;

comment on view public.completion_gaps is
  'One leg per pair of consecutive completions by the same worker in a round, with the gap in seconds, that worker''s median gap, and whether the leg exceeds 3x the median. Excludes legs touching an offline-replayed row and legs under 60s.';


-- The per-worker aggregate the dashboard section reads — one query, no summing
-- on the client (CLAUDE.md §3).
create or replace view public.worker_pace_stats
with (security_invoker = on) as
select
  round_id,
  user_id,
  -- same denormalised-snapshot pattern as round_user_stats (0002): survives the
  -- account being deleted, where a profile join would blank the name.
  (array_agg(user_name order by completed_at desc))[1] as user_name,
  count(*)                            as leg_count,
  min(median_gap_seconds)             as median_gap_seconds,   -- constant per group
  max(gap_seconds)                    as max_gap_seconds,
  count(*) filter (where is_anomaly)  as anomaly_count
from public.completion_gaps
group by round_id, user_id;

comment on view public.worker_pace_stats is
  'Per round, per worker: number of legs, median gap, worst gap, and how many legs were anomalous.';


-- -----------------------------------------------------------------------------
-- 4. Round timing (F3)
--
-- round_stats is replaced, not altered: CREATE OR REPLACE VIEW may only APPEND
-- columns, so the 0002 body is reproduced byte-for-byte and the two timestamps
-- are added last. For a worker, invoker RLS means first/last of THEIR OWN
-- completions — the same semantics 0002 already documents for the counts.
-- -----------------------------------------------------------------------------
create or replace view public.round_stats
with (security_invoker = on) as
select
  r.id                                                       as round_id,
  r.label,
  r.started_at,
  r.ended_at,
  count(c.id) filter (where c.action = 'completed')           as completed_count,
  count(c.id) filter (where c.action = 'uncompleted')         as uncompleted_count,
  count(distinct c.user_id) filter (where c.action = 'completed') as worker_count,
  min(c.created_at) filter (where c.action = 'completed')     as first_completed_at,
  max(c.created_at) filter (where c.action = 'completed')     as last_completed_at
from public.rounds r
left join public.station_completions c on c.round_id = r.id
group by r.id, r.label, r.started_at, r.ended_at;

comment on view public.round_stats is
  'One row per round: how much was completed, undone, by how many people, and the real work span (first to last completion).';


-- Completions per day, bucketed in Asia/Jerusalem so an evening (23:30) tap
-- belongs to the worker's day, not to UTC's next one. `day` reaches the client
-- as a 'YYYY-MM-DD' string — no timezone arithmetic ever runs in the browser.
create or replace view public.round_daily_stats
with (security_invoker = on) as
select
  round_id,
  (created_at at time zone 'Asia/Jerusalem')::date as day,
  count(*) filter (where action = 'completed')     as completed_count
from public.station_completions
where round_id is not null
group by round_id, (created_at at time zone 'Asia/Jerusalem')::date;

comment on view public.round_daily_stats is
  'Completions per calendar day (Asia/Jerusalem) within each round.';


-- -----------------------------------------------------------------------------
-- 5. Grants — REVOKE FIRST (CLAUDE.md §4)
--
-- Every view is BORN with full privileges for anon + authenticated because of
-- Supabase's default privileges; the revoke is what makes the grant the actual
-- permission. round_stats keeps its grants across CREATE OR REPLACE, but it is
-- restated here to keep the file self-contained, as 0002 §3 does.
-- -----------------------------------------------------------------------------
revoke all on public.completion_gaps, public.worker_pace_stats,
              public.round_daily_stats, public.round_stats
  from anon, authenticated;

grant select on public.completion_gaps, public.worker_pace_stats,
                public.round_daily_stats, public.round_stats
  to authenticated;
