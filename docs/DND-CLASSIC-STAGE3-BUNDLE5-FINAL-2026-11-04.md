# At your service! — D&D Classic stage 3, final bundle 5/5

## Release status
- Merge order strictly PR #84 → #85 → #86 → #88 → this PR; each main CI **and deploy** must succeed, and release.json / HTML revision must match main SHA.
- Independent external fetch of GitHub Pages may be blocked by network restrictions; rely only on actual post-deploy GitHub Actions live HTTP verification logs, not a build artifact alone.
- No production Supabase migration or SQL application. The new D&D rooms category remains SERVER-BLOCKED in production because Rooms V2 game system constraints permit only PF2e and Project Moon. This blocker is intentional until migration approval.

## New features
- Downloadable A4 PDF for both 2014 and 2024 from the actual four-page browser paper and private portrait crop. RichField content is fully enumerated in supplementary A4 pages: no silent clipping from nested editable scrollboxes. Pagination uses measured paragraphs and fails explicitly if a fragment cannot fit.
- Exact Unicode text preservation regression `dndPdfSupplementPlan` and Chromium real-PDF download checks on both layouts with >9000 chars per rich field, plus A4 page-count assertions.
- Conservative external LSS version 2 import via the existing app character importer: distinct `edition` and `sheetEdition`, inner `data` JSON string, identity/verified raw attributes/conditions/currencies, selected ProseMirror formatting, spell references as unresolved slugs. Unsupported LSS bonus/resource formulas are not evaluated.
- Complete original imported LSS JSON archived in the sheet (when under live storage budget), available as an **unchanged source export** only. It is not a genuine edited AYS → LSS reverse exporter; current changes export in the native AYS JSON v2 format.
- Large sheets can always be saved into a local backup JSON even when the 48 KB cloud-save preflight rejects the change. No silent trimming or partial cloud writes.
- Local disposable PostgreSQL 17 RLS two-role account isolation and CAS/JSONB size tests, in addition to existing Rooms V2 isolated tests. **Not equivalent to two genuine Supabase Auth JWTs**, and no production data/Storage was accessed.

## Explicit limits
- Full LSS corpus/schema-level round trip was not available: no real current-service authenticated LSS export fixture was furnished. Mapping is limited to documented, verified fields. Import may reject oversized exports rather than drop original data, and unknown fields remain in original archived payload.
- Existing app data model is still `schemaVersion:1`; optional classes/effects/resources do not require migrations. The cloud `pg_column_size(details)<=65536` constraint must not be lifted without authorized migration. The conservative 48 KB UTF-8 preflight remains the gate.
- Four-page exact-print geometry plus extra pages for rich text; it is **not** a claim of perfect typographic fidelity to LSS copyrighted blank PDFs.
- D&D Rooms V2 not enabled or advertised until a separately approved and tested server migration.
- Genuine authenticated two-account Supabase E2E, DB+Storage backup/restore, multi-device browser sessions, accessibility audits, all LSS spell bindings and full class automation are external release blockers, not silently called successful.

## Acceptance
- Full CI: `test:models`, TypeScript, Vite, local Postgres RPC/RLS, Windows smoke, Playwright 2014, 2024, advanced panel, large PDF download, all existing PF2e/PM/Rooms/PDF regressions.
- Main merge/deploy status and live post-deploy revision must be checked after every dependency merge. PR checks run only with GitHub isolated workflow, no user Supabase database modifications.
