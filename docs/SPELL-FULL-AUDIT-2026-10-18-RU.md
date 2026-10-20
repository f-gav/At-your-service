# Полный аудит 483 заклинаний PF2e — 18.10.2026

Автоматический реестр ВСЕХ записей: 71 чары, 189 заклинаний первого круга, 223 второго. Сигналы — кандидаты на ручную проверку, не доказанные ошибки. Источник русской терминологии и контрольных карточек: PF2.ru. При расхождении проверять конкретную редакцию Remaster или Legacy и оригинал Paizo.

## Итоги

- 413 русских карточек, 70 без русского перевода.
- Сокращённых относительно исходного английского текста: 157.
- Возможных пропусков формул кубиков: 55.
- Возможных пропусков критических исходов: 57.
- Возможных пропусков спасбросков: 2.
- Флаги пересекаются. Короткий текст не обязательно неполный; кубики могли быть вынесены в параметры или записаны словами. Каждое исправление требует смысловой проверки PF2.ru.

## Процедура замены

На сайт попадёт только полное русское самостоятельное изложение механики, согласованное с PF2.ru: действия, признаки, дальность/цели/область, атака/спасбросок, урон и тип, условия успехов, длительность, усиление, редакция и источник. Английский блок в карточки не добавлять. После каждой волны сверять JSON, типизацию, браузер, экспорт и GitHub Actions.

## Очереди

- Волна 1: чары с замечаниями: 15.
- Волна 2: 1 круг — формулы: 33.
- Волна 3: 1 круг — иные механики: 18.
- Волна 4: 1 круг — короткие/без RU: 59.
- Волна 5: 2 круг — формулы: **18** (уточнено 20.10; первоначальные 38 включали 20 записей без RU).
- Волна 6: 2 круг — иные механики: **16 карточек обновлены 20.10.2026** ([аудит](SPELL-AUDIT-WAVE06-2026-10-20-RU.md)).
- Волна 7: 2 круг — короткие/без RU: **89 проверены и объединены в каталог 20.10.2026** (69 добавленных RU версий + 20 полных проверенных RU описаний; [отчёт](SPELL-AUDIT-WAVE07-2026-10-20-RU.md)).
- Волна 8: 2 круг — **100 проверены; 42 записи с усилениями и 2 записи с исходами приведены к полному формату (20.10.2026)** ([отчёт](SPELL-AUDIT-WAVE08-2026-10-20-RU.md)).

Уточнение от 20 октября 2026 года: первоначальная приоритетная очередь второго круга «38» состояла из 18 сигналов о пропуске формул и 20 карточек только на английском языке; отсутствие русской версии не доказывает ошибку урона. Приоритет 20 строк «Нет RU» перенесён с 1 на 3 без изменений самих заклинаний. Отчёт сверки: [волна 05](SPELL-AUDIT-WAVE05-2026-10-20-RU.md). Кодовые изменения в русских карточках и регрессионные проверки уточнены отдельно.

Актуализация 20 октября 2026 года: 69 ранее подготовленных авторских переводов второго ранга из двух отдельных файлов перенесены в основной каталог, а 20 коротких русских описаний проверены и дополнены по сохранённым данным. Дополнительно перенесено заклинание первого ранга Funeral Flames, ошибочно находившееся в импорте rank-2. Все 483 исторических записи имеют RU и EN; источник и редакция не изменены. Старые автоматические сигналы в таблице ниже отражают исходную контрольную точку 18 октября и хранятся для истории.

## Реестр

| Круг | ID | Имя | Редакция | Приоритет | Сигналы |
|---|---|---|---|---|---|
| 0 | pf2e-acid-splash | Всплеск кислоты | pf2e-legacy | 4 | — |
| 0 | pf2e-ancient-dust | Древний прах | pf2e-legacy | 1 | Нет кубиков 1d6; Проверить критические исходы |
| 0 | pf2e-approximate | Аппроксимация | pf2e-remaster | 3 | Короткое |
| 0 | pf2e-artistic-recollection | Художественное воспоминание | pf2e-remaster | 4 | — |
| 0 | pf2e-bramble-bush | Колючий куст | pf2e-remaster | 4 | — |
| 0 | pf2e-bullhorn | Рупор | pf2e-remaster | 4 | — |
| 0 | pf2e-caustic-blast | Всплеск кислоты | pf2e-remaster | 1 | Короткое; Нет кубиков 1d8 |
| 0 | pf2e-create-earthen-facsimile | Создание земляного подобия | pf2e-remaster | 4 | — |
| 0 | pf2e-daze | Ступор | pf2e-remaster | 4 | — |
| 0 | pf2e-deep-breath | Глубокий вдох | pf2e-remaster | 4 | — |
| 0 | pf2e-detect-magic | Обнаружение магии | pf2e-remaster | 4 | — |
| 0 | pf2e-detect-metal | Обнаружение металла | pf2e-remaster | 4 | — |
| 0 | pf2e-divine-lance | Божественное копьё | pf2e-remaster | 4 | — |
| 0 | pf2e-draw-moisture | Вытянуть влагу | pf2e-remaster | 4 | — |
| 0 | pf2e-eat-fire | Глотать пламя | pf2e-remaster | 4 | — |
| 0 | pf2e-electric-arc | Электрическая дуга | pf2e-remaster | 4 | — |
| 0 | pf2e-elemental-counter | Стихийная нейтрализация | pf2e-remaster | 4 | — |
| 0 | pf2e-figment | Вымысел | pf2e-remaster | 4 | — |
| 0 | pf2e-forbidding-ward | Преграждающий оберег | pf2e-remaster | 4 | — |
| 0 | pf2e-frostbite | Обморожение | pf2e-remaster | 4 | — |
| 0 | pf2e-frosts-touch | Касание мороза | pf2e-remaster | 3 | Короткое |
| 0 | pf2e-gale-blast | Штормовой порыв | pf2e-remaster | 4 | — |
| 0 | pf2e-ghost-sound | Призрачный звук | pf2e-legacy | 3 | Короткое |
| 0 | pf2e-glamorize | Восхваление | pf2e-remaster | 3 | Короткое |
| 0 | pf2e-glass-shield | Стеклянный щит | pf2e-remaster | 1 | Короткое; Нет кубиков 1d4 |
| 0 | pf2e-glowing-trail | Светящийся след | pf2e-legacy | 4 | — |
| 0 | pf2e-gouging-claw | Раздирающий коготь | pf2e-remaster | 4 | — |
| 0 | pf2e-guidance | Наставление | pf2e-remaster | 4 | — |
| 0 | pf2e-haunting-hymn | Навязчивый гимн | pf2e-remaster | 4 | — |
| 0 | pf2e-healing-plaster | Исцеляющий гипс | pf2e-legacy | 4 | — |
| 0 | pf2e-ignition | Воспламенение | pf2e-remaster | 4 | — |
| 0 | pf2e-illuminate | Подсветить | pf2e-remaster | 3 | Короткое |
| 0 | pf2e-infectious-enthusiasm | Заразительный энтузиазм | pf2e-remaster | 3 | Короткое |
| 0 | pf2e-inside-ropes | Верёвка из внутренностей | pf2e-legacy | 4 | — |
| 0 | pf2e-invoke-true-name | Призыв истинного имени | pf2e-legacy | 3 | Короткое |
| 0 | pf2e-join-pasts | Связь воспоминаний | pf2e-legacy | 4 | — |
| 0 | pf2e-know-the-way | Определение направления | pf2e-remaster | 3 | Короткое |
| 0 | pf2e-light | Свет | pf2e-remaster | 4 | — |
| 0 | pf2e-live-wire | Живой провод | pf2e-remaster | 1 | Короткое; Нет кубиков 1d4 |
| 0 | pf2e-message | Сообщение | pf2e-remaster | 4 | — |
| 0 | pf2e-musical-accompaniment | Музыкальное сопровождение | pf2e-remaster | 4 | — |
| 0 | pf2e-needle-darts | Иглы-дротики | pf2e-remaster | 4 | — |
| 0 | pf2e-phase-bolt | Фазовый болт | pf2e-remaster | 4 | — |
| 0 | pf2e-prestidigitation | Престидижитация | pf2e-remaster | 4 | — |
| 0 | pf2e-protect-companion | Защитить компаньона | pf2e-remaster | 4 | — |
| 0 | pf2e-puff-of-poison | Дуновение яда | pf2e-remaster | 4 | — |
| 0 | pf2e-ray-of-frost | Морозный луч | pf2e-legacy | 4 | — |
| 0 | pf2e-read-aura | Чтение ауры | pf2e-remaster | 4 | — |
| 0 | pf2e-read-the-air | Прочитать эфир | pf2e-remaster | 4 | — |
| 0 | pf2e-root-reading | Толкование корней | pf2e-remaster | 3 | Короткое |
| 0 | pf2e-rousing-splash | Бодрящие брызги | pf2e-remaster | 4 | — |
| 0 | pf2e-scatter-scree | Рассеять щебень | pf2e-remaster | 4 | — |
| 0 | pf2e-shield | Щит | pf2e-remaster | 4 | — |
| 0 | pf2e-sigil | Сигил | pf2e-remaster | 4 | — |
| 0 | pf2e-slashing-gust | Рубящий шквал | pf2e-remaster | 4 | — |
| 0 | pf2e-spout | Столб воды | pf2e-remaster | 4 | — |
| 0 | pf2e-stabilize | Стабилизировать | pf2e-remaster | 4 | — |
| 0 | pf2e-summon-instrument | Призыв музыкального инструмента | pf2e-remaster | 4 | — |
| 0 | pf2e-take-root | Пустить корни | pf2e-remaster | 3 | Короткое |
| 0 | pf2e-tame | Приручение | pf2e-remaster | 4 | — |
| 0 | pf2e-tangle-vine | Оплетающая лоза | pf2e-remaster | 4 | — |
| 0 | pf2e-telekinetic-hand | Телекинетическая рука | pf2e-remaster | 4 | — |
| 0 | pf2e-telekinetic-projectile | Телекинетический бросок | pf2e-remaster | 4 | — |
| 0 | pf2e-timber | Дерево! | pf2e-remaster | 1 | Короткое; Нет кубиков 2d4 |
| 0 | pf2e-time-sense | Чувство времени | pf2e-remaster | 4 | — |
| 0 | pf2e-torturous-trauma | Мучительная травма | pf2e-legacy | 4 | — |
| 0 | pf2e-tremor-signs | Вибрационные сигналы | pf2e-remaster | 4 | — |
| 0 | pf2e-vitality-lash | Витальная плеть | pf2e-remaster | 4 | — |
| 0 | pf2e-void-warp | Пустотное искажение | pf2e-remaster | 4 | — |
| 0 | pf2e-warp-step | Шаг искривления | pf2e-remaster | 4 | — |
| 0 | pf2e-wash-your-luck | Очищение удачи | pf2e-remaster | 4 | — |
| 1 | pf2e-500-toads | 500 жаб | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-acidic-burst | Кислотный взрыв | pf2e-remaster | 4 | — |
| 1 | pf2e-admonishing-ray | Вразумляющий луч | pf2e-legacy | 2 | Проверить критические исходы |
| 1 | pf2e-agitate | Взбудоражить | pf2e-remaster | 4 | — |
| 1 | pf2e-air-bubble | Воздушный пузырь | pf2e-remaster | 4 | — |
| 1 | pf2e-airburst | Воздушный выброс | pf2e-legacy | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-alarm | Тревога | pf2e-remaster | 4 | — |
| 1 | pf2e-animal-allies | Животные-союзники | pf2e-remaster | 4 | — |
| 1 | pf2e-animate-rope | Оживление верёвки | pf2e-legacy | 4 | — |
| 1 | pf2e-ant-haul | Муравьиная добыча | pf2e-remaster | 4 | — |
| 1 | pf2e-anticipate-peril | Предвидение опасности | pf2e-remaster | 4 | — |
| 1 | pf2e-aqueous-blast | Водяной взрыв | pf2e-legacy | 1 | Короткое; Нет кубиков 2d8,1d8 |
| 1 | pf2e-armor-of-thorn-and-claw | Броня из шипов и когтей | pf2e-remaster | 1 | Короткое; Нет кубиков 1d4 |
| 1 | pf2e-bane | Проклятие | pf2e-remaster | 4 | — |
| 1 | pf2e-befuddle | Сбить с толку | pf2e-remaster | 4 | — |
| 1 | pf2e-benediction | Оберегание | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-beseech-the-sphinx | Мольба к сфинксу | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-biting-words | Кусачие слова | pf2e-remaster | 4 | — |
| 1 | pf2e-bless | Благословение | pf2e-remaster | 4 | — |
| 1 | pf2e-blessing-of-vigor | Благословение жизненных сил | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-bone-shield | Костяной щит | pf2e-remaster | 4 | — |
| 1 | pf2e-breadcrumbs | Хлебные крошки | pf2e-remaster | 4 | — |
| 1 | pf2e-breathe-fire | Огненное дыхание | pf2e-remaster | 1 | Короткое; Нет кубиков 2d6 |
| 1 | pf2e-briny-bolt | Солёный снаряд | pf2e-remaster | 1 | Короткое; Нет кубиков 2d6,4d6; Проверить критические исходы |
| 1 | pf2e-buffeting-winds | Шквальные ветры | pf2e-legacy | 4 | — |
| 1 | pf2e-buoyant-bubbles | Плавучие пузыри | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-camel-spit | Верблюжий плевок | pf2e-remaster | 1 | Короткое; Нет кубиков 1d6; Проверить критические исходы |
| 1 | pf2e-carryall | Перевозка | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-celestial-accord | Небесное согласие | pf2e-legacy | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-charm | Очаровать | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-chilling-spray | Ледяной поток | pf2e-remaster | 1 | Короткое; Нет кубиков 2d4; Проверить критические исходы |
| 1 | pf2e-cinder-scribe | Пепельный писец | pf2e-remaster | 4 | — |
| 1 | pf2e-cleanse-cuisine | Очищение провизии | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-command | Приказ | pf2e-remaster | 4 | — |
| 1 | pf2e-concordant-choir | Стройный хор | pf2e-remaster | 1 | Короткое; Нет кубиков 1d4,2d4 |
| 1 | pf2e-conductive-weapon | Проводящее оружие | pf2e-remaster | 1 | Короткое; Нет кубиков 1d12 |
| 1 | pf2e-connective-current | Связующий поток | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-cradle-aloft | Парящая колыбель | pf2e-remaster | 4 | — |
| 1 | pf2e-create-water | Создание воды | pf2e-remaster | 4 | — |
| 1 | pf2e-curse-of-recoil | Проклятие отдачи | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-curse-of-slippery-steps | Проклятие скользких шагов | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-cycle-of-retribution | Круг возмездия | pf2e-remaster | 1 | Короткое; Нет кубиков 1d4; Проверить критические исходы |
| 1 | pf2e-decompose | Разложение | pf2e-remaster | 4 | — |
| 1 | pf2e-defended-by-spirits | Под защитой духов | pf2e-remaster | 4 | — |
| 1 | pf2e-dehydrate | Обезвоживание | pf2e-remaster | 1 | Короткое; Нет кубиков 1d6,3d6; Проверить критические исходы |
| 1 | pf2e-déjà-vu | Дежавю | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-detect-poison | Обнаружение яда | pf2e-remaster | 4 | — |
| 1 | pf2e-devils-horseshoe | Дьявольская подкова | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-disguise-magic | Сокрытие магии | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-dizzying-colors | Цветные брызги | pf2e-remaster | 4 | — |
| 1 | pf2e-dome-of-tranquility | Купол безмятежности | pf2e-remaster | 4 | — |
| 1 | pf2e-draw-ire | Вымышленный гнев | pf2e-legacy | 1 | Короткое; Нет кубиков 1d10; Проверить критические исходы |
| 1 | pf2e-echoing-weapon | Вторящее оружие | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-elysian-whimsy | Причуда Элизиума | pf2e-legacy | 4 | — |
| 1 | pf2e-endure | Упорство | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-enfeeble | Слабость | pf2e-remaster | 4 | — |
| 1 | pf2e-equal-footing | На равных | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-exchange-image | Обмен обликами | pf2e-legacy | 3 | Короткое |
| 1 | pf2e-fashionista | Законодатель мод | pf2e-legacy | 4 | — |
| 1 | pf2e-fated-healing | Исцеление судьбой | pf2e-remaster | 4 | — |
| 1 | pf2e-fear | Ужас | pf2e-remaster | 4 | — |
| 1 | pf2e-fishing-spot | Рыбное место | pf2e-remaster | 4 | — |
| 1 | pf2e-flashy-disappearance | Эффектное исчезновение | pf2e-legacy | 4 | — |
| 1 | pf2e-fleet-step | Легконогость | pf2e-remaster | 4 | — |
| 1 | pf2e-flense | Сдирание плоти | pf2e-legacy | 4 | — |
| 1 | pf2e-flourishing-flora | Процветающая флора | pf2e-remaster | 1 | Короткое; Нет кубиков 2d4,1d4 |
| 1 | pf2e-fold-metal | Складывание металла | pf2e-remaster | 4 | — |
| 1 | pf2e-foraging-friends | Друзья-фуражиры | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-force-barrage | Силовой залп | pf2e-remaster | 4 | — |
| 1 | pf2e-forced-mercy | Навязанное милосердие | pf2e-remaster | 1 | Короткое; Нет кубиков 1d4; Проверить критические исходы; Проверить спасбросок |
| 1 | pf2e-forge | Горнило | pf2e-legacy | 1 | Короткое; Нет кубиков 2d6; Проверить критические исходы |
| 1 | pf2e-friendfetch | Притяжение друзей | pf2e-legacy | 4 | — |
| 1 | pf2e-funeral-flames | Funeral Flames | pf2e-remaster | 1 | Нет RU |
| 1 | pf2e-gentle-landing | Плавное падение | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-gloom-mantle | Мантия сумрака | pf2e-remaster | 4 | — |
| 1 | pf2e-goblin-pox | Гоблинская оспа | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-gravitational-pull | Гравитационное притяжение | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-grease | Масло | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-grim-tendrils | Мрачные щупальцы | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-gritty-wheeze | Песчаный хрип | pf2e-legacy | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-groom-companion | Уход за спутником | pf2e-remaster | 4 | — |
| 1 | pf2e-gust-of-wind | Порыв ветра | pf2e-remaster | 1 | Короткое; Нет кубиков 2d6; Проверить критические исходы |
| 1 | pf2e-harm | Нанесение ран | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-heal | Исцеление | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-helpful-steps | Удобные ступени | pf2e-legacy | 4 | — |
| 1 | pf2e-hippocampus-retreat | Отступление гиппокампа | pf2e-remaster | 1 | Короткое; Нет кубиков 2d6,1d6; Проверить критические исходы |
| 1 | pf2e-horizon-thunder-sphere | Диапазонная грозовая сфера | pf2e-remaster | 1 | Короткое; Нет кубиков 2d6 |
| 1 | pf2e-hydraulic-push | Водный толчок | pf2e-remaster | 4 | — |
| 1 | pf2e-ill-omen | Дурная примета | pf2e-remaster | 4 | — |
| 1 | pf2e-illusory-disguise | Иллюзорная маскировка | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-illusory-object | Иллюзорный объект | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-imprint-message | Внедрение послания | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-infuse-vitality | Наделение жизнетворностью | pf2e-remaster | 1 | Короткое; Нет кубиков 1d4,2d4,3d4 |
| 1 | pf2e-inkshot | Выстрел чернилами | pf2e-legacy | 4 | — |
| 1 | pf2e-instant-pottery | Мгновенное гончарство | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-interposing-earth | Заслон из земли | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-invisible-item | Невидимый предмет | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-item-facade | Внешний вид предмета | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-jump | Прыжок | pf2e-remaster | 4 | — |
| 1 | pf2e-juvenile-companion | Омоложенный верный зверь | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-kinetic-ram | Кинетический таран | pf2e-remaster | 1 | Короткое; Нет кубиков 1d6; Проверить критические исходы |
| 1 | pf2e-know-location | Знание местоположения | pf2e-legacy | 4 | — |
| 1 | pf2e-leaden-steps | Свинцовые шаги | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-liberating-command | Освобождающая команда | pf2e-remaster | 4 | — |
| 1 | pf2e-lock | Замок | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-lose-the-path | Сбить с пути | pf2e-remaster | 4 | — |
| 1 | pf2e-magic-stone | Магический камень | pf2e-legacy | 4 | — |
| 1 | pf2e-malediction | Проклинание | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-mending | Починка | pf2e-remaster | 4 | — |
| 1 | pf2e-message-rune | Руна сообщения | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-metal-merged | Слияние с металлом | pf2e-remaster | 4 | — |
| 1 | pf2e-mindlink | Мысленная связь | pf2e-remaster | 4 | — |
| 1 | pf2e-mud-pit | Грязевая яма | pf2e-remaster | 4 | — |
| 1 | pf2e-mystic-armor | Магический доспех | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-necromancers-generosity | Щедрость некроманта | pf2e-remaster | 4 | — |
| 1 | pf2e-negate-aroma | Подавление запаха | pf2e-legacy | 3 | Короткое |
| 1 | pf2e-nettleskin | Терновая кожа | pf2e-legacy | 4 | — |
| 1 | pf2e-noxious-vapors | Ядовитые испарения | pf2e-remaster | 1 | Короткое; Нет кубиков 1d6; Проверить спасбросок |
| 1 | pf2e-nudge-the-odds | Повышение шансов | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-object-reading | Чтение предмета | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-overselling-flourish | Преувеличенная игра | pf2e-legacy | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-penumbral-shroud | Покров полутени | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-personal-rain-cloud | Личная дождевая туча | pf2e-legacy | 4 | — |
| 1 | pf2e-pest-form | Форма зверька | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-pet-cache | Схрон для питомца | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-phantasmal-minion | Фантомный слуга | pf2e-remaster | 4 | — |
| 1 | pf2e-phantom-pain | Фантомная боль | pf2e-remaster | 1 | Короткое; Нет кубиков 2d4,1d4; Проверить критические исходы |
| 1 | pf2e-pocket-library | Карманная библиотека | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-propelling-air-stream | Толкающий воздушный поток | pf2e-remaster | 4 | — |
| 1 | pf2e-protection | Защита | pf2e-remaster | 4 | — |
| 1 | pf2e-protector-tree | Древо-защитник | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-pummeling-rubble | Град обломков | pf2e-remaster | 1 | Короткое; Нет кубиков 2d4; Проверить критические исходы |
| 1 | pf2e-purifying-icicle | Очищающая сосулька | pf2e-legacy | 4 | — |
| 1 | pf2e-putrefy-food-and-drink | Порча еды и питья | pf2e-legacy | 3 | Короткое |
| 1 | pf2e-quick-sort | Быстрая сортировка | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-rainbows-end | Конец радуги | pf2e-remaster | 1 | Короткое; Нет кубиков 1d4,2d4 |
| 1 | pf2e-reed-whistle | Тростниковый свисток | pf2e-remaster | 4 | — |
| 1 | pf2e-restyle | Смена стиля | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-rude-awakening | Резкое пробуждение | pf2e-remaster | 4 | — |
| 1 | pf2e-runic-body | Рунное тело | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-runic-weapon | Рунное оружие | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-sacred-beasts | Сакральные звери | pf2e-remaster | 1 | Короткое; Нет кубиков 2d6 |
| 1 | pf2e-sanctuary | Убежище | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-schadenfreude | Злорадство | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 1 | pf2e-scorching-blast | Огненный взрыв | pf2e-legacy | 1 | Короткое; Нет кубиков 2d8,1d6,1d8 |
| 1 | pf2e-scouring-sand | Вычищающий песок | pf2e-legacy | 2 | Проверить критические исходы |
| 1 | pf2e-seashell-of-stolen-sound | Ракушка похищенных звуков | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-share-lore | Поделиться знаниями | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-shattering-gem | Раскалывающийся самоцвет | pf2e-remaster | 1 | Короткое; Нет кубиков 1d8 |
| 1 | pf2e-shielded-arm | Рука-щит | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-shillelagh | Шилейла | pf2e-legacy | 3 | Короткое |
| 1 | pf2e-shocking-grasp | Шоковое прикосновение | pf2e-legacy | 1 | Короткое; Нет кубиков 1d4,1d12; Проверить критические исходы |
| 1 | pf2e-shockwave | Ударная волна | pf2e-remaster | 1 | Короткое; Нет кубиков 1d6; Проверить критические исходы |
| 1 | pf2e-signal-skyrocket | Сигнальная ракета | pf2e-remaster | 1 | Короткое; Нет кубиков 1d10; Проверить критические исходы |
| 1 | pf2e-sky-sight | Небесное зрение | pf2e-remaster | 4 | — |
| 1 | pf2e-sleep | Сон | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-snowball | Снежок | pf2e-legacy | 3 | Короткое |
| 1 | pf2e-soothe | Успокоение | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-spider-sting | Паучье жало | pf2e-remaster | 1 | Короткое; Нет кубиков 1d4; Проверить критические исходы |
| 1 | pf2e-spirit-link | Духовная связь | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-spirit-ward | Оберег от духов | pf2e-remaster | 4 | — |
| 1 | pf2e-stick-on | Прилипание | pf2e-remaster | 4 | — |
| 1 | pf2e-summon-animal | Призыв животного | pf2e-remaster | 4 | — |
| 1 | pf2e-summon-construct | Призыв конструкта | pf2e-remaster | 4 | — |
| 1 | pf2e-summon-fey | Призыв феи | pf2e-remaster | 4 | — |
| 1 | pf2e-summon-lesser-servitor | Призыв малого служителя | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-summon-plant-or-fungus | Призыв растения или гриба | pf2e-remaster | 4 | — |
| 1 | pf2e-summon-undead | Призыв нежити | pf2e-remaster | 4 | — |
| 1 | pf2e-sure-strike | Верный удар | pf2e-remaster | 4 | — |
| 1 | pf2e-swampcall | Зов болота | pf2e-legacy | 3 | Короткое |
| 1 | pf2e-synchronize | Сверка | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-synchronize-steps | Согласованные шаги | pf2e-legacy | 4 | — |
| 1 | pf2e-tailwind | Попутный ветер | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-temporary-tool | Временный инструмент | pf2e-remaster | 4 | — |
| 1 | pf2e-tether | Путы | pf2e-remaster | 4 | — |
| 1 | pf2e-thicket-of-knives | Заросли ножей | pf2e-remaster | 4 | — |
| 1 | pf2e-thoughtful-gift | Продуманный подарок | pf2e-remaster | 4 | — |
| 1 | pf2e-threefold-limb | Тройная конечность | pf2e-remaster | 1 | Короткое; Нет кубиков 2d6; Проверить критические исходы |
| 1 | pf2e-thunderstrike | Удар грома | pf2e-remaster | 4 | — |
| 1 | pf2e-turnip-lantern | Фонарь из репы | pf2e-remaster | 4 | — |
| 1 | pf2e-unbroken-panoply | Несокрушимое облачение | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-vanishing-tracks | Бесследный шаг | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-ventriloquism | Чревовещание | pf2e-remaster | 4 | — |
| 1 | pf2e-verdant-sprout | Зелёный росток | pf2e-legacy | 3 | Короткое |
| 1 | pf2e-verminous-lure | Приманка для мелких тварей | pf2e-legacy | 4 | — |
| 1 | pf2e-wall-of-shrubs | Стена кустарников | pf2e-remaster | 4 | — |
| 1 | pf2e-weaken-earth | Ослабить землю | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-weave-wood | Плести дерево | pf2e-remaster | 3 | Короткое |
| 1 | pf2e-wooden-fists | Деревянные кулаки | pf2e-remaster | 1 | Короткое; Нет кубиков 1d6,2d6,3d6,4d6 |
| 2 | pf2e-acid-arrow | Кислотная Стрела | pf2e-legacy | 4 | — |
| 2 | pf2e-acid-grip | Кислотная хватка | pf2e-remaster | 4 | — |
| 2 | pf2e-advanced-scurvy | Advanced Scurvy | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-albatross-curse | Проклятие альбатроса | pf2e-remaster | 4 | — |
| 2 | pf2e-allfood | Allfood | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-animal-form | Форма животного | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-animal-messenger | Животное-посланник | pf2e-remaster | 4 | — |
| 2 | pf2e-animated-assault | Телекинетический шторм | pf2e-remaster | 4 | — |
| 2 | pf2e-animus-mine | Ментальная мина | pf2e-remaster | 4 | — |
| 2 | pf2e-ash-cloud | Пепельное облако | pf2e-remaster | 4 | — |
| 2 | pf2e-augury | Гадание | pf2e-remaster | 4 | — |
| 2 | pf2e-avenging-wildwood | Avenging Wildwood | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-banishing-touch | Изгоняющее касание | pf2e-remaster | 4 | — |
| 2 | pf2e-bee-man-s-summons | Bee-Man's Summons | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-befitting-attire | Подходящий наряд | pf2e-remaster | 4 | — |
| 2 | pf2e-binding-muzzle | Binding Muzzle | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-blast-of-the-bellows | Blast of the Bellows | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-blazing-armory | Пылающий арсенал | pf2e-remaster | 4 | — |
| 2 | pf2e-blazing-blade | Пылающий клинок | pf2e-legacy | 4 | — |
| 2 | pf2e-blazing-bolt | Всполох пламени | pf2e-remaster | 4 | — |
| 2 | pf2e-blistering-invective | Обжигающее сквернословие | pf2e-remaster | 4 | — |
| 2 | pf2e-blood-duplicate | Blood Duplicate | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-blood-runs-cold | Blood Runs Cold | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-blood-vendetta | Кровавая месть | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 2 | pf2e-blur | Расплывчатость | pf2e-remaster | 4 | — |
| 2 | pf2e-bone-spray | Bone Spray | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-boneshaker | Костотряс | pf2e-legacy | 2 | Короткое; Проверить критические исходы |
| 2 | pf2e-bralani-referendum | Bralani Referendum | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-brand-the-impenitent | Клеймение нераскаявшегося | pf2e-legacy | 2 | Проверить критические исходы |
| 2 | pf2e-breath-of-drought | Breath of Drought | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-brine-dragon-bile | Желчь пенного дракона | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-burrow-ward | Защита от бурильщиков | pf2e-remaster | 4 | — |
| 2 | pf2e-buzzing-servants | Жужжащие слуги | pf2e-remaster | 4 | — |
| 2 | pf2e-calm | Спокойствие | pf2e-remaster | 4 | — |
| 2 | pf2e-carrion-mire | Carrion Mire | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-cauterize-wounds | Прижигание ран | pf2e-remaster | 4 | — |
| 2 | pf2e-charitable-urge | Неслыханная щедрость | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 2 | pf2e-clad-in-metal | Облачить в металл | pf2e-remaster | 4 | — |
| 2 | pf2e-claws-of-the-otter | Когти выдры | pf2e-remaster | 4 | — |
| 2 | pf2e-clawsong | Песнь когтей | pf2e-legacy | 4 | — |
| 2 | pf2e-cleanse-affliction | Избавление от недуга | pf2e-remaster | 4 | — |
| 2 | pf2e-cleanse-air | Очистить воздух | pf2e-remaster | 4 | — |
| 2 | pf2e-clear-mind | Очищение разума | pf2e-remaster | 4 | — |
| 2 | pf2e-coiling-dance | Извивающийся танец | pf2e-remaster | 4 | — |
| 2 | pf2e-confetti-cloud | Confetti Cloud | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-create-food | Создание еды | pf2e-remaster | 4 | — |
| 2 | pf2e-cutting-insult | Cutting Insult | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-dancing-shield | Танцующий щит | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-darkness | Тьма | pf2e-remaster | 4 | — |
| 2 | pf2e-darkvision | Ночное зрение | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-deafness | Глухота | pf2e-remaster | 2 | Проверить критические исходы |
| 2 | pf2e-death-knell | Погребальный звон | pf2e-legacy | 2 | Проверить критические исходы |
| 2 | pf2e-dimensional-drop | Dimensional Drop | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-disintegrating-puddle | Disintegrating Puddle | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-dismantle | Деконструкция | pf2e-remaster | 4 | — |
| 2 | pf2e-disorienting-flash | Disorienting Flash | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-dispel-magic | Рассеивание магии | pf2e-remaster | 4 | — |
| 2 | pf2e-draw-blood | Draw Blood | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-electrostatic-glider | Electrostatic Glider | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-elemental-zone | Зона стихии | pf2e-remaster | 4 | — |
| 2 | pf2e-embed-message | Начертание послания | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-empathic-link | Empathic Link | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-empty-pack | Пустой мешок | pf2e-remaster | 4 | — |
| 2 | pf2e-enhance-victuals | Улучшение провизии | pf2e-legacy | 4 | — |
| 2 | pf2e-enlarge | Увеличение | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-entangling-flora | Опутывание | pf2e-remaster | 4 | — |
| 2 | pf2e-environmental-endurance | Защита от непогоды | pf2e-remaster | 4 | — |
| 2 | pf2e-erase-trail | Erase Trail | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-everlight | Вечный свет | pf2e-remaster | 4 | — |
| 2 | pf2e-expeditious-excavation | Стремительные раскопки | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 2 | pf2e-exploding-earth | Взрывающаяся земля | pf2e-remaster | 1 | Нет кубиков 2d6 |
| 2 | pf2e-explosive-dust | Explosive Dust | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-extract-poison | Извлечение яда | pf2e-legacy | 4 | — |
| 2 | pf2e-faerie-fire | Фейское сияние | pf2e-legacy | 4 | — |
| 2 | pf2e-false-vitality | Ложная жизнь | pf2e-remaster | 4 | — |
| 2 | pf2e-falsify-heat | Ложное тепло | pf2e-remaster | 4 | — |
| 2 | pf2e-familiars-resurrection | Familiar's Resurrection | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-far-flung-fetch | Перенос издалека | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-fear-the-sun | Боязнь солнца | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 2 | pf2e-feast-of-ashes | Пир из пепла | pf2e-remaster | 1 | Короткое; Нет кубиков 1d4,2d4; Проверить критические исходы |
| 2 | pf2e-feral-shades | Свирепые оттенки | pf2e-remaster | 1 | Нет кубиков 1d4 |
| 2 | pf2e-final-sacrifice | Последняя жертва | pf2e-remaster | 1 | Нет кубиков 2d6 |
| 2 | pf2e-fireproof | Огнеупорность | pf2e-remaster | 4 | — |
| 2 | pf2e-flame-wisp | Пламенный огонёк | pf2e-remaster | 4 | — |
| 2 | pf2e-floating-flame | Парящее пламя | pf2e-remaster | 1 | Нет кубиков 1d6 |
| 2 | pf2e-floating-harness | Floating Harness | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-frog-tongue | Лягушачий язык | pf2e-remaster | 4 | — |
| 2 | pf2e-frozen-lungs | Frozen Lungs | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-fungal-hyphae | Грибные гифы | pf2e-remaster | 1 | Короткое; Нет кубиков 3d8 |
| 2 | pf2e-fungal-infestation | Грибковое заражение | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 2 | pf2e-gecko-grip | Лапы геккона | pf2e-remaster | 4 | — |
| 2 | pf2e-gentle-breeze | Нежный бриз | pf2e-remaster | 4 | — |
| 2 | pf2e-ghostly-carrier | Призрачная фигура | pf2e-remaster | 4 | — |
| 2 | pf2e-ghoulish-cravings | Голод упыря | pf2e-remaster | 2 | Проверить критические исходы |
| 2 | pf2e-glacial-causeway | Glacial Causeway | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-grave-impressions | Grave Impressions | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-guiding-star | Путеводная звезда | pf2e-remaster | 4 | — |
| 2 | pf2e-heat-metal | Раскалённый металл | pf2e-legacy | 1 | Короткое; Нет кубиков 2d6,1d4; Проверить критические исходы |
| 2 | pf2e-helpful-reload | Вспомогательная перезарядка | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-helpful-scribe | Helpful Scribe | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-helpful-wood-spirits | Помощь древесных духов | pf2e-remaster | 4 | — |
| 2 | pf2e-hidebound | Покрыть шкурой | pf2e-remaster | 4 | — |
| 2 | pf2e-horrifying-blood-loss | Horrifying Blood Loss | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-humanoid-form | Форма гуманоида | pf2e-remaster | 4 | — |
| 2 | pf2e-ignite-fireworks | Поджечь фейерверк | pf2e-remaster | 1 | Короткое; Нет кубиков 1d4 |
| 2 | pf2e-illusory-creature | Иллюзорное существо | pf2e-remaster | 1 | Нет кубиков 1d4 |
| 2 | pf2e-illusory-shroud | Illusory Shroud | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-imp-sting | Imp Sting | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-impart-empathy | Impart Empathy | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-impeccable-flow | Impeccable Flow | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-imprinting-hand | Imprinting Hand | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-infernal-supervision | Infernal Supervision | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-inner-radiance-torrent | Поток внутреннего сияния | pf2e-remaster | 1 | Нет кубиков 2d4 |
| 2 | pf2e-instant-armor | Мгновенный доспех | pf2e-remaster | 4 | — |
| 2 | pf2e-invisibility | Невидимость | pf2e-remaster | 4 | — |
| 2 | pf2e-iron-gut | Железные внутренности | pf2e-legacy | 4 | — |
| 2 | pf2e-kgalaserkes-axes | Топоры Кгаласерке | pf2e-remaster | 4 | — |
| 2 | pf2e-knock | Стук | pf2e-remaster | 4 | — |
| 2 | pf2e-laughing-fit | Безудержный смех | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 2 | pf2e-lock-item | Зафиксировать предмет | pf2e-remaster | 4 | — |
| 2 | pf2e-loose-times-arrow | Выпустить стрелу времени | pf2e-remaster | 4 | — |
| 2 | pf2e-lucky-number | Счастливое число | pf2e-remaster | 4 | — |
| 2 | pf2e-magnetic-attraction | Магнитное притяжение | pf2e-remaster | 4 | — |
| 2 | pf2e-magnetic-repulsion | Магнитное отталкивание | pf2e-remaster | 4 | — |
| 2 | pf2e-manifestation-of-spirits | Manifestation of Spirits | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-mark-of-blood | Mark of Blood | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-marvelous-mount | Чудесный скакун | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-mental-map | Ментальная карта | pf2e-remaster | 2 | Проверить критические исходы |
| 2 | pf2e-metal-reverberation | Metal Reverberation | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-mimic-undead | Имитирование нежити | pf2e-legacy | 4 | — |
| 2 | pf2e-mind-games | Mind Games | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-mirror-image | Зеркальное отражение | pf2e-legacy | 4 | — |
| 2 | pf2e-mist | Непроглядный туман | pf2e-remaster | 4 | — |
| 2 | pf2e-mist-sight | Mist Sight | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-murder-of-crows | Воронья стая | pf2e-remaster | 1 | Нет кубиков 3d4 |
| 2 | pf2e-noise-blast | Звуковой взрыв | pf2e-remaster | 1 | Короткое; Нет кубиков 1d10; Проверить критические исходы |
| 2 | pf2e-oaken-resilience | Дубовая стойкость | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-one-with-plants | One with Plants | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-osseous-cage | Osseous Cage | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-pack-attack | Стайная атака | pf2e-legacy | 3 | Короткое |
| 2 | pf2e-palm-held-sun | Palm-Held Sun | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-paranoia | Паранойя | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 2 | pf2e-pave-ground | Выровнять землю | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-peaceful-rest | Посмертный покой | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-penumbral-disguise | Penumbral Disguise | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-persistent-servant | Persistent Servant | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-phantasmal-treasure | Phantasmal Treasure | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-phantom-crowd | Призрачная толпа | pf2e-remaster | 4 | — |
| 2 | pf2e-piercing-jet | Пронзающая струя | pf2e-remaster | 1 | Нет кубиков 2d6 |
| 2 | pf2e-propulsive-breeze | Попутный ветер | pf2e-remaster | 4 | — |
| 2 | pf2e-pyrefowl-rebuke | Отпор огненной птицы | pf2e-remaster | 4 | — |
| 2 | pf2e-quench | Quench | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-radiant-field | Сияющее поле | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-rapid-adaptation | Быстрая адаптация | pf2e-legacy | 4 | — |
| 2 | pf2e-reapers-lantern | Фонарь жнеца | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-resist-energy | Устойчивость к энергии | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-restoration | Восстановление | pf2e-legacy | 3 | Короткое |
| 2 | pf2e-retrieving-hook | Retrieving Hook | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-revealing-light | Озаряющий свет | pf2e-remaster | 2 | Проверить критические исходы |
| 2 | pf2e-rime-slick | Rime Slick | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-rubble-step | Шаг щебня | pf2e-remaster | 4 | — |
| 2 | pf2e-saturate | Saturate | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-sea-surge | Sea Surge | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-see-the-unseen | Видение невидимого | pf2e-remaster | 4 | — |
| 2 | pf2e-shadow-zombie | Shadow Zombie | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-shape-wood | Преображение дерева | pf2e-remaster | 4 | — |
| 2 | pf2e-share-life | Кровные узы | pf2e-remaster | 4 | — |
| 2 | pf2e-shatter | Разбивающий звук | pf2e-remaster | 1 | Нет кубиков 1d10 |
| 2 | pf2e-shift-perspective | Shift Perspective | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-shrink | Уменьшение | pf2e-remaster | 4 | — |
| 2 | pf2e-silence | Тишина | pf2e-remaster | 4 | — |
| 2 | pf2e-slough-skin | Шелушащаяся кожа | pf2e-remaster | 4 | — |
| 2 | pf2e-sonata-span | Соната-мост | pf2e-remaster | 4 | — |
| 2 | pf2e-sound-body | Крепкое тело | pf2e-remaster | 4 | — |
| 2 | pf2e-speak-with-animals | Разговор с животными | pf2e-remaster | 4 | — |
| 2 | pf2e-spirit-sense | Чутьё на духов | pf2e-remaster | 4 | — |
| 2 | pf2e-spiritual-armament | Призрачное оружие | pf2e-remaster | 1 | Нет кубиков 1d8 |
| 2 | pf2e-spiritual-weapon | Призрачное Оружие | pf2e-legacy | 1 | Нет кубиков 1d8 |
| 2 | pf2e-splinter-volley | Град щепок | pf2e-remaster | 4 | — |
| 2 | pf2e-spray-of-salt | Соляной шквал | pf2e-remaster | 4 | — |
| 2 | pf2e-spys-mark | Spy's Mark | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-status | Состояние | pf2e-remaster | 4 | — |
| 2 | pf2e-steel-fortifications | Steel Fortifications | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-sticky-fire | Липкое пламя | pf2e-remaster | 4 | — |
| 2 | pf2e-stupefy | Одурманивание | pf2e-remaster | 4 | — |
| 2 | pf2e-sudden-blight | Внезапное увядание | pf2e-remaster | 4 | — |
| 2 | pf2e-sudden-bolt | Внезапная молния | pf2e-legacy | 4 | — |
| 2 | pf2e-summon-elemental | Призыв элементаля | pf2e-remaster | 4 | — |
| 2 | pf2e-summoners-precaution | Summoner's Precaution | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-summoners-visage | Summoner's Visage | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-sure-footing | Уверенная поступь | pf2e-remaster | 4 | — |
| 2 | pf2e-swallow-light | Поглощение света | pf2e-legacy | 3 | Короткое |
| 2 | pf2e-tacky-pine-sap | Липкая смола | pf2e-remaster | 4 | — |
| 2 | pf2e-teeth-to-terror | Зубастый ужас | pf2e-legacy | 4 | — |
| 2 | pf2e-telekinetic-maneuver | Телекинетический манёвр | pf2e-remaster | 4 | — |
| 2 | pf2e-the-parrots-whisper | The Parrot's Whisper | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-the-queens-rainbow | Радуга королевы | pf2e-remaster | 4 | — |
| 2 | pf2e-thermal-remedy | Целебный отвар | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-thunder-echo | Громовое эхо | pf2e-remaster | 3 | Короткое |
| 2 | pf2e-thundering-dominance | Thundering Dominance | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-timely-reminder | Своевременное напоминание | pf2e-remaster | 4 | — |
| 2 | pf2e-timely-tutor | Своевременный наставник | pf2e-remaster | 4 | — |
| 2 | pf2e-tracing-bond | Tracing Bond | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-translate | Перевод | pf2e-remaster | 4 | — |
| 2 | pf2e-tremorsense | Виброчувствительность | pf2e-remaster | 4 | — |
| 2 | pf2e-umbral-extraction | Извлечение из тени | pf2e-legacy | 4 | — |
| 2 | pf2e-umbral-mindtheft | Umbral Mindtheft | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-uncover-device | Uncover Device | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-unrelenting-gravity | Unrelenting Gravity | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-vanish-weapon | Vanish Weapon | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-veil-of-spirits | Veil of Spirits | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-vicious-jealousy | Vicious Jealousy | pf2e-legacy | 3 | Нет RU |
| 2 | pf2e-voice-on-the-breeze | Шёпот ветра | pf2e-remaster | 4 | — |
| 2 | pf2e-vomit-swarm | Изрыгание стаи | pf2e-remaster | 1 | Нет кубиков 1d8 |
| 2 | pf2e-warping-pull | Warping Pull | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-warriors-regret | Воинское раскаяние | pf2e-remaster | 1 | Короткое; Нет кубиков 1d8,2d8,4d8; Проверить критические исходы |
| 2 | pf2e-watchdog | Watchdog | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-water-breathing | Дыхание под водой | pf2e-remaster | 4 | — |
| 2 | pf2e-water-walk | Хождение по воде | pf2e-remaster | 4 | — |
| 2 | pf2e-waterproof | Водонепроницаемость | pf2e-remaster | 4 | — |
| 2 | pf2e-web | Паутина | pf2e-remaster | 2 | Короткое; Проверить критические исходы |
| 2 | pf2e-with-friends-like-these | With Friends like These | pf2e-remaster | 3 | Нет RU |
| 2 | pf2e-worms-repast | Корм для червей | pf2e-legacy | 2 | Короткое; Проверить критические исходы |
