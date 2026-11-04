# D&D Classic — Stage 3, bundle 4/5 · Advanced mechanics

Date: 2026-11-04. **No production DB mutations.** One PR, stacked on bundle 3 (#86), which is stacked on #85 and #84. All three predecessor PRs were OPEN and UNMERGED at this package's initial live inspection; main SHA 198f83f5756bfdbd16b70e3b71e2b97674f09778. Main CI was green, but it did not include D&D. GitHub Pages release.json and HTML were not reliably readable and their publication SHA remains **unverified**. DO NOT claim D&D is released or merge this PR ahead of dependencies.

## Implemented

- Dedicated bounded D&D formula interpreter `src/features/dnd5e/domain/lss-formulas.ts`:
  - NdS dice, percentile, Fate, Russian K, computed counts, arithmetic, powers, modulo, floor/ceil/round/min/max/abs/pow and numeric conditional if(), logical operators.
  - Keep/drop highest/lowest, reroll once/repeated by condition, unique rerolls, explosions (including penetrating), min/max face clamps and success counting, explicit error on invalid syntax.
  - `[LVL]`, `[PROF]`, `[HALF_PROF]`, ability modifiers; non-random numeric formula interpreter for fields and bonus sources.
  - Limits: <=1000 chars, <=1000 initial dice, <=32 parser depth, <=100 extra rerolls/explosions per die, finite totals. No eval, arbitrary code, remote calls or hidden API use.
  - **Not full LSS language parity.** Grouped dice expressions `{...}`, critical success/failure coloring metadata and all complex damage types/roll labels remain deferred; those must be tested against live LSS samples before claiming 1:1 compatibility.
- Bonus layers: base/add/override and existing multiply/floor/cap, formula-valued bonuses, active/inactive source selection and effects-linked activation. Numeric formulas may not use random dice.
- 2014/2024 conditions: explicit effects with active status and round counters; selected generic mechanics for grappled/restrained/paralyzed/poisoned, plus edition-specific exhaustion. Conditional line-of-sight effects are deliberately not guessed.
- Typed, validated resources with manual/short/long recovery and explicit rest operations; manual-only resources are never restored automatically. Normal slots restore on long rest, Pact Magic slots on short/long rest.
- Multiclass: up to six class rows, total level up to 20, full/half/third/pact caster progression. 2024 half casters round up; 2014 round down. Suggested spellcaster slots table 1–20 and independent Warlock Pact slot table. **No slot overwrite without user confirmation**. Individual class spell-preparation rules remain manual.
- Grimoire: stable spell identifiers, name, circle, source provenance, known/prepared/in book/granted/slotless flags, manual rich description and basic casting time/range/duration; separate ordinary and Pact slot expenditure with precondition checks and no silent consumption.
- Features: editable named/class-sourced entries with a full shared RichField description.
- Both 2014 and 2024 paper layouts remain exactly four fixed A4 pages. Advanced controls are a separate collapsible non-printing panel outside the paper; both layouts share the same `dnd5eSheet` object, CAS autosave, recovery and JSON v2. No risky data transform or page geometries modified beyond exposing RichField's D&D variables.
- Dice dock and inline RichField in D&D-only fields use the D&D formula parser. PF2e and Project Moon stay on the original dice engine.

## Tests and acceptance

- `tests/dnd5e-advanced.mjs` in `test:models` covers deterministic formula syntax, error caps, bonus priorities, source activation, conditions, multiclass 2014/2024 rounding, Pact slots, spell casting, rest/resource rules and AYS JSON v2 lossless round trip.
- `tests/dnd5e-advanced-browser.mjs` uses actual React + Chromium editor with a stubbed save handler, not production DB: Grimoire, formulas, Pact Magic, multiclass, resource/rest, effects, layout change and persistence.
- Existing 2014 and 2024 browser regressions, PF2e/Project Moon, PDF, Rooms and isolated PostgreSQL CI remain active.
- **Full CI on this PR must pass before merge**; green PR CI does not imply deployment.

## Explicit limitations and deferred work

- LSS external JSON import is NOT implemented; no real LSS private export fixture available in the connected workspace. AYS JSON v2 remains supported.
- Prepared-spell caps, individual class progression, spell lists from non-SRD books and subclass-granted features require licensed rules data and are not automatically asserted. Only class-level spell slots and Pact Magic tables are computed.
- Advanced panel is outside the four printable paper pages. Final D&D PDF integration/overflow, mobile print page breaks and actual live account E2E are in bundle 5.
- Production `characters.details` 65,536-byte `pg_column_size` check remains unchanged; 48 KB preflight remains as implemented previously. Large sheets must produce explicit save errors rather than dropping content.
- D&D Rooms remains blocked by server constraint; no production SQL or RLS/RPC changes until separately authorized.

## Required merge and release sequence

1. Merge #84 and verify main deployment and live release.json/HTML SHA.
2. Merge #85 and verify 2014 classic paper in deployed site.
3. Merge #86 and verify 2024 classic paper and cross-edition behavior.
4. Rebase this package PR on updated main, rerun CI, merge after all prior deploys verified, then check main and published HTML/release.json.
5. Only then begin package 5/5 final PDF, LSS import, Rooms and real isolated 2-account acceptance.

## Sources of rule / notation interpretation

- https://longstoryshort.app/doc/character-sheet/notation/
- https://longstoryshort.app/doc/character-sheet/bonuses/
- https://longstoryshort.app/doc/character-sheet/multiclass/
- https://www.roll20.net/compendium/dnd5e/Rules%3AMulticlassing/
No proprietary LSS artwork, trademarked UI template, or non-licensed spell texts copied.
