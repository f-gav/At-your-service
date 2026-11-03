# At your service! — Stage 4 Rooms V2 — final acceptance (5/5)

**Scope:** five fixed bundles (PR #79–#82 plus this final PR). No production schema, RLS, RPC or migrations have been applied by this stage. Merge of a code PR is not equivalent to deployment of Supabase SQL.

## Acceptance matrix

| Area | What is verified | Boundary |
| --- | --- | --- |
| State model / permissions | Owner, participant, outsider and unsupported systems; room membership selectors | Node unit tests + SQL source checks |
| Multi-room | Same character in different rooms, duplicate prevention within one room | Source contracts and PostgreSQL RPC fixture |
| RPC and rate limits | Calls under contention: 16 simulated concurrent requests, 10 accepted and 6 denied | Disposable PostgreSQL fixture with staging-only quota proposal |
| RLS, two identities | Owner/outsider/participant predicates, private characters, outsider denial, owner settings, own roll toggle | Real PostgreSQL `SET ROLE authenticated` + synthetic `auth.uid()`; **not real JWT authentication** |
| Realtime / reconnect | Newer read wins, subscriber/online/visible refresh and cleanup | Source contract tests; real socket disconnect/reconnect E2E still pending |
| Master actions | Serialized mutations, affected-row checks, stale title/closed predicates | Node regression and full app CI |
| Player views | PF2e and Project Moon resource fields, multi-room labels | Node regression + Chromium CSS/DOM fixture |
| Mobile UI | 390/560/820/1200px geometry with no horizontal overflow | Chromium fixture; real devices not covered |
| Sheets, PDF, JSON, library | Existing full app browser/model/PDF suites | CI |
| Session isolation | Clear private room lists and invalidate pending queries on sign-out, clear stale snapshots on join/create | Source regression, requires cross-account browser E2E |
| Build release | `dist/release.json`, `dist/index.html`, `dist/rooms/index.html` show same `GITHUB_SHA[:12]` | Build artifact test |
| Live Pages | `release.json` and `rooms/` must match merged SHA after publish | GitHub Actions `deploy` job; independent live query inaccessible from current environment |
| Real two-JWT E2E | Two separate non-admin Supabase Auth identities against isolated restore | **NOT EXECUTED** without credentials / authorized isolated environment |
| Recovery | Windows operator smoke and backup procedure | CI smoke only; actual DB+Storage restore remains a separate acceptance gate |

## Confirmed final correction
Private room state could remain in the mounted React component across sign-out/account changes. On sign-out we invalidate pending overview/detail requests, reset the active room, clear private room/member/roll state and selected room. Create/join now also clear previous member/roll snapshots immediately.

## Required operator acceptance before declaring stage fully closed

1. Inspect the `main` GitHub Actions `Deploy to GitHub Pages` run for the final merge commit. Require all `build`, `rpc-quota-postgres`, `recovery-windows-smoke`, and `deploy` jobs green. The deploy job already fetches live `release.json` and `rooms/` and compares `revision`/the meta marker to its own commit.
2. In a disposable restored Supabase (not production), provision two separate non-admin accounts and characters, plus rooms for both PF2e/Project Moon. Pass JWTs only via local secret env to `scripts/security-two-accounts-e2e.mjs`. Its authenticated read-only checks do **not** prove full room lifecycle.
3. Execute safe, authorized two-account browser flow in the isolated environment: create/join/duplicate/different-system/closed/full room, own leave/master kick, rejoin and revoke rights, own vs foreign casts, room rename/close/delete, resource snapshot refresh, multi-room, reconnect and simultaneous mutations.
4. Verify private Storage and PostgreSQL restore from a real backup in isolated environment; compare row/object counts, JSON and PDFs.
5. If any acceptance gate fails, treat release as conditional and create a targeted follow-up; do not silently adjust live RLS or run migration.

## Roadmap after Stage 4
- Separate operational acceptance for the connected Supabase environment and backups if credentials were not available during CI.
- Priority: real two-account browser/JWT integration on ephemeral Supabase, websocket reconnect/failover testing, deterministic concurrent writes and soak scenarios.
- Later: optional room UX enhancements and perf pagination, only after verified safe deployment.

**Status:** Code and automated test acceptance require a green PR CI. Stage 4 can be marked fully released only after live Pages verification and real isolated two-account acceptance; never infer these from fixtures.
