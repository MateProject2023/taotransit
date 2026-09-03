#!/usr/bin/env node
/**
 * Утилита для настройки интеграции с amoCRM (запускается локально, руками).
 *
 *   node scripts/amo-fields.mjs list [leads|contacts]
 *       — показать кастомные поля аккаунта (id / code / type / name).
 *
 *   node scripts/amo-fields.mjs pipelines
 *       — показать воронки аккаунта: id, название, включено ли «Неразобранное».
 *         Отсюда берётся AMO_PIPELINE_ID для новой воронки TAO.
 *
 *   node scripts/amo-fields.mjs ensure-utm
 *       — найти (или создать) поля сделки под utm-метки и напечатать готовую
 *         строку AMO_UTM_FIELD_IDS. В штатном аккаунте не нужна: метки лежат
 *         в системных полях tracking_data и находятся по field_code.
 *
 *   node scripts/amo-fields.mjs test-lead
 *       — отправить тестовую заявку в «Неразобранное» и показать ответ amoCRM.
 *
 * Доступы берутся из переменных окружения или из .env в корне репозитория:
 *   AMO_SUBDOMAIN, AMO_LONG_TOKEN, (опц.) AMO_HOST, AMO_PIPELINE_ID, AMO_ANSWER_FIELD.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildAmoUnsortedPayload,
  normalizeLead,
  readConfig,
  TRACKING_KEYS,
} from '../src/lib/lead.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Минимальный .env-парсер: только KEY=VALUE, без подстановок. */
function loadDotEnv() {
  try {
    const raw = readFileSync(resolve(ROOT, '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!match) continue
      const [, key, rawValue] = match
      if (process.env[key] !== undefined) continue
      process.env[key] = rawValue.replace(/^["']|["']$/g, '')
    }
  } catch {
    // .env может отсутствовать — это не ошибка, переменные могут прийти из окружения.
  }
}

loadDotEnv()

// Доступы читаем тем же readConfig, что и оба приёмника, — дефолты (host и пр.)
// живут в одном месте.
const AMO = readConfig(process.env).amo

if (!AMO.subdomain || !AMO.token) {
  console.error('Нужны AMO_SUBDOMAIN и AMO_LONG_TOKEN (в .env или в окружении).')
  process.exit(1)
}

const BASE = `https://${AMO.subdomain}.${AMO.host}/api/v4`

async function amo(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${AMO.token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${init.method || 'GET'} ${path} → ${response.status}\n${text}`)
  }
  return text ? JSON.parse(text) : null
}

/** GET всех кастомных полей сущности с обходом пагинации. */
async function fetchFields(entity) {
  const fields = []
  for (let page = 1; page <= 20; page += 1) {
    const data = await amo(`/${entity}/custom_fields?page=${page}&limit=250`)
    const chunk = data?._embedded?.custom_fields || []
    fields.push(...chunk)
    if (chunk.length < 250) break
  }
  return fields
}

// Список меток — из общего модуля: добавленная там метка сразу попадает и сюда.
const UTM_FIELDS = TRACKING_KEYS.map((key) => ({ key, code: key.toUpperCase(), name: key }))

async function cmdList(entity = 'leads') {
  const fields = await fetchFields(entity)
  console.log(`\nКастомные поля «${entity}» (${fields.length}):\n`)
  for (const field of fields) {
    console.log(
      `${String(field.id).padEnd(10)} ${String(field.type).padEnd(14)} ${String(field.code ?? '—').padEnd(18)} ${field.name}`
    )
  }

  if (entity === 'leads') {
    // Поле под ответ формы не системное: код из AMO_ANSWER_FIELD обязан
    // существовать, иначе amo вернёт 400 и потеряет ВСЮ заявку (FORM.md § 12, п. 8).
    const wanted = String(AMO.answerField || '').toUpperCase()
    if (wanted) {
      const hit = fields.find(
        (field) => String(field.code || '').toUpperCase() === wanted || String(field.id) === wanted
      )
      console.log(
        hit
          ? `\nAMO_ANSWER_FIELD=${AMO.answerField} → поле #${hit.id} («${hit.name}») — есть.`
          : `\n⚠️  AMO_ANSWER_FIELD=${AMO.answerField} в аккаунте НЕ найден. С таким значением amo вернёт 400 и потеряет заявку целиком — либо создай поле, либо оставь переменную пустой.`
      )
    } else {
      console.log(
        '\nAMO_ANSWER_FIELD не задан: ответ на вопрос формы попадёт только в название сделки и в текст Telegram.'
      )
    }
  }
  console.log()
}

async function cmdPipelines() {
  const data = await amo('/leads/pipelines')
  const pipelines = data?._embedded?.pipelines || []
  console.log(`\nВоронки аккаунта «${AMO.subdomain}» (${pipelines.length}):\n`)
  for (const pipeline of pipelines) {
    // Без «Неразобранного» заявка в воронку просто не создастся (FORM.md § 7).
    const unsorted = pipeline.is_unsorted_on ? 'Неразобранное: вкл' : '⚠️ Неразобранное: ВЫКЛ'
    const current = String(pipeline.id) === String(AMO.pipelineId) ? '  ← AMO_PIPELINE_ID' : ''
    console.log(`${String(pipeline.id).padEnd(10)} ${String(unsorted).padEnd(26)} ${pipeline.name}${current}`)
  }
  if (!AMO.pipelineId) {
    console.log('\nAMO_PIPELINE_ID не задан — сделки лягут в воронку по умолчанию (у mate она общая!).')
  }
  console.log()
}

async function cmdEnsureUtm() {
  const fields = await fetchFields('leads')
  const byCode = new Map(fields.filter((f) => f.code).map((f) => [String(f.code).toUpperCase(), f]))
  const byName = new Map(fields.map((f) => [String(f.name).toLowerCase(), f]))

  const mapping = {}
  const toCreate = []

  for (const utm of UTM_FIELDS) {
    const existing = byCode.get(utm.code) || byName.get(utm.name)
    if (existing) {
      mapping[utm.key] = existing.id
      console.log(`✓ ${utm.key} → поле #${existing.id} («${existing.name}»)`)
    } else {
      toCreate.push(utm)
    }
  }

  if (toCreate.length) {
    console.log(`\nСоздаю недостающие поля: ${toCreate.map((f) => f.name).join(', ')}`)
    const created = await amo('/leads/custom_fields', {
      method: 'POST',
      body: JSON.stringify(
        toCreate.map((utm) => ({ name: utm.name, type: 'text', code: utm.code }))
      ),
    })
    const requested = new Map(toCreate.flatMap((utm) => [[utm.code, utm], [utm.name, utm]]))
    for (const field of created?._embedded?.custom_fields || []) {
      const utm =
        requested.get(String(field.code).toUpperCase()) ||
        requested.get(String(field.name).toLowerCase())
      if (utm) {
        mapping[utm.key] = field.id
        console.log(`+ ${utm.key} → поле #${field.id}`)
      }
    }
  }

  console.log('\nЕсли метки в аккаунте лежат в самодельных полях — добавь в .env:\n')
  console.log(`AMO_UTM_FIELD_IDS=${JSON.stringify(mapping)}\n`)
}

async function cmdTestLead() {
  const lead = normalizeLead(
    {
      requestId: `test-${Date.now()}`,
      name: 'Тестовая заявка (amo-fields.mjs)',
      email: 'test@taotransit.com',
      phoneNumber: '+70000000000',
      companyType: 'Проверка интеграции',
      lang: 'ru',
      formName: 'Диагностика интеграции',
      formPage: 'https://taotransit.com/?utm_source=integration-test',
      referer: 'https://ya.ru/search',
      utm_source: 'integration-test',
      utm_campaign: 'diagnostics',
      gclid: 'test-gclid',
      yclid: 'test-yclid',
      _ym_uid: 'test-ym-uid',
    },
    { via: 'script', ip: '127.0.0.1' }
  )

  const config = readConfig(process.env).amo
  const payload = buildAmoUnsortedPayload(lead, config)
  console.log('\nОтправляю в amoCRM:\n', JSON.stringify(payload, null, 2))

  const response = await amo('/leads/unsorted/forms', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  console.log('\nОтвет amoCRM:\n', JSON.stringify(response, null, 2))
  console.log('\nПроверь раздел «Неразобранное» в нужной воронке amoCRM.\n')
}

const [command = 'list', arg] = process.argv.slice(2)

try {
  if (command === 'list') await cmdList(arg === 'contacts' ? 'contacts' : 'leads')
  else if (command === 'pipelines') await cmdPipelines()
  else if (command === 'ensure-utm') await cmdEnsureUtm()
  else if (command === 'test-lead') await cmdTestLead()
  else {
    console.error(
      `Неизвестная команда «${command}». Доступно: list | pipelines | ensure-utm | test-lead`
    )
    process.exit(1)
  }
} catch (error) {
  console.error('\nОшибка:', error.message)
  process.exit(1)
}
