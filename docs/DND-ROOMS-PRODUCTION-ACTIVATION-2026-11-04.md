# D&D Rooms V2 — production activation gate (4 November 2026)

**CURRENT STATE: NOT ACTIVATED. Production schema and Storage are not modified by this document.**

## Confirmed live read-only findings

Authorized project: Supabase project **At your service!** (`cvimyqmksxeigjnofexf`), PostgreSQL 17, ACTIVE_HEALTHY at audit. Do not confuse it with the separate WreckTrack project.

- Production has **1 PF/PM room**, **1 membership**, **0 D&D rooms**, **0 D&D room memberships**, **0 D&D characters** and **4 Storage objects** at audit.
- `game_rooms_system_check` permits `('pf2e','prmoon')` only.
- `public.join_game_room(text,uuid)` rejects `dnd5e` using the exact original whitelist from `supabase/proposals/dnd-rooms-v2-approval-required.sql`.
- `ays_rooms_private.room_snapshot` has the expected PF2e / Project Moon branches and unchanged fallback.
- Every single live source-code signature and compatibility guard in `supabase/dnd-rooms-prod-preflight.sql` was checked by a read-only query; **all seven compatibility conditions succeeded**, plus anonymous join denied and authenticated join permitted.
- `game_rooms`, `game_room_members` and `characters` have RLS on. No RLS changes are proposed.
- Supabase's security advisor currently reports *two existing authenticated SECURITY DEFINER RPC warnings* (`join_game_room` and `post_game_room_roll`) and *disabled leaked-password protection*. Existing protected RPCs include explicit authorization checks; do not suppress these warnings without analysis. See [linter 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

These conditions authorize preparing the rollout, **not** bypassing the backup gate.

## Required operator recovery acceptance — BLOCKING

The **full production database, Auth and private Storage backup has never been confirmed restored in an isolated environment**. The green GitHub Actions tests of PR #90/#91 verify *fixture-only* DB/Storage recovery and real **local** Supabase Auth. They are not evidence of complete recovery of live user data.

Use the already implemented Windows 11 recovery workflow `docs/STAGE-1-ITER8-OPERATOR-ACCEPTANCE-2026-10-30.md` and `scripts/local-recovery.mjs`:

1. On the operator Windows 11 machine, install Docker Desktop (Linux containers), PostgreSQL CLI 17, Node.js 22+ and pinned Supabase CLI 2.122.0.
2. Set `AYS_SOURCE_PROJECT_REF=cvimyqmksxeigjnofexf` and a new empty private `AYS_RECOVERY_ROOT` **outside Git, OneDrive and shared folders**. Run `node scripts/local-recovery.mjs preflight`.
3. Use **only local secrets** from Supabase Connect, link the correct source project and ensure nobody edits data during backup. Run `node scripts/local-recovery.mjs backup`. This reads production but produces private SQL/Auth/Storage material. Never upload archives, credentials, JSON character data or JWT to GitHub, ChatGPT or CI artifacts.
4. Remove secret variables. Run `node scripts/local-recovery.mjs inspect`, then `node scripts/local-recovery.mjs restore`. The restore is restricted to `127.0.0.1:54322` and checks database row fingerprints and byte-accurate Storage hashes.
5. Run `node scripts/local-jwt-e2e.mjs` and then `node scripts/recovery-acceptance-report.mjs`. Only share the **short redacted status report** (PASS/FAIL), not private details.

**Abort release if any step fails.** No paid Supabase project or branch is needed.

## Two-gate production rollout (after real recovery is proven)

1. Re-read the production schema, run `supabase/dnd-rooms-prod-preflight.sql` against the verified project with read-only credentials and ensure **every value is true**. Freeze writes during migration and maintain an operator-owned SQL definition backup.
2. Have an operator review the exact SQL in `supabase/proposals/dnd-rooms-v2-approval-required.sql` and its backout. Apply it once as a versioned, auditable Supabase production migration, in a transaction, **only after full recovery PASS**. Do not auto-apply through the Pages workflow. Capture success/failure in the migrations ledger.
3. Read-only verify CHECK allows `dnd5e`, the snapshots expose only whitelisted HP/edition/level/base AC, existing PF/PM snapshots unchanged, and anonymous RPC EXECUTE denied. Review security advisors. For production operational verification use **authorized test accounts only**; do not read/modify unrelated players' characters.
4. Only after DB migration and RLS/RPC verification, deliberately change the public build to `VITE_DND_ROOMS_V2=true` in a separate frontend PR; adjust `tests/dnd-rooms-v2-gate.mjs` to assert the approved rollout state. Full CI must pass and Pages HTML + `release.json` must match the deployed SHA.
5. Smoke-test D&D 2014/2024 create/join and cross-system denials using authorized accounts, real Auth JWT, two-browser Realtime and autosave snapshots. Monitor errors and let clients create data only after acceptance. On regression, **first revert the feature flag**.

**Rollback:** Disable the frontend flag first. Restore exact original `room_snapshot` and `join_game_room` source definitions from the private pre-migration backup. Restore the old CHECK and remove the helper function only after verifying **zero D&D rooms and memberships**, otherwise preserve data and keep the superset constraint. Never delete D&D player data automatically.

## What remains after activation

- Fully compatible LSS v2 importer/exporter. Current import is conservative, uses archival original for round-trip and does **not** send edited AYS fields back to LSS.
- More complete 2014/2024 classes, subclasses, species, feats, leveling, spell preparation and derived class mechanics.
- Lifting the validated ~48 KB browser/cloud character payload limit via a reviewed storage design.
- End-to-end on the exact production character save/RLS schema (isolated fixture CAS tests do not prove exact production semantics).
- Ongoing production monitoring, recovery rehearsal, Realtime reconnection and multi-user room stress tests.
- Separate security improvements from pre-existing advisors, especially executable SECURITY DEFINER RPC design and leaked-password protection.

**Safety:** A code merge or Pages publication must never be mistaken for the DB migration's success. All these gates are independent.
