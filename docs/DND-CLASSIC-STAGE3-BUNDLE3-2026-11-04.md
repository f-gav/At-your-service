# At your service! — D&D Classic / Stage 3 / Bundle 3 of exactly 5

Date: 2026-11-04. PR dependency is **#84 → #85 → this PR**.

## Preflight: live release state

- At start, PR #84 and PR #85 were both still OPEN and not merged into main. Their PR CI had previously passed. Main remained 198f83f5756bfdbd16b70e3b71e2b97674f09778 and latest push workflow for main completed successfully.
- GitHub Pages release.json and HTML could not be independently retrieved; **do not claim the published site includes D&D**. Package 2 is NOT released.
- This branch was created from feat/dnd-classic-stage3-bundle2-2014, not from main. This is an intentional dependency, not permission to merge out of order.
- No production Supabase table or Storage changes; no SQL migrations, no user records read.

## Implementation

- Original distinct 4-page A4 HTML-based 2024 sheet based on the Stage 2 conceptual wireframes. No copied LSS brand, PDF artwork, proprietary text or fonts.
- Page 1: character identity, six ability panels with skills/saves grouped by ability, proficiency and expertise, AC, HP and death saves, heroic inspiration, exhaustion, speed, initiative, conditions, attacks, features.
- Page 2: portrait with existing private Storage crop/editor; goals, alliances and organizations, extra features and treasure.
- Page 3: six independent RichField notes with stable IDs.
- Page 4: spellcasting ability, spell DC and attack, slot counters 1–9, structured manual text areas for cantrips and circles 1–9, appearance, personality/background, equipment, attunement notes and coins.
- Shared in-place RichField supports existing formatting, spoilers, resource widgets and dice binding.
- One `characters.details.dnd5eSheet` object; `layoutEdition` switches paper, `rulesEdition` switches rules separately and confirms recalculation.
- Switching 2014 ↔ 2024 changes no original field IDs or values and must preserve non-rendered data (text, counters, notes, extras, unknown metadata).
- New character dialog lets the player select D&D 2014 or D&D 2024; both fields initialize to the selected edition, while later paper selection does not implicitly change rules.
- AYS JSON v2 import now accepts either edition and mixed rules/layout combinations. Invalid/unknown editions remain rejected. LSS external import is intentionally not implemented in this bundle.
- The existing CAS autosave, local-only draft recovery, conflict notification, safe 48 KB UTF-8 preflight, ownership checks and portrait tooling are unchanged.

## 2024 versus 2014 mechanics

- Core 2024 ability/proficiency math from bundle 1 remains shared with 2014.
- 2024 exhaustion is −2 to D20 Tests and −5 feet walking speed per exhaustion level; death at six levels; all derived checks and speed use rulesEdition.
- 2014 exhaustion/advantage/HP limits remain unchanged.
- 2024 skill panels regroup the 18 skills instead of the 2014 alphabetic list.
- Heroic Inspiration is shown separately from 2014 inspiration but maps to the same persistent boolean as appropriate to the rules edition.
- Advanced official class/race/feat progression, prepared spell catalogue, multiclass and Pact Magic are deferred to bundle 4.

## Regression gates

- New Playwright `tests/dnd5e-classic2024-browser.mjs`, registered in workflow, mounts the actual editor with a stub persistence callback, **not the live database**.
- Checks four A4 pages at 320/390/768/1360, no root overflow, all paper zones bounded, six ability panels, six RichFields, nine circles.
- Edits Dexterity, Stealth proficiency, 2024 exhaustion, condition tags, spell slots, biography name, rich note and spell text; invokes portrait editing.
- Tests 2024 → 2014 → 2024 layout switch without losing values and opposite 2014 → 2024 → 2014; confirms rulesEdition stays unchanged.
- JSON v2 regression tests 2014, 2024 and mixed configurations, and existing 2014 Chromium test stays active.
- Full repository CI must pass. No deployment from a pull request.

## Remaining scope and limits

- Current spell sections are manual text fields; data sources, prepared spells, class and school automation remain bundle 4.
- PDF/print clipping and downloadable four-page PDFs, genuine LSS JSON fixtures and actual two-account cross-device security tests remain in later acceptance.
- Current database `pg_column_size(details) <= 65536` from prior read-only inspection; saving over-large sheets must fail safely instead of trimming data.
- D&D rooms remain server-blocked until explicit, separately approved migration in bundle 5.

## Merge order / operator acceptance

1. PR #84: review and merge, observe full successful main deployment, verify release.json/HTML with commit SHA.
2. PR #85: update against main, full CI, merge, verify deployment and working D&D 2014.
3. Package 3 PR: update against new main, rerun full CI, merge only after publication dependencies satisfied, verify 2024 and 2014 in production without changing production DB.
4. Package 4: LSS formula compatibility, layered bonuses and structured advanced spells.

**Status:** code and CI subject to tool-verifiable GitHub Actions results. Approval to ship requires all three merges and deploy verification, not merely PR CI success.
