# Приём заявок: Telegram + amoCRM

Механика внутрянки формы. Перенос рабочей интеграции с **matestrade.com** (Next.js 14) на этот
проект (Astro 7). Текст самодостаточен — исходники приведены целиком, доступ к репозиторию `mate`
не нужен.

**Что уже сделано:** фронт формы (этап 1). **Что не сделано:** ни одного приёмника — ни воркера,
ни серверного эндпоинта, ни секретов. Пока их нет, форма работает в демо-режиме (см. § 1).

Смежные документы: `PLAN.md` — этапы проекта, `DESIGN.md` § 5 — внешний вид полей и § 6 — почему
второй канал вообще появился, `CLAUDE.md` § «The form» — решения по боту и воронке.

---

## 1. Что уже стоит на фронте

| Файл | Роль |
|---|---|
| `src/components/LeadForm.astro` | секция `#lead` — последняя на странице, сюда ведут все призывы. Состояния: покой / отправка / успех / ошибка |
| `src/scripts/lead.ts` | сбор тела запроса, метки, два параллельных запроса, добор через фолбэк, демо-режим |
| `src/components/Select.astro` + `src/scripts/select.ts` | свой список «Что нужно» вместо нативного `<select>` |
| `src/content/landing.ts` → `leadForm`, `ctas` | текст формы, подписи полей, варианты списка и подписи парных кнопок |
| `src/content/legal.ts` + `src/components/LegalDocs.astro` | документы, на которые ссылается строка согласия под кнопкой |

Клиент уже собирает и шлёт **полное тело** по контракту § 4 — включая `requestId`, все
11 рекламных меток и `_ym_uid` из cookie Метрики. Ничего дописывать на фронте под этап 2
не придётся: нужны только адреса приёмников.

### Демо-режим

```js
const DEMO = !RELAY_URL && !ORIGIN_URL
```

Если ни `PUBLIC_LEAD_RELAY_URL`, ни `PUBLIC_LEAD_ORIGIN_URL` не заданы на сборке, `lead.ts`
**не делает ни одного запроса**: показывает экран успеха и пишет в консоль
`форма в демо-режиме: приёмник не настроен, заявка никуда не ушла`.

⚠️ Это ровно то, что происходит на превью-сборке сейчас. Если заказчик тестирует форму до этапа 2 —
предупредить: заявка не придёт никуда. Режим выключается сам, как только в `.env` появляется хотя бы
один адрес; отдельной правки кода не требуется.

### Honeypot

В форме есть скрытое поле `company` (вне потока, `tabindex="-1"`, `autocomplete="off"`). Заполнено —
клиент показывает успех и молча не отправляет. Приёмники о поле не знают и знать не должны:
`normalizeLead` игнорирует неизвестные ключи.

---

## 2. Маршрут заявки

Браузер шлёт **два независимых запроса параллельно**. Это не фолбэк-цепочка, а сознательное
разделение каналов по приёмникам:

```
браузер (форма) — два параллельных запроса
   ├─► Cloudflare Worker            {channels:["telegram"]}   таймаут клиента 4 с
   │        └────► api.telegram.org
   └─► серверный эндпоинт сайта     {channels:["amo"]}        таймаут клиента 9 с
            └────► amocrm.ru (Неразобранное), напрямую

если воркер не ответил или вернул retryable:true
   └─► серверный эндпоинт сайта     {channels:["telegram"], via:"fallback"}
            └────► api.telegram.org
```

| Канал | Маршрут | Причина |
|---|---|---|
| Telegram | браузер → Cloudflare Worker | изолирует отправку от возможной блокировки Telegram на российском хостинге; там же rate limit |
| amoCRM | браузер → серверный эндпоинт сайта → `amocrm.ru` | amoCRM — российский сервис, сервер в РФ отвечает ему за ~0.5 с. Хоп через Cloudflare добавил бы только латентность и вторую точку отказа |

Разделение **закреплено в конфиге, а не в договорённости**: у воркера стоит `LEAD_CHANNELS: "telegram"`,
и `resolveChannels()` пересекает запрошенное клиентом с этим потолком. Даже клиент, попросивший
у воркера `amo`, получит отказ по этому каналу.

**Вся логика доставки живёт в одном изоморфном модуле** `src/lib/lead.js`, который бандлят оба
приёмника — и серверный роут сайта, и воркер. Копий нет, поэтому формат сообщения, набор полей и
нормализация телефона совпадают, каким бы маршрутом заявка ни пришла.

Цена решения: модуль обязан оставаться изоморфным — никаких `fs`, `path`, `node:*`, серверных
импортов фреймворка и алиасов сборщика (`@/…`, esbuild в wrangler их не резолвит). Только
Web API: `fetch`, `URL`, `AbortSignal`, `JSON`.

⚠️ **Двойной деплой.** Правка общего модуля требует ДВУХ выкаток: деплой сайта И ручной
`wrangler deploy` из папки воркера. Воркер не подхватывается CI сайта. Забыл вторую — приёмники
молча разъехались.

---

## 3. Что отличается от mate

Всё, чего нет в таблице, переносится без изменений.

| Что | Где | Действие |
|---|---|---|
| `TG_BOT_TOKEN` | секрет нового воркера | **решение принято, токена нет.** Берём бота, который уже стоит на сайте, — `@taotransit_bot`. Токен запрашивается у заказчика через BotFather. См. предупреждение в § 6 |
| `CHAT_ID` | секрет нового воркера | **новое** — id отдельной беседы, НЕ той, в которой боту пишут клиенты |
| `AMO_PIPELINE_ID` | `.env` сервера | **новое** — id новой воронки. Аккаунт тот же, `mategrouptrade` |
| `AMO_SUBDOMAIN`, `AMO_LONG_TOKEN` | `.env` сервера | без изменений (аккаунт тот же, токен живёт до 5 лет) |
| `AMO_SOURCE_NAME`, `AMO_SOURCE_UID`, `AMO_FORM_ID` | `.env` сервера | **новое** — задать явно, иначе заявки TAO неотличимы от заявок mate в одном аккаунте |
| `AMO_ANSWER_FIELD` | `.env` сервера | решить: переиспользовать `FORM_ANSWER` или завести своё поле. Без переменной ответ живёт только в названии сделки и в тексте Telegram |
| `ALLOWED_ORIGINS` | `src/lib/lead.js` | **правка** — `https://taotransit.com`, `http://taotransit.com`, адрес превью и `http://localhost:4321` (порт Astro dev) |
| `name`, `namespace_id` | `wrangler.jsonc` | **правка** — `taotransit-lead-relay` и свой `namespace_id`, иначе перезапишется воркер mate |
| `PUBLIC_LEAD_RELAY_URL` | `.env` сборки | **новое** — URL нового воркера, нужен ДО сборки |
| счётчик Метрики и цель | `src/scripts/lead.ts` | **правка** — у mate это `ym(98008761, 'reachGoal', 'sendForm')`. У TAO своего счётчика пока нет (см. `CLAUDE.md` § Analytics), поэтому вызова в коде нет — место помечено комментарием |
| логика доставки, формат TG, payload amo | `src/lib/lead.js` | копируется как есть |

**Почему нужен отдельный воркер, а не тот же.** У воркера mate `CHAT_ID` лежит в секретах одним
значением — он физически не умеет писать в две беседы. Развилку по `Origin` внутри одного воркера
делать не стоит: два сайта начнут делить rate limit, деплой и аптайм. Дешевле поднять второй
воркер из той же папки — `wrangler deploy` с другим `name`.

---

## 4. Контракт запроса

Оба приёмника принимают **одно и то же тело** и прогоняют его через `normalizeLead()`.
Метод `POST`, тело — JSON-строка, **без заголовка `Content-Type`** (см. «Грабли»).

| Поле | Тип | Что делает |
|---|---|---|
| `requestId` | string | UUID заявки. Уходит в amo как `request_id`, помогает опознать технический дубль |
| `name` | string | Имя контакта. Пустое → в amo «Без имени» |
| `email` | string | Поле контакта `EMAIL` (`enum_code: WORK`) |
| `phoneNumber` | string | В любом виде: приёмник вырежет всё кроме цифр и подставит `+` |
| `companyType` | string | Ответ на вопрос формы (у нас — «Что нужно»). Идёт в название сделки и, если задан `AMO_ANSWER_FIELD`, в кастомное поле |
| `lang` | string | Язык страницы. Становится **тегом сделки** в amo и строкой в TG. У нас всегда `ru` |
| `formName` | string | Человеческое имя формы → `metadata.form_name` |
| `formPage` | string | `window.location.href`. Из хоста выводится «с какого сайта заявка», в amo уходит **без query** |
| `referer` | string | `document.referrer` → поле `REFERRER` в amo |
| `channels` | string[] | `["telegram"]` / `["amo"]`. Пересекается с тем, что приёмнику разрешено |
| `via` | string | Только `"fallback"` при доборе; остальное приёмник проставляет сам |
| метки | string | 11 ключей из `TRACKING_KEYS`, плоскими полями в корне тела |

### Ответ приёмника

Клиент **не разбирает HTTP-коды** — решение о повторе принимает приёмник и кладёт его в тело
как `retryable`. Это единственная защита от дублей.

```
200  {"ok":true,  "retryable":false, "telegram":"ok",    "amo":"off", "delivered":1}
502  {"ok":false, "retryable":true,  "telegram":"error", "amo":"off", "delivered":0}
429  {"ok":false, "retryable":false, "error":"rate_limited"}
400  {"ok":false, "retryable":false, "error":"bad_request"}
403  Forbidden          — origin не в allowlist
```

Статусы канала: `ok` — доставлено; `error` — попытались, не вышло (ошибка в логах);
`skipped` — канал запрошен, но секреты не настроены; `off` — приёмнику канал не разрешён вообще
(норма для `amo` в воркере).

⚠️ **Правило, которое нельзя нарушать:** `retryable: true` ставится **только когда не доставлено
ничего** (`delivered === 0`) — тогда дублировать заведомо нечего. Если Telegram прошёл, а amo
упала — ответ 200 и `retryable: false`. Ослабишь правило — каждая икота воркера превратится
в двойное сообщение.

---

## 5. Рекламные метки

Список задан **один раз** в общем модуле и питает трёх потребителей: что клиент читает из URL,
какие строки появляются в Telegram, какие поля заполняются в amoCRM.

```js
export const TRACKING_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign',
  'utm_content', 'utm_term', 'utm_referrer',
  'gclid', 'yclid', 'fbclid', 'roistat',
  '_ym_uid',
]
```

- Первые десять читаются из `URLSearchParams` текущей страницы.
- `_ym_uid` — **не URL-параметр**: клиент берёт его из cookie Яндекс.Метрики, чтобы сделку в CRM
  можно было сшить с визитом. У TAO своего счётчика пока нет, поэтому cookie появится только
  вместе с ним; код читает её заранее и без счётчика просто отдаёт пустую строку.
- В amoCRM метки кладутся **по `field_code`** (ключ в верхнем регистре: `UTM_SOURCE`, `GCLID`,
  `_YM_UID`). Это системные поля типа `tracking_data` — они есть в любом аккаунте изначально,
  маппинг id не нужен, интеграция переезжает между аккаунтами без правок. Проверено на живом
  аккаунте 2026-08-11.
- Пустые метки не отправляются вовсе — ни строкой в TG, ни полем в amo.
- `AMO_UTM_FIELD_IDS` (JSON `{"utm_source":123,…}`) — аварийное переопределение для аккаунта, где
  метки лежат в самодельных полях: задан → `field_id` побеждает `field_code` поштучно.

**Дублирование списка.** `TRACKING_KEYS` объявлен и в `src/lib/lead.js` (сервер и воркер), и в
`src/scripts/lead.ts` (клиент) — импортировать серверный модуль в клиентский бандл нельзя.
Списки обязаны совпадать; при правке править оба.

---

## 6. Telegram

### Формат сообщения

Обычный `sendMessage` без разметки, `disable_web_page_preview: true`:

```
taotransit.com
Язык: ru
Имя: Иван
Email: ivan@example.com
Номер: +79990000000
Ответ на вопрос: Выкуп и доставка

utm_source: yandex
utm_campaign: brand
_ym_uid: 1712...

Страница: https://taotransit.com/?utm_source=yandex
Реферер: https://ya.ru/search
```

Диагностическая строка `⚠ доставлено через fallback · 3f9c1a2b` дописывается **только** когда
маршрут нештатный. Штатные — `worker` (через Cloudflare) и `origin` (воркер не настроен, сервер
везёт оба канала). Короткий `requestId` позволяет отличить технический дубль от человека,
отправившего форму дважды.

### ⚠️ Про бота `@taotransit_bot`

Это **живой консьерж-бот заказчика**, а не служебный. Отсюда два правила:

1. **Никогда не вызывать `setWebhook` / `deleteWebhook` на этом токене.** Бот работает через
   вебхук; его подмена или снятие молча ломает клиентский поток. Исходящий `sendMessage`
   с вебхуком сосуществует — конфликта нет, отправлять безопасно.
2. **Отдельная беседа.** Заявки идут в новую группу, не в ту, где боту пишут клиенты.

Если заказчик не готов отдать токен консьерж-бота — запасной вариант — завести отдельного бота
у BotFather под заявки. Тогда пункт 1 отпадает, а `CHAT_ID` всё равно новый.

### Как получить id новой беседы

1. Добавить бота в беседу и дать право писать.
2. Написать в беседе любое сообщение.
3. `curl "https://api.telegram.org/bot<TOKEN>/getUpdates"` → взять `result[].message.chat.id`.

⚠️ `getUpdates` **нельзя вызывать на боте с активным вебхуком** — Telegram вернёт 409 и, что хуже,
может перехватить апдейт, предназначенный вебхуку. Для `@taotransit_bot` id беседы берётся иначе:
у заказчика из его бекенда, либо временно через отдельного бота, добавленного в ту же группу.

У супергрупп id отрицательный и начинается с `-100` — минус обязателен. Если беседа с включёнными
темами (форум) и писать нужно в конкретную тему, в тело `sendMessage` добавляется
`message_thread_id` — в текущем коде этого нет, добавляется одной строкой в `sendToTelegram()`.

### Переменные воркера

| Имя | Где | Значение |
|---|---|---|
| `TG_BOT_TOKEN` | секрет CF | `@taotransit_bot` (или отдельный бот, см. выше) |
| `CHAT_ID` | секрет CF | новая беседа |
| `LEAD_CHANNELS` | `wrangler.jsonc` | `"telegram"` — потолок разрешённого |
| `OUTBOUND_TIMEOUT_MS` | `wrangler.jsonc` | `"3000"` — клиент ждёт воркер 4 с, доставка дольше никому не отдастся |
| `LEAD_LIMITER` | биндинг `ratelimits` | 5 запросов с IP в минуту. `period` принимает **только 10 или 60** |

Первый деплой:

```bash
cd workers/lead-relay
npm install
npx wrangler login
npx wrangler secret put TG_BOT_TOKEN
npx wrangler secret put CHAT_ID
npm run deploy        # напечатает https://<name>.<account>.workers.dev
```

⚠️ Первые 1–3 минуты после самого первого деплоя новый поддомен `*.workers.dev` отвечает
`SSL handshake failure` — Cloudflare ещё выпускает сертификат. DNS резолвится и TCP встаёт, так что
снаружи это неотличимо от блокировки по SNI. Не диагностировать, просто подождать и повторить.

Rate limit **ограничивает только форму**: прямой POST на серверный эндпоинт его не знает. Именно
поэтому 429 несёт `retryable: false` — иначе форма обходила бы антиспам одним лишним запросом.
Если лимит на эндпоинте понадобится, его место в nginx (`limit_req`), не в коде.

---

## 7. amoCRM

Заявка создаётся как **неразобранное типа «форма»**: `POST /api/v4/leads/unsorted/forms`
([доки](https://www.amocrm.ru/developers/content/crm_platform/unsorted-api#unsorted-add-form)).
Так она попадает в «Неразобранное» с метаданными источника, страницы и IP, а amo сам делает
дедупликацию контактов по телефону и email. Авторизация — долгоживущий токен приватной интеграции
(`Authorization: Bearer …`, до 5 лет, без refresh-танцев).

### Тело запроса

```json
[{
  "source_name": "Сайт taotransit.com",
  "source_uid": "taotransit-website-form",
  "created_at": 1756684800,
  "request_id": "3f9c1a2b-…",
  "pipeline_id": 1234567,
  "_embedded": {
    "leads": [{
      "name": "Заявка с сайта taotransit.com — Выкуп и доставка",
      "custom_fields_values": [
        { "field_code": "UTM_SOURCE",  "values": [{ "value": "yandex" }] },
        { "field_code": "GCLID",       "values": [{ "value": "…" }] },
        { "field_code": "REFERRER",    "values": [{ "value": "https://ya.ru/search" }] },
        { "field_code": "FORM_ANSWER", "values": [{ "value": "Выкуп и доставка" }] }
      ],
      "_embedded": { "tags": [{ "name": "ru" }] }
    }],
    "contacts": [{
      "name": "Иван",
      "custom_fields_values": [
        { "field_code": "PHONE", "values": [{ "value": "+79990000000", "enum_code": "WORK" }] },
        { "field_code": "EMAIL", "values": [{ "value": "ivan@example.com", "enum_code": "WORK" }] }
      ]
    }]
  },
  "metadata": {
    "ip": "1.2.3.4",
    "form_id": "taotransit-contact-form",
    "form_name": "Форма на сайте",
    "form_page": "https://taotransit.com/",
    "form_sent_at": 1756684800,
    "referer": "https://ya.ru/search"
  }
}]
```

### Мелочи, на которых легко обжечься

- Тело — **массив**, даже для одной заявки.
- `created_at` / `form_sent_at` — Unix-**секунды**, не миллисекунды.
- `metadata.ip` обязателен; при отсутствии подставляется `0.0.0.0`.
- `form_page` отправляется **без query-строки** — метки и так лежат отдельными полями.
- `pipeline_id` — свойство **корневого объекта**, не сделки внутри `_embedded`.
- `lang` становится тегом сделки — удобный фильтр в воронке.

⚠️ **Новая воронка: две проверки перед боем.**
1. В настройках воронки должно быть **включено «Неразобранное»** — иначе заявка не создастся.
2. Поле под ответ формы (`FORM_ANSWER` и подобные) — **не системное**. Если в `AMO_ANSWER_FIELD`
   указать код несуществующего поля, amo вернёт 400 и потеряет **всю** заявку. Поэтому переменная
   и сделана необязательной: без неё ответ выживает в названии сделки и в Telegram.

Id новой воронки: `GET /api/v4/leads/pipelines` с тем же токеном, или из URL воронки в интерфейсе amo.

Диагностический скрипт (переносится как есть, читает `.env` из корня):

```
node scripts/amo-fields.mjs list          # поля аккаунта: id / code / type
node scripts/amo-fields.mjs ensure-utm    # найти/создать utm-поля → строка AMO_UTM_FIELD_IDS
node scripts/amo-fields.mjs test-lead     # отправить тестовую заявку в «Неразобранное»
```

---

## 8. Исходники, копируемые как есть

Три файла из репозитория mate. В новом проекте правятся только `ALLOWED_ORIGINS`
в первом и `name` в третьем.

### 8.1. `src/lib/lead.js` — общий модуль доставки (изоморфный)

```js
/**
 * Единая логика доставки заявки с сайта в Telegram и amoCRM.
 *
 * ВАЖНО: модуль изоморфный — он бандлится и в серверный роут, и в
 * Cloudflare Worker (workers/lead-relay). Поэтому здесь нельзя:
 *   - импортировать 'server-only', 'fs', 'path' и прочие Node-API;
 *   - использовать алиасы сборщика (wrangler/esbuild их не резолвит).
 * Только стандартные Web API: fetch, AbortSignal, URL, JSON.
 */

/** Origin-ы, которым разрешено слать заявку (CORS + защита от чужих сайтов). */
export const ALLOWED_ORIGINS = [
  'https://taotransit.com',
  'http://taotransit.com',
  'http://localhost:4321',
]

/** Все каналы доставки. Кто из них работает у конкретного приёмника — решает вызывающий. */
export const CHANNELS = ['telegram', 'amo']

/**
 * Канонический список рекламных меток. Отсюда выводится и чтение из URL на
 * клиенте, и строки в Telegram, и поля сделки в amoCRM (по `field_code` =
 * КЛЮЧ В ВЕРХНЕМ РЕГИСТРЕ — у amoCRM это готовые поля типа tracking_data,
 * они есть в каждом аккаунте: UTM_SOURCE, GCLID, YCLID, FBCLID, _YM_UID, …).
 *
 * Добавляя ключ сюда, убедись, что поле с таким кодом в amo существует:
 * `node scripts/amo-fields.mjs list`. Неизвестный код заявку не роняет
 * (amo игнорирует), но и не сохранит значение.
 */
export const TRACKING_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_referrer',
  // клики из рекламных систем — приходят в URL так же, как utm
  'gclid',
  'yclid',
  'fbclid',
  'roistat',
  // не URL-параметр: клиент берёт его из cookie Яндекс.Метрики,
  // чтобы заявку можно было сшить с визитом
  '_ym_uid',
]

/** Таймаут одного исходящего запроса, если не задан OUTBOUND_TIMEOUT_MS. */
const DEFAULT_OUTBOUND_TIMEOUT_MS = 8000

function str(value) {
  return value == null ? '' : String(value).trim()
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Страница без query-строки — метки в amo и так лежат отдельными полями (TRACKING_KEYS). */
function withoutQuery(url) {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return url
  }
}

/** CORS-заголовки для разрешённого origin, иначе null. Общее для обоих приёмников. */
export function corsHeadersFor(origin) {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return null
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  }
}

/** Приводит сырое тело запроса формы к предсказуемой форме. */
export function normalizeLead(raw, ctx = {}) {
  const body = raw && typeof raw === 'object' ? raw : {}
  const digits = str(body.phoneNumber).replace(/[^\d]/g, '')
  const formPage = str(body.formPage)

  const tracking = {}
  for (const key of TRACKING_KEYS) tracking[key] = str(body[key])

  return {
    requestId: str(body.requestId) || null,
    name: str(body.name),
    email: str(body.email),
    phone: digits ? `+${digits}` : '',
    companyType: str(body.companyType),
    lang: str(body.lang) || 'ru',
    /** С какого сайта пришла заявка: берём из URL страницы. */
    site: hostOf(formPage) || 'taotransit.com',
    formName: str(body.formName) || 'Форма на сайте',
    formPage,
    referer: str(body.referer),
    tracking,
    /** Кто доставил заявку — проставляет приёмник, идёт в текст TG. */
    via: str(ctx.via) || 'unknown',
    ip: str(ctx.ip),
    sentAt: Math.floor(Date.now() / 1000),
  }
}

/** Текст сообщения в Telegram. */
export function buildTelegramText(lead) {
  const lines = [
    lead.site,
    `Язык: ${lead.lang}`,
    `Имя: ${lead.name}`,
    `Email: ${lead.email}`,
    `Номер: ${lead.phone}`,
    `Ответ на вопрос: ${lead.companyType}`,
  ]

  const trackingLines = TRACKING_KEYS.filter((key) => lead.tracking[key]).map(
    (key) => `${key}: ${lead.tracking[key]}`
  )
  if (trackingLines.length) lines.push('', ...trackingLines)

  if (lead.formPage) lines.push('', `Страница: ${lead.formPage}`)
  if (lead.referer) lines.push(`Реферер: ${lead.referer}`)

  // Диагностическая строка — только когда маршрут нештатный, иначе она была бы
  // шумом в каждом сообщении. Штатные маршруты: `worker` (через Cloudflare) и
  // `origin` (воркер не настроен — тогда сервер везёт оба канала). Всё остальное —
  // добор после сбоя воркера, диагностический скрипт или запрос не из формы;
  // короткий requestId позволяет опознать дубль одной и той же заявки.
  const isRoutine = lead.via === 'worker' || lead.via === 'origin'
  if (!isRoutine) {
    const shortId = lead.requestId ? ` · ${lead.requestId.slice(0, 8)}` : ''
    lines.push(`⚠ доставлено через ${lead.via}${shortId}`)
  }

  return lines.join('\n')
}

async function sendToTelegram(lead, config, timeoutMs) {
  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: buildTelegramText(lead),
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`Telegram ${response.status}: ${await response.text()}`)
  }
}

/**
 * Тело запроса для POST /api/v4/leads/unsorted/forms.
 * @see https://www.amocrm.ru/developers/content/crm_platform/unsorted-api#unsorted-add-form
 */
export function buildAmoUnsortedPayload(lead, config) {
  const contactFields = []
  if (lead.phone) {
    contactFields.push({ field_code: 'PHONE', values: [{ value: lead.phone, enum_code: 'WORK' }] })
  }
  if (lead.email) {
    contactFields.push({ field_code: 'EMAIL', values: [{ value: lead.email, enum_code: 'WORK' }] })
  }

  // Метки кладём по системному коду поля (UTM_SOURCE, GCLID, …): в amoCRM это
  // готовые поля типа tracking_data, они есть в аккаунте изначально и код у них
  // одинаковый везде — маппинг id не нужен (проверено на живом аккаунте 2026-08-11).
  // AMO_UTM_FIELD_IDS остаётся аварийным переопределением, если в конкретном
  // аккаунте метки лежат в самодельных полях с другими кодами.
  const leadFields = []
  const utmFieldIds = config.utmFieldIds || {}
  for (const key of TRACKING_KEYS) {
    if (!lead.tracking[key]) continue
    const fieldId = Number(utmFieldIds[key])
    const target = Number.isInteger(fieldId)
      ? { field_id: fieldId }
      : { field_code: key.toUpperCase() }
    leadFields.push({ ...target, values: [{ value: lead.tracking[key] }] })
  }

  // Источник перехода — у amoCRM для него тоже есть штатное поле.
  if (lead.referer) {
    leadFields.push({ field_code: 'REFERRER', values: [{ value: lead.referer }] })
  }

  // Ответ на вопрос формы. Поле НЕ системное: его код/id задаётся через
  // AMO_ANSWER_FIELD, и без этой переменной в поле мы не пишем — иначе аккаунт
  // без такого поля ловил бы 400 и терял заявку целиком. Сам ответ при этом
  // не пропадает: он всегда идёт в название сделки (ниже) и в текст Telegram.
  if (lead.companyType && config.answerField) {
    const fieldId = Number(config.answerField)
    const target = Number.isInteger(fieldId)
      ? { field_id: fieldId }
      : { field_code: String(config.answerField).toUpperCase() }
    leadFields.push({ ...target, values: [{ value: lead.companyType }] })
  }

  const baseName = config.leadName || `Заявка с сайта ${lead.site}`
  const leadEntity = {
    name: lead.companyType ? `${baseName} — ${lead.companyType}` : baseName,
  }
  if (leadFields.length) leadEntity.custom_fields_values = leadFields
  if (lead.lang) leadEntity._embedded = { tags: [{ name: lead.lang }] }

  const complaint = {
    source_name: config.sourceName,
    source_uid: config.sourceUid,
    created_at: lead.sentAt,
    _embedded: {
      leads: [leadEntity],
      contacts: [
        {
          name: lead.name || 'Без имени',
          ...(contactFields.length ? { custom_fields_values: contactFields } : {}),
        },
      ],
    },
    metadata: {
      ip: lead.ip || '0.0.0.0',
      form_id: config.formId,
      form_name: lead.formName,
      form_page: (lead.formPage && withoutQuery(lead.formPage)) || `https://${lead.site}`,
      form_sent_at: lead.sentAt,
      ...(lead.referer ? { referer: lead.referer } : {}),
    },
  }

  if (lead.requestId) complaint.request_id = lead.requestId
  if (config.pipelineId) complaint.pipeline_id = config.pipelineId

  return [complaint]
}

async function sendToAmo(lead, config, timeoutMs) {
  const url = `https://${config.subdomain}.${config.host}/api/v4/leads/unsorted/forms`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(buildAmoUnsortedPayload(lead, config)),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`amoCRM ${response.status}: ${await response.text()}`)
  }
}

function intOrNull(value) {
  const parsed = Number(value)
  return value && Number.isInteger(parsed) ? parsed : null
}

/**
 * Читает конфиг из «плоского» объекта переменных окружения. Один и тот же набор
 * имён работает и для process.env (VPS), и для env воркера (CF secrets).
 */
export function readConfig(env = {}) {
  let utmFieldIds = null
  if (env.AMO_UTM_FIELD_IDS) {
    try {
      utmFieldIds = JSON.parse(env.AMO_UTM_FIELD_IDS)
    } catch (error) {
      console.error('AMO_UTM_FIELD_IDS is not valid JSON, UTM will be skipped:', error)
    }
  }

  // Какие каналы этому приёмнику разрешены вообще. У воркера — только telegram
  // (LEAD_CHANNELS в wrangler.jsonc): amoCRM ходит исключительно с сервера.
  const allowedChannels = String(env.LEAD_CHANNELS || '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => CHANNELS.includes(name))

  return {
    channels: allowedChannels.length ? allowedChannels : CHANNELS,
    // Воркеру бюджет режут через env: клиент ждёт его меньше, чем серверный фолбэк,
    // и доставка дольше клиентского таймаута — это заведомо выброшенная работа.
    timeoutMs: intOrNull(env.OUTBOUND_TIMEOUT_MS) || DEFAULT_OUTBOUND_TIMEOUT_MS,
    telegram: {
      botToken: env.TG_BOT_TOKEN || '',
      chatId: env.CHAT_ID || '',
    },
    amo: {
      subdomain: env.AMO_SUBDOMAIN || '',
      token: env.AMO_LONG_TOKEN || '',
      host: env.AMO_HOST || 'amocrm.ru',
      pipelineId: intOrNull(env.AMO_PIPELINE_ID),
      sourceName: env.AMO_SOURCE_NAME || 'Сайт taotransit.com',
      sourceUid: env.AMO_SOURCE_UID || 'taotransit-website-form',
      formId: env.AMO_FORM_ID || 'taotransit-contact-form',
      leadName: env.AMO_LEAD_NAME || '',
      // Код или id поля под ответ на вопрос формы. Пусто → в поле не пишем.
      answerField: env.AMO_ANSWER_FIELD || '',
      utmFieldIds,
    },
  }
}

/** Одна попытка доставки: никогда не бросает, возвращает статус канала. */
async function attempt(name, isConfigured, send) {
  if (!isConfigured) {
    console.error(`${name} is not configured, skipping`)
    return 'skipped'
  }
  try {
    await send()
    return 'ok'
  } catch (error) {
    console.error(`Lead delivery to ${name} failed:`, error)
    return 'error'
  }
}

/**
 * Чего просит клиент ∩ что этому приёмнику вообще разрешено (LEAD_CHANNELS).
 * Мусор, пустое пересечение и отсутствие поля дают полный набор приёмника —
 * заявка не теряется из-за кривого запроса.
 */
export function resolveChannels(requested, allowed) {
  if (!Array.isArray(requested)) return allowed
  const wanted = requested.filter((name) => allowed.includes(name))
  return wanted.length ? wanted : allowed
}

/**
 * Шлёт заявку в запрошенные каналы независимо друг от друга.
 * Никогда не бросает: возвращает статусы, решение об HTTP-коде — за вызывающим.
 *
 * @param {string[]} channels какие каналы задействовать — см. CHANNELS
 * @returns {Promise<{telegram: 'ok'|'error'|'skipped'|'off', amo: ..., delivered: number}>}
 */
export async function deliverLead(lead, config, channels = CHANNELS) {
  const { telegram: tg, amo } = config
  const wanted = (name) => channels.includes(name)

  const [telegram, amoStatus] = await Promise.all([
    wanted('telegram')
      ? attempt('Telegram', tg.botToken && tg.chatId, () =>
          sendToTelegram(lead, tg, config.timeoutMs)
        )
      : 'off',
    wanted('amo')
      ? attempt('amoCRM', amo.subdomain && amo.token, () => sendToAmo(lead, amo, config.timeoutMs))
      : 'off',
  ])

  return {
    telegram,
    amo: amoStatus,
    delivered: [telegram, amoStatus].filter((status) => status === 'ok').length,
  }
}
```

### 8.2. `workers/lead-relay/src/index.js` — Cloudflare Worker

```js
/**
 * Cloudflare Worker — прослойка между формой сайта и Telegram.
 *
 * Каналы разведены по приёмникам:
 *   - Telegram → этот воркер (обход возможной блокировки Telegram из РФ);
 *   - amoCRM   → только напрямую с сервера (российский сервис, российский сервер;
 *                хоп через Cloudflare добавил бы латентность и точку отказа).
 * Ограничение зашито в `LEAD_CHANNELS` (wrangler.jsonc), а не в договорённость:
 * даже если клиент попросит здесь amo, `resolveChannels` это отсечёт.
 *
 * Если воркер вернул `retryable: true` или не ответил, форма добирает Telegram
 * через серверный эндпоинт сайта. Чтобы добор не породил дубль,
 * `retryable: true` ставится ТОЛЬКО когда не доставлено ничего. Решение принимает
 * воркер — клиент кодов ответа не разбирает.
 *
 * Вся бизнес-логика лежит в общем модуле src/lib/lead.js — здесь только
 * транспорт, CORS и rate limit.
 */
import {
  corsHeadersFor,
  deliverLead,
  normalizeLead,
  readConfig,
  resolveChannels,
} from '../../../src/lib/lead'

function json(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin')
    const cors = corsHeadersFor(origin)

    if (request.method === 'GET') {
      // Health-check без единого секрета в ответе.
      return json({ ok: true, service: 'taotransit-lead-relay' }, 200)
    }

    if (request.method === 'OPTIONS') {
      if (!cors) return new Response('Forbidden', { status: 403 })
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers':
            request.headers.get('Access-Control-Request-Headers') || 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST, OPTIONS' } })
    }

    // Воркер публичен, поэтому единственная защита от чужих сайтов — Origin
    // (браузер его не даёт подделать) плюс лимит по IP ниже.
    if (!cors) return new Response('Forbidden', { status: 403 })

    const ip = request.headers.get('CF-Connecting-IP') || ''

    if (env.LEAD_LIMITER) {
      const { success } = await env.LEAD_LIMITER.limit({ key: ip || origin })
      // Повторять на сервере нельзя: у него своего лимита нет, и фолбэк обходил бы
      // антиспам одним лишним запросом.
      if (!success) return json({ ok: false, error: 'rate_limited', retryable: false }, 429, cors)
    }

    let lead
    let requestedChannels
    try {
      const body = await request.json()
      requestedChannels = body?.channels
      lead = normalizeLead(body, { via: 'worker', ip })
    } catch (error) {
      // Тело не разобрать — сервер разберёт его ровно так же, повтор бессмыслен.
      console.error('Bad request body:', error)
      return json({ ok: false, error: 'bad_request', retryable: false }, 400, cors)
    }

    const config = readConfig(env)
    const result = await deliverLead(lead, config, resolveChannels(requestedChannels, config.channels))

    // Ничего не доставлено — только здесь повтор безопасен и нужен.
    if (result.delivered === 0) return json({ ok: false, retryable: true, ...result }, 502, cors)

    return json({ ok: true, retryable: false, ...result }, 200, cors)
  },
}
```

### 8.3. `workers/lead-relay/wrangler.jsonc`

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "taotransit-lead-relay",
  "main": "src/index.js",
  "compatibility_date": "2026-08-10",
  "workers_dev": true,
  "observability": {
    "enabled": true
  },
  "vars": {
    // Воркеру разрешён ТОЛЬКО Telegram. amoCRM — российский сервис, и ходит в него
    // исключительно сервер напрямую: хоп через Cloudflare дал бы лишнюю латентность
    // и лишнюю точку отказа. Даже если клиент попросит здесь amo — будет отсечено.
    "LEAD_CHANNELS": "telegram",
    // Клиент ждёт воркер 4 с (RELAY_TIMEOUT_MS в src/scripts/lead.ts) — доставка
    // дольше этого всё равно никому не отдастся, поэтому бюджет канала здесь
    // короче дефолтных 8 с, которые остаются у сервера.
    "OUTBOUND_TIMEOUT_MS": "3000"
  },
  // Антиспам: не более 5 заявок с одного IP в минуту. period может быть только 10 или 60.
  "ratelimits": [
    {
      "name": "LEAD_LIMITER",
      "namespace_id": "2001",
      "simple": {
        "limit": 5,
        "period": 60
      }
    }
  ]
  // Секреты (НЕ хранить здесь, задаются через `wrangler secret put <NAME>`):
  //   TG_BOT_TOKEN, CHAT_ID
}
```

---

## 9. Серверный эндпоинт под Astro — `src/pages/api/lead.ts`

```ts
import type { APIRoute } from 'astro'
import {
  corsHeadersFor, deliverLead, normalizeLead, readConfig, resolveChannels,
} from '../../lib/lead.js'

// Эндпоинт обязан быть серверным даже при статическом сайте.
export const prerender = false

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || ''
}

export const OPTIONS: APIRoute = ({ request }) => {
  const cors = corsHeadersFor(request.headers.get('origin'))
  if (!cors) return new Response('Forbidden', { status: 403 })

  return new Response(null, {
    status: 204,
    headers: {
      ...cors,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        request.headers.get('access-control-request-headers') || 'Content-Type',
    },
  })
}

export const POST: APIRoute = async ({ request }) => {
  const cors = corsHeadersFor(request.headers.get('origin'))
  if (!cors) return new Response('Forbidden', { status: 403 })

  // Контракт: всегда 200 для разрешённого origin. Это единственный путь в amoCRM
  // и последний рубеж для Telegram — показывать пользователю 5xx уже некуда.
  try {
    const body = await request.json()
    const via = body?.via === 'fallback' ? 'fallback' : 'origin'
    const lead = normalizeLead(body, { via, ip: clientIp(request) })
    const config = readConfig(process.env)  // на Cloudflare: locals.runtime.env
    await deliverLead(lead, config, resolveChannels(body?.channels, config.channels))
  } catch (error) {
    console.error('lead handler error:', error)
  }

  return new Response('ok', { status: 200, headers: cors })
}
```

Замечания по Astro:

- Нужен адаптер (`@astrojs/node` в режиме `standalone`/`middleware` за nginx). Весь сайт в
  `output: 'server'` переводить не нужно: остаётся статика, а серверным помечается только этот
  эндпоинт через `export const prerender = false`.
- `import.meta.env.SECRET` инлайнится на этапе сборки, поэтому серверные секреты читаем из
  `process.env` (node-адаптер) — иначе смена значения потребует пересборки. На Cloudflare-адаптере
  переменные приходят в `locals.runtime.env`, и сигнатуру надо поменять на
  `async ({ request, locals })` + `readConfig(locals.runtime.env)`.
- `OPTIONS` остаётся отдельным экспортом, не сливать с `POST`.
- Появление адаптера ломает нынешнюю схему деплоя «положить `dist/` папкой» — статику начинает
  отдавать node-процесс или nginx перед ним. Учесть при выборе хостинга (`CLAUDE.md` § Hosting).

---

## 10. Переменные окружения

`.env` в корне, в git не коммитится:

```
# клиентские — инлайнятся в бандл на этапе сборки
PUBLIC_LEAD_RELAY_URL=https://taotransit-lead-relay.<account>.workers.dev
PUBLIC_LEAD_ORIGIN_URL=https://taotransit.com/api/lead

# серверные
TG_BOT_TOKEN=…            # @taotransit_bot; нужен, только если сервер тоже шлёт в TG (фолбэк)
CHAT_ID=…                 # id новой беседы
AMO_SUBDOMAIN=mategrouptrade
AMO_LONG_TOKEN=…          # тот же долгоживущий токен, что у mate
AMO_PIPELINE_ID=…         # НОВАЯ воронка
AMO_ANSWER_FIELD=FORM_ANSWER
AMO_SOURCE_NAME=Сайт taotransit.com
AMO_SOURCE_UID=taotransit-website-form
AMO_FORM_ID=taotransit-contact-form
# необязательные: AMO_HOST, AMO_LEAD_NAME, AMO_UTM_FIELD_IDS, LEAD_CHANNELS, OUTBOUND_TIMEOUT_MS
```

`readConfig()` читает плоский объект переменных — один набор имён работает и для `process.env`,
и для env воркера.

⚠️ Пока обе `PUBLIC_*` пусты, фронт сидит в демо-режиме (§ 1) и никуда не ходит.

---

## 11. Развилка по хостингу

Схема с двумя приёмниками оправдана ровно одним обстоятельством: **сервер стоит в России**.
Хостинг taotransit.com пока не выбран (`CLAUDE.md` § Hosting), поэтому выбор ещё влияет на код.

| Где живёт сайт | Что делать |
|---|---|
| **VPS в РФ** (кандидат — тот же Timeweb, где живёт mate) | схема переносится один в один. Astro + `@astrojs/node` за nginx. Рекомендуется: заявки идут из России |
| **Cloudflare Pages** | воркер как отдельный приёмник теряет смысл — эндпоинт сайта и есть воркер. Оставить один приёмник с `LEAD_CHANNELS="telegram,amo"`, убрать параллельные запросы на клиенте. Env — из `locals.runtime.env`. Риск: до amoCRM ходить из-за границы, плюс сам CF из РФ доступен нестабильно |
| **Vercel / Netlify** | соответствующий адаптер, `process.env` работает. Схема с воркером осмысленна, только если Telegram с площадки недоступен. Из РФ обе площадки режутся — для превью-ссылки заказчику не годятся |
| **Полностью статический сайт** (без адаптера) | серверного эндпоинта нет → оба канала уходят в воркер: `LEAD_CHANNELS="telegram,amo"`, секреты `AMO_*` кладутся в Cloudflare. Ценой становится хоп Cloudflare → amoCRM и один общий приёмник вместо двух. **Самый дешёвый путь, если не хочется трогать текущую схему деплоя статики** |

---

## 12. Грабли

По каждой уже наступили в mate. Порядок — по цене ошибки.

1. **Дубли заявок.** Решение о повторе принимает приёмник (поле `retryable`), а не клиент по
   HTTP-коду. Начнёшь ретраить на 5xx самостоятельно — каждая частичная неудача даст двойное
   сообщение в Telegram.
2. **`setWebhook` на `@taotransit_bot`.** Ломает живой консьерж-поток заказчика. См. § 6.
3. **`Content-Type` не задаётся намеренно.** Без него запрос остаётся CORS simple request и
   браузер не шлёт preflight — минус RTT и минус один способ сломаться. Обе стороны читают тело
   через `.json()`. Добавишь заголовок — появится `OPTIONS`, который обязан отвечать корректно.
4. **`PUBLIC_*` инлайнится на сборке.** URL воркера должен лежать в `.env` ДО сборки. Положил
   после — в бандле пусто, форма молча уходит в демо-режим.
5. **403 на чужой origin.** Забыли добавить домен (или dev-порт 4321) в `ALLOWED_ORIGINS` — 403 и на
   воркере, и на сервере. Массив общий: правка требует и деплоя сайта, и `wrangler deploy`.
6. **Эндпоинт всегда отвечает 200.** Ошибки уходят в `console.error`, наружу — никогда. Это
   сознательно: пользователю показывать 5xx некуда. Значит, мониторинг — только логи, и тишина
   в них не равна успеху.
7. **Двойной деплой общего модуля.** Правка `lead.js` без `wrangler deploy` = приёмники разъехались.
8. **400 от amo убивает заявку целиком.** Несуществующий код поля в `AMO_ANSWER_FIELD` — и
   неразобранное не создастся.
9. **Метрика может не загрузиться.** `ym(...)` обёрнут в `try/catch`: цель — не повод потерять заявку.
10. **`period` лимитера.** В биндинге `ratelimits` допустимы только значения 10 и 60. Любое
    другое — ошибка деплоя воркера.
11. **Заголовок IP.** За nginx настоящий адрес в `x-forwarded-for`, у воркера — в
    `CF-Connecting-IP`. Перепутал — в amo уедет адрес прокси.
12. **Два списка `TRACKING_KEYS`.** Клиентский и серверный обязаны совпадать (§ 5).

---

## 13. Порядок внедрения

Каждый шаг проверяется до того, как на него завязывается следующий.

1. Получить от заказчика: токен бота (`@taotransit_bot` или новый), доступ к amo (`mategrouptrade`),
   решение по хостингу.
2. Скопировать `src/lib/lead.js`, папку `workers/lead-relay/` и `scripts/amo-fields.mjs` из `mate`.
   Поправить `ALLOWED_ORIGINS` и `name` воркера.
3. Создать беседу под заявки, добавить бота, получить `CHAT_ID` (осторожно с `getUpdates` — § 6).
4. Задеплоить воркер с двумя секретами, дождаться сертификата, проверить health-check и тестовую
   заявку curl-ом.
5. Получить id новой воронки, убедиться, что в ней включено «Неразобранное».
6. Прогнать `node scripts/amo-fields.mjs list` и решить судьбу поля под ответ формы.
7. Проверить amo вслепую: `node scripts/amo-fields.mjs test-lead` — заявка должна появиться
   в нужной воронке.
8. Заполнить `.env`, включая `PUBLIC_LEAD_RELAY_URL`, ДО первой сборки.
9. Добавить `src/pages/api/lead.ts` и адаптер, собрать, задеплоить.
10. Отправить форму с боевого домена с меткой в URL: `?utm_source=test&gclid=test`.
11. Сверить три вещи: сообщение в беседе (без строки `⚠`), сделку в нужной воронке с заполненными
    метками и тегом языка, цель в Метрике.

### Быстрые проверки

```bash
# воркер жив
curl https://<name>.<account>.workers.dev

# тестовая заявка (Origin обязателен, иначе 403)
curl -i -X POST https://<name>.<account>.workers.dev \
  -H 'Origin: https://taotransit.com' \
  -d '{"channels":["telegram"],"name":"Тест","email":"t@example.com","phoneNumber":"+70000000000","lang":"ru","formPage":"https://taotransit.com/"}'

# живые логи воркера
cd workers/lead-relay && npm run tail

# серверный эндпоинт
curl -i -X POST https://taotransit.com/api/lead \
  -H 'Origin: https://taotransit.com' \
  -d '{"channels":["amo"],"name":"Тест","email":"t@example.com","phoneNumber":"+70000000000","lang":"ru","formPage":"https://taotransit.com/"}'
```

Ответ `{"ok":true,"telegram":"ok","amo":"off","delivered":1}` от воркера — норма: `amo: "off"`
означает «этому приёмнику канал не разрешён», и так задумано. `"skipped"` — другое: канал разрешён,
но секреты не заданы.

---

## 14. Что осталось решить

| Вопрос | Кому | Почему это блокирует |
|---|---|---|
| Токен бота: консьерж `@taotransit_bot` или отдельный | заказчику | без него не встаёт Telegram-канал целиком |
| `CHAT_ID` беседы под заявки | заказчику | у бота с вебхуком `getUpdates` не сработает (§ 6) |
| Доступ к amoCRM и id новой воронки | заказчику | без `AMO_PIPELINE_ID` сделки лягут в воронку mate |
| **Юридические документы** | заказчику / юристу | тексты написаны и открываются из формы и футера, но это черновик, и пять реквизитов не заполнены. Список и последствия — `CLAUDE.md` § «Юридические документы» |
| Свой счётчик Метрики и цель `sendForm` | заказчику | место вызова `ym()` в `lead.ts` помечено комментарием, самого вызова нет; без счётчика конверсия формы не считается, а метка `_ym_uid` уходит пустой. Подключать только за `analyticsAllowed()` из `src/scripts/legal.ts` — иначе отказ в плашке ничего не значит |
| Хостинг | нам | определяет, нужен ли воркер и какой адаптер (§ 11) |
