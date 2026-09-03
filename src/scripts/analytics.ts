/**
 * Счётчики: Яндекс.Метрика и Google-тег (gtag.js, GA4).
 *
 * Здесь две вещи, и обе неочевидны.
 *
 * 1. НИЧЕГО НЕ ГРУЗИТСЯ ДО СОГЛАСИЯ. Оба счётчика подключаются только после
 *    «Принять» в плашке — ни запроса, ни cookie до ответа. Это не осторожность
 *    ради осторожности: кнопка «Только необходимые» и текст документа о cookie
 *    (src/content/legal.ts, § 2) прямо обещают именно это. Подключить счётчик
 *    в <head> «как обычно» — значит сделать обе надписи ложью.
 *
 *    Отсюда же отказ от <noscript>-пикселя Метрики: без JS плашки нет, значит
 *    нет и согласия, а пиксель посчитал бы визит.
 *
 * 2. Consent Mode у Google выставляется явно. Google своим порядком («грузите
 *    тег всегда, а согласие передавайте отдельно») пользоваться не будем —
 *    он шлёт обезличенные пинги даже при denied, то есть запрос всё равно
 *    уходит. Мы грузим тег уже после согласия, но состояния всё равно
 *    объявляем: analytics_storage — granted, рекламные — denied, потому что
 *    рекламных кабинетов у сайта нет и посетитель на них не соглашался.
 *
 * Локальные сборки не считаем: иначе в статистику попадут визиты разработки.
 */
import { analyticsAllowed, onConsentAnswer } from './legal';

/* Идентификаторы публичны и живут в коде: у них нет ни срока, ни секрета.
   Переменная окружения нужна для одного — погасить счётчик на отдельной
   сборке, задав ей пустое значение. */
const YM_ID = import.meta.env.PUBLIC_YM_ID ?? '112274964';
const GA_ID = import.meta.env.PUBLIC_GA_ID ?? 'G-C19XJZ9B84';

/** Цель Метрики на отправленную заявку. Заводится в интерфейсе счётчика. */
const LEAD_GOAL = 'sendForm';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
const isLocal = () =>
  import.meta.env.DEV || LOCAL_HOSTS.includes(location.hostname) || location.hostname.endsWith('.local');

let started = false;

function startMetrika() {
  if (!YM_ID) return;

  /* Код вставки Метрики, разложенный в понятный вид: стаб копит вызовы в
     `ym.a`, пока едет tag.js, а `ym.l` — отметка старта, её счётчик читает сам. */
  const queue: NonNullable<Window['ym']> = Object.assign(
    (...args: unknown[]) => {
      (queue.a ||= []).push(args);
    },
    { l: Date.now() },
  );
  const ym = (window.ym ||= queue);

  const src = `https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}`;
  if (![...document.scripts].some((script) => script.src === src)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  }

  ym(YM_ID, 'init', {
    ssr: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });
}

function startGoogle() {
  if (!GA_ID) return;

  const layer = (window.dataLayer ||= []);
  /* Обычная функция, а не стрелка с rest: gtag кладёт в очередь именно объект
     arguments, и тег разбирает его по позициям. Массив ломает разбор. */
  const gtag = (window.gtag ||= function gtag() {
    layer.push(arguments);
  });

  // Порядок обязателен: consent → js → config, и всё это до загрузки тега.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  });
  gtag('js', new Date());
  gtag('config', GA_ID);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

function start() {
  if (started) return;
  started = true;

  if (isLocal()) {
    console.info('аналитика пропущена: локальная сборка (src/scripts/analytics.ts)');
    return;
  }

  startMetrika();
  startGoogle();
}

export function initAnalytics() {
  if (analyticsAllowed()) {
    start();
    return;
  }
  // Согласия ещё нет — ждём ответа на плашку и подключаемся тем же визитом.
  onConsentAnswer((allowed) => {
    if (allowed) start();
  });
}

/**
 * Цель «заявка отправлена». Счётчика может не быть — согласия не дали, скрипт
 * не доехал, блокировщик, — и это не повод ронять форму: заявка уже доставлена.
 */
export function trackLead() {
  try {
    window.ym?.(YM_ID, 'reachGoal', LEAD_GOAL);
  } catch (error) {
    console.warn('цель Метрики не отправилась', error);
  }
  try {
    // Стандартное событие GA4 для лида — по нему считается конверсия.
    window.gtag?.('event', 'generate_lead');
  } catch (error) {
    console.warn('событие GA не отправилось', error);
  }
}
