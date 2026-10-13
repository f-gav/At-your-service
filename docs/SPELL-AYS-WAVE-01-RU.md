# At your service! — волна 01: девять переведённых чар

Дата: 13 октября 2026. **Первая из семи** намеченных волн авторской локализации. Начало: 204 русские карточки / 55 только английских. Результат: **213 русских / 46 только английских**, при неизменном общем количестве 259.

Это **собственные русские переводы**, а не официальная локализация PF2.ru. Тон, названия навыков и действий согласованы с [русской терминологией Pathfinder 2e](https://pf2.ru/actions?tab=skill-actions); содержимое сверено с английскими JSON Foundry PF2e v14-dev. Полные тексты не переносились из чужих русских материалов.

Для **каждой** из девяти записей задано `translationOrigin: "at-your-service"` и `translationStatus: "draft"`. В UI каждой карточки показывается **«Перевод от At your service!»**; публикация оригинального английского имени, списка традиций, редакции и издательской книги сохранена.

## Переведённые заклинания

| № | Русское название | English | Редакция | Книга | Источник правил |
|---:|---|---|---|---|---|
| 1 | Древний прах | Ancient Dust | Legacy | Pathfinder #186: Ghost King's Rage | [Исходник](https://github.com/foundryvtt/pf2e/blob/v14-dev/packs/pf2e/spells/spells/cantrip/ancient-dust.json) |
| 2 | Художественное воспоминание | Artistic Recollection | Remaster | Pathfinder Impossible Magic | [Исходник](https://github.com/foundryvtt/pf2e/blob/v14-dev/packs/pf2e/spells/spells/cantrip/artistic-recollection.json) |
| 3 | Колючий куст | Bramble Bush | Remaster | Pathfinder #203: Shepherd of Decay | [Исходник](https://github.com/foundryvtt/pf2e/blob/v14-dev/packs/pf2e/spells/spells/cantrip/bramble-bush.json) |
| 4 | Создание земляного подобия | Create Earthen Facsimile | Remaster | Pathfinder Impossible Magic | [Исходник](https://github.com/foundryvtt/pf2e/blob/v14-dev/packs/pf2e/spells/spells/cantrip/create-earthen-facsimile.json) |
| 5 | Светящийся след | Glowing Trail | Legacy | Pathfinder #194: Cult of the Cave Worm | [Исходник](https://github.com/foundryvtt/pf2e/blob/v14-dev/packs/pf2e/spells/spells/cantrip/glowing-trail.json) |
| 6 | Верёвка из внутренностей | Inside Ropes | Legacy | Pathfinder #181: Zombie Feast | [Исходник](https://github.com/foundryvtt/pf2e/blob/v14-dev/packs/pf2e/spells/spells/cantrip/inside-ropes.json) |
| 7 | Связь воспоминаний | Join Pasts | Legacy | Pathfinder #147: Tomorrow Must Burn | [Исходник](https://github.com/foundryvtt/pf2e/blob/v14-dev/packs/pf2e/spells/spells/cantrip/join-pasts.json) |
| 8 | Музыкальное сопровождение | Musical Accompaniment | Remaster | Pathfinder Impossible Magic | [Исходник](https://github.com/foundryvtt/pf2e/blob/v14-dev/packs/pf2e/spells/spells/cantrip/musical-accompaniment.json) |
| 9 | Мучительная травма | Torturous Trauma | Legacy | Pathfinder #186: Ghost King's Rage | [Исходник](https://github.com/foundryvtt/pf2e/blob/v14-dev/packs/pf2e/spells/spells/cantrip/torturous-trauma.json) |

## Особенности, сохранённые в полном переводе

- **Древний прах:** четыре результата спасброска, продолжительный урон пустотой, усиление на +2 круга.
- **Художественное воспоминание:** допускает только непосредственно увиденные или подробно изученные образы; изображение исчезает через минуту.
- **Колючий куст:** начальный урон и отдельный урон при входе в опасную клетку; перемещение затруднено до следующего хода; формула с округлением и усиление сохранены.
- **Создание земляного подобия:** хрупкость фигурки и возвращение земли к прежнему состоянию после окончания магии.
- **Светящийся след:** отдельный 10-минутный срок существования участков следа, часовая длительность заклинания, выбор видимости и повышение до 3/5/7/9 круга.
- **Верёвка из внутренностей:** 50 футов, половина скорости при Лазании, минимум 5 футов, чистая проверка СЛ 5 после критического провала, особая польза для заклинателя и условия прекращения.
- **Связь воспоминаний:** два согласных существа, действие «Вспомнить информацию», Поддержка любым навыком Знаний без подготовки, повышение (+1) — дополнительная цель.
- **Музыкальное сопровождение:** бонус состояния +1 к Выступлению, усмотрение Ведущего для других социальных навыков, ситуативный штраф −4 к Скрытности и громкость крика четырёх человек.
- **Мучительная травма:** 1d4 + модификатор характеристики заклинаний дробящего урона, дополнительное Утомление при критическом провале и невосприимчивость существ без внутренних органов.

## Терминологические решения

- `flat check` — **чистая проверка**, `DC` — **СЛ**; `Climb` — **Лазание**; `Recall Knowledge` — **Вспомнить информацию**; `Aid` — **Поддержка**; `difficult terrain` — **пересечённая местность**; `hazardous terrain` — **опасная местность**.
- `Sustain` и `Dismiss` по ранее принятой форме; здесь `Dismiss` — **Развеять**.
- Спасброски и описания рангов используют существующие подписи At your service!, чтобы избежать смешения нескольких переводческих стандартов внутри сайта.
- Повышение размещено в `rules.heightened`, результаты — в `rules.outcomes`, без повторения этих блоков в основном описании.

## Приёмка и дальнейший план

- Тесты требуют русскую карточку и авторскую метку для каждой из девяти чар, а также 71/71 переведённых чар в целом.
- Браузерный сценарий проверяет **Древний прах**, **Верёвку из внутренностей** и сокращение фильтра «Только английский» до 46 карточек.
- [Все семь волн](./SPELL-AYS-LOCALIZATION-WAVES-RU.md) · [Текущий перечень английских карточек](./SPELL-ENGLISH-TRACKER-RU.md).
- Следующая волна: **Admonishing Ray, Airburst, Blessing of Vigor, Bone Shield, Buffeting Winds, Celestial Accord, Cinder Scribe, Connective Current** (8 заклинаний 1-го круга).
