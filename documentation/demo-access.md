# Demo Access

Lets someone try Pairc without being onboarded first. The login screen gains an **Explore the demo** button that signs into a shared Supabase account pre-loaded with a real match.

The demo account is a normal user with full read/write access — it is not a sandbox or a read-only mode. What keeps it safe is team isolation, not restricted permissions.

---

## How the isolation works

Every table in this schema is gated by `auth_team_id()`, which resolves the signed-in user's `allowed_users.team_id` — see [`20260323000000_team_rls.sql`](../supabase/migrations/20260323000000_team_rls.sql). Policies on `events`, `matches`, `squad_players`, `possession_sessions`, `possession_events`, `pass_sessions` and `pass_events` all compare `team_id = auth_team_id()`.

So a demo account assigned to its **own** `teams` row can only ever see and write demo data. It cannot read a real club's events even though it has full write permissions on its own.

**This is the whole security model, and it rests on one thing:** the demo user must be assigned to a dedicated team. If you point it at a real club's `team_id`, you have handed the public that club's data.

### About the credentials being public

The demo email and password ship in the client JavaScript bundle. Anyone can read them out of the deployed app. That is inherent to a one-tap public demo and is not something to fix by obscuring them.

What it means in practice:

- Anyone can sign in as the demo account and write to the demo team. Expect the demo match to accumulate junk over time; reset it periodically (below).
- Nothing else is exposed, because of the team scoping above.
- Do not reuse the demo password anywhere else, and do not give the demo account an admin email (`VITE_ADMIN_EMAILS`).

---

## Setup

Project ref: `ogqyddmglezqetliilzf`. Direct links below assume it.

Pick the demo email and password before you start and use the same values in every step. The email does not need to receive mail — step 2 confirms the account manually — but it should be one you control the domain of, or an obvious placeholder.

### 1. Create the demo team and allowlist entry

Open the [SQL editor](https://supabase.com/dashboard/project/ogqyddmglezqetliilzf/sql/new), paste [`supabase/demo-account.sql`](../supabase/demo-account.sql), and run it.

It creates a `Pairc Demo` team, allowlists the demo email against it, and returns a verification row. **Read that row before continuing** — its `team_id` must not match any real club's. That single check is what stands between the demo and your live data.

If you use an email other than `demo@pairc.app`, change it in the SQL before running.

### 2. Create the Auth user

[Authentication → Users](https://supabase.com/dashboard/project/ogqyddmglezqetliilzf/auth/users) → **Add user** → **Create new user**.

- Email: the demo email from step 1
- Password: the demo password
- **Auto Confirm User: on** — without this the account cannot sign in, because no confirmation email will be delivered

Both records are required. As the README notes, a Supabase Auth user alone will not pass login; the email must also be in `allowed_users`, which step 1 handled.

### 3. Point the app at it

Vercel → your project → **Settings → Environment Variables**. Add both, for Production (and Preview if you want the demo there too):

```env
VITE_DEMO_EMAIL=<the demo email>
VITE_DEMO_PASSWORD=<the demo password>
```

Then **redeploy** — Vite inlines `VITE_*` at build time, so an existing deployment will not pick these up.

Do not add the demo email to `VITE_ADMIN_EMAILS`.

If either variable is unset the demo button does not render at all. That is the intended state for local development and for the E2E build.

### 4. Seed the match

1. Open the deployed app and click **Explore the demo**. You should land in the app with a purple **Demo** banner under the header.
2. **In-game → Events → Import JSON**.
3. Select [`documentation/demo/demo-match-2026.json`](demo/demo-match-2026.json). Expect `Imported 58 new event(s)`.
4. **Capture** → click the match context bar → select `Clontarf v Na Fianna 2026-06-14`.
5. Check **In-game → Live** reads `CLONTARF 1-10 / NA FIANNA 1-6`.

Importing while signed in as the demo account stamps every row with the demo `team_id` automatically ([App.svelte:2357-2358](../src/App.svelte#L2357-L2358)), which is what lets RLS accept the write. **Do not import the seed while signed in as a real user** — it would land in that club's team.

---

## The seed match

`Clontarf 1-10 — Na Fianna 1-06`, 14 June 2026. 58 events: 24 kickouts, 26 shots, 8 turnovers, spread across both halves and all pitch zones.

It is built to have a story rather than to be uniform noise: Clontarf lose the first-half kickout battle and trail, then fix the restart and win it late. The app's own analysis picks this up unprompted — the digest reads *"Kickout control flipped from they early to we late"* and *"#11 is their main scoring threat (3 points, 3 chances)"*, and every analytics tab, both heatmaps and the tactical board have real data to show.

The match is left **open**, not closed, so a visitor can capture events on top of it. A closed match is read-only and makes for a flatter demo.

To change the fixture, edit and re-run the generator:

```bash
node documentation/demo/build-demo-match.mjs
```

Event IDs are deterministic (`demo-001`…`demo-058`), so re-importing updates the same rows rather than creating duplicates.

---

## Resetting the demo

Visitors can edit and delete the seed match. To restore it:

```sql
DELETE FROM events  WHERE team_id = (SELECT id FROM teams WHERE name = 'Pairc Demo');
DELETE FROM matches WHERE team_id = (SELECT id FROM teams WHERE name = 'Pairc Demo');
```

Then repeat step 4. Both statements are scoped by `team_id`, so they cannot touch real data.

Worth doing before any demo you actually care about.

---

## What the demo user sees

- A **Demo** banner under the header: *"You are signed in to the shared demo account. Anything you record here is visible to other demo visitors."* Shared state is the one genuinely surprising thing about this setup, so it is stated rather than left to be discovered.
- Otherwise the full app — capture, all analytics, digest, tactical board, import/export.

---

## Before you publicise the link

The demo drops a visitor onto the **capture screen**, which as of 2026-08-05 does not work at phone widths — the pitch collapses to zero height and the save button is unreachable below the fold. See [ux-review-2026-08-05.md §1.1](ux-review-2026-08-05.md).

Most people opening a demo link do so on a phone. Phase 0 of [ux-roadmap-2026-08-05.md](ux-roadmap-2026-08-05.md) is a hard prerequisite for sharing this, not just for general release.

The demo works correctly on tablet and desktop today.
