#!/usr/bin/env node
/**
 * Отдаёт собранную статику для замерялок и глазной сверки.
 *
 *   node scripts/serve-build.mjs [порт]      # по умолчанию 4399
 *
 * Зачем свой сервер, а не `astro preview`: с адаптером @astrojs/vercel команда
 * `preview` не работает (адаптер её не реализует), а сама сборка уезжает из
 * `dist/` в `.vercel/output/static/`. Порт 4399 выбран не случайно — это
 * значение по умолчанию у scripts/contrast-audit.mjs, так что связка
 * `node scripts/serve-build.mjs` + `node scripts/contrast-audit.mjs`
 * работает без флагов.
 *
 * ⚠️ Это ФАЙЛОВЫЙ сервер: /api/lead он не отдаст — эндпоинт рендерится
 * по запросу и живёт в .vercel/output/functions. Для него нужен `npm run dev`
 * (или `vercel dev`, если хочется именно среды Vercel).
 */
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)), '.vercel/output/static')
const PORT = Number(process.argv[2]) || 4399

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

/** Путь внутри ROOT и только внутри: `..` в запросе никуда не выводит. */
function resolvePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  const full = join(ROOT, clean)
  return full.startsWith(ROOT) ? full : null
}

async function fileFor(urlPath) {
  const base = resolvePath(urlPath)
  if (!base) return null
  for (const candidate of [base, join(base, 'index.html'), `${base}.html`]) {
    try {
      const info = await stat(candidate)
      if (info.isFile()) return candidate
    } catch {
      // следующий кандидат
    }
  }
  return null
}

createServer(async (req, res) => {
  const file = await fileFor(req.url || '/')
  if (!file) {
    const notFound = await fileFor('/404.html')
    if (notFound) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] })
      return createReadStream(notFound).pipe(res)
    }
    res.writeHead(404, { 'Content-Type': TYPES['.txt'] })
    return res.end('404')
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' })
  createReadStream(file).pipe(res)
}).listen(PORT, () => {
  console.log(`Сборка на http://127.0.0.1:${PORT}/  (${ROOT})`)
  console.log('Замеры: node scripts/contrast-audit.mjs | node scripts/gradient-audit.mjs --url=…')
})
