# D&D Rooms V2 — production activation, 2026-11-04

This is a record of actual changes to the **At your service!** production system, not a test proposal.

## Database migration

- Target project `cvimyqmksxeigjnofexf` (NOT the unrelated WreckTrack project).
- Applied as recorded Supabase migration `20261104191201_enable_dnd5e_rooms_v2_guarded`.
- Corresponding audited SQL now archived in `supabase/migrations/20261104191201_enable_dnd5e_rooms_v2_guarded.sql` and previously in `supabase/proposals/dnd-rooms-v2-approval-required.sql`.
- Live read-only verification passed: room CHECK includes `pf2e`, `prmoon`, `dnd5e`; room snapshot dispatcher has D&D branch; join RPC permits D&D; `anon` cannot execute it; authenticated users can.
- Immediately after migration, existing room count remained **1** and member count **1**. No production table rows were deleted by the migration.

## Frontend rollout

- Workflow `.github/workflows/deploy.yml` now explicitly includes `VITE_DND_ROOMS_V2: 'true'` **only in the Vite build step**; the UI still derives state from `import.meta.env.VITE_DND_ROOMS_V2==='true'`.
- `tests/dnd-rooms-v2-gate.mjs` now asserts release state and the applied migration ledger file.
- CI on this PR must be fully green before merge and Pages deploy.
- Production /rooms HTML and /release.json must match resulting main SHA.
- On regression, revert this build flag first, preserve D&D rooms/data and investigate. Do not perform destructive schema rollback for nonempty rooms.

## Accepted outstanding risk

At user request, activation proceeded without a demonstrated full backup and isolated restore of **the actual production DB + Auth + private Storage**. Prior synthetic fixture recovery and Windows smoke tests are **not substitutes**. This is an unresolved operational risk and should be addressed next with `scripts/local-recovery.mjs`, not concealed behind successful CI.

## Post-release checks

1. Read-only verify database permissions, constraint, data counts, snapshots, security advisors.
2. Verify D&D 2014 and 2024 room creation, owner invitation / player join, two-client Realtime updates, HP snapshots and source protection using only authorized accounts.
3. Verify cross-system join denials and existing PF2e/Project Moon rooms.
4. Finish full real DB + Storage local recovery and operator backout acceptance.
5. Track future LSS JSON coverage, class/subclass/species automation, spell integrations, large-sheet storage and long-session concurrency.

D&D member snapshots are deliberately restricted to name, edition, level, HP and **base** AC, not private sheet contents.
