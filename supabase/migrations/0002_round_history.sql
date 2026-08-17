-- =============================================================================
-- Sonol Field Ops — round history
--
-- `rounds` and `station_completions` have existed since 0001. They are the
-- whole reason `reset_round` is non-destructive: the Firestore app's "reset"
-- erased every completion with no record that it had ever happened.
--
-- Nothing ever read them. Once a round was closed its data was unreachable
-- from the app — an append-only audit log that could not be audited. These two
-- views are the read side.
--
-- Both are `security_invoker = on`, so RLS still applies to the caller:
--   * an admin sees every round and every worker in it
--     (`completions_select` allows `public.is_admin()`)
--   * a worker sees the same rounds, counting only their OWN completions
--     (the same policy's `user_id = auth.uid()` branch)
-- Neither view needs a policy of its own; it inherits the tables'.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Per round — the history list
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
  count(distinct c.user_id) filter (where c.action = 'completed') as worker_count
from public.rounds r
left join public.station_completions c on c.round_id = r.id
group by r.id, r.label, r.started_at, r.ended_at;

comment on view public.round_stats is
  'One row per round: how much was completed, undone, and by how many people.';


-- -----------------------------------------------------------------------------
-- 2. Per round x worker — the breakdown inside a round
-- -----------------------------------------------------------------------------
create or replace view public.round_user_stats
with (security_invoker = on) as
select
  c.round_id,
  c.user_id,
  -- The denormalised name snapshot, most recent first: it survives the user
  -- being deleted, which is exactly why the column exists. A profile join
  -- would leave a historical round showing a blank name once the account is
  -- gone.
  (array_agg(c.user_name order by c.created_at desc))[1]      as user_name,
  count(*) filter (where c.action = 'completed')              as completed_count,
  count(*) filter (where c.action = 'uncompleted')            as uncompleted_count
from public.station_completions c
where c.round_id is not null
group by c.round_id, c.user_id;

comment on view public.round_user_stats is
  'Per round, per worker completion counts. Names come from the denormalised snapshot.';


-- -----------------------------------------------------------------------------
-- 3. Grants — REVOKE FIRST
--
-- Same trap as 0001 section 5b and section 8: Supabase ships
-- `alter default privileges in schema public grant all on tables to anon,
-- authenticated, service_role`, so a view is BORN with full privileges for
-- both roles. The revoke is what makes the grant below the actual permission
-- rather than a no-op on top of an existing one.
-- -----------------------------------------------------------------------------
revoke all on public.round_stats, public.round_user_stats from anon, authenticated;

grant select on public.round_stats, public.round_user_stats to authenticated;
