-- =============================================================================
-- Sonol Field Ops — per-round, per-station drill-down
--
-- `station_completions` has recorded who/when/where every completion happened
-- since 0001, and `reset_round` has never deleted from it — a reset only wipes
-- the CURRENT-round convenience columns on `stations`. But nothing in the app
-- ever let an admin browse that detail per station: `round_stats`/
-- `round_user_stats` (0002) are aggregates only, and `completion_locations`
-- (0004/0005) is scoped to the dashboard's "far from station" widget — current
-- open round only, and it silently drops any station with no captured GPS or a
-- station missing coordinates. Neither answers "show me every station this
-- round, who did it, when, and where" for a round that has since been closed.
--
-- This view is that read side. Same "standing event per (round, station)"
-- shape as `completion_locations`, but:
--   * joined to `areas` too, since a round spans many areas;
--   * a station with no captured position (permission denied, or completed
--     before 0004 shipped GPS capture) still gets a row — `distance_m`/`is_far`
--     are null instead of the whole station vanishing, which is the one real
--     behavioural difference from `completion_locations`.
-- =============================================================================

create or replace view public.round_station_history
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
    c.created_at,
    c.queued
  from public.station_completions c
  where c.round_id is not null
  -- `id desc` breaks ties when a complete and its undo share a timestamp
  -- (same-transaction now()), so the true last event wins — same as 0005.
  order by c.round_id, c.station_id, c.created_at desc, c.id desc
)
select
  l.round_id,
  s.id             as station_id,
  s.name           as station_name,
  s.sort_number,
  a.id             as area_id,
  a.name           as area_name,
  a.sort_order     as area_sort_order,
  l.user_id,
  l.user_name,
  l.created_at     as completed_at,
  l.queued,
  s.latitude       as station_latitude,
  s.longitude      as station_longitude,
  l.latitude,
  l.longitude,
  l.accuracy,
  case
    when l.latitude is not null and l.longitude is not null
     and s.latitude is not null and s.longitude is not null
    then (2 * 6371000 * asin(sqrt(
        power(sin(radians(s.latitude  - l.latitude)  / 2), 2)
      + cos(radians(l.latitude)) * cos(radians(s.latitude))
        * power(sin(radians(s.longitude - l.longitude) / 2), 2)
    )))
  end as distance_m,
  case
    when l.latitude is not null and l.longitude is not null
     and s.latitude is not null and s.longitude is not null
    then (2 * 6371000 * asin(sqrt(
        power(sin(radians(s.latitude  - l.latitude)  / 2), 2)
      + cos(radians(l.latitude)) * cos(radians(s.latitude))
        * power(sin(radians(s.longitude - l.longitude) / 2), 2)
    )) - coalesce(l.accuracy, 0) > 500)
  end as is_far
from latest l
join public.stations s on s.id = l.station_id
join public.areas    a on a.id = s.area_id
where l.action = 'completed';   -- only the standing completion, per station.

comment on view public.round_station_history is
  'Per round, per station: the STANDING completion — who, when, and (if captured) where — for the round drill-down page. A station whose latest event in the round is an uncomplete does not appear. Unlike completion_locations, a station with no captured position or no coordinates still gets a row, with distance_m/is_far null.';

revoke all on public.round_station_history from anon, authenticated;
grant select on public.round_station_history to authenticated;
