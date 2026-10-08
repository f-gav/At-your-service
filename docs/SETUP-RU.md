# At your service — первая установка

Этот файл предназначен владельцу проекта. **Никакие приватные ключи, Google Client Secret, пароли или Supabase `service_role` не присылай в чат и не размещай в GitHub.**

## Шаг 1. Репозиторий GitHub

Репозиторий уже создан: https://github.com/f-gav/At-your-service . Этот проект отдельный от WreckTrack.

Будущий адрес сайта: **https://f-gav.github.io/At-your-service/** (появится после настройки GitHub Pages и успешной публикации).

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
2. После входа создай персонажа любой из трёх систем.
3. Заполни имя, концепцию и заметки; нажми **«Сохранить»**.
4. Перезагрузи страницу и убедись, что лист остался на месте.
5. Войди с того же Google-аккаунта на втором устройстве — персонаж должен загрузиться.
6. Выйди и зайди с другого Google-аккаунта — чужие листы не должны отображаться.

**Важно:** Это первоначальный функциональный черновик. Готовые игровые поля из оригинальных бумажных листов пока намеренно не реализованы — дождёмся твоих макетов для D&D, Pathfinder и Vampire. Сейчас сохраняются текстовые черновики.

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
