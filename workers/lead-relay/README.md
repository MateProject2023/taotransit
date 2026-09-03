# taotransit-lead-relay

Cloudflare Worker — прослойка между формой сайта и **Telegram**. Полное описание
маршрута, контракта и граблей — в `FORM.md` в корне репозитория.

**amoCRM через воркер не ходит и ходить не должен.** Это российский сервис;
маршрут через Cloudflare добавил бы только латентность и вторую точку отказа.
Ограничение зашито в `LEAD_CHANNELS: "telegram"` — даже запрос, явно просящий
здесь `amo`, будет отсечён (`resolveChannels`).

**Воркер выкатывается вручную.** CI сайта (Vercel) о нём не знает.

## Нужен ли он вообще на Vercel

Изначально воркер решал одну задачу: сайт mate стоит на VPS в РФ, откуда Telegram
может быть недоступен. taotransit живёт на Vercel — оттуда Telegram доступен
напрямую, поэтому **воркер здесь опционален**.

- `PUBLIC_LEAD_RELAY_URL` пуст → форма шлёт один запрос на `/api/lead`, и сервер
  везёт оба канала. Это рабочая схема по умолчанию, Cloudflare не нужен вовсе.
- `PUBLIC_LEAD_RELAY_URL` задан → Telegram уходит через воркер, amoCRM — через
  сервер, параллельно. Второй маршрут до Telegram на случай, если Vercel-функция
  до `api.telegram.org` не дойдёт.

Разворачивать имеет смысл, если сайт когда-нибудь переедет на VPS в РФ
(`CLAUDE.md` § Hosting: запасной вариант — Timeweb) — тогда воркер становится
обязательным, а код уже готов.

## Схема

```
браузер (форма) — два параллельных запроса
   ├─► https://taotransit-lead-relay.<account>.workers.dev  {channels:["telegram"]}
   │        └────► Telegram
   └─► https://taotransit.com/api/lead                      {channels:["amo"]}
            └────► amoCRM (Неразобранное), напрямую

если воркер не ответил или вернул retryable:true
   └─► https://taotransit.com/api/lead   {channels:["telegram"], via:"fallback"}
            └────► Telegram с сервера
```

Логика доставки общая — `src/lib/lead.js` в корне репозитория; воркер и
Astro-роут бандлят один и тот же файл, копий нет.

⚠️ **Двойной деплой.** Правка `src/lib/lead.js` требует и выкатки сайта,
и `npm run deploy` отсюда. Забыл вторую — приёмники молча разъехались.

**Про дубли:** повторять или нет — решает воркер, а не клиент: он возвращает в теле
`retryable`. `true` ставится только когда не доставлено **ни в один** канал (HTTP 502),
то есть дублировать заведомо нечего. Если Telegram прошёл, а amoCRM упала, ответ
будет `200` + `retryable: false` (заявка не потеряна), ошибка уйдёт в логи.

## Первый деплой

```bash
cd workers/lead-relay
npm install
npx wrangler login          # откроет браузер, нужен доступ к аккаунту Cloudflare

# секреты (в git их нет и быть не должно) — оба про Telegram
npx wrangler secret put TG_BOT_TOKEN
npx wrangler secret put CHAT_ID

npm run deploy
```

**`AMO_*` сюда класть не нужно** — они живут в переменных проекта на Vercel,
потому что в amoCRM ходит только серверный роут.

⚠️ **Первые ~1–3 минуты после самого первого деплоя новый поддомен отвечает
`SSL handshake failure`** — Cloudflare ещё выпускает для него сертификат. DNS при этом
уже резолвится, а TCP встаёт, так что со стороны это неотличимо от блокировки по SNI.
Не диагностировать, просто подождать и повторить.

После деплоя wrangler напечатает URL вида
`https://taotransit-lead-relay.<account>.workers.dev`. Его нужно положить в
переменные проекта Vercel как `PUBLIC_LEAD_RELAY_URL` **до сборки**
(`PUBLIC_*` вшивается в бандл на этапе `astro build`) и пересобрать сайт.

## Переменные

| Имя | Где | Обяз. | Назначение |
|---|---|---|---|
| `TG_BOT_TOKEN` | секрет CF | да | токен бота Telegram — **тот же, что у mate** |
| `CHAT_ID` | секрет CF | да | **новая** беседа под заявки TAO, не та, где сидят заявки mate |
| `CHAT_THREAD_ID` | секрет CF | — | id темы, если беседа с включёнными темами (форум) |
| `LEAD_CHANNELS` | `wrangler.jsonc` | — | `telegram`. Потолок разрешённых каналов; менять только вместе со схемой |
| `OUTBOUND_TIMEOUT_MS` | `wrangler.jsonc` | — | `3000` — клиент ждёт воркер 4 с; дефолт модуля `8000` остаётся у сервера |
| `LEAD_ALLOWED_ORIGINS` | `wrangler.jsonc` | — | добавочные origin-ы через запятую (превью-домен Vercel) |

Локальная разработка: положи `TG_BOT_TOKEN` и `CHAT_ID` в `workers/lead-relay/.dev.vars`
(файл в `.gitignore`) и запусти `npm run dev`.

## Проверка

```bash
# health-check — без секретов в ответе
curl https://taotransit-lead-relay.<account>.workers.dev

# тестовая заявка (Origin обязателен, иначе 403)
curl -i -X POST https://taotransit-lead-relay.<account>.workers.dev \
  -H 'Origin: https://taotransit.com' \
  -d '{"channels":["telegram"],"name":"Тест","email":"t@example.com","phoneNumber":"+70000000000","lang":"ru","companyType":"Проверка","formPage":"https://taotransit.com/?utm_source=test"}'

# живые логи
npm run tail
```

Ответ `{"ok":true,"telegram":"ok","amo":"off","delivered":1}` — норма: заявка ушла
в Telegram, а `amo: "off"` означает «этому приёмнику канал не разрешён» (и не должен).
`"skipped"` — другое: канал разрешён, но не настроен (нет секретов).

## Защита

- **Origin allowlist** — список в `src/lib/lead.js` (`ALLOWED_ORIGINS`) плюс
  `LEAD_ALLOWED_ORIGINS`, общий с серверным роутом. Запрос без `Origin` или
  с чужим origin получает `403`.
- **Rate limit** — биндинг `LEAD_LIMITER`, 5 запросов с IP в минуту (`wrangler.jsonc`).
  Ответ `429` несёт `retryable: false`, поэтому форма не уходит на серверный фолбэк:
  у роута своего лимита нет, и иначе он обходился бы одним лишним запросом.
  **Лимит ограничивает только форму** — прямой POST на `/api/lead` его не знает.
- Секреты живут только в Cloudflare (`wrangler secret put`), в `wrangler.jsonc` их нет.
