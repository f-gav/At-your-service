# D&D Classic — Stage 3 bundle 4/5

## Release dependencies (read-only preflight, 2026-11-04)
PRs #84, #85 and #86 are open, not merged. `main` remains `198f83f5756bfdbd16b70e3b71e2b97674f09778`. Main CI completed successfully, but the public GitHub Pages release.json and HTML were inaccessible to the web fetcher, so **publication is not verified**. Bundle 4 branches from the package-3 feature branch; no production Supabase changes. Merge in order #84 → #85 → #86 → this PR and verify release SHA per merge.

## Changes
- Structured (optional and backwards-compatible) classes, features, resources and effects in the same versioned `characters.details.dnd5eSheet` JSON; strict validation rejects invalid counts, duplicate IDs, resource bounds and over-20 multiclass levels.
- Manual grimoire for known, prepared, spellbook and granted spells. Ordinary and Pact Magic slot pools are distinct; slot spending and short/long rest resets are explicit actions.
- Basic 2014/2024 multiclass effective caster levels and suggested slot table, while **never overriding manual/imported slots**.
- Deterministic source-based bonuses and active effect overlays; known condition penalties, immobilization and duration ticks. 2014 and 2024 rulesEdition remains separate from layoutEdition.
- Safe bounded D&D dice notation building on existing parser: Cyrillic `к`/Latin `d`, `kh`/`dl`, variable modifiers `[STR]`, `[PROF]`, `[LVL]`, mathematical functions, narrow `if(...)`, reroll-once `ro=N`, explosive `!`. Unsupported advanced LSS constructs intentionally reject input; no eval or remote execution.
- Shared accordion-style advanced mechanics section outside both A4 paper compositions. RichField for ability descriptions and preserved legacy rich text sections.
- Regression tests for formula edge cases, spells, effects, classes, JSON and mobile editor; full CI expected.

## Limits / acceptance
- No automatic class-feature entitlement, prepared-spell progression, proprietary LSS dataset or copied rules text. Class slot suggestions are non-destructive.
- Genuine LSS imports and final PDF/Rooms functionality are bundle 5. Live two-user production tests not claimed.
- Database constraints unchanged: `pg_column_size(details)<=65536`; preliminary 48 KB UTF-8 preflight still active.
- Only this single PR for bundle 4, built on dependency branch. Do not release prior to full CI and ordered merges.

## References
- Official LSS notation: https://longstoryshort.app/doc/character-sheet/expression-input/
- LSS effects: https://longstoryshort.app/doc/character-sheet/effects/
- D&D 2024 multiclass/Pact Magic reference: https://www.dndbeyond.com/sources/dnd/br-2024/character-classes
