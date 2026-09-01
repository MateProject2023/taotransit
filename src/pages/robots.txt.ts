import type { APIRoute } from 'astro';
import { PRODUCTION_HOST, isProductionHost } from '../lib/site';

/**
 * robots.txt собирается, а не лежит в public/, ради одной развилки:
 * пока сборка живёт не на боевом домене, индексировать её нельзя.
 *
 * Иначе превью на *.vercel.app попадёт в выдачу и станет дублем живого
 * taotransit.com — того самого, который сейчас отдаёт Тильда.
 */
export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL(`https://${PRODUCTION_HOST}`);

  const body = isProductionHost(base)
    ? `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', base).href}\n`
    : `# Сборка вне боевого домена — в поиск не отдаём.\nUser-agent: *\nDisallow: /\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
