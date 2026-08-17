-- =============================================================================
-- Sonol Field Ops — GPS capture at completion, and "far from station" checking
--
-- The manager wants to verify a worker was physically at the station. We capture
-- the worker's device position at the moment they confirm a completion and store
-- it two places, mirroring how the rest of completion state is split:
--   * on `stations` (completed_latitude/longitude/accuracy) for the CURRENT
--     round, so the station card can show the distance with no extra query and
--     `reset_round` wipes it like the other current-round columns;
--   * on `station_completions` (latitude/longitude/accuracy) as durable history,
--     which survives a reset the same way `created_at` does.
--
-- The capture is a synchronous read of a warm `watchPosition` fix on the client
-- (never an await that blocks the tap), and it rides the offline queue's record
-- so a tap made in a dead zone is replayed later WITH the position it had when
-- the worker was actually standing there — replay-time position would be wrong.
--
-- PRIVACY: this records worker location. It is captured only at a completion
-- tap, only when the browser grants permission, and only to answer "was the van
-- at the station". There is no continuous tracking beyond the foregrounded
-- completion screen.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Columns
--
-- All nullable: permission may be denied, a fix may be stale, and every row
-- written before this migration has none. Metadata-only defaults (no default at
-- all, in fact), so no table rewrite.
-- -----------------------------------------------------------------------------
alter table public.station_completions
  add column if not exists latitude  double precision check (latitude  between -90  and 90),
  add column if not exists longitude double precision check (longitude between -180 and 180),
  add column if not exists accuracy  double precision check (accuracy >= 0);

comment on column public.station_completions.latitude is
  'Worker device latitude captured at completion time (durable history). Null when permission was denied or no fresh fix was available.';

alter table public.stations
  add column if not exists completed_latitude  double precision check (completed_latitude  between -90  and 90),
  add column if not exists completed_longitude double precision check (completed_longitude between -180 and 180),
  add column if not exists completed_accuracy  double precision check (completed_accuracy >= 0);

comment on column public.stations.completed_latitude is
  'Worker device latitude for the CURRENT round''s completion of this station. Wiped by reset_round and uncomplete_station, like the other completed_* columns.';


-- -----------------------------------------------------------------------------
-- 2. complete_station — add the captured position (DROP + CREATE)
--
-- Same reasoning as 0003: a wider arg list via CREATE OR REPLACE would leave a
-- second overload and PostgREST would answer PGRST203 on the app's busiest RPC.
-- DROP the (uuid, boolean) signature first, then create the (uuid, boolean,
-- double, double, double) one. The three new params default to null, so a
-- precached PWA calling with just {p_station_id, p_queued} still resolves here.
-- Body is 0003's, plus the position written to stations and the audit row.
-- -----------------------------------------------------------------------------
drop function public.complete_station(uuid, boolean);
create function public.complete_station(
  p_station_id uuid,
  p_queued     boolean          default false,
  p_latitude   double precision default null,
  p_longitude  double precision default null,
  p_accuracy   double precision default null
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
     set is_done             = true,
         completed_at        = now(),
         completed_by        = auth.uid(),
         completed_by_name   = v_name,
         completed_latitude  = p_latitude,
         completed_longitude = p_longitude,
         completed_accuracy  = p_accuracy
   where id = p_station_id
  returning * into v_station;

  update public.profiles
     set completed_count = completed_count + 1
   where id = auth.uid();

  insert into public.station_completions
    (station_id, round_id, user_id, user_name, action, queued, latitude, longitude, accuracy)
  values
    (p_station_id, public.current_round_id(), auth.uid(), v_name, 'completed',
     coalesce(p_queued, false), p_latitude, p_longitude, p_accuracy);

  return v_station;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. uncomplete_station — clear the captured position too
--
-- Signature is unchanged (uuid, boolean), so CREATE OR REPLACE is safe (no
-- overload, no PostgREST ambiguity). The only change from 0003 is nulling the
-- three new stations columns alongside the existing completed_* ones, so an
-- undo cannot leave a stale distance on the card.
-- -----------------------------------------------------------------------------
create or replace function public.uncomplete_station(
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
     set is_done             = false,
         completed_at        = null,
         completed_by        = null,
         completed_by_name   = null,
         completed_latitude  = null,
         completed_longitude = null,
         completed_accuracy  = null
   where id = p_station_id
  returning * into v_station;

  if v_owner is not null then
    update public.profiles
       set completed_count = greatest(completed_count - 1, 0)
     where id = v_owner;
  end if;

  insert into public.station_completions
    (station_id, round_id, user_id, user_name, action, queued)
  values
    (p_station_id, public.current_round_id(), auth.uid(),
     (select display_name from public.profiles where id = auth.uid()),
     'uncompleted', coalesce(p_queued, false));

  return v_station;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. reset_round — wipe the captured position with the rest of the round state
--
-- Signature unchanged, so CREATE OR REPLACE is safe. Body is 0001's plus the
-- three new columns in the stations reset.
-- -----------------------------------------------------------------------------
create or replace function public.reset_round(p_label text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_round uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  update public.rounds set ended_at = now() where ended_at is null;

  insert into public.rounds (label, started_by)
  values (coalesce(p_label, to_char(now(), 'YYYY-MM-DD')), auth.uid())
  returning id into v_new_round;

  update public.stations
     set is_done             = false,
         completed_at        = null,
         completed_by        = null,
         completed_by_name   = null,
         completed_latitude  = null,
         completed_longitude = null,
         completed_accuracy  = null
   where is_done = true;

  update public.profiles
     set completed_count = 0
   where completed_count <> 0;

  return v_new_round;
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. Re-grant execute
--
-- DROP discarded complete_station's grants; the two CREATE OR REPLACEd
-- functions keep theirs, but restating all three keeps this file self-contained
-- (0002 §3 does the same for its views).
-- -----------------------------------------------------------------------------
revoke all on function public.complete_station(uuid, boolean, double precision, double precision, double precision) from public, anon;
revoke all on function public.uncomplete_station(uuid, boolean) from public, anon;
revoke all on function public.reset_round(text)                 from public, anon;
grant execute on function public.complete_station(uuid, boolean, double precision, double precision, double precision) to authenticated;
grant execute on function public.uncomplete_station(uuid, boolean) to authenticated;
grant execute on function public.reset_round(text)                 to authenticated;


-- -----------------------------------------------------------------------------
-- 6. completion_locations — distance from the station, per completion
--
-- One row per (round, station): the most recent standing 'completed' audit row
-- that carries a captured position, joined to the station's own coordinates,
-- with the great-circle distance in metres. `is_far` allows for the fix's own
-- reported accuracy so a poor GPS lock does not raise a false alarm.
--
-- Haversine is written inline rather than pulling in earthdistance/postgis — a
-- single distance needs no index support and no extension in the public schema
-- (which the advisor already flags for citext). The client has its OWN haversine
-- in src/lib/geo.ts for the station card, where the two points are already in
-- hand and a round trip would be wasteful; this view is the source of truth for
-- the dashboard aggregate, per CLAUDE.md §3.
--
-- security_invoker: an admin sees every worker's distances; a worker would see
-- only their own rows (completions_select), same as the other stats views.
-- -----------------------------------------------------------------------------
create or replace view public.completion_locations
with (security_invoker = on) as
with latest as (
  select distinct on (c.round_id, c.station_id)
    c.round_id, c.station_id, c.user_id, c.user_name,
    c.latitude, c.longitude, c.accuracy, c.created_at
  from public.station_completions c
  where c.action = 'completed'
    and c.round_id  is not null
    and c.latitude  is not null
    and c.longitude is not null
  order by c.round_id, c.station_id, c.created_at desc
)
select
  l.round_id,
  s.area_id,
  l.user_id,
  l.user_name,
  l.station_id,
  s.name       as station_name,
  l.created_at as completed_at,
  l.accuracy,
  (2 * 6371000 * asin(sqrt(
      power(sin(radians(s.latitude  - l.latitude)  / 2), 2)
    + cos(radians(l.latitude)) * cos(radians(s.latitude))
      * power(sin(radians(s.longitude - l.longitude) / 2), 2)
  ))) as distance_m,
  (2 * 6371000 * asin(sqrt(
      power(sin(radians(s.latitude  - l.latitude)  / 2), 2)
    + cos(radians(l.latitude)) * cos(radians(s.latitude))
      * power(sin(radians(s.longitude - l.longitude) / 2), 2)
  )) - coalesce(l.accuracy, 0) > 500) as is_far
from latest l
join public.stations s on s.id = l.station_id
where s.latitude is not null
  and s.longitude is not null;

comment on view public.completion_locations is
  'Per round, per station: the standing completion''s captured position vs the station''s coordinates, the distance in metres, and whether it exceeds 500m allowing for GPS accuracy.';


-- -----------------------------------------------------------------------------
-- 7. Grant — REVOKE FIRST (CLAUDE.md §4)
-- -----------------------------------------------------------------------------
revoke all on public.completion_locations from anon, authenticated;
grant select on public.completion_locations to authenticated;
