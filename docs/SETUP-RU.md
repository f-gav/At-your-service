# At your service! — установка и эксплуатация (релиз 0.2)

Этот файл предназначен владельцу проекта. **Никакие приватные ключи, Google Client Secret, пароли или Supabase `service_role` не присылай в чат и не размещай в GitHub.**

## Шаг 1. Репозиторий GitHub

Репозиторий уже создан: https://github.com/f-gav/At-your-service . Этот проект отдельный от WreckTrack.

Рабочий адрес сайта: **https://f-gav.github.io/At-your-service/**. Проверяй успешность публикации в GitHub Actions.

## Шаг 2. Отдельный проект Supabase

1. Открой https://supabase.com/dashboard и создай отдельный проект для At your service (не используй базу WreckTrack, чтобы не смешивать данные).
2. В **SQL Editor** вставь и выполни файл **`supabase/schema.sql`**.
3. В **Project Settings → API** (названия меню могут немного отличаться) найди **Project URL** и **publishable key** (или legacy `anon public` key).
4. В GitHub-репозитории открой **Settings → Secrets and variables → Actions → Variables** и добавь:
   - `VITE_SUPABASE_URL` = Project URL, например `https://xyz.supabase.co`;
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_...` (или `anon public` key).

Эти **два значения предназначены для браузера и будут публичны**. Защита данных обеспечивается SQL-политиками Row Level Security. **Не используй `service_role` / secret keys!**

## Шаг 3. Вход через Google

1. Открой https://console.cloud.google.com/ и создай отдельный Google Cloud проект (можно использовать существующий, если он твой).
2. В разделе **Google Auth Platform** настрой **Branding** (имя приложения **At your service**) и **Audience**. Для личного тестирования используй External в режиме Testing и добавь Google-аккаунт в Test users; для открытого входа позднее понадобится опубликовать OAuth-приложение. Точный набор шагов Google может менять.
3. В разделе **Clients** создай OAuth Client ID типа **Web application**.
4. **Authorized JavaScript origins**: `https://f-gav.github.io` (без `/At-your-service/`). Если будешь тестировать локально, добавь `http://localhost:5173`.
5. **Authorized redirect URIs**: укажи **Supabase Callback URL**, показанный в Supabase → Authentication → Sign In / Providers → Google, обычно `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`. **Здесь НЕ URL GitHub Pages!**
6. Полученные **Client ID** и **Client Secret** вставь **только в настройки Google-провайдера в Supabase**, включи Google и сохрани. Secret не нужен на сайте и не должен попадать в GitHub.

## Шаг 4. Разрешённый адрес после входа

В Supabase зайди в **Authentication → URL Configuration**:

- **Site URL** = `https://f-gav.github.io/At-your-service/`
- **Redirect URLs**: добавь `https://f-gav.github.io/At-your-service/`
- Для локального теста дополнительно разреши `http://localhost:5173/**`.

Здесь нужен точный конечный адрес сайта. После переезда на собственный домен эти значения нужно будет обновить.

## Шаг 5. GitHub Pages

1. Открой **Settings → Pages** нового GitHub-репозитория.
2. В разделе **Build and deployment → Source** выбери **GitHub Actions**.
3. После загрузки файлов в `main` автоматически запустится workflow **Deploy to GitHub Pages** (`.github/workflows/deploy.yml`).
4. Проверь его в **Actions**. После зелёного статуса сайт должен открываться по `https://f-gav.github.io/At-your-service/`.
5. Если сначала настроен Pages, но переменные Supabase ещё не заданы, главная страница появится с предупреждением о настройке; Google-вход до настройки не заработает. После изменения GitHub Variables перезапусти workflow через Actions → Deploy to GitHub Pages → Run workflow.

## Шаг 6. Проверка

1. Открой сайт и нажми **«Войти через Google»**.
2. После входа создай персонажа **Pathfinder 2e** или **Project Moon** (D&D и VtM пока недоступны для создания).
3. Заполни лист, дождись индикатора успешного автосохранения; при ошибке проверь локальный черновик и кнопку повтора.
4. Перезагрузи страницу и убедись, что лист остался на месте.
5. Войди с того же Google-аккаунта на втором устройстве — персонаж должен загрузиться.
6. Выйди и зайди с другого Google-аккаунта — чужие листы не должны отображаться.

**Важно:** Pathfinder 2e и Project Moon имеют полноценные игровые листы; D&D и Vampire пока планируются. Параллельное редактирование на разных устройствах и гарантированная офлайн-синхронизация не реализованы.

## Локальный запуск (необязательно)

```bash
npm install
cp .env.example .env.local
# В .env.local вставь только Project URL и public/publishable key
npm run dev
```

Адрес локального сайта обычно `http://localhost:5173/At-your-service/`. Google OAuth должен иметь этот адрес в Redirect URLs Supabase, а `http://localhost:5173` — в Google Authorized JavaScript origins.

## Если вход не работает

- `redirect_uri_mismatch`: проверь **Supabase callback URL** в Google Cloud (это не URL GitHub Pages).
- Google сообщает, что приложение тестовое: добавь адрес своей почты в **Test users** на стороне Google Auth Platform.
- После входа пусто или `42501`: проверь, что `supabase/schema.sql` выполнен полностью, а имя таблицы — `public.characters`.
- В браузере написано «Подключение аккаунтов ещё не настроено»: в GitHub Actions Variables отсутствует хотя бы одно публичное значение либо не перестроен сайт.
- После создания GitHub Pages возвращает 404: убедись, что название репозитория и Vite base path совпадают **`At-your-service`**.

Официальные инструкции: https://supabase.com/docs/guides/auth/social-login/auth-google , https://supabase.com/docs/guides/auth/redirect-urls , https://vite.dev/guide/static-deploy.html


## Шаг 7. Безопасность рабочей базы и резервные копии (релиз 0.2)

Перед любыми операциями с существующим проектом Supabase:

1. Проверь в **Database → Backups** доступные для твоего тарифа автоматические копии и варианты восстановления. Наличие этой функции и её периодичность зависят от плана. При отсутствии управляемого восстановления готовь собственную резервную копию PostgreSQL безопасным инструментом и **храни её вне публичного репозитория**.
2. Проверь резервирование таблиц `public.characters`, `public.sheet_admins`, `public.sheet_templates`, `public.sheet_template_drafts`, `public.sheet_template_history` и всех применённых миграций. Экспорт отдельных персонажей в JSON **не покрывает** шаблоны, пользователей и полную историю.
3. Отдельно сохрани **приватные** файлы `storage.objects` из bucket `character-portraits` через разрешённый администраторский способ. Выгрузка PostgreSQL сама по себе **не содержит байты файлов** Storage.
4. Проверь, что копия действительно читается, и выполни пробное восстановление **в изолированном тестовом проекте**, не в рабочем. Сверь количество персонажей и версий шаблонов, доступность портретов, права доступа и корректность JSON.
5. Зафиксируй дату, объём, контрольные суммы, место хранения и способ восстановления. Никогда не размещай дампы пользователей, портреты, OAuth-токены и секреты в GitHub, комментариях к PR или артефактах публичного CI.

**Граница текущего аудита:** исходные SQL-миграции в GitHub можно проверить без доступа к реальным данным. Но их применение, фактические RLS-политики, резервные копии и возможность восстановления должны быть подтверждены владельцем активного проекта Supabase.

## Шаг 8. Проверка изоляции аккаунтов

В тестовой среде с двумя отдельными аккаунтами A и B проверь:

- A видит и редактирует только собственных персонажей; B не может прочитать, изменить, удалить или переставить их через API.
- B не может загрузить, скачать или удалить файлы портретов A, даже если известен Storage path.
- Обычный пользователь не может изменить `sheet_templates`, `sheet_template_drafts` или `sheet_template_history` и вызвать административную публикацию.
- Права администратора заданы через `public.sheet_admins` и проверяются серверным RLS/RPC; скрытие элементов интерфейса само по себе не является авторизацией.
- Повторный импорт JSON создаёт нового персонажа, не заменяет чужие данные и не импортирует `user_id` из файла.

Проверять эти сценарии нужно с **непривилегированным** ключом пользователя, а не через SQL Editor/service_role (они могут обходить RLS).

## Шаг 9. Регрессионная проверка релиза

```bash
npm install --no-audit --no-fund
npm run test:models
npm run build
npx playwright install chromium
npm run test:pdf-browser
npm run test:pf-alternative-browser
npm run test:spell-library-browser
node tests/routes-static-browser.mjs
```

После коммита дождись **обоих** успешных заданий `build` и `deploy` в `.github/workflows/deploy.yml`. Зелёная локальная сборка или один успешный job не доказывают публикацию сайта.
