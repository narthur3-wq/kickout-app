echnical overview (current MVP)

Architecture: Front-end–only single-page app (SPA) built with Svelte + Vite. No server or backend services required.

Runtime/hosting: Static site. During development it runs on the Vite dev server; in production it’s just static files (index.html, JS, CSS) that can be opened locally or served by any static host.

UI components:

Pitch.svelte – interactive SVG pitch; click to capture landing/pickup. Draws 13/20/40/45/65 lines, rectangles, arcs to GAA dims.

Heatmap.svelte – canvas heatmap stacked on the same pitch drawing, so overlays align 1:1.

ImportModal.svelte – client-side Excel/CSV importer via xlsx; header mapping, preview, normalises metres vs 0–1 coords.

App.svelte – capture form, filters (opponent, YTD, player, contest/outcome), KPIs, CSV export.

State & persistence:

In-memory state with Svelte reactivity.

Persistent storage via localStorage keys: ko_events (events), ko_meta (team/opponent/orientation).

Works fully offline; all parsing & analytics happen in the browser.

Data model (per event):

id, created_at, match_date, team, opponent, period, clock,
target_player, outcome, contest_type, break_outcome,
time_to_tee_s, total_time_s, scored_20s,
x, y          (normalised 0–1, origin = top-left of pitch SVG)
x_m, y_m      (metres; derived from x,y and orientation)
our_goal_at_top (bool),
side_band (Left/Centre/Right), depth_band (Short/Medium/Long/Very Long),
depth_from_own_goal_m, zone_code (e.g. C-M),
pickup_x, pickup_y, pickup_x_m, pickup_y_m, break_displacement_m


Analytics (client-side):

Retention by zone (S/M/L/V × L/C/R), break win-rate by zone + overall.

Heatmap from filtered events (landing or pickup).

Filters combine: opponent (game), player, YTD, and contest/outcome.

Import/Export:

Import: .xlsx/.xls/.csv; auto-map headers; supports metres or normalised coords; places zone-only rows at zone centre.

Export: CSV via Blob download; no server.

Privacy & security: All data stays on the user’s device; no cookies, no network requests, no third-party tracking.

Performance notes: Thousands of events are fine. Heatmap is O(n) splat + small Gaussian blur on a fixed grid; redraws on filter changes. localStorage practical limit ~5–10 MB (tens of thousands of rows depending on fields).

Build & run
# dev
npm install
npm run dev

# production build (static files in dist/)
npm run build
npm run preview   # or serve 'dist/' with any static server/host

Deployment options

Local only: open dist/index.html or run vite preview.

Static hosting: Netlify/Vercel/GitHub Pages/Cloudflare Pages—no server needed.

Installable app: add a simple PWA manifest + service worker to cache assets for true offline use.

Known limitations (by design)

Browser storage only (no multi-device sync, no shared DB).

No user auth/permissions.

Dedupe/versioning not enforced beyond manual CSV discipline.

If/when you want a real backend

Recommended: Supabase (Postgres + Auth + Row-Level Security).
Minimal schema: matches, players, events. Keep the same event fields; add user_id, team_id, timestamps, and indexes on (opponent, match_date), (target_player).

Sync model: Keep the app offline-first. Write to IndexedDB locally; background sync to Postgres when online. Use Supabase’s RLS to scope data to your team.

Migration plan: Start by replacing localStorage with a thin storage service that has 2 adapters (local | remote). Flip a switch later.