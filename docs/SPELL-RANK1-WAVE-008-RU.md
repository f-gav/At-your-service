# Pathfinder 2e — первый круг, волна 008 (заключительная)

**Состояние:** все последние 20 записей №169–188 импортированы в том же порядке, что и исходные JSON-файлы [Foundry PF2e v14-dev](https://github.com/foundryvtt/pf2e/tree/v14-dev/packs/pf2e/spells/spells/rank-1): от `swampcall` до `wooden-fists`.

**Итого в библиотеке:** **259 записей** — 71 чары и **188 / 188 заклинаний 1-го круга** выбранного исходного набора. **125 русских карточек и 134 английских**. В финальной волне 9 русских карточек (названия подтверждены справочником) и 11 английских.

## Манифест

| № | Оригинал | Русское название | Язык | Редкость | Редакция | Книга |
|---:|---|---|:---:|---|---|---|
| 169 | Swampcall | Зов болота | RU | uncommon | Legacy | Pathfinder #171: Hurricane's Howl |
| 170 | Synchronize Steps | — | EN | uncommon | Legacy | Pathfinder Lost Omens Knights of Lastwall |
| 171 | Synchronize | Сверка | RU | common | Remaster | Pathfinder Impossible Magic |
| 172 | Tailwind | — | EN | common | Remaster | Pathfinder Player Core |
| 173 | Temporary Tool | Временный инструмент | RU | common | Remaster | Pathfinder Lost Omens Divine Mysteries |
| 174 | Tether | Путы | RU | common | Remaster | Pathfinder Lost Omens Divine Mysteries |
| 175 | Thicket of Knives | Заросли ножей | RU | common | Remaster | Pathfinder Impossible Magic |
| 176 | Thoughtful Gift | Продуманный подарок | RU | common | Remaster | Pathfinder Player Core 2 |
| 177 | Threefold Limb | — | EN | uncommon | Remaster | Pathfinder Lost Omens Rival Academies |
| 178 | Thunderstrike | Удар грома | RU | common | Remaster | Pathfinder Player Core |
| 179 | Turnip Lantern | — | EN | common | Remaster | Pathfinder Lost Omens Cheliax, Infernal Inheritance |
| 180 | Unbroken Panoply | — | EN | uncommon | Remaster | Pathfinder Lost Omens Rival Academies |
| 181 | Vanishing Tracks | — | EN | common | Remaster | Pathfinder Player Core |
| 182 | Ventriloquism | Чревовещание | RU | common | Remaster | Pathfinder Player Core |
| 183 | Verdant Sprout | — | EN | uncommon | Legacy | Pathfinder #151: The Show Must Go On |
| 184 | Verminous Lure | — | EN | uncommon | Legacy | Pathfinder #169: Kindled Magic |
| 185 | Wall of Shrubs | Стена кустарников | RU | common | Remaster | Pathfinder Rage of Elements |
| 186 | Weaken Earth | — | EN | common | Remaster | Pathfinder Rage of Elements |
| 187 | Weave Wood | — | EN | common | Remaster | Pathfinder Rage of Elements |
| 188 | Wooden Fists | — | EN | common | Remaster | Pathfinder Rage of Elements |

## Источники и принципы

- Каждая исходная английская запись, книга, редкость, традиции и версия (Remaster / Legacy) сохранены отдельно от русской черновой локализации.
- Русские названия подтверждены в [Pathfinder 2E RU](https://pf2e-ru-translation.readthedocs.io/ru/latest/spells/all-spells.html), русские описания сформулированы самостоятельно по механикам Foundry. Они не выдаются за официальный перевод.
- Legacy и Remaster нельзя считать синонимами. Например, `Tailwind` нельзя автоматически переименовывать в название старого заклинания без сверки редакций и правил.
- **Важное обнаружение:** в исходном Foundry JSON заклинания `Turnip Lantern` текст `1 minute` находился в поле `target.value`, хотя описывает длительность. В нашей копии это уточнено: `duration = 1 minute`, `targets` отсутствует. Этот случай внесён в будущий аудит исходных метаданных.
- Отсутствие подтверждённого русского названия означает только, что текущая карточка остаётся на английском, но не доказывает отсутствие перевода в других источниках.

## Следующая работа — аудит **перед** новым кругом

1. **Проверка существования.** Сверить каждую из 188 записей с файлами конкретной версии Foundry и указанной книгой; выявить ошибочные связи, дубли, переименования и пригодность приключенческих/редких заклинаний для общей библиотеки. Отдельно отметить неофициальные, устаревшие и специфичные для приключений источники, если они встретятся.
2. **Правила и карточки.** Сверить время сотворения, область, дальность, цели, спасброски, длительность, критические результаты, усиление и динамические условия с первоисточником. Исправить ошибки вроде `Turnip Lantern`; отдельно проверить шаблоны с многодейственным сотворением.
3. **Локализация английского.** Лишь после проверки происхождения пройти все **134** английские карточки; искать подтверждённые русские названия, не выдумывать их, сохранять историю исправлений и не приписывать Legacy-перевод другому Remaster-заклинанию без доказательства соответствия.

Накопительный реестр английских карточек — [SPELL-ENGLISH-TRACKER-RU.md](./SPELL-ENGLISH-TRACKER-RU.md).
