/**
 * Отправка заявки с формы. Внутренняя механика приёмников описана в FORM.md;
 * здесь только клиентская половина, и она уже полная: тело запроса,
 * рекламные метки, два параллельных запроса и добор после сбоя воркера.
 *
 * Пока приёмников нет (этап 2 не начат), работает демо-режим: ни одного
 * запроса не уходит, форма показывает успех и предупреждает в консоли.
 * Режим выключается сам, как только в .env появляется адрес приёмника.
 */

/**
 * Копия TRACKING_KEYS из src/lib/lead.js (FORM.md § 8.1). Импортировать
 * серверный модуль сюда нельзя — он бандлится в воркер и в роут, а не в
 * страницу. Списки обязаны совпадать; правка нужна в обоих местах.
 */
const TRACKING_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_referrer',
  'gclid',
  'yclid',
  'fbclid',
  'roistat',
  '_ym_uid',
] as const;

const RELAY_URL = import.meta.env.PUBLIC_LEAD_RELAY_URL ?? '';
const ORIGIN_URL = import.meta.env.PUBLIC_LEAD_ORIGIN_URL ?? '';

/** Ни одного приёмника не настроено — значит, отправлять некуда. */
const DEMO = !RELAY_URL && !ORIGIN_URL;

/* Воркер живёт на *.workers.dev, у части RU-операторов он режется и умирает
   по таймауту. Ждём его недолго и уходим на проверенный путь; фолбэку —
   полный бюджет. */
const RELAY_TIMEOUT_MS = 4000;
const ORIGIN_TIMEOUT_MS = 9000;

type PostResult = { ok: boolean; retryable: boolean };

async function postLead(url: string, payload: object, timeoutMs: number): Promise<PostResult> {
  if (!url) return { ok: false, retryable: true };
  try {
    const response = await fetch(url, {
      method: 'POST',
      // Content-Type намеренно не задаём: с text/plain браузер не шлёт preflight,
      // а обе стороны всё равно читают тело через .json().
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.ok) return { ok: true, retryable: false };

    // Можно ли повторить — решает приёмник, клиент кодов ответа не разбирает.
    const body = await response.json().catch(() => null);
    return { ok: false, retryable: body?.retryable !== false };
  } catch (error) {
    console.error('lead post failed', url, error);
    return { ok: false, retryable: true };
  }
}

function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

export type LeadValues = {
  name: string;
  phone: string;
  email: string;
  need: string;
};

async function submitLead(values: LeadValues): Promise<boolean> {
  const params = new URLSearchParams(location.search);
  const payload = {
    requestId: crypto.randomUUID(),
    name: values.name,
    email: values.email,
    phoneNumber: values.phone, // нормализует приёмник
    companyType: values.need,
    lang: document.documentElement.lang || 'ru',
    formName: 'Форма на сайте',
    formPage: location.href,
    referer: document.referrer,
    ...Object.fromEntries(TRACKING_KEYS.map((key) => [key, params.get(key) ?? ''])),
    // не URL-параметр: cookie Метрики, чтобы сшить сделку с визитом
    _ym_uid: readCookie('_ym_uid'),
  };

  /* Цель Метрики. Своего счётчика у TAO пока нет (CLAUDE.md § Analytics),
     поэтому вызова тут нет — но обёртка в try/catch обязательна, когда он
     появится: неподгрузившийся счётчик не повод терять заявку. */

  if (DEMO) {
    console.warn(
      'форма в демо-режиме: приёмник не настроен, заявка никуда не ушла. См. FORM.md § 1',
      payload,
    );
    return true;
  }

  const useRelay = Boolean(RELAY_URL);
  const [relay, origin] = await Promise.all([
    useRelay ? postLead(RELAY_URL, { ...payload, channels: ['telegram'] }, RELAY_TIMEOUT_MS) : null,
    postLead(
      ORIGIN_URL,
      { ...payload, channels: useRelay ? ['amo'] : ['amo', 'telegram'] },
      ORIGIN_TIMEOUT_MS,
    ),
  ]);

  let delivered = origin.ok || Boolean(relay?.ok);

  /* Воркер не смог — добираем Telegram с сервера. Дубля не будет: retryable
     он ставит, только когда не доставил ничего. */
  if (relay && !relay.ok && relay.retryable) {
    const retry = await postLead(
      ORIGIN_URL,
      { ...payload, via: 'fallback', channels: ['telegram'] },
      ORIGIN_TIMEOUT_MS,
    );
    delivered = delivered || retry.ok;
  }

  return delivered;
}

/** Телефон принимаем в любом виде, но десять цифр — это минимум номера в СНГ. */
const isPhone = (value: string) => value.replace(/\D/g, '').length >= 10;
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

export function initLeadForm() {
  const form = document.querySelector<HTMLFormElement>('[data-lead-form]');
  if (!form) return;

  const done = document.querySelector<HTMLElement>('[data-lead-done]');
  const failure = form.querySelector<HTMLElement>('[data-lead-failure]');
  const button = form.querySelector<HTMLButtonElement>('[data-lead-submit]');
  const buttonLabel = button?.textContent ?? '';

  const fieldError = (name: string) =>
    form.querySelector<HTMLElement>(`[data-lead-error="${name}"]`);

  const setError = (name: string, message: string) => {
    const input = form.elements.namedItem(name);
    const slot = fieldError(name);
    if (slot) {
      slot.textContent = message;
      slot.hidden = !message;
    }
    if (input instanceof HTMLElement) {
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
    return !message;
  };

  const value = (name: string) => {
    const input = form.elements.namedItem(name);
    return input instanceof HTMLInputElement || input instanceof HTMLSelectElement
      ? input.value.trim()
      : '';
  };

  /* Телефон печатают как привыкли, поэтому маски нет — только отсев символов,
     которые в номер попасть не могут. Приёмник всё равно оставит одни цифры. */
  const phone = form.elements.namedItem('phone');
  if (phone instanceof HTMLInputElement) {
    phone.addEventListener('input', () => {
      const cleaned = phone.value.replace(/[^\d+\s()-]/g, '');
      if (cleaned !== phone.value) phone.value = cleaned;
    });
  }

  // Ошибка снимается по мере исправления, а не только на следующей отправке.
  form.addEventListener('input', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.getAttribute('aria-invalid') === 'true') {
      setError(target.getAttribute('name') ?? '', '');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (button?.disabled) return;

    const errors = form.dataset.leadErrors ? JSON.parse(form.dataset.leadErrors) : {};
    const values: LeadValues = {
      name: value('name'),
      phone: value('phone'),
      email: value('email'),
      need: value('need'),
    };

    const checks = [
      setError('name', values.name ? '' : errors.name),
      setError('phone', isPhone(values.phone) ? '' : errors.phone),
      setError('email', !values.email || isEmail(values.email) ? '' : errors.email),
    ];
    if (checks.includes(false)) {
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }

    /* Honeypot: поле уведено за экран и скрыто от скринридеров, человек его
       не видит. Заполнено — молча показываем успех и никуда не идём. */
    if (value('company')) {
      form.hidden = true;
      if (done) done.hidden = false;
      return;
    }

    if (failure) failure.hidden = true;
    if (button) {
      button.disabled = true;
      button.textContent = form.dataset.leadSubmitting ?? buttonLabel;
    }

    const delivered = await submitLead(values);

    if (button) {
      button.disabled = false;
      button.textContent = buttonLabel;
    }

    if (delivered) {
      form.hidden = true;
      if (done) {
        done.hidden = false;
        done.focus();
      }
      return;
    }

    if (failure) failure.hidden = false;
  });
}
