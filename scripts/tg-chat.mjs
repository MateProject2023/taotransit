#!/usr/bin/env node
/**
 * Утилита для настройки Telegram-канала заявок (запускается локально, руками).
 *
 *   node scripts/tg-chat.mjs whoami
 *       — кто этот бот и стоит ли на нём вебхук. Запускать ПЕРВЫМ.
 *
 *   node scripts/tg-chat.mjs chats
 *       — показать беседы, в которых бот видел сообщения, и их chat_id.
 *         Отсюда берётся CHAT_ID для новой беседы под заявки TAO.
 *
 *   node scripts/tg-chat.mjs test
 *       — отправить в CHAT_ID тестовое сообщение ровно того формата,
 *         который придёт из формы.
 *
 * Доступы берутся из .env в корне репозитория: TG_BOT_TOKEN, CHAT_ID,
 * (опц.) CHAT_THREAD_ID.
 *
 * ⚠️ ГЛАВНОЕ ПРАВИЛО: на этом токене НИКОГДА не вызывать setWebhook и
 * deleteWebhook. Бот живой; подмена или снятие вебхука молча ломает поток,
 * который через него ходит. Этот скрипт их и не умеет — только чтение и
 * исходящий sendMessage, которые с вебхуком сосуществуют.
 *
 * `getUpdates` на боте с активным вебхуком не работает (409) и, хуже того,
 * может перехватить апдейт, предназначенный вебхуку, — поэтому команда `chats`
 * сначала проверяет вебхук и отказывается работать, если он стоит. Тогда
 * chat_id берётся иначе: у владельца бота из его бекенда, либо временно через
 * отдельного бота, добавленного в ту же беседу.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildTelegramText, normalizeLead } from '../src/lib/lead.js'

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
    // .env может отсутствовать — переменные могут прийти из окружения.
  }
}

loadDotEnv()

const TOKEN = process.env.TG_BOT_TOKEN || ''
if (!TOKEN) {
  console.error('Нужен TG_BOT_TOKEN (в .env или в окружении).')
  process.exit(1)
}

async function tg(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: body ? 'POST' : 'GET',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  })
  const data = await response.json().catch(() => null)
  if (!data?.ok) {
    throw new Error(`${method} → ${response.status}: ${data?.description || 'нет ответа'}`)
  }
  return data.result
}

async function webhookInfo() {
  const info = await tg('getWebhookInfo')
  return { url: info.url || '', info }
}

async function cmdWhoami() {
  const me = await tg('getMe')
  console.log(`\nБот: @${me.username} (${me.first_name}), id ${me.id}`)
  console.log(`Может читать все сообщения в группах: ${me.can_read_all_group_messages ? 'да' : 'нет'}`)

  const { url, info } = await webhookInfo()
  if (url) {
    console.log(`\n⚠️  На боте СТОИТ вебхук: ${url}`)
    console.log('   Это живой бот. НЕ вызывай setWebhook/deleteWebhook — сломаешь чужой поток.')
    console.log('   Исходящий sendMessage при этом работает: команда `test` безопасна.')
    console.log('   А вот `chats` (getUpdates) на таком боте недоступна — chat_id придётся')
    console.log('   получить иначе (см. шапку файла и FORM.md § 6).')
    if (info.pending_update_count) {
      console.log(`   Необработанных апдейтов в очереди: ${info.pending_update_count}`)
    }
  } else {
    console.log('\nВебхука нет — команда `chats` сработает.')
  }
  console.log()
}

async function cmdChats() {
  const { url } = await webhookInfo()
  if (url) {
    console.error(`\n⚠️  Отказываюсь: на боте стоит вебхук (${url}).`)
    console.error('getUpdates перехватил бы апдейт, предназначенный ему. Возьми chat_id иначе —')
    console.error('см. шапку scripts/tg-chat.mjs и FORM.md § 6.\n')
    process.exit(1)
  }

  // offset/limit не трогаем: getUpdates без confirm-offset ничего не «съедает».
  const updates = await tg('getUpdates')
  const chats = new Map()
  for (const update of updates) {
    const message = update.message || update.channel_post || update.edited_message
    const chat = message?.chat
    if (!chat) continue
    const existing = chats.get(chat.id) || { chat, threads: new Set() }
    if (message.message_thread_id) existing.threads.add(message.message_thread_id)
    chats.set(chat.id, existing)
  }

  if (!chats.size) {
    console.log('\nБот не видел ни одного сообщения.')
    console.log('Добавь его в беседу, дай право писать, напиши в ней что угодно и повтори.')
    console.log('В группах с включённым privacy mode бот видит только сообщения, адресованные ему.\n')
    return
  }

  console.log(`\nБеседы, которые видел бот (${chats.size}):\n`)
  for (const { chat, threads } of chats.values()) {
    const title = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || '—'
    console.log(`CHAT_ID=${chat.id}   ${String(chat.type).padEnd(10)} ${title}`)
    if (threads.size) {
      console.log(`   темы (форум): CHAT_THREAD_ID=${[...threads].join(' | ')}`)
    }
  }
  console.log('\nУ супергрупп id отрицательный и начинается с -100 — минус обязателен.')
  console.log('Для TAO нужна ОТДЕЛЬНАЯ беседа, не та, куда падают заявки mate.\n')
}

async function cmdTest() {
  const chatId = process.env.CHAT_ID || ''
  if (!chatId) {
    console.error('Нужен CHAT_ID (в .env). Найти его: node scripts/tg-chat.mjs chats')
    process.exit(1)
  }

  const lead = normalizeLead(
    {
      requestId: `test-${Date.now()}`,
      name: 'Тестовая заявка (tg-chat.mjs)',
      email: 'test@taotransit.com',
      phoneNumber: '+70000000000',
      companyType: 'Проверка интеграции',
      lang: 'ru',
      formName: 'Диагностика интеграции',
      formPage: 'https://taotransit.com/?utm_source=integration-test&gclid=test',
      referer: 'https://ya.ru/search',
      utm_source: 'integration-test',
      utm_campaign: 'diagnostics',
      gclid: 'test',
      _ym_uid: 'test-ym-uid',
    },
    { via: 'script', ip: '127.0.0.1' }
  )

  const threadId = Number(process.env.CHAT_THREAD_ID)
  const result = await tg('sendMessage', {
    chat_id: chatId,
    text: buildTelegramText(lead),
    disable_web_page_preview: true,
    ...(Number.isInteger(threadId) ? { message_thread_id: threadId } : {}),
  })

  console.log(`\nОтправлено в «${result.chat?.title || result.chat?.id}», message_id ${result.message_id}.`)
  console.log('Строка «⚠ доставлено через script» — норма для этого скрипта: она отмечает')
  console.log('нештатный маршрут. Из формы её быть не должно.\n')
}

const [command = 'whoami'] = process.argv.slice(2)

try {
  if (command === 'whoami') await cmdWhoami()
  else if (command === 'chats') await cmdChats()
  else if (command === 'test') await cmdTest()
  else {
    console.error(`Неизвестная команда «${command}». Доступно: whoami | chats | test`)
    process.exit(1)
  }
} catch (error) {
  console.error('\nОшибка:', error.message)
  process.exit(1)
}
