# Этап 1 · Итерация № 7 — надёжность локального восстановления

Дата: 30 октября 2026. PR — только инструменты, тесты и документация. **Никаких изменений рабочей Supabase.**

## Найденные проблемы после PR #65

1. Клиент PostgreSQL мог получить из окружения `PGHOSTADDR` или `PGSERVICE` и подключиться не к ожидаемой базе, несмотря на `PGHOST`. Для restore и локального JWT E2E теперь создаётся чистое окружение, удаляются альтернативные настройки libpq, а `psql` получает явные `-h 127.0.0.1 -p 54322`. Фактический `DB_URL` из `supabase status -o env` обязан указывать на этот адрес.
2. `supabase storage cp -r` может сохранить объектную иерархию сразу в папку назначения либо внутри подпапки bucket. Теперь скрипт поддерживает оба расположения, проверяет общее число файлов и не принимает неполный перенос. Пустой bucket тоже поддерживается.
3. В локальную Supabase не переносились RLS-политики схемы `storage`: стандартный `supabase db dump` исключает managed-схемы. Добавлен **только локальный** файл `supabase/proposals/local-restore-portrait-storage.sql`, воссоздающий private bucket и три текущие политики. Перед экспортом и после местного восстановления `supabase/storage-source-guard.sql` обязан вернуть `PASS`; этот read-only SQL выполнен на рабочей БД, конфигурация совпала.
4. E2E использовал PNG по невалидному пути. Для настоящей проверки RLS теперь создаётся тестовый WebP по реальному формату `<user-id>/<character-id>/<32-hex>-source.webp` (bucket разрешает только `image/webp`, лимит 450000).
5. Версия CLI ранее не фиксировалась. Сценарий проверен на документации и требует `Supabase CLI 2.122.0`; `preflight` проверяет командные флаги. GitHub Actions дополнительно проверяет реальный бинарный CLI через `npx supabase@2.122.0 --help`.
6. Для доступа к удалённой БД требуется TLS (`PGSSLMODE=require` или строже). Локальные обращения не наследуют remote-токены. Перед локальным JWT E2E сверяются данные `restored.json` с текущим состоянием восстановленной БД.

## Windows 11: безопасный пошаговый запуск

**Не передавайте в чат** пароль PostgreSQL, access token Supabase CLI, private JWT, SQL-дамп, файлы персонажей и Storage. Файлы хранятся только в закрытой локальной директории вне репозитория и OneDrive. Рекомендуется BitLocker.

### A. Установка и проверка — без подключения к production

Установить [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) с Linux Containers, Node.js 22+, PostgreSQL 17 CLI и [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started). Закреплённая версия — **2.122.0**. Пакет из [релизов CLI](https://github.com/supabase/cli/releases/tag/v2.122.0), либо инструмент установки, поддерживающий указанную версию. Не обойти контроль несовпадения версии без повторной проверки флагов.

В PowerShell в папке репозитория:

```powershell
$env:AYS_RECOVERY_ROOT = 'C:\AYS-Private-Recovery\snapshot-001'
$env:AYS_SOURCE_PROJECT_REF = 'cvimyqmksxeigjnofexf'
node scripts/local-recovery.mjs preflight
```

Ожидаемый результат — `PASS`. Если Docker не запущен, CLI несовместим или отсутствует `psql`, скрипт завершится ошибкой **до работы с данными**.

### B. Источник — безопасное подключение и резервирование

В корне репозитория, убедившись, что открыта именно база **At your service!**, не WreckTrack:

```powershell
supabase login
supabase link --project-ref cvimyqmksxeigjnofexf
```

Адрес подключения для `PGHOST`, `PGPORT`, `PGUSER` узнать в Dashboard → Project → Connect. Использовать отдельное окно PowerShell, не вставлять пароль в командную строку или git.

```powershell
$env:PGHOST = '<database host from Dashboard>'
$env:PGPORT = '5432'
$env:PGDATABASE = 'postgres'
$env:PGUSER = '<database user from Dashboard>'
$env:PGSSLMODE = 'require'
$secure = Read-Host 'Database password' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
node scripts/local-recovery.mjs backup
```

Это read-only дампы и скачивание Storage из привязанного проекта. Перед началом лучше на короткое время остановить редактирование персонажей, чтобы избежать разных версий данных между дампами. Автоматическая сверка до/после снижает риск, **но не доказывает строгую атомарную согласованность транзакций**.

Если любой шаг завершился ошибкой, папка содержит **непроверенный/неполный архив**. Не пытаться восстановить его как достоверный, не запускать повторно поверх него. Разобраться с ошибкой и использовать новую пустую папку.

Для завершения удалить переменные секретов:

```powershell
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
```

### C. Восстановление — только изолированная Supabase в Docker

```powershell
node scripts/local-recovery.mjs restore
```

Скрипт создаёт **новую** папку `local-only`, запускает отдельную Supabase, проверяет `DB_URL` на `127.0.0.1:54322`, проверяет SHA-256 SQL-дампов, импортирует данные, восстанавливает конфигурацию private bucket и объектные байты через Storage API. Затем сравнивает строки восьми таблиц, 11 счётчиков, 9 показателей целостности, пути файлов и SHA-256.

При несоответствии схем Auth, SQL, Storage и версий Supabase операция должна **остановиться**. Нельзя ослаблять сравнение и нельзя направлять восстановление в production.

**Ограничение:** восстановление байтов через Storage API не гарантирует сохранение всех служебных полей managed `storage.objects` (например, исходного `created_at`). Это тест восстановления прикладных данных, Auth и файлов, а не идентичности всей внутренней платформы Supabase.

### D. Проверка двух аккаунтов — только после PASS восстановления

```powershell
node scripts/local-jwt-e2e.mjs
```

Два случайных аккаунта создаются **в локальном Supabase Auth**. Проверяется реальный вход по JWT, доступ к собственному персонажу, отсутствие чужих персонажей, комнат и журнала, приватность WebP, отклонение попытки выполнить чужие RPC. В финале SQL-квоты применяются только к `127.0.0.1:54322`; production не затрагивается.

Локальные email/password не являются проверкой Google OAuth; её потребуется принять отдельно в безопасной тестовой среде.

## Отдельные условия закрытия этапа 1

- [ ] Реальный оператор успешно прошёл `preflight`, `backup`, `restore` и `local-jwt-e2e`.
- [ ] Подтверждён согласованный архив PostgreSQL + Auth + приватный Storage и зафиксированы SHA-256.
- [ ] Отдельно проверены конфигурация OAuth и расширения Supabase, не входящие в дамп.
- [ ] Получено доказательство безопасности прикладных REST/RPC сценариев в восстановленной среде.
- [ ] Только после этого возможно внедрение серверного rate limiting в production с планом отката.

**Статус на момент коммита:** SQL read-only сверка production Storage выполнена; остальные проверки с настоящими пользовательскими данными и Docker на ПК пользователя пока **NOT RUN**. Ни одна продуктивная миграция не применена.

**Правило будущей модели комнат:** один персонаж принадлежит только одной комнате, правка откладывается до Rooms V2.
