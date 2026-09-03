/**
 * Серверный приёмник заявки. Единственный путь в amoCRM и последний рубеж
 * для Telegram — маршрут целиком описан в FORM.md § 2.
 *
 * Вся логика доставки лежит в общем модуле src/lib/lead.js, который бандлит
 * ещё и Cloudflare Worker (workers/lead-relay). Здесь только транспорт и CORS.
 *
 * ⚠️ Правка общего модуля требует ДВУХ выкаток: деплоя сайта и ручного
 * `wrangler deploy` из workers/lead-relay. Забыл вторую — приёмники разъехались.
 */
import type { APIRoute } from 'astro';

import {
  corsHeadersFor,
  deliverLead,
  normalizeLead,
  readConfig,
  resolveChannels,
} from '../../lib/lead.js';

/* Эндпоинт обязан рендериться по запросу — весь остальной сайт остаётся
   статикой (astro.config.mjs, output по умолчанию). */
export const prerender = false;

/* Секреты читаем из process.env, а не из import.meta.env: второй инлайнится
   на сборке, и смена значения в панели хостинга потребовала бы пересборки.
   На Cloudflare-адаптере переменные пришли бы в locals.runtime.env — тогда
   сигнатуры меняются на ({ request, locals }), см. FORM.md § 9. */
const env = process.env;

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || '';
}

/**
 * Собственный адрес деплоя. Запрос со своей же страницы — по определению не
 * с чужого сайта, поэтому его разрешаем всегда: иначе каждый превью-деплой
 * Vercel (домен у него свой на каждую ветку) отвечал бы форме 403.
 */
function selfOrigin(request: Request): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) return '';
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || 'https';
  return `${proto}://${host}`;
}

function allowedFor(request: Request) {
  return corsHeadersFor(request.headers.get('origin'), [
    selfOrigin(request),
    env.LEAD_ALLOWED_ORIGINS,
  ]);
}

export const OPTIONS: APIRoute = ({ request }) => {
  const cors = allowedFor(request);
  if (!cors) return new Response('Forbidden', { status: 403 });

  return new Response(null, {
    status: 204,
    headers: {
      ...cors,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        request.headers.get('access-control-request-headers') || 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const cors = allowedFor(request);
  if (!cors) return new Response('Forbidden', { status: 403 });

  /* Контракт: 200 почти всегда. Показывать пользователю 5xx за чужой сбой
     некуда — ошибки уходят в логи, наружу никогда. Значит, мониторинг тут
     только по логам, и тишина в них не равна успеху (FORM.md § 12, п. 6).
     Единственное исключение — ниже. */
  try {
    const body = await request.json();
    /* `fallback` — форма пришла сюда после неудачи воркера, `origin` — напрямую
       (воркер не настроен либо запрос не из формы). Различие видно в тексте TG. */
    const via = body?.via === 'fallback' ? 'fallback' : 'origin';
    const lead = normalizeLead(body, { via, ip: clientIp(request) });
    const config = readConfig(env);
    /* Форма обычно просит здесь только amo (Telegram уходит через воркер) и
       добирает telegram отдельным запросом, если воркер не справился. Без
       воркера просит оба канала сразу. */
    const result = await deliverLead(
      lead,
      config,
      resolveChannels(body?.channels, config.channels),
    );

    /* Единственный случай, когда пользователю показывают неудачу: ни один
       запрошенный канал не настроен вовсе (`skipped`, а не `error`). Это не
       сбой доставки, а незаполненный .env — и тогда «Готово, заявка у
       менеджера» было бы прямой ложью: заявка не потерялась по дороге, её
       никто и не отправлял. Форма покажет «Не отправилось» со ссылкой на
       Telegram, и человек дойдёт до менеджера сам.

       Ошибку канала (`error`) сюда не пускаем: там заявка могла уйти, и
       повтор родил бы дубль — это остаётся 200 по контракту. */
    const attempted = [result.telegram, result.amo];
    if (result.delivered === 0 && !attempted.includes('error')) {
      console.error('lead delivery is not configured at all:', result);
      return new Response(
        JSON.stringify({ ok: false, retryable: false, error: 'not_configured', ...result }),
        { status: 503, headers: { 'Content-Type': 'application/json', ...cors } },
      );
    }
  } catch (error) {
    console.error('lead handler error:', error);
  }

  return new Response('ok', { status: 200, headers: cors });
};

/* Health-check: отвечает, не раскрывая ни одного секрета. Полезен, чтобы
   отличить «эндпоинт не задеплоен» от «эндпоинт молчит». */
export const GET: APIRoute = () => {
  const config = readConfig(env);
  return new Response(
    JSON.stringify({
      ok: true,
      service: 'taotransit-lead',
      channels: config.channels,
      telegram: Boolean(config.telegram.botToken && config.telegram.chatId),
      amo: Boolean(config.amo.subdomain && config.amo.token),
      pipeline: Boolean(config.amo.pipelineId),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
