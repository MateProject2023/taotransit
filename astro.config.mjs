// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

/**
 * Адрес сайта. Из него собираются canonical, og:url, og:image, JSON-LD,
 * robots.txt и sitemap.xml — то есть все абсолютные ссылки на странице.
 *
 * Пока боевой домен taotransit.com отдаёт старую Тильду, зашивать его в
 * превью-сборку нельзя: og:image указывал бы на несуществующий файл чужого
 * сайта, а canonical — на сам этот чужой сайт. Поэтому адрес берётся из
 * окружения, а хардкод остаётся только для локальной сборки.
 *
 * Порядок:
 *   1. PUBLIC_SITE_URL          — ставится вручную, когда домен переедет;
 *   2. VERCEL_PROJECT_PRODUCTION_URL — постоянный домен проекта на Vercel;
 *   3. VERCEL_URL               — адрес конкретного деплоя (превью веток);
 *   4. https://taotransit.com   — локальная сборка и `npm run preview`.
 *
 * От того, совпал ли хост с боевым, зависит ещё и индексация: см.
 * src/pages/robots.txt.ts и мета-тег robots в Layout.astro.
 */
const env = process.env;
const site =
  env.PUBLIC_SITE_URL ||
  (env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  (env.VERCEL_URL && `https://${env.VERCEL_URL}`) ||
  'https://taotransit.com';

/**
 * Адаптер нужен ровно одной странице — src/pages/api/lead.ts, приёмнику заявок
 * (FORM.md § 9). Весь остальной сайт остаётся статикой: `output` не трогаем,
 * по умолчанию он `'static'`, а серверным помечается только сам эндпоинт
 * через `export const prerender = false`.
 *
 * ⚠️ С адаптером сборка уезжает из `dist/` в `.vercel/output/` (Build Output
 * API). Поэтому в vercel.json снято `outputDirectory` — иначе Vercel искал бы
 * статику там, где её больше нет.
 */
// https://astro.build/config
export default defineConfig({
  site,
  adapter: vercel(),
  /**
   * Своя проверка вместо встроенной. `checkOrigin` у Astro включён по умолчанию
   * и режет любой кросс-доменный POST с телом text/plain — то есть ровно тот
   * запрос, который шлёт форма (Content-Type не задаётся намеренно, чтобы не
   * было preflight, FORM.md § 12, п. 3). Проблема не в строгости, а в том, что
   * это ВТОРАЯ дверь с другими правилами: список ALLOWED_ORIGINS в
   * src/lib/lead.js общий у сервера и воркера, а встроенная проверка про него
   * не знает — приёмники начали бы отвечать по-разному на один и тот же запрос.
   *
   * Наша проверка при этом строже встроенной: та сравнивает Origin с адресом
   * запроса только когда заголовок есть, а src/pages/api/lead.ts без Origin
   * отвечает 403 всегда.
   */
  security: {
    checkOrigin: false,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
