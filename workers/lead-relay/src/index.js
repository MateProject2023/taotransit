/**
 * Cloudflare Worker — прослойка между формой сайта и Telegram.
 *
 * Каналы разведены по приёмникам:
 *   - Telegram → этот воркер;
 *   - amoCRM   → только напрямую с сервера сайта (российский сервис; хоп через
 *                Cloudflare добавил бы латентность и точку отказа).
 * Ограничение зашито в `LEAD_CHANNELS` (wrangler.jsonc), а не в договорённость:
 * даже если клиент попросит здесь amo, `resolveChannels` это отсечёт.
 *
 * Если воркер вернул `retryable: true` или не ответил, форма добирает Telegram
 * через серверный эндпоинт сайта. Чтобы добор не породил дубль,
 * `retryable: true` ставится ТОЛЬКО когда не доставлено ничего. Решение принимает
 * воркер — клиент кодов ответа не разбирает.
 *
 * Вся бизнес-логика лежит в общем модуле src/lib/lead.js (его же бандлит
 * серверный роут сайта) — здесь только транспорт, CORS и rate limit.
 */
import {
  corsHeadersFor,
  deliverLead,
  normalizeLead,
  readConfig,
  resolveChannels,
} from '../../../src/lib/lead.js'

function json(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin')
    // Превью-домены сайта живут в LEAD_ALLOWED_ORIGINS, боевые — в ALLOWED_ORIGINS.
    const cors = corsHeadersFor(origin, env.LEAD_ALLOWED_ORIGINS)

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
