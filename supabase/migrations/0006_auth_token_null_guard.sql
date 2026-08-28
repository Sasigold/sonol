-- =============================================================================
-- Sonol Field Ops — auth.users token columns must never be NULL
--
-- Bug: admin password reset (admin-reset-password) and admin delete
-- (admin-delete-user) returned a generic error for some users and worked for
-- others, with no pattern the UI could explain.
--
-- Root cause is in GoTrue, not this app. GoTrue (Go) scans a fixed set of
-- auth.users token columns — confirmation_token, recovery_token, the email- and
-- phone-change tokens, reauthentication_token — into plain `string` fields, not
-- `sql.NullString`. A NULL in any of them makes EVERY admin API call that reads
-- the row fail with
--   "error finding user: sql: Scan error ... converting NULL to string is
--    unsupported"  (HTTP 500)
-- which admin-reset-password / admin-delete-user surface as the generic Hebrew
-- error. updateUserById, deleteUser and getUserById all hit it.
--
-- GoTrue's own inserts write '' into these columns, so a user created through
-- the app (or the sign-up API) is fine. A user INSERTed straight into
-- auth.users — a seed row, a manual SQL insert, a restored dump — arrives with
-- NULLs and is permanently unresettable and undeletable through the API. That
-- is exactly the split we saw: seeded accounts failed, app-created ones worked.
--
-- This guards the column set three ways so it works in every case, now and for
-- any row added later:
--   1. repair every existing row (NULL -> ''),
--   2. DEFAULT '' so an insert that OMITS a token column never lands a NULL,
--   3. a BEFORE INSERT OR UPDATE trigger that coerces an EXPLICIT NULL to '' —
--      the one thing a column default cannot catch.
--
-- Attaching a trigger to auth.users is already how this schema works — see
-- on_auth_user_created / handle_new_user in 0001. The function lives in public,
-- like that one, and only rewrites NEW; it never touches another table and
-- leaves any non-NULL value untouched, so it cannot interfere with GoTrue's own
-- writes to these columns.
-- =============================================================================

-- 1. Repair existing rows. Idempotent: a row already holding '' is unchanged.
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where confirmation_token is null
   or recovery_token is null
   or email_change is null
   or email_change_token_new is null
   or email_change_token_current is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null;

-- 2. Default '' for any insert that leaves a token column out.
alter table auth.users
  alter column confirmation_token         set default '',
  alter column recovery_token             set default '',
  alter column email_change               set default '',
  alter column email_change_token_new     set default '',
  alter column email_change_token_current set default '',
  alter column phone_change               set default '',
  alter column phone_change_token         set default '',
  alter column reauthentication_token     set default '';

-- 3. Coerce an explicit NULL on insert or update — the case a default misses.
create or replace function public.auth_users_no_null_tokens()
returns trigger
language plpgsql
as $$
begin
  new.confirmation_token         := coalesce(new.confirmation_token, '');
  new.recovery_token             := coalesce(new.recovery_token, '');
  new.email_change               := coalesce(new.email_change, '');
  new.email_change_token_new     := coalesce(new.email_change_token_new, '');
  new.email_change_token_current := coalesce(new.email_change_token_current, '');
  new.phone_change               := coalesce(new.phone_change, '');
  new.phone_change_token         := coalesce(new.phone_change_token, '');
  new.reauthentication_token     := coalesce(new.reauthentication_token, '');
  return new;
end;
$$;

drop trigger if exists auth_users_no_null_tokens on auth.users;
create trigger auth_users_no_null_tokens
  before insert or update on auth.users
  for each row execute function public.auth_users_no_null_tokens();
