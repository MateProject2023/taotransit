/**
 * Контактные полосы: почта заодно ложится в буфер обмена.
 *
 * Приём из mate (`Footer/ContactLine.jsx`): почтовый клиент настроен не у
 * всех, и `mailto:` у части посетителей не открывает ничего. Клик кладёт
 * адрес в буфер и на две секунды подменяет подпись — `mailto:` при этом
 * не отменяется и отрабатывает своим чередом.
 */
const COPIED_MS = 2000;

export function initContacts(copiedLabel: string) {
  const links = document.querySelectorAll<HTMLAnchorElement>('a[data-contact][data-copy]');

  links.forEach((link) => {
    const label = link.querySelector<HTMLElement>('[data-contact-label]');
    const address = link.dataset.copy;
    if (!label || !address) return;

    const original = label.textContent ?? '';
    let timer: number | undefined;

    link.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(address);
      } catch {
        // буфер недоступен: нет разрешения или небезопасный контекст.
        // Ссылка всё равно сработает, подменять подпись не за что.
        return;
      }
      label.textContent = copiedLabel;
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        label.textContent = original;
      }, COPIED_MS);
    });
  });
}
