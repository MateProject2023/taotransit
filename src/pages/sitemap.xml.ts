import type { APIRoute } from 'astro';
import { PRODUCTION_HOST } from '../lib/site';

/**
 * Одна страница — один URL. Полноценная интеграция sitemap здесь избыточна:
 * у Тильды в ситемапе ровно та же единственная ссылка.
 *
 * Адрес всегда боевой, даже если сборка стоит на превью-домене: карта сайта
 * описывает сайт, а не деплой. На превью её всё равно никто не прочитает —
 * robots.txt там закрыт целиком.
 */
export const GET: APIRoute = () => {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${PRODUCTION_HOST}/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
