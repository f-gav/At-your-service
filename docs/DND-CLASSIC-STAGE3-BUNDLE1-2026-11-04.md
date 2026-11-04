# D&D 5e Classic — Stage 3, bundle 1/5 (2026-11-04)

## Scope / non-goals

Introduces the edition-independent typed data foundation, deterministic 2014/2024 calculations, layered bonuses and safe AYS JSON v2 adapters. No paper pages, class automation, LSS import or Supabase DDL in this bundle. D&D remains unavailable for character creation and generic JSON import until a usable editor exists (bundle 2). No changes to production data.

## Read-only production schema preflight

Project: **At your service!** (not WreckTrack). Executed SELECT of pg_constraint/pg_get_constraintdef only; no user table contents read. Actual public.characters details check: jsonb_typeof(details)='object' AND pg_column_size(details)<=65536. The live characters.system CHECK includes dnd5e already. Live game_rooms.system CHECK is limited to pf2e and prmoon. No migrations applied.

This means the existing 2MB portable JSON upload threshold is NOT a valid database payload bound. Bundle 1 implements 48,000 UTF-8 bytes preflight on complete character details before D&D save/import preparation, with a clear error instead of deleting player content. UTF-8 JSON and Postgres JSONB footprints differ: this remains a conservative client-side check, NOT a mathematical guarantee of a database write. The server and CAS remain authoritative. Large-content support needs a separately reviewed migration or alternative storage architecture.

## Data model

- Game system key: dnd5e (already present in registry).
- Persistent root: characters.details.dnd5eSheet, schemaVersion 1.
- rulesEdition and layoutEdition are independent ('2014' | '2024').
- Fields: identity, ability scores, saves/skills, combat, attacks, rich block placeholders, spell slots/spells, inventory, bonuses, effects, resources, presentation and import metadata.
- Changing layout returns a validated copy and never changes rulesEdition or erases hidden edition-specific values.
- No pixel layouts or LSS brand art in this bundle.

## Rules / calculated values

- Ability modifier and level-derived proficiency bonus; none / proficient / expert.
- Saving throws, 18 skills, initiative, basic armor class and HP/speed.
- Layered bonuses: replace base, add, multiply, floor, cap, final override; advantage/disadvantage cancel; source trace.
- 2014 exhaustion: disadvantaged ability checks (1+), speed half (2+), disadvantaged attacks/saves (3+), maximum HP half (4+), speed 0 (5+), death at 6.
- 2024 exhaustion: -2 to d20 tests and -5 ft speed per level, death at 6.
- d20 formula generation reuses the existing safe dice engine notation (1d20, 2d20kh1, 2d20kl1). Advanced LSS reroll/explode/conditionals are intentionally deferred to bundle 4.
- Armor-class expression parser intentionally handles ONLY an integer or integer+[DEX]; unknown expressions fail explicitly, never execute code. Expand when armor/class rules arrive.

## JSON v2 and save boundary

- The existing exportCharacter now emits a grouped DnD sheet under character.sheet; the internal details object is not duplicated in the portable common-details payload.
- Strict validation and a pure parseDndAysV2 adapter support future import without creating users or records.
- Unknown compatible values are preserved during layout switching and round-trip; malformed data and oversized saves are rejected.
- The app-wide generic import still blocks D&D; enabling it before the D&D editor would produce a non-editable character.
- Existing autosave/CAS via character-repository.ts remains unchanged and will be wired to this adapter in bundle 2.

## Acceptance

- npm run test:models includes tests/dnd5e-model.mjs.
- Tests cover score/proficiency math, 18 skills map, both exhaustion rule sets, advantage cancellation, deterministic bonus precedence, 2014→2024→2014 layout retention, JSON v2 round-trip, malformed payload rejection and UTF-8 cap.
- Full pre-existing CI (build, TypeScript, PF2e, Project Moon, Rooms, browsers, PDF) must pass on the PR.
- GitHub Pages is NOT to be deployed from a PR: only main deploy runs if/when a PR is merged separately.

## Deferred gates before release

1. Playable four-page 2014 and 2024 layouts.
2. Editor autosave end-to-end, mobile and PDF.
3. Full rule automation, spells and real LSS import (with unresolved fields report).
4. Explicitly authorized SQL review for D&D rooms and large data; no changes until approved.
5. Live two-account security and full release E2E before public enablement.
