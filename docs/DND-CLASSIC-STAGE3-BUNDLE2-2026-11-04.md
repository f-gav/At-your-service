# At your service! — D&D Classic 2014, Stage 3 bundle 2/5

Date: 2026-11-04. Dependency: PR #84 (Stage 3 bundle 1) must merge first. Do not merge this PR until its CI passes and #84 is merged. Do not change production Supabase.

## Work completed

- Four original four-page A4 classic-2014 sheets, aligned to Stage 2 independent wireframe geometry (not LSS artwork or protected text): page 1 stats, skills, saves, combat, HP/AC/death, attacks, equipment, roleplaying; page 2 portrait, biography, goals, allies, features, treasure; page 3 six independent RichField areas; page 4 caster DC/attack, 0–9 spell-level text areas and slot counters.
- Fixed 210×297 mm paper with horizontal panning on mobile; no restacking into one-column cards.
- Existing private portrait Storage editor opened via onEditPortrait; crop and image display reuse PortraitImage.
- Existing RichField for formatted content, dice binding, dividers, spoilers, resources. Stable field identifiers for all sections.
- Existing useAutoSave with CAS/revision protection, device draft recovery on matching snapshots, explicit failures and guarded navigation. No Supabase migrations.
- Package 1 calculations wired to editable 2014 ability scores, skill/save ranks, combat, HP, initiative, speed and exhaustion.
- AYS dnd5e character creation enabled with player-entered name, default rulesEdition 2014 and layoutEdition 2014.
- Own AYS JSON v2 D&D transfer enabled through strict validation; legacy generic D&D v1 notes still import without losing metadata.
- Local D&D dice example panel reuses existing safe parser. Full LSS formula compatibility belongs to bundle 4.

## Data and save boundaries

Rich content lives under content.blocks keys: equipment, personality, bonds, features, backstory, goals, allies, traits, extraFeatures, treasure, note1 through note6, spellLevel0 through spellLevel9, hitDice and supporting biography keys. Text-first spells are intentional for this package; full prepared/grimoire/cards and pact slot rules belong to bundle 4. Layout and rules edition remain independent.

The 48 KB UTF-8 preflight from package 1 remains active. Production read-only check confirmed pg_column_size(details) <= 65536. Database CAS and constraints remain authoritative.

## Automated acceptance

- tests/dnd5e-classic2014-harness.tsx mounts the real editor with in-memory onSave, no external accounts.
- tests/dnd5e-classic2014-browser.mjs tests 4 pages, A4 dimensions (320/390/768/1360 px), horizontal panning, fields, rich notes, portrait action, slot controls, unrelated notes preservation, save and Back.
- CI invokes this after Chromium installation. Existing Pathfinder/Project Moon/Rooms/JSON/PDF tests remain active.
- No live two-account or Supabase writes. They remain separate final acceptance gates.

## Intentional limits

- Spell text and slot counts are manual. Catalog, prepared state, multiclass/pact pools, spell cards: bundle 4.
- Attacks have name, ability and formula. Full LSS bonus effects, class advancement and more elaborate attack handling: bundle 4.
- Page 2024: bundle 3.
- Production D&D rooms prohibited by current game_rooms server CHECK: bundle 5 after separately approved SQL.
- Downloadable PDF overflow/layout acceptance: bundle 5. Text fields scroll on-screen.
- LSS character import requires real current-version LSS fixtures and authorized conversions: bundle 4.
- No protected LSS graphics, translations or PDF files distributed.

## Merge order

1. PR #84 green, merge first under authorized operator decision.
2. Retarget/rebase this branch against current main, require full CI.
3. Merge only after all checks and confirm Pages SHA.
4. Proceed to bundle 3/5, not before dependency gates are satisfied.
