# Pathfinder 2e sheet — visual iteration 2

## Architecture

- `fields.json`: canonical identifiers, types and coordinates of 373 editable fields. Coordinates are in **PDF points** with top-left origin. Do not use text labels as database keys.
- `layout.ts`: tiny visual alignment adjustments (independent of saved values); future rule logic belongs in separate files.
- `summary.ts`: extracts the home-card subtitle from the character sheet's `ancestry` and `character_class` fields.
- `PathfinderSheet.tsx`: all four pages in document order, field input state, counter controls and save flow.
- `PathfinderSheet.css`: isolated styling. No green editable-field overlays; neutral keyboard focus.
- `public/pathfinder/page-{1..4}.webp`: lossless WebP, high-resolution (288 DPI) renders of the original PDF. `loading="lazy"` for pages 2–4.
- `public/pathfinder/Pathfinder_2e_RU_editable_V1.pdf`: downloadable form-enabled PDF, kept for compatibility, but the web UI edits its own persisted fields.

The website stores the character's data in `characters.details.pathfinderSheet`, with `schemaVersion: 1`. The layout and original PDF do not affect saved data. When future gameplay calculations are added, do not replace user-entered values without a migration plan.

## Rendering quality

The original PDF has vector text and line art. The first version used 962 × 1252 lossy WebP thumbnails as page backgrounds, so text became soft on Retina displays. Version 2 uses 2404 × 3130 lossless WebP images; browser display is ~960 px wide on desktop, so the image supplies about 2.5 physical pixels per CSS pixel at 100% scale. At extreme zoom, a future PDF.js renderer could offer resolution-independent vector rendering.

## Notes

- The 4 pages appear top to bottom in source order and use natural document scrolling.
- Existing values and the PDF field IDs remain unchanged.
- No automatic rules/derived stats yet.

## Динамические поля и значения (исправлено)

- `sheet-values.ts` загружает значения **всех** ID из `characters.details.pathfinderSheet`, в том числе полей, добавленных администратором после публикации шаблона.
- Поле, скрытое или удалённое из шаблона, остаётся в сохранённых данных персонажа и восстанавливается, если его ID снова появится.
- Пустая строка или снятая отметка явно очищают соответствующий ключ; другие поля не затрагиваются.
- Загрузка опубликованной схемы не сбрасывает локальные изменения: состояние значений берётся из данных персонажа, а схема отвечает только за отображение.
- Формат JSON остаётся версии 1: экспорт и импорт передают объект `details.pathfinderSheet` целиком, независимо от набора полей опубликованного шаблона.
