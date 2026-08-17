# CLAUDE.md — Sonol Field Ops

Conventions for this repo. Read before touching anything; these are enforced by
tooling, not just by taste.

**The user is a field worker in a vehicle, in bright sunlight, one-handed, on
poor connectivity.** Every design decision follows from that.

---

## 1. RTL is not a theme, it is the layout

`<html lang="he" dir="rtl">`. There is no LTR mode.

**Use logical properties only.** Tailwind v4 ships them natively:

| Never                        | Always                       |
| ---------------------------- | ---------------------------- |
| `ml-*` `mr-*`                | `ms-*` `me-*`                |
| `pl-*` `pr-*`                | `ps-*` `pe-*`                |
| `left-*` `right-*`           | `start-*` `end-*`            |
| `border-l-*` `border-r-*`    | `border-s-*` `border-e-*`    |
| `rounded-l-*` `rounded-tr-*` | `rounded-s-*` `rounded-ee-*` |
| `text-left` `text-right`     | `text-start` `text-end`      |
| `space-x-*` `divide-x-*`     | `gap-*`                      |

`space-x-*` and `divide-x-*` are banned outright: they emit physical
`margin-left` / `border-left-width` and are genuinely broken under `dir="rtl"`.

Enforced two ways — `no-restricted-syntax` in `eslint.config.js` (covers `.ts`/
`.tsx` class strings, including template literals) and `npm run lint:rtl`
(covers `@apply` in CSS and `index.html`, which ESLint cannot see).

**Directional icons must mirror.** A lucide `ChevronLeft` points the wrong way
in an RTL list. Use `rtl:-scale-x-100`, or pick the icon by direction.

**Latin runs inside Hebrew need isolation.** Emails, coordinates, UUIDs, phone
numbers and station numbers reorder badly when the bidi algorithm gets hold of
them mid-sentence. Wrap them in `<bdi>` or the `.ltr-isolate` class.

`.ltr-isolate` is **inline only**, and deliberately sets no `text-align`. On a
block element, `direction: ltr` makes `text-align: start` resolve to _left_ and
strands the block at the left margin of an RTL page. Put it on an inline span
inside a normally-aligned block.

---

## 2. Every user-visible string comes from `src/lib/copy.ts`

No string literal in JSX. Ever. Strings that interpolate are exported as
functions (`labels.remaining(n)`) so a call site cannot silently drop a
placeholder. Grouping mirrors the brief's §9 numbering.

Error text is mapped from Supabase codes to Hebrew — an English error surfacing
in the UI is a bug.

---

## 3. No business logic in the client

Completing a station, undoing it, toggling markers, resetting the round and
changing user privileges all go through Postgres RPCs. The client never writes
those columns directly — it cannot, the grants forbid it.

| RPC                                             | Who              |
| ----------------------------------------------- | ---------------- |
| `complete_station` / `uncomplete_station`       | worker, own area |
| `set_station_markers`                           | admin            |
| `reset_round`                                   | admin            |
| `admin_set_user_flags` / `admin_set_user_areas` | admin            |

Read aggregates from the views (`my_areas`, `area_stats`, `global_stats`,
`user_stats`) — one query each. Never sum on the client, and never open more
than one realtime channel per screen.

User creation and deletion run in Edge Functions with the service-role key.
Creating a user from the browser replaces the admin's own session — that was a
defect in the original app.

> **Edge Function gotcha:** `admin_set_user_flags` checks `public.is_admin()`,
> which reads `auth.uid()`. Under the service-role key `auth.uid()` is NULL, so
> the RPC throws `admin only`. Create the account with the service-role client,
> then call the RPCs through a client carrying the _caller's_ JWT.

---

## 4. Database

`supabase/migrations/0001_initial_schema.sql` is authoritative. It is excluded
from Prettier (`.prettierignore`) — do not let an editor reformat it.

**The one deliberate change from the supplied schema:** `revoke all ... from
anon, authenticated` before each set of grants. Supabase ships
`alter default privileges in schema public grant all on tables to anon,
authenticated, service_role`, so every table is _born_ with table-wide
privileges and an additive `grant update (col, ...)` restricts nothing. Without
those revokes any signed-in user could run
`update profiles set is_admin = true where id = auth.uid()`.

**If you add a table or view, revoke first, then grant.** The default privilege
will otherwise hand `anon` and `authenticated` full access at CREATE time.

Types are generated, never hand-written: `npm run gen:types`.

---

## 5. Design tokens

`src/styles/globals.css`. Two layers: plain custom properties on `:root` /
`.dark` (these change), and an `@theme inline` block mapping Tailwind names onto
them (`inline` is what makes the dark swap work at all).

The scales are **restricted by construction** — `--spacing-*`, `--radius-*`,
`--shadow-*` and `--text-*` are each reset to `initial` before ours are defined.
`p-7`, `rounded-xl`, `shadow-md` and `text-5xl` do not exist. They do not,
however, break the build on their own — see the warning below.

- Spacing: only 4 8 12 16 20 24 32 40 48
- Radii: `sm` 8 / `md` 12 / `lg` 16 (cards) / `full`
- Shadows: exactly `card`, `raised`, `overlay`
- Type: `display h1 h2 h3 body body-strong small caption`, nothing below 13px
- Motion: 150ms state / 250ms entrance, `cubic-bezier(0.4,0,0.2,1)`, and respect
  `prefers-reduced-motion`. No animation that does nothing.

**Colour never carries meaning alone** — every coloured badge also has an icon
or a text label. Touch targets ≥ 48×48. Body text ≥ 16px. Contrast AA.

**An out-of-scale class does not fail the build — it silently emits nothing.**
`h-9` in a `.tsx` produces no CSS and no error, so the element just renders
unstyled through typecheck, ESLint and `vite build`. (Inside `@apply` it does
throw.) `npm run lint:scale` compiles every class in the source against the real
token layer and fails on any that resolve to nothing. Do not remove it.

**`cn()` needs teaching about the type scale.** tailwind-merge reads `text-*` as
a colour unless the suffix looks like a t-shirt size, so `text-h1` / `text-body`
/ `text-caption` were being classified as colours and dropped whenever a real
colour sat beside them — silently, again. `src/lib/utils.ts` registers them
under `font-size`; the tests in `utils.test.ts` guard it.

**Do not run `shadcn add`.** The primitives in `src/components/ui/` are
hand-written on Radix against our tokens. The CLI emits `h-9`, `shadow-xs` and
`rounded-xl` (all non-existent here), rewrites `globals.css`, and would overwrite
`utils.ts` — undoing the merge fix above. Copy shadcn's _structure_ by hand;
never its class strings.

Dark mode uses `--brand-400` / `--brand-300`, not `--brand-600`: `#3B5BDB` on
`#0F172A` is ~2.7:1 and fails AA.

---

## 6. Every screen has four states

Loading (skeleton, never a spinner), empty (illustrated, with a next action),
error (message + retry), content. A screen missing one is not done.

Every form field is validated with zod before submit, with Hebrew messages.
Every destructive action has a confirm dialog naming what it affects.
The submit button is always visible — disable it, never hide it.

`ConfirmDialog` has **no `onCancel` prop**, on purpose: defect 10 was a Cancel
button that navigated away. Cancel closes the dialog and nothing else, and
there is no way to attach behaviour to it.

Sign-in validates password `min 6` (§8.1); user creation uses `min 8` (§8.8).
The 8-character rule is **client-side only** — Supabase Auth's server minimum is
left at its default of 6, so anything scripting the API directly can go shorter.

---

## 7. TypeScript

`strict`, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
No `any`. No non-null assertions on Supabase results — narrow them. Both are
ESLint errors.

---

## 8. Commands

```
npm run dev          vite
npm run build        tsc -b && vite build
npm run typecheck    tsc -b --noEmit
npm run lint         eslint
npm run lint:rtl     physical-property guard
npm run lint:scale   fails on classes outside the token scale
npm run test         vitest
npm run gen:types    regenerate database.types.ts
npm run verify       all of the above — run before every commit
```
