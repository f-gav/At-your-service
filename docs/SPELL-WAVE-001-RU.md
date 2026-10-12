# Библиотека PF2e — волна 001: первые 24 чары

Дата: 12 октября 2026 года. Порядок: английские имена по каталогу
`foundryvtt/pf2e`, ветка `v14-dev`, путь `packs/pf2e/spells/spells/cantrip`.
Источники метаданных: Foundry PF2e + Paizo; русскоязычный пользовательский архив
`spellcards-pdf.zip` (четыре PDF `Cantrip_1.pdf`).

**Итог волны**: 24 различных записи; 15 имён подтверждены в приложенных
русских PDF (их механические описания заново изложены с учётом актуальных
данных); 9 записей оставлены на английском; 3 записи относятся к
Legacy и явно выделяются в Remaster-каталоге. Для D&D записей нет.

## Состав волны

| № | English | Русское название | Язык описания | Правила |
|---:|---|---|---|---|
| 01 | Acid Splash | Всплеск кислоты | RU (адаптация) | Legacy |
| 02 | Ancient Dust | — | EN | Legacy |
| 03 | Approximate | — | EN | Remaster |
| 04 | Artistic Recollection | — | EN | Remaster |
| 05 | Bramble Bush | — | EN | Remaster |
| 06 | Bullhorn | Рупор | RU (адаптация) | Remaster |
| 07 | Caustic Blast | — | EN | Remaster |
| 08 | Create Earthen Facsimile | — | EN | Remaster |
| 09 | Daze | Ступор | RU (адаптация) | Remaster |
| 10 | Deep Breath | Глубокий вдох | RU (адаптация) | Remaster |
| 11 | Detect Magic | Обнаружение магии | RU (адаптация) | Remaster |
| 12 | Detect Metal | Обнаружение металла | RU (адаптация) | Remaster |
| 13 | Divine Lance | Божественное копьё | RU (адаптация) | Remaster |
| 14 | Draw Moisture | Вытянуть влагу | RU (адаптация) | Remaster |
| 15 | Eat Fire | Глотать пламя | RU (адаптация) | Remaster |
| 16 | Electric Arc | Электрическая дуга | RU (адаптация) | Remaster |
| 17 | Elemental Counter | Стихийная нейтрализация | RU (адаптация) | Remaster |
| 18 | Figment | Вымысел | RU (адаптация) | Remaster |
| 19 | Forbidding Ward | Преграждающий оберег | RU (адаптация) | Remaster |
| 20 | Frostbite | Обморожение | RU (адаптация) | Remaster |
| 21 | Frost's Touch | — | EN | Remaster |
| 22 | Gale Blast | Штормовой порыв | RU (адаптация) | Remaster |
| 23 | Ghost Sound | — | EN | Legacy |
| 24 | Glamorize | — | EN | Remaster |

**Остались на английском (9):** Ancient Dust, Approximate,
Artistic Recollection, Bramble Bush, Caustic Blast,
Create Earthen Facsimile, Frost's Touch, Ghost Sound, Glamorize.

Важно: отсутствие записи в PDF не означает доказанное отсутствие
русского перевода в интернете. На момент импорта для этих девяти
не подтверждён источник русской версии, которую можно использовать.
Описание с пометкой «Текст на проверке» является аккуратным изложением
правил, а не официальной локализацией.

## Политика версий

- Acid Splash, Ancient Dust и Ghost Sound импортированы как **Legacy**,
  не превращаются в Remaster механически и маркируются на карточке.
  На вкладке Remaster эти записи доступны для поиска как архивные
  дополнения с соответствующим предупреждением.
- Electric Arc: 2d4 урона электричеством, без старого бонуса характеристики.
- Caustic Blast и Figment не подменяются Legacy-вариантами Acid Splash
  и Ghost Sound: отдельные названия, эффекты и ID.
- Elemental Counter — чары-реакция, но требуют расходования ячейки
  подходящего элементального заклинания.
- Доступность определяется традициями из записи исходного материала.
  Фокусные чары некроманта будут импортированы отдельно, чтобы
  не смешивать их с обычным каталогом.

## Источники

- [Foundry PF2e, cantrips](https://github.com/foundryvtt/pf2e/tree/v14-dev/packs/pf2e/spells/spells/cantrip)
- [Paizo / Pathfinder 2e rules about cantrips](https://2e.aonprd.com/Rules.aspx?ID=2221)
- Архив русских карточек пользователя: `spellcards-pdf.zip`
- Для каждой записи сохранены книга, редакция и лицензия ORC/OGL
  в `public/spell-library/pf2e.json`.

Следующая волна: чары 25–48, по английскому алфавиту.
