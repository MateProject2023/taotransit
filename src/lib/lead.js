/**
 * Единая логика доставки заявки с сайта в Telegram и amoCRM.
 *
 * ВАЖНО: модуль изоморфный — он бандлится и в серверный роут Astro
 * (src/pages/api/lead.ts), и в Cloudflare Worker (workers/lead-relay).
 * Поэтому здесь нельзя:
 *   - импортировать 'fs', 'path', 'node:*' и прочие Node-API;
 *   - использовать алиасы сборщика (esbuild в wrangler их не резолвит).
 * Только стандартные Web API: fetch, AbortSignal, URL, JSON.
 *
 * Перенесён из matestrade.com (../mate/mate/src/lib/lead.js) почти дословно.
 * Отличия от исходника перечислены в FORM.md § 3.
 */

/**
 * Origin-ы, которым разрешено слать заявку (CORS + защита от чужих сайтов).
 *
 * Список статический, потому что он общий для двух приёмников: воркер и роут
 * обязаны отвечать одинаково. Всё, что списком не покрывается, добавляется
 * переменной LEAD_ALLOWED_ORIGINS (через запятую) — её передаёт вызывающий.
 */
export const ALLOWED_ORIGINS = [
  'https://taotransit.com',
  'http://taotransit.com',
  'https://www.taotransit.com',
  'http://www.taotransit.com',
  // порт `astro dev`
  'http://localhost:4321',
  'http://127.0.0.1:4321',
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
 *
 * ⚠️ Список продублирован в src/scripts/lead.ts (клиентский бандл не может
 * импортировать этот модуль). Правка нужна в обоих местах — FORM.md § 5.
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

/**
 * Разбирает добавочные origin-ы: массив, строка или строка через запятую.
 * Нужен превью-сборкам (у Vercel адрес деплоя свой на каждую ветку) и
 * серверному роуту, который разрешает сам себя, — см. FORM.md § 3.
 */
function extraOrigins(extra) {
  const items = Array.isArray(extra) ? extra : [extra]
  return items
    .filter(Boolean)
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

/**
 * CORS-заголовки для разрешённого origin, иначе null. Общее для обоих приёмников.
 *
 * @param {string|null} origin заголовок Origin запроса
 * @param {string|string[]} [extra] дополнительные origin-ы поверх ALLOWED_ORIGINS
 */
export function corsHeadersFor(origin, extra) {
  if (!origin) return null
  const allowed = extra ? [...ALLOWED_ORIGINS, ...extraOrigins(extra)] : ALLOWED_ORIGINS
  if (!allowed.includes(origin)) return null
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
      // Беседа с темами (форум): без этого поля сообщение уходит в General.
      // Пусто → ключа в теле нет, обычная группа его не понимает.
      ...(config.threadId ? { message_thread_id: config.threadId } : {}),
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

  // Ответ на вопрос формы («Что нужно»). Поле НЕ системное: его код/id задаётся
  // через AMO_ANSWER_FIELD, и без этой переменной в поле мы не пишем — иначе
  // аккаунт без такого поля ловил бы 400 и терял заявку целиком. Сам ответ при
  // этом не пропадает: он всегда идёт в название сделки (ниже) и в текст Telegram.
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
 * имён работает и для process.env (сервер), и для env воркера (CF secrets).
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
  // (LEAD_CHANNELS в wrangler.jsonc): amoCRM ходит исключительно с сервера сайта.
  const allowedChannels = String(env.LEAD_CHANNELS || '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => CHANNELS.includes(name))

  return {
    channels: allowedChannels.length ? allowedChannels : CHANNELS,
    // Воркеру бюджет режут через env: клиент ждёт его меньше, чем серверный фолбэк,
    // и доставка дольше клиентского таймаута — это заведомо выброшенная работа.
    timeoutMs: intOrNull(env.OUTBOUND_TIMEOUT_MS) || DEFAULT_OUTBOUND_TIMEOUT_MS,
    /** Добавочные origin-ы поверх ALLOWED_ORIGINS: превью-домены и т.п. */
    allowedOrigins: env.LEAD_ALLOWED_ORIGINS || '',
    telegram: {
      botToken: env.TG_BOT_TOKEN || '',
      chatId: env.CHAT_ID || '',
      // Только для бесед с темами (форум). Пусто → ключ в sendMessage не уходит.
      threadId: intOrNull(env.CHAT_THREAD_ID),
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
