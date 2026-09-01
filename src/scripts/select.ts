/**
 * Свой выпадающий список вместо нативного <select>.
 *
 * Нативный на тёмном рисуется системой: стрелка, поля и белый выпадающий лист
 * приходят от браузера, и CSS до них не дотягивается. Здесь listbox на кнопке,
 * а поведение повторяет нативное — иначе замена была бы ухудшением:
 *
 * — стрелки и Enter/Пробел открывают и выбирают, Escape закрывает;
 * — Home/End прыгают к краям, буквы ищут пункт по началу названия;
 * — фокус остаётся на кнопке, активный пункт объявляется через
 *   aria-activedescendant — это штатный шаблон combobox, и он не ломает
 *   чтение с экрана, в отличие от переноса фокуса внутрь списка;
 * — клик вне и уход фокуса закрывают список.
 */

const TYPEAHEAD_RESET_MS = 500;

function setup(root: HTMLElement) {
  const trigger = root.querySelector<HTMLButtonElement>('[data-select-trigger]');
  const list = root.querySelector<HTMLElement>('[data-select-list]');
  const input = root.querySelector<HTMLInputElement>('[data-select-input]');
  const valueLabel = root.querySelector<HTMLElement>('[data-select-value]');
  const arrow = trigger?.querySelector('svg');
  if (!trigger || !list || !input || !valueLabel) return;

  const options = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
  if (!options.length) return;

  let active = 0;
  let typed = '';
  let typedAt = 0;

  const setActive = (index: number) => {
    active = Math.max(0, Math.min(options.length - 1, index));
    options.forEach((option, i) => {
      option.dataset.active = i === active ? 'true' : 'false';
    });
    const option = options[active];
    trigger.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  };

  const isOpen = () => trigger.getAttribute('aria-expanded') === 'true';

  const open = () => {
    if (isOpen()) return;
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    arrow?.classList.add('-scale-y-100');
    setActive(options.findIndex((o) => o.getAttribute('aria-selected') === 'true'));
  };

  const close = () => {
    if (!isOpen()) return;
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    arrow?.classList.remove('-scale-y-100');
  };

  const select = (index: number) => {
    const option = options[index];
    if (!option) return;
    options.forEach((o, i) => o.setAttribute('aria-selected', i === index ? 'true' : 'false'));
    input.value = option.dataset.value ?? '';
    valueLabel.textContent = option.textContent?.trim() ?? '';
    // Пустой пункт — это подсказка, а не ответ, поэтому он остаётся приглушённым.
    valueLabel.classList.toggle('text-ink-muted', !input.value);
    close();
    trigger.focus();
  };

  trigger.addEventListener('click', () => (isOpen() ? close() : open()));

  trigger.addEventListener('keydown', (event) => {
    const key = event.key;

    if (key === 'Escape') {
      close();
      return;
    }

    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      isOpen() ? select(active) : open();
      return;
    }

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen()) {
        open();
        return;
      }
      setActive(active + (key === 'ArrowDown' ? 1 : -1));
      return;
    }

    if (key === 'Home' || key === 'End') {
      if (!isOpen()) return;
      event.preventDefault();
      setActive(key === 'Home' ? 0 : options.length - 1);
      return;
    }

    // Поиск по первым буквам: одна буква перебирает совпадения по кругу,
    // несколько подряд складываются в строку — как в нативном списке.
    if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now();
      typed = now - typedAt > TYPEAHEAD_RESET_MS ? key : typed + key;
      typedAt = now;
      const needle = typed.toLowerCase();
      const from = typed.length === 1 ? active + 1 : active;
      for (let i = 0; i < options.length; i += 1) {
        const index = (from + i) % options.length;
        const text = options[index].textContent?.trim().toLowerCase() ?? '';
        if (text.startsWith(needle)) {
          open();
          setActive(index);
          return;
        }
      }
    }
  });

  list.addEventListener('click', (event) => {
    const option = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]');
    if (option) select(options.indexOf(option));
  });

  // Наведение и клавиатура подсвечивают один и тот же пункт: две подсветки
  // на экране читаются как две позиции курсора.
  list.addEventListener('pointermove', (event) => {
    const option = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]');
    if (option) setActive(options.indexOf(option));
  });

  root.addEventListener('focusout', () => {
    // Фокус может уйти внутрь того же списка — закрываем только когда он ушёл наружу.
    requestAnimationFrame(() => {
      if (!root.contains(document.activeElement)) close();
    });
  });

  document.addEventListener('pointerdown', (event) => {
    if (!root.contains(event.target as Node)) close();
  });
}

export function initSelects() {
  document.querySelectorAll<HTMLElement>('[data-select]').forEach(setup);
}
