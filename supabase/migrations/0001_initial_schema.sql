-- =============================================================================
-- Sonol Field Ops — Supabase / PostgreSQL schema
-- Migrated from Firebase Firestore (FlutterFlow project sonol-hbjkg9)
--
-- Run order: this file is idempotent-ish and meant to be applied as a single
-- migration on a fresh Supabase project.
--
-- Contents:
--   1. Extensions & enums
--   2. Tables
--   3. Indexes
--   4. Triggers (updated_at, new-user provisioning)
--   5. Helper functions (auth predicates)
--   6. Row Level Security policies
--   7. Business RPCs (complete / uncomplete / reset round / admin user mgmt)
--   8. Reporting views
--   9. Storage buckets & policies
--  10. Realtime publication
--  11. Seed data (optional)
-- =============================================================================


-- =============================================================================
-- 1. EXTENSIONS & ENUMS
-- =============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive email

-- Firestore stored stations.type as the Hebrew strings 'רגיל' / 'סופר'.
-- We normalise to stable machine values; the Hebrew labels live in the UI layer.
do $$ begin
  create type public.fuel_type as enum ('regular', 'super');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.completion_action as enum ('completed', 'uncompleted');
exception when duplicate_object then null; end $$;


-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 profiles  <-  Firestore collection `users`
--     Doc id was the Firebase Auth uid; here the PK is auth.users.id.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            citext      not null,
  display_name     text        not null default '',
  photo_url        text,
  phone_number     text,

  -- was users.isAdmin
  is_admin         boolean     not null default false,

  -- was users.rashi  ("רשאי" = permitted to use the app at all).
  -- Fail-closed: a freshly provisioned account cannot use the app until an
  -- admin flips this. This matches the original intent but is now enforced
  -- server-side by RLS instead of only by hiding widgets.
  is_authorized    boolean     not null default false,

  -- was users.camotBicha — stations completed in the CURRENT round
  completed_count  integer     not null default 0 check (completed_count >= 0),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint profiles_email_unique unique (email)
);

comment on table  public.profiles is 'Application users. 1:1 with auth.users. Was Firestore collection "users".';
comment on column public.profiles.is_authorized is 'Firestore field "rashi" — may the user use the app at all.';
comment on column public.profiles.completed_count is 'Firestore field "camotBicha" — stations completed in the current round.';


-- -----------------------------------------------------------------------------
-- 2.2 areas  <-  Firestore collection `azorim`
--     The unused `azorim.azorim` string array is dropped (dead field).
-- -----------------------------------------------------------------------------
create table if not exists public.areas (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,          -- was azorim.azor
  sort_order  integer     not null default 0,-- was azorim.mispar
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint areas_name_unique unique (name)
);

comment on table  public.areas is 'Geographic areas. Was Firestore collection "azorim".';
comment on column public.areas.name is 'Firestore field "azor".';
comment on column public.areas.sort_order is 'Firestore field "mispar" — display order.';


-- -----------------------------------------------------------------------------
-- 2.3 user_areas  <-  replaces the users.azorim string array
--     Firestore stored area NAMES inside the user document, so renaming an
--     area silently broke a user's permissions. A junction table with FKs
--     fixes that.
-- -----------------------------------------------------------------------------
create table if not exists public.user_areas (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  area_id     uuid not null references public.areas(id)    on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, area_id)
);

comment on table public.user_areas is 'Which areas each user may work in. Replaces the users.azorim string array.';


-- -----------------------------------------------------------------------------
-- 2.4 rounds  (NEW — did not exist in Firestore)
--     "Reset everything" used to destroy all completion state. Rounds make the
--     reset non-destructive: close the current round, open a new one.
-- -----------------------------------------------------------------------------
create table if not exists public.rounds (
  id          uuid primary key default gen_random_uuid(),
  label       text        not null default to_char(now(), 'YYYY-MM-DD'),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  started_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.rounds is 'A full work cycle, from one reset to the next. New concept, not present in Firestore.';

-- Exactly one open round at a time.
create unique index if not exists rounds_one_open_idx
  on public.rounds ((ended_at is null)) where ended_at is null;


-- -----------------------------------------------------------------------------
-- 2.5 stations  <-  Firestore collection `stations`
-- -----------------------------------------------------------------------------
create table if not exists public.stations (
  id             uuid primary key default gen_random_uuid(),
  area_id        uuid        not null references public.areas(id) on delete restrict,
                             -- was stations.location (DocumentReference -> azorim)
  name           text        not null check (length(btrim(name)) > 0),

  -- was stations.number (double). Kept numeric so a station can be inserted
  -- between 12 and 13 as 12.5 without renumbering the whole area.
  sort_number    numeric(10,2) not null default 0,

  fuel_type      public.fuel_type not null,          -- was stations.type ('רגיל'/'סופר')
  total          integer     not null default 0 check (total     >= 0),  -- was stations.total
  flyers         integer     not null default 0 check (flyers    >= 0),  -- was stations.flayerim

  waze_link      text,                                -- was stations.link
  latitude       double precision check (latitude  between  -90 and  90),
  longitude      double precision check (longitude between -180 and 180),
                             -- was stations.locationWaze (LatLng), now parsed
                             -- once at save time instead of on every navigation

  -- completion state for the CURRENT round
  is_done        boolean     not null default false,  -- was stations.isdone
  completed_at   timestamptz,                          -- was stations.time
  completed_by   uuid references public.profiles(id) on delete set null,
                             -- was stations.me (a plain display-name STRING)
  completed_by_name text,    -- denormalised snapshot, survives user deletion

  -- admin markers
  has_envelope     boolean not null default false,     -- was stations.simonMatafa
  has_flyers_note  boolean not null default false,     -- was stations.simon

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- a station number must be unique inside its area
  constraint stations_area_number_unique unique (area_id, sort_number),

  -- completion fields must be coherent
  constraint stations_completion_coherent check (
    (is_done = true  and completed_at is not null) or
    (is_done = false and completed_at is null and completed_by is null)
  )
);

comment on table  public.stations is 'Fuel stations. Was Firestore collection "stations".';
comment on column public.stations.sort_number is 'Firestore field "number" — drive order within the area.';
comment on column public.stations.completed_by is 'Replaces Firestore field "me", which stored a display name string.';


-- -----------------------------------------------------------------------------
-- 2.6 station_completions  (NEW — audit log)
--     Firestore kept no history; a reset erased everything. This gives the
--     dashboard real reporting across rounds.
-- -----------------------------------------------------------------------------
create table if not exists public.station_completions (
  id           uuid primary key default gen_random_uuid(),
  station_id   uuid not null references public.stations(id) on delete cascade,
  round_id     uuid references public.rounds(id) on delete set null,
  user_id      uuid references public.profiles(id) on delete set null,
  user_name    text,
  action       public.completion_action not null,
  created_at   timestamptz not null default now()
);

comment on table public.station_completions is 'Append-only audit log of every completion / un-completion.';


-- =============================================================================
-- 3. INDEXES
--    Mirror the Firestore composite indexes plus what the new queries need.
-- =============================================================================

-- Firestore: (location asc, isdone asc, number asc/desc)
create index if not exists stations_area_done_number_idx
  on public.stations (area_id, is_done, sort_number);

-- Firestore: (location asc, isdone asc, time desc)
create index if not exists stations_area_done_completed_idx
  on public.stations (area_id, is_done, completed_at desc);

-- dashboard aggregates
create index if not exists stations_type_idx        on public.stations (fuel_type);
create index if not exists stations_is_done_idx     on public.stations (is_done);
create index if not exists stations_completed_by_idx on public.stations (completed_by);

-- Firestore: (azor asc, mispar asc)
create index if not exists areas_sort_idx on public.areas (sort_order, name);

create index if not exists user_areas_area_idx on public.user_areas (area_id);

create index if not exists profiles_authorized_idx on public.profiles (is_authorized) where is_authorized;

create index if not exists completions_station_idx on public.station_completions (station_id, created_at desc);
create index if not exists completions_round_user_idx on public.station_completions (round_id, user_id);


-- =============================================================================
-- 4. TRIGGERS
-- =============================================================================

-- 4.1 updated_at maintenance -------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists areas_set_updated_at on public.areas;
create trigger areas_set_updated_at
  before update on public.areas
  for each row execute function public.set_updated_at();

drop trigger if exists stations_set_updated_at on public.stations;
create trigger stations_set_updated_at
  before update on public.stations
  for each row execute function public.set_updated_at();


-- 4.2 provision a profile row for every new auth user ------------------------
--     Replaces FlutterFlow's client-side maybeCreateUser().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, photo_url, phone_number)
  values (
    new.id,
    coalesce(new.email, '')::citext,
    coalesce(new.raw_user_meta_data ->> 'display_name',
             new.raw_user_meta_data ->> 'full_name',
             ''),
    new.raw_user_meta_data ->> 'avatar_url',
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 4.3 auto-parse Waze coordinates on insert/update ---------------------------
--     Firestore parsed the iframe link with a regex on every navigation.
--     Do it once, at write time.
create or replace function public.parse_waze_coordinates()
returns trigger
language plpgsql
as $$
declare
  m text[];
begin
  if new.waze_link is not null and new.waze_link <> '' then
    -- matches ...lat=32.360590&lon=34.868798...  and  ...ll=32.36,34.86...
    m := regexp_match(new.waze_link, 'lat=(-?\d+\.?\d*)&lon=(-?\d+\.?\d*)');
    if m is null then
      m := regexp_match(new.waze_link, 'll=(-?\d+\.?\d*)[,%]+2?C?(-?\d+\.?\d*)');
    end if;
    if m is not null then
      new.latitude  := m[1]::double precision;
      new.longitude := m[2]::double precision;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stations_parse_waze on public.stations;
create trigger stations_parse_waze
  before insert or update of waze_link on public.stations
  for each row execute function public.parse_waze_coordinates();


-- =============================================================================
-- 5. HELPER FUNCTIONS (auth predicates used by RLS)
--    Defined as SECURITY DEFINER + STABLE so RLS policies can call them
--    without recursing into the policies on profiles.
-- =============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.is_authorized()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_authorized or p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- may the current user work in this area?
create or replace function public.can_access_area(p_area_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
      or (
        public.is_authorized()
        and exists (
          select 1 from public.user_areas ua
          where ua.user_id = auth.uid() and ua.area_id = p_area_id
        )
      );
$$;

create or replace function public.current_round_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.rounds where ended_at is null order by started_at desc limit 1;
$$;


-- =============================================================================
-- 5b. TABLE GRANTS
--     RLS decides WHICH ROWS; grants decide whether the role may touch the
--     table at all. Supabase's default privileges usually cover this, but we
--     state it explicitly so the schema is self-contained and portable.
--     `anon` gets nothing: this app has no public surface.
-- =============================================================================

grant usage on schema public to authenticated;

-- CRITICAL — revoke BEFORE granting.
--
-- Supabase ships `alter default privileges in schema public grant all on tables
-- to anon, authenticated, service_role` (visible in pg_default_acl, installed by
-- both `postgres` and `supabase_admin`). Every table created above was therefore
-- born with table-wide arwdDxtm for `authenticated`.
--
-- `grant update (display_name, photo_url, phone_number)` is purely ADDITIVE — it
-- revokes nothing. Without the revoke below, the column restriction this section
-- describes is inert, and any signed-in user can simply run
--
--     update public.profiles set is_admin = true where id = auth.uid();
--
-- which is defect 1 of the original app reproduced exactly. Verified on
-- PostgreSQL 17.6: has_column_privilege('authenticated','public.profiles',
-- 'is_admin','UPDATE') returned true until this statement was added.
revoke all on public.profiles, public.areas, public.user_areas,
             public.stations, public.rounds, public.station_completions
        from anon, authenticated;

-- profiles: read is row-filtered by RLS; writes are COLUMN-restricted.
-- A user may edit their own contact details and nothing else. is_admin,
-- is_authorized and completed_count are simply not grantable to `authenticated`,
-- so privilege escalation is impossible at the SQL level rather than being
-- caught by a trigger. The SECURITY DEFINER RPCs below are owned by the table
-- owner and therefore bypass this restriction.
grant select on public.profiles to authenticated;
grant update (display_name, photo_url, phone_number) on public.profiles to authenticated;

grant select, insert, update, delete on public.areas          to authenticated;
grant select, insert, update, delete on public.user_areas     to authenticated;
grant select, insert, update, delete on public.stations       to authenticated;
grant select, insert, update          on public.rounds        to authenticated;
grant select                          on public.station_completions to authenticated;

revoke all on public.profiles, public.areas, public.user_areas,
             public.stations, public.rounds, public.station_completions from anon;


-- =============================================================================
-- 6. ROW LEVEL SECURITY
--    The original Firestore rules were `allow read, write: if request.auth != null`
--    on every collection — i.e. any signed-in user could wipe the database.
--    These policies enforce the role model for real.
-- =============================================================================

alter table public.profiles            enable row level security;
alter table public.areas               enable row level security;
alter table public.user_areas          enable row level security;
alter table public.stations            enable row level security;
alter table public.rounds              enable row level security;
alter table public.station_completions enable row level security;


-- 6.1 profiles ---------------------------------------------------------------
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Row scope for self-service edits. WHICH COLUMNS may be written is decided by
-- the column grants in section 5b, not here.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins may read every profile and delete profiles. Changing privilege flags
-- and area assignments goes through admin_set_user_flags() /
-- admin_set_user_areas() so the rules stay in one auditable place.
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- 6.2 areas ------------------------------------------------------------------
drop policy if exists areas_select on public.areas;
create policy areas_select on public.areas
  for select to authenticated
  using (public.is_authorized());

drop policy if exists areas_admin_write on public.areas;
create policy areas_admin_write on public.areas
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- 6.3 user_areas -------------------------------------------------------------
drop policy if exists user_areas_select on public.user_areas;
create policy user_areas_select on public.user_areas
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_areas_admin_write on public.user_areas;
create policy user_areas_admin_write on public.user_areas
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- 6.4 stations ---------------------------------------------------------------
-- A field worker sees only the stations in the areas assigned to them.
drop policy if exists stations_select on public.stations;
create policy stations_select on public.stations
  for select to authenticated
  using (public.can_access_area(area_id));

-- Field workers may toggle completion via the RPCs in section 7 (which run as
-- SECURITY DEFINER). Direct UPDATE of a station row is admin-only, so a worker
-- cannot rewrite a station's name, area, quantities or admin markers.
drop policy if exists stations_admin_write on public.stations;
create policy stations_admin_write on public.stations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- 6.5 rounds -----------------------------------------------------------------
drop policy if exists rounds_select on public.rounds;
create policy rounds_select on public.rounds
  for select to authenticated
  using (public.is_authorized());

drop policy if exists rounds_admin_write on public.rounds;
create policy rounds_admin_write on public.rounds
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- 6.6 station_completions ----------------------------------------------------
drop policy if exists completions_select on public.station_completions;
create policy completions_select on public.station_completions
  for select to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
  );

-- inserts happen only through SECURITY DEFINER RPCs; no INSERT policy on purpose.


-- =============================================================================
-- 7. BUSINESS RPCs
--    Every state-changing operation that must be atomic or privileged lives
--    here instead of in the client.
-- =============================================================================

-- 7.1 mark a station done ----------------------------------------------------
-- Replaces the FlutterFlow two-write sequence (station.update + user increment)
-- which was not atomic.
create or replace function public.complete_station(p_station_id uuid)
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

  insert into public.station_completions (station_id, round_id, user_id, user_name, action)
  values (p_station_id, public.current_round_id(), auth.uid(), v_name, 'completed');

  return v_station;
end;
$$;


-- 7.2 undo a completion ------------------------------------------------------
-- Fixes the original bug where the CURRENT user's counter was decremented even
-- when someone else had completed the station.
create or replace function public.uncomplete_station(p_station_id uuid)
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

  insert into public.station_completions (station_id, round_id, user_id, user_name, action)
  values (p_station_id, public.current_round_id(), auth.uid(),
          (select display_name from public.profiles where id = auth.uid()),
          'uncompleted');

  return v_station;
end;
$$;


-- 7.3 toggle the admin markers ----------------------------------------------
create or replace function public.set_station_markers(
  p_station_id       uuid,
  p_has_envelope     boolean default null,
  p_has_flyers_note  boolean default null
)
returns public.stations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station public.stations;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  update public.stations
     set has_envelope    = coalesce(p_has_envelope,    has_envelope),
         has_flyers_note = coalesce(p_has_flyers_note, has_flyers_note)
   where id = p_station_id
  returning * into v_station;

  if not found then
    raise exception 'station not found';
  end if;

  return v_station;
end;
$$;


-- 7.4 reset the round --------------------------------------------------------
-- Replaces the client-side WriteBatch that silently broke past 500 documents
-- and never awaited its own commit.
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
     set is_done           = false,
         completed_at      = null,
         completed_by      = null,
         completed_by_name = null
   where is_done = true;

  update public.profiles
     set completed_count = 0
   where completed_count <> 0;

  return v_new_round;
end;
$$;


-- 7.5 admin user management --------------------------------------------------
-- Account CREATION must happen in an Edge Function using the service-role key
-- (see supabase/functions/admin-create-user), because creating a user from the
-- client would replace the admin's own session — the exact bug in the original
-- app. These two RPCs cover the parts that are pure data.

create or replace function public.admin_set_user_flags(
  p_user_id       uuid,
  p_is_authorized boolean default null,
  p_is_admin      boolean default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_user_id = auth.uid() and p_is_admin is false then
    raise exception 'cannot revoke your own admin role';
  end if;

  update public.profiles
     set is_authorized = coalesce(p_is_authorized, is_authorized),
         is_admin      = coalesce(p_is_admin,      is_admin)
   where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'user not found';
  end if;

  return v_profile;
end;
$$;


create or replace function public.admin_set_user_areas(
  p_user_id  uuid,
  p_area_ids uuid[]
)
returns setof public.user_areas
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  delete from public.user_areas
   where user_id = p_user_id
     and (p_area_ids is null or area_id <> all(p_area_ids));

  if p_area_ids is not null then
    insert into public.user_areas (user_id, area_id)
    select p_user_id, unnest(p_area_ids)
    on conflict do nothing;
  end if;

  return query select * from public.user_areas where user_id = p_user_id;
end;
$$;


-- 7.6 grant execute ----------------------------------------------------------
revoke all on function public.complete_station(uuid)                       from public, anon;
revoke all on function public.uncomplete_station(uuid)                     from public, anon;
revoke all on function public.set_station_markers(uuid, boolean, boolean)  from public, anon;
revoke all on function public.reset_round(text)                            from public, anon;
revoke all on function public.admin_set_user_flags(uuid, boolean, boolean) from public, anon;
revoke all on function public.admin_set_user_areas(uuid, uuid[])           from public, anon;

grant execute on function public.complete_station(uuid)                       to authenticated;
grant execute on function public.uncomplete_station(uuid)                     to authenticated;
grant execute on function public.set_station_markers(uuid, boolean, boolean)  to authenticated;
grant execute on function public.reset_round(text)                            to authenticated;
grant execute on function public.admin_set_user_flags(uuid, boolean, boolean) to authenticated;
grant execute on function public.admin_set_user_areas(uuid, uuid[])           to authenticated;

-- The auth predicates from section 5 default to EXECUTE for PUBLIC (and hence
-- anon). They are SECURITY DEFINER, so leaving them world-executable is an
-- unnecessary exposure — current_round_id() in particular would hand an
-- unauthenticated caller the open round's UUID. `authenticated` must keep
-- EXECUTE because the RLS policies in section 6 call them.
revoke all on function public.is_admin()                from public, anon;
revoke all on function public.is_authorized()           from public, anon;
revoke all on function public.can_access_area(uuid)     from public, anon;
revoke all on function public.current_round_id()        from public, anon;

grant execute on function public.is_admin()             to authenticated;
grant execute on function public.is_authorized()        to authenticated;
grant execute on function public.can_access_area(uuid)  to authenticated;
grant execute on function public.current_round_id()     to authenticated;


-- =============================================================================
-- 8. REPORTING VIEWS
--    The old dashboard opened 1 + 3N realtime listeners (N = number of areas)
--    and summed everything on the client. These views do it in one query.
--    security_invoker = on  ->  RLS still applies to the caller.
-- =============================================================================

-- 8.1 per-area stats (dashboard table + home-page "נשאר N")
create or replace view public.area_stats
with (security_invoker = on) as
select
  a.id                                              as area_id,
  a.name                                            as area_name,
  a.sort_order,
  count(s.id)                                       as station_count,
  count(s.id) filter (where s.is_done)              as done_count,
  count(s.id) filter (where not s.is_done)          as remaining_count,
  coalesce(sum(s.total)  filter (where s.fuel_type = 'regular'), 0) as total_regular,
  coalesce(sum(s.total)  filter (where s.fuel_type = 'super'),   0) as total_super,
  coalesce(sum(s.flyers), 0)                        as total_flyers
from public.areas a
left join public.stations s on s.area_id = a.id
group by a.id, a.name, a.sort_order;


-- 8.2 global stats (the two big counters + the totals card)
create or replace view public.global_stats
with (security_invoker = on) as
select
  count(*)                                            as station_count,
  count(*) filter (where is_done)                     as done_count,
  count(*) filter (where not is_done)                 as remaining_count,
  coalesce(sum(total)  filter (where fuel_type = 'regular'), 0) as total_regular,
  coalesce(sum(total)  filter (where fuel_type = 'super'),   0) as total_super,
  coalesce(sum(flyers), 0)                            as total_flyers
from public.stations;


-- 8.3 per-user stats (the pie chart)
create or replace view public.user_stats
with (security_invoker = on) as
select
  p.id            as user_id,
  p.display_name,
  p.is_admin,
  p.is_authorized,
  p.completed_count,
  count(s.id)     as stations_completed_now
from public.profiles p
left join public.stations s on s.completed_by = p.id and s.is_done
where p.is_authorized
group by p.id, p.display_name, p.is_admin, p.is_authorized, p.completed_count;


-- 8.4 the current user's own areas, with remaining counts (home page)
create or replace view public.my_areas
with (security_invoker = on) as
select
  a.id            as area_id,
  a.name          as area_name,
  a.sort_order,
  st.remaining_count,
  st.done_count,
  st.station_count
from public.areas a
join public.area_stats st on st.area_id = a.id
where exists (
  select 1 from public.user_areas ua
  where ua.area_id = a.id and ua.user_id = auth.uid()
)
or public.is_admin();

-- Same default-privilege trap as section 5b. These four views are created AFTER
-- 5b ran, so they picked up the `grant all to anon, authenticated` default and
-- 5b's revoke (which names only the six tables) never touched them. Revoke, then
-- grant only SELECT.
revoke all on public.area_stats, public.global_stats, public.user_stats, public.my_areas
        from anon, authenticated;

grant select on public.area_stats, public.global_stats, public.user_stats, public.my_areas to authenticated;


-- =============================================================================
-- 9. STORAGE
--    The original storage.rules denied everything at the root and allowed
--    world-read on users/{uid}/**. Here: a public avatars bucket, writable
--    only by the owner.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable" on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists "users manage their own avatar" on storage.objects;
create policy "users manage their own avatar" on storage.objects
  for all to authenticated
  using  (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- =============================================================================
-- 10. REALTIME
--     One publication for the tables the app subscribes to.
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.stations';
    execute 'alter publication supabase_realtime add table public.areas';
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
exception when duplicate_object then null;
end $$;


-- =============================================================================
-- 11. SEED
-- =============================================================================

-- open the first round so complete_station() has somewhere to log
insert into public.rounds (label)
select to_char(now(), 'YYYY-MM-DD')
where not exists (select 1 from public.rounds where ended_at is null);

-- Example areas (replace with the real list migrated from Firestore `azorim`):
-- insert into public.areas (name, sort_order) values
--   ('צפון', 1), ('שרון', 2), ('מרכז', 3), ('שפלה', 4), ('ירושלים', 5), ('דרום', 6)
-- on conflict (name) do nothing;

-- After importing users, promote the first admin manually:
-- update public.profiles set is_admin = true, is_authorized = true
--  where email = 'admin@example.com';
