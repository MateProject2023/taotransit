// @ts-check
import { defineConfig } from 'astro/config';
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

// https://astro.build/config
export default defineConfig({
  site,
  vite: {
    plugins: [tailwindcss()],
  },
});
