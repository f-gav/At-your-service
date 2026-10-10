# Pathfinder 2e sheet — visual iteration 2

## Architecture

- `fields.json`: canonical identifiers, types and coordinates of 373 editable fields. Coordinates are in **PDF points** with top-left origin. Do not use text labels as database keys.
- `layout.ts`: tiny visual alignment adjustments (independent of saved values); future rule logic belongs in separate files.
- `summary.ts`: extracts the home-card subtitle from the character sheet's `ancestry` and `character_class` fields.
- `PathfinderSheet.tsx`: all four pages in document order, field input state, counter controls and save flow.
- `PathfinderSheet.css`: isolated styling. No green editable-field overlays; neutral keyboard focus.
- `public/pathfinder/page-{1..4}.webp`: lossless WebP, high-resolution (360 DPI) renders of the original PDF. `loading="lazy"` for pages 2–4.
- `public/pathfinder/Pathfinder_2e_RU_editable_V1.pdf`: downloadable form-enabled PDF, kept for compatibility, but the web UI edits its own persisted fields.

The website stores the character's data in `characters.details.pathfinderSheet`, with `schemaVersion: 1`. The layout and original PDF do not affect saved data. When future gameplay calculations are added, do not replace user-entered values without a migration plan.

## Rendering quality

The original PDF has vector text and line art. The first version used 962 × 1252 lossy WebP thumbnails as page backgrounds, so text became soft on Retina displays. Current version uses 3005 × 3912 lossless WebP images rendered from the original vector PDF at 360 DPI. At a ~960 CSS-px sheet width, it provides about 3.1 image pixels per CSS pixel. The PDF field coordinate system is unchanged. Rendering via PDF.js would provide resolution-independent text and lines at arbitrary zoom.

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

## Параметры отображения и выбор из списка

- Для `hero_1..hero_3` отметка на странице теперь закрашивает шестиугольник, сохраняя логический `boolean`.
- Выпадающий список (`kind: 'select'`) хранит варианты в схеме администратора, а значение персонажа — строка по постоянному ID.
- Исходное поле `size` получило варианты PF2e: Крошечный, Маленький, Средний, Большой, Огромный, Исполинский. **Если уже опубликован собственный шаблон**, переключи тип поля «Размер» на выпадающее меню через редактор и опубликуй изменение; позиции пользовательских полей не перезаписываются.
- Переключатель монохромного режима находится в меню «Настройки» листа, сохраняется в локальном браузере и не меняет облачные данные или JSON.
