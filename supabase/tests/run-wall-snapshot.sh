#!/usr/bin/env bash
# Applies every migration to a throwaway PostgreSQL cluster and runs the wall
# feed suite (wall_snapshot.sql) against it. No Supabase project is touched.
#
#   sudo ./supabase/tests/run-wall-snapshot.sh
#
# Needs PostgreSQL 16 or newer (`postgresql-16`, binaries under
# /usr/lib/postgresql/<v>/bin) and root: postgres refuses to run as root, so
# the cluster is created under /var/tmp/sonol-wallpg, owned by the `postgres`
# OS user, and recreated on every run. Port: $SONOL_TEST_PORT (default 55433).
#
# Supabase provides things a stock PostgreSQL does not; the bootstrap below
# stubs exactly what the migrations and the suite touch: the anon /
# authenticated / service_role roles and Supabase's default privileges, auth
# (users + uid()/jwt()), storage (buckets, objects, foldername()), the
# supabase_realtime publication, and Vault (secrets, decrypted_secrets,
# create_secret(), update_secret()) — a stub that stores in plain text, which
# is fine for a hash in a throwaway cluster.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
BASE=/var/tmp/sonol-wallpg
PORT=${SONOL_TEST_PORT:-55433}
PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)
[ -n "$PGBIN" ] && export PATH="$PGBIN:$PATH"

PSQL="psql -h /var/tmp -p $PORT -U postgres -q -X"

if ! $PSQL -d postgres -tAc 'select 1' >/dev/null 2>&1; then
  echo "== starting a scratch cluster on port $PORT =="
  rm -rf "$BASE"
  mkdir -p "$BASE/pgdata"
  chown -R postgres:postgres "$BASE"
  chmod 700 "$BASE/pgdata"
  su postgres -c "PATH=$PGBIN:\$PATH initdb -D $BASE/pgdata -U postgres --auth=trust -E UTF8" >/dev/null
  su postgres -c "PATH=$PGBIN:\$PATH pg_ctl -D $BASE/pgdata -o '-k /var/tmp -p $PORT -c listen_addresses=' -l $BASE/log -w start" >/dev/null
fi

$PSQL -v ON_ERROR_STOP=1 -d postgres -c 'drop database if exists sonol;' -c 'create database sonol;' >/dev/null

$PSQL -v ON_ERROR_STOP=1 -d sonol >/dev/null <<'SQL'
set client_min_messages = error;   -- the publication warns about wal_level

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

-- Supabase's default privileges — the trap CLAUDE.md §4 is about. Without
-- them a missing revoke would go unnoticed here.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create schema auth;
create table auth.users (
  id                         uuid primary key default gen_random_uuid(),
  email                      text,
  phone                      text,
  raw_user_meta_data         jsonb not null default '{}'::jsonb,
  confirmation_token         text,
  recovery_token             text,
  email_change               text,
  email_change_token_new     text,
  email_change_token_current text,
  phone_change               text,
  phone_change_token         text,
  reauthentication_token     text,
  created_at                 timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $f$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$f$;
create function auth.jwt() returns jsonb language sql stable as $f$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$f$;
grant usage on schema auth to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);
create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text not null,
  owner     uuid
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $f$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
$f$;

create publication supabase_realtime;

create schema vault;
create table vault.secrets (
  id          uuid primary key default gen_random_uuid(),
  name        text unique,
  description text not null default '',
  secret      text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create view vault.decrypted_secrets as
  select *, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(new_secret text, new_name text default null,
                                    new_description text default '', new_key_id uuid default null)
returns uuid language sql as $f$
  insert into vault.secrets (secret, name, description)
  values (new_secret, new_name, coalesce(new_description, ''))
  returning id
$f$;
create function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null,
                                    new_description text default null, new_key_id uuid default null)
returns void language sql as $f$
  update vault.secrets
     set secret      = coalesce(new_secret, secret),
         name        = coalesce(new_name, name),
         description = coalesce(new_description, description),
         updated_at  = now()
   where id = secret_id
$f$;
revoke all on schema vault from public;
SQL

echo "== migrations =="
for f in "$ROOT"/supabase/migrations/*.sql; do
  if ! $PSQL -v ON_ERROR_STOP=1 -d sonol -f "$f" >"$BASE/mig.log" 2>&1; then
    echo "FAILED: $(basename "$f")"; tail -20 "$BASE/mig.log"; exit 1
  fi
done
echo "all $(ls "$ROOT"/supabase/migrations/*.sql | wc -l) migrations applied"

echo
echo "== wall feed suite =="
# ON_ERROR_STOP: an unexpected error aborts the suite and fails the run, rather
# than leaving a short list of passes that looks green.
set +e
OUT=$($PSQL -v ON_ERROR_STOP=1 -d sonol -tA -f "$HERE/wall_snapshot.sql" 2>&1)
RC=$?
set -e
echo "$OUT" | grep -v '^$' || true

echo
FAILED=$(echo "$OUT" | grep -c '^FAIL' || true)
PASSED=$(echo "$OUT" | grep -c '^pass' || true)
echo "pass: $PASSED   FAIL: $FAILED"
if [ "$RC" -ne 0 ]; then echo "suite aborted (psql exit $RC)"; exit 1; fi
[ "$FAILED" -eq 0 ] && [ "$PASSED" -gt 0 ]
