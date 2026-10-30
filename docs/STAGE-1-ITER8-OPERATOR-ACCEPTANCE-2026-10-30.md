# Этап 1 · Итерация №8 — операторская приёмка Windows 11

Дата: 30 октября 2026. Этот документ описывает **допуск к настоящему восстановлению**, а не подтверждает, что оно уже произошло.

**Production не трогать:** в проекте остаются данные игроков, тестовая локальная копия не должна быть доступна из сети. Нельзя присылать дампы, JWT, PGPASSWORD, URL с секретами или файлы персонажей в чат.

## Что улучшено по сравнению с PR #66

1. `backup` сохраняет SHA-256 **каждого объекта Storage**, помимо хешей SQL-дампов. Ранее промежуточная порча скачанного портрета могла остаться незамеченной до восстановления.
2. `inspect` проверяет весь комплект `source.json`, `db-digests.json`, `storage-digests.json`, четыре SQL-дампа и все файлы Storage **без подключения к базе и без запуска Docker**. Восстановление начинается только после успешной проверки.
3. `scripts/recovery-acceptance-report.mjs` выводит только статусный отчёт, пригодный для передачи без частных данных и имён пользователей. При успешном локальном JWT-тесте сохраняется приватная отметка `local-e2e-pass.json` **без JWT/ID**.
4. Добавлена независимая проверка `tests/local-recovery-safety.mjs` на `windows-latest`. Deploy требует успешных build, PostgreSQL и Windows job.
5. Старые архивы, созданные до появления `storage-digests.json`, этим способом **не будут приняты**. Не редактируйте проверку вручную: лучше создать новый согласованный архив.

## Windows 11 — порядок безопасного запуска

Нужны Docker Desktop (Linux containers), PostgreSQL CLI, Node.js 22+, Supabase CLI **2.122.0** и репозиторий с последними изменениями. На Windows используйте PowerShell от своего пользователя; административные права на Git не требуются.

Рабочая папка репозитория: `C:\At-your-service` — это **пример**, не обязательный путь. Архив — только в отдельной закрытой папке **за пределами репозитория, OneDrive и общих папок**.

### Шаг 1. Preflight — без секретов и без работы с производственной базой

В PowerShell в корне репозитория:

```powershell
$env:AYS_RECOVERY_ROOT = 'C:\AYS-Private-Recovery\snapshot-001'
$env:AYS_SOURCE_PROJECT_REF = 'cvimyqmksxeigjnofexf'
node scripts/local-recovery.mjs preflight
```

Ожидается `PASS: pinned CLI 2.122.0, Docker and recovery commands available`.

Если FAIL — **не запускайте backup**, сначала устраните ошибку (Docker, PATH, несовпадение версии). Эта команда не доказывает наличие правильного удалённого подключения и не проверяет, что архив будет успешно восстановлен.

### Шаг 2. Backup — только чтение production

Один раз выполните локально `supabase login` и `supabase link --project-ref cvimyqmksxeigjnofexf`. В `$env:PGHOST`, `$env:PGPORT`, `$env:PGDATABASE`, `$env:PGUSER`, `$env:PGPASSWORD` укажите параметры **конкретно At your service!** из Supabase Connect. `$env:PGSSLMODE = 'require'`. Пароль вводите локально (пример безопасного ввода — в [инструкции этапа 7](STAGE-1-ITER7-WINDOWS-2026-10-30.md)).

Перед снимком **остановите редактирование пользователями** на время дампа и копирования Storage: автоматическая сверка до/после обнаруживает изменения исходного содержимого, но не гарантирует атомарную точку времени для раздельных вызовов CLI.

```powershell
node scripts/local-recovery.mjs backup
```

Ожидается `PASS: export completed and pre/post inventories match. NOT YET A VERIFIED RESTORE.`

Если экспорт прерван, **не запускайте снова в той же папке**: этот каталог неполон. Выбирайте новый уникальный пустой `AYS_RECOVERY_ROOT`. Настоящие данные и секреты НЕ должны попадать в GitHub.

### Шаг 3. Inspect — архива, без Docker и без соединения с Supabase

```powershell
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
node scripts/local-recovery.mjs inspect
```

Ожидается `PASS: private DB+Storage archive hashes and manifest match (restore NOT YET tested)`.

FAIL означает **недостоверный архив**: не отключать контрольные суммы и не менять исходные SQL-файлы, а выяснить причину и при необходимости создать новый снимок.

### Шаг 4. Restore — только в локальном Docker

```powershell
node scripts/local-recovery.mjs restore
```

Скрипт сначала повторно выполняет `inspect`, только потом создаёт локальный Docker-проект. Его PostgreSQL закреплён на `127.0.0.1:54322`. Он не использует `supabase link` и не применяет SQL к удалённой базе.

Ожидается `PASS: local DB row fingerprints and private Storage SHA-256 match.`

Важное ограничение: мы пока **не выполнили** этот импорт реального бэкапа на Windows и не доказали, что managed `auth` совместима со схемами конкретной локальной версии. Если PostgreSQL сообщает конфликт ролей, несовпадение колонок Auth, дублирование ключей или ошибку RLS, **остановитесь и используйте приватный диагностический лог для локального анализа**. Не редактируйте production или проверочные хеши ради прохождения.

### Шаг 5. JWT — только на восстановленной копии

```powershell
node scripts/local-jwt-e2e.mjs
```

Ожидается `PASS: real local Supabase two-JWT Auth/RLS/Storage/negative RPC tests`.

Создаются синтетические аккаунты только в локальном Supabase Auth, проверяются ограничения по персонажам, комнатам, портретам и отказ RPC. После PASS появляется закрытый локальный файл `local-e2e-pass.json`, в нём нет секретов.

Это **не тест Google OAuth** и не доказательство восстановления всех управляемых компонентов Supabase (SMTP, JWT signing configuration, edge functions и т. д.).

### Шаг 6. Безопасный отчёт, который можно показать в переписке

```powershell
node scripts/recovery-acceptance-report.mjs
```

Вывод содержит только следующее (настоящие значения зависят от результата):

```text
At your service! / Stage 1 / operator acceptance
PREFLIGHT: OPERATOR_CHECK_REQUIRED
BACKUP: PASS
RESTORE: PASS
LOCAL_TWO_JWT_E2E: PASS
GOOGLE_OAUTH_E2E: NOT_RUN
PRODUCTION_RATE_LIMIT: NOT_INSTALLED
No private values are included in this report.
```

**Это пример формата, а не выполненные результаты.** Рекомендуется присылать только эти семь строк. Полные stdout/stderr, пути к файлам, `supabase status -o env`, `supabase link` и JWT не присылать: они могут содержать секреты. Если оператору необходимо сообщить об ошибке, достаточно написать название шага и безопасно отредактированное сообщение, без трассировки с приватными данными.

## Чек-лист закрытия этапа 1

- [ ] Preflight реально пройден на Windows 11.
- [ ] Получен согласованный DB+Auth+Storage backup и прошёл inspect.
- [ ] Этот архив восстановлен в Docker, сравнение SQL-строк и Storage SHA-256 = PASS.
- [ ] Два непривилегированных локальных Auth JWT и отрицательные RPC = PASS.
- [ ] Вручную приняты Google OAuth и восстановимость внешней конфигурации.
- [ ] Серверные rate limits спроектированы, tested PostgreSQL, но **не установлены в production** до пункта восстановления и решения по откату.

До завершения операторской проверки считать этап 1 **открытым**, не обещать полной защищённости пользовательских данных.

Правило Rooms V2: **один персонаж — одна комната**. Эта правка отложена.
