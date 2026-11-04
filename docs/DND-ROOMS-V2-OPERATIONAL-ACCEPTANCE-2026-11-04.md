# D&D Rooms V2 — isolated operational acceptance and approval-ready rollout

Date: 2026-11-04. Branch: feat/dnd-rooms-isolated-gate.
Repository: f-gav/At-your-service.

## Status and NON-production scope

The prior D&D Classic stage-3 PRs #84, #85, #86, #88, #89 are merged; main began at
5dbdfe509b77d93a8dc114be5b233375ceb23fea. The Pages deploy CI for that SHA
reported success, including HTTP GET checks on /release.json and /rooms/ HTML.
The public HTML could not be fetched directly from the assistant runtime;
the real on-runner HTTP validation is the verified source.

The live Supabase account exposes exactly one project named At your service!
alongside an unrelated WreckTrack project, **not a disposable test project**.
No production write, new Supabase project/branch, Auth account creation, service
role exposure, or paid test environment is permitted by this task.

## Existing blockers confirmed from actual database and source

- public.game_rooms.system CHECK allows only ('pf2e','prmoon').
- public.join_game_room performs chosen.system not in ('pf2e','prmoon').
- The UI excludes D&D from creating/joining rooms.
- The shared room_snapshot SQL supports only PF2e and Project Moon.
- The character JSON already supports rulesEdition/layoutEdition 2014/2024.
- Rooms V2's membership, owner, invite code, roll permission and Realtime
  patterns must be preserved; only small whitelisted resource snapshots are
  safe to expose, NOT another player's full D&D sheet.

## Proposed patch (NOT deployed)

- supabase/proposals/dnd-rooms-v2-approval-required.sql is intentionally NOT
  placed in supabase/migrations and NOT run on production.
- Adds dnd5e to the rooms system CHECK, new SECURITY INVOKER private snapshot
  helper with a strict whitelist, and inserts an additional branch in the
  existing snapshot dispatcher.
- Changes *only* the system whitelist in the existing public.join_game_room
  definition via a guarded, exact replacement of pg_get_functiondef. Does not
  overwrite current rate limits, security-definer signature or ownership tests.
  The migration **fails closed** if server SQL no longer has the expected
  signature/structure. Revoke / GRANT remain authenticated-only.
- The concise room snapshot includes name, edition, level, current/max/temp
  HP and BASE armor class. SQL intentionally does not attempt a full AC
  calculation with arbitrary effect/armor formulas; UI labels it "Базовая КЗ".
  No private notes, spellbook, portrait, equipment, or arbitrary JSON.
- The D&D create/join client is behind VITE_DND_ROOMS_V2 === 'true',
  **OFF by default** (not present in release workflow). Merely merging this
  PR must not expose nonfunctional D&D rooms in production.
- Existing PF2e and Project Moon flows, custom mobile room geometry, member
  RLS, and roll quotas remain untouched.

## Disposable CI acceptance

- Existing PostgreSQL 17 GitHub Actions fixture with synthetic identities.
- Builds a baseline PF/PM snapshot + RLS/membership auto-refresh trigger
  in tests/fixtures/dnd-rooms-v2-baseline.sql.
- Applies the approval-required SQL only to that disposable test database.
- Runs tests/fixtures/dnd-rooms-v2-rls.sql: multiple users via SET ROLE and
  request.jwt.claim.sub, owner creation, outsider denial, ownership mismatch,
  PF2e-to-D&D denial, 2014/2024 and mixed rules/layout, compact snapshots
  and no secret note leakage, 2-room membership, autosave-driven refresh,
  preserving server-side join quota and no anonymous RPC access.
- Source/feature gate static regression prevents accidental enablement.
- All existing rooms, D&D/PF2e/Project Moon, PDF, Windows and browser CI
  must continue to pass.

## Mandatory release approvals and unavailable evidence

**No production migration has been approved or executed.**
Do NOT enable VITE_DND_ROOMS_V2 until ALL these gates pass:
1. Operator explicitly approves the exact reviewed production SQL and a
   tested backout; check current live schema and function fingerprints again.
2. Complete DB + Storage backup with verified free local restore before writes.
3. Real two-account tests using signed JWTs from a **separate authorized,
   disposable Supabase Auth** environment; include RLS, invite-code denial,
   two-user Realtime, concurrent joins, unauthorized access and browser sessions.
   CI SET ROLE impersonation is NOT a substitute for verified Auth JWT.
4. Apply versioned migration only after approval; verify live RPC grants,
   RLS advisors, game_rooms.system constraint and filtered snapshots.
5. Turn on the client feature flag in the deployment environment as a separate
   rollout, rerun full CI and confirm GitHub Pages /release.json and /rooms/ HTML.
6. Monitor any errors and disable the client flag on regression. A rollback of
   the DB CHECK requires zero D&D rooms/members; never drop users' data blindly.

## Scope of acceptance

This PR can pass all code and disposable Postgres gates and still be correctly
classified **staged, not production-ready**. Full operational readiness needs
real Supabase Auth, production migration approval, restore exercise and live
post-rollout verification. Not claiming a service-to-service or signed-JWT test.
