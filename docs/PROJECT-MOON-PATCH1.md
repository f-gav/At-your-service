# Project Moon — Patch 1

Implementation checklist for At your service! (fourth system: **Pr. Moon**).

## Released with Patch 1
- Game selector, filter and badge with stable system key `prmoon`.
- Independent HTML/CSS dossier with four navigation tabs: **Досье / Боевое досье / Обо мне / Заметки**.
- Six attributes and character metadata, independent existing portrait editor entry point.
- Manual HP, ST and SP; one opt-in auto-max setting with manual overrides.
- Light current/max empty for new character; max computed from `3 + Rank` after rank entry, with override and reset.
- Editable resource counters (direct values and ± controls), two weapon cards and six initial skill cards with unlimited extension (100-card storage guard); six editable notes and rich-text inventory.
- Uses the existing RichField editor for expandable text, including its interactive resource/toggle capabilities.
- Save on explicit button and before navigating home, preserving other character-detail keys.
- Portable JSON import and export for Pr. Moon, backward compatible with Pathfinder imports.
- Responsive paper-inspired monochrome styling, no PDF image underlays.

## Not yet in Patch 1
- Final user-supplied Project Moon portrait frame and custom portrait mask on sheet and home cards, plus tailored crop editing (planned Patch 2).
- Refined game-specific attack/equipment presentation and further visual fidelity improvements, mobile QA (later patches).

## Required production migration
Run `supabase/migrations/20261012_add_project_moon_system.sql` on the *At your service!* database to allow saving the new `prmoon` system key. The frontend build alone does not change PostgreSQL CHECK constraints.
