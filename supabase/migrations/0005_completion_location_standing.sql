-- =============================================================================
-- Sonol Field Ops — completion_locations must only count a completion that
-- still stands
--
-- Bug: 0004's view took the most recent row WHERE action = 'completed' per
-- (round, station). Undoing a completion inserts an 'uncompleted' audit row but
-- leaves the earlier 'completed' row untouched, so the view kept returning it —
-- an undone station stayed flagged "far from station" on the dashboard.
--
-- Fix: rank ALL of a (round, station)'s events, take the single most recent one,
-- and keep it only when that latest event is itself a 'completed' with a
-- captured position. An 'uncompleted' as the latest event now correctly drops
-- the station from the view. A complete → undo → complete sequence keeps the
-- newest completion's position, as it should.
-- =============================================================================

create or replace view public.completion_locations
with (security_invoker = on) as
with latest as (
  select distinct on (c.round_id, c.station_id)
    c.round_id,
    c.station_id,
    c.user_id,
    c.user_name,
    c.action,
    c.latitude,
    c.longitude,
    c.accuracy,
    c.created_at
  from public.station_completions c
  where c.round_id is not null
  -- `id desc` breaks ties when a complete and its undo share a timestamp
  -- (same-transaction now()), so the true last event wins.
  order by c.round_id, c.station_id, c.created_at desc, c.id desc
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
where l.action = 'completed'          -- the station's latest event is a completion...
  and l.latitude  is not null          -- ...that captured a position...
  and l.longitude is not null
  and s.latitude  is not null          -- ...and the station has coordinates to compare to.
  and s.longitude is not null;

comment on view public.completion_locations is
  'Per round, per station: the STANDING completion''s captured position vs the station''s coordinates, the distance in metres, and whether it exceeds 500m allowing for GPS accuracy. A station whose latest event is an uncomplete does not appear.';

-- CREATE OR REPLACE keeps the 0004 grants; restated for a self-contained file.
revoke all on public.completion_locations from anon, authenticated;
grant select on public.completion_locations to authenticated;
