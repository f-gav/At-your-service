# Pathfinder 2e — interactive sheet v1

The original Russian Pathfinder Remaster sheet is a **four-page, non-fillable PDF**. `fields.json` is the single coordinate map for 373 editable inputs and toggles. Coordinates are in PDF points, measured from the top-left corner of a 600.945 × 782.362 page. The web UI converts these into percentages, so controls track the original artwork at any zoom.

- `PathfinderSheet.tsx`: isolated React UI; editing, counters, navigation, save-on-back.
- `PathfinderSheet.css`: all feature-specific styles; no changes to global card styling.
- `fields.json`: stable field identifiers, labels, kinds, positions, optional limits.
- `public/pathfinder/page-N.webp`: visual backgrounds generated from the original PDF.
- `public/pathfinder/Pathfinder_2e_RU_editable_V1.pdf`: separate AcroForm PDF with the same field IDs.

## Data model

`characters.details.pathfinderSheet` is a versioned dictionary with one key per field and `schemaVersion: 1`. `name` is also synced with `characters.name`. No database schema changes, no rule engine, no automatic derived stats. This feature is intentionally independent of the other game systems.

## Next iterations

1. Rule engine for calculated values and proficiency tiers, separately testable.
2. Portrait upload through authenticated Supabase Storage (not base64 inside JSONB).
3. Better spell/inventory rows (structured arrays instead of multi-line columns).
4. Export character values back into an individual populated PDF; the downloadable template is currently blank.
5. More mobile-friendly zoom/pan and accessibility improvements.

PDF form viewers do not consistently support scripted increment/decrement buttons. Counters are therefore implemented in the web UI; the downloadable AcroForm PDF has editable numeric fields and clickable checkboxes. The original art is retained, including attribution.
