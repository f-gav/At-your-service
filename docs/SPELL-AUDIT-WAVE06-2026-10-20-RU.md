# Волна № 6: механический аудит 16 заклинаний второго круга
Дата: 20 октября 2026 года.

## Очередь
- Кровавая месть (`blood-vendetta`) — pf2e-remaster, проверено исходов: 4; описание 243 → 902 символов
- Костотряс (`boneshaker`) — pf2e-legacy, проверено исходов: 4; описание 459 → 1419 символов
- Клеймение нераскаявшегося (`brand-the-impenitent`) — pf2e-legacy, проверено исходов: 4; описание 429 → 647 символов
- Неслыханная щедрость (`charitable-urge`) — pf2e-remaster, проверено исходов: 4; описание 208 → 1152 символов
- Глухота (`deafness`) — pf2e-remaster, проверено исходов: 4; описание 277 → 518 символов
- Погребальный звон (`death-knell`) — pf2e-legacy, проверено исходов: 3; описание 284 → 445 символов
- Стремительные раскопки (`expeditious-excavation`) — pf2e-remaster, проверено исходов: 3; описание 271 → 969 символов
- Боязнь солнца (`fear-the-sun`) — pf2e-remaster, проверено исходов: 4; описание 202 → 751 символов
- Грибковое заражение (`fungal-infestation`) — pf2e-remaster, проверено исходов: 4; описание 178 → 746 символов
- Голод упыря (`ghoulish-cravings`) — pf2e-remaster, проверено исходов: 4; описание 385 → 748 символов
- Безудержный смех (`laughing-fit`) — pf2e-remaster, проверено исходов: 4; описание 225 → 632 символов
- Ментальная карта (`mental-map`) — pf2e-remaster, проверено исходов: 3; описание 427 → 745 символов
- Паранойя (`paranoia`) — pf2e-remaster, проверено исходов: 4; описание 80 → 649 символов
- Озаряющий свет (`revealing-light`) — pf2e-remaster, проверено исходов: 4; описание 491 → 710 символов
- Паутина (`web`) — pf2e-remaster, проверено исходов: 4; описание 667 → 1606 символов
- Корм для червей (`worms-repast`) — pf2e-legacy, проверено исходов: 4; описание 460 → 1242 символов

## Источники
Основной источник русских названий и терминов: [PF2.ru](https://pf2.ru/). Отдельные страницы проверены для 12 заклинаний: [Blood Vendetta](https://pf2.ru/spells/blood%20vendetta), [Charitable Urge](https://pf2.ru/spells/charitable%20urge), [Deafness](https://pf2.ru/spells/deafness), [Death Knell](https://pf2.ru/spells/death%20knell), [Fear the Sun](https://pf2.ru/spells/fear%20the%20sun), [Fungal Infestation](https://pf2.ru/spells/fungal%20infestation), [Ghoulish Cravings](https://pf2.ru/spells/ghoulish%20cravings), [Laughing Fit](https://pf2.ru/spells/laughing%20fit), [Mental Map](https://pf2.ru/spells/mental%20map), [Paranoia](https://pf2.ru/spells/paranoia), [Revealing Light](https://pf2.ru/spells/revealing%20light), [Web](https://pf2.ru/spells/web). Прямые русские страницы Boneshaker, Brand the Impenitent, Expeditious Excavation, Worm's Repast подтвердить не удалось; тексты составлены самостоятельно по английским оригиналам Foundry PF2e, сохранённым в библиотеке.

## Исправления
В каждое русское описание добавлены **все документированные структурные исходы** и **все варианты усиления**, которые раньше были представлены только в отдельных полях. Сверены реакция и требования Blood Vendetta, 2/3-действенное сотворение Boneshaker, выбор Акробатики или Рефлекса в Expeditious Excavation, формулы Worm's Repast, условия действий и перемещения в Web. Английский оригинал, признаки, метаданные и редакция не затронуты. Сохраняется атрибуция «Перевод от At your service!».

Там, где исходный текст не содержит отдельной категории критического успеха либо критического провала, она не выдумывается (Death Knell, Expeditious Excavation, Mental Map). 4 Legacy карточки не подменяются Remaster.

## Тесты
Регрессионный тест `tests/spell-library.mjs` проверяет все 16 карточек, каждый отдельно заданный исход спасброска, каждое структурное усиление, русскую локализацию и неизменность редакций. Далее необходимо дождаться полного цикла GitHub Actions: модели, TypeScript/Vite, PDF, браузерный тест библиотеки и GitHub Pages.
