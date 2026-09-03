/**
 * Документы в модальных окнах и плашка про сбор данных.
 *
 * Окна — нативные <dialog>: фокус, Escape и inert для остальной страницы
 * достаются даром. Здесь только открытие, закрытие по клику мимо и память
 * о выборе в плашке.
 */
import { cookieNotice } from '../content/legal';

/** Что ответил посетитель. `null` — ещё не спрашивали. */
type Consent = 'accepted' | 'necessary' | null;

/* localStorage бросает в приватном режиме и при запрете хранилища — тогда
   плашка просто покажется снова. Терять из-за этого страницу нельзя. */
function readConsent(): Consent {
  try {
    const value = localStorage.getItem(cookieNotice.storageKey);
    return value === 'accepted' || value === 'necessary' ? value : null;
  } catch {
    return null;
  }
}

function writeConsent(value: Exclude<Consent, null>) {
  try {
    localStorage.setItem(cookieNotice.storageKey, value);
  } catch {
    /* не сохранилось — не повод ломать страницу */
  }
}

/**
 * Разрешена ли аналитика. Отсюда её спрашивают счётчики (src/scripts/analytics.ts):
 * пока ответа нет или он «только необходимые», ни один не подключается.
 */
export function analyticsAllowed(): boolean {
  return readConsent() === 'accepted';
}

/** Кого разбудить, когда посетитель ответит на плашку. */
const consentListeners = new Set<(allowed: boolean) => void>();

/**
 * Подписка на ответ. Нужна, чтобы согласие включало счётчик тем же визитом,
 * а не со следующей загрузки страницы. Хранится в модуле, поэтому порядок
 * initLegal / initAnalytics в разметке значения не имеет.
 */
export function onConsentAnswer(listener: (allowed: boolean) => void) {
  consentListeners.add(listener);
}

export function initLegal() {
  const dialogs = new Map<string, HTMLDialogElement>();
  for (const dialog of document.querySelectorAll<HTMLDialogElement>('[data-legal]')) {
    dialogs.set(dialog.dataset.legal ?? '', dialog);
  }

  if (dialogs.size) {
    document.addEventListener('click', (event) => {
      const opener = (event.target as HTMLElement).closest<HTMLElement>('[data-legal-open]');
      if (!opener) return;
      event.preventDefault();
      dialogs.get(opener.dataset.legalOpen ?? '')?.showModal();
    });

    for (const dialog of dialogs.values()) {
      dialog.querySelector('[data-legal-close]')?.addEventListener('click', () => dialog.close());
      // Клик мимо листа: у <dialog> подложка — часть самого элемента,
      // поэтому «мимо» это событие, у которого target и есть диалог.
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
      });
    }
  }

  const banner = document.querySelector<HTMLElement>('[data-cookie-banner]');
  if (!banner) return;

  if (readConsent() === null) banner.hidden = false;

  const answer = (value: Exclude<Consent, null>) => {
    writeConsent(value);
    banner.hidden = true;
    for (const listener of consentListeners) listener(value === 'accepted');
  };

  banner.querySelector('[data-cookie-accept]')?.addEventListener('click', () => answer('accepted'));
  banner.querySelector('[data-cookie-decline]')?.addEventListener('click', () => answer('necessary'));
}
