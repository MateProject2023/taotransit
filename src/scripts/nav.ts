/**
 * Мобильное меню: бургер слева, панель вырастает из его угла.
 *
 * Заказчик просил поведение контекстного меню — того, что открывается по
 * правой кнопке: панель появляется у точки нажатия, а не выезжает шторкой
 * во весь экран. Отсюда `transform-origin: top left` и масштаб 0.92 → 1;
 * подложки нет намеренно, контекстное меню страницу не гасит.
 *
 * Разметка — <details>/<summary>, поэтому без JS меню всё равно
 * открывается. Здесь только надстройка: анимация, закрытие кликом мимо,
 * по Escape и по переходу на пункт.
 *
 * До 1024px это единственная навигация: горизонтальной ленты с прокруткой
 * больше нет. Порог тот же, на котором пилюля перестаёт быть лентой —
 * восьми пунктам нужно 926px, и колонка доходит до этого только к 1024.
 */
import { animate } from 'motion/mini';

/* Тот же порог, что `lg:` в разметке. Совпадение обязано держаться: при
   переходе на десктоп панель надо закрыть, иначе она останется раскрытой
   в разметке и вернётся при обратном сужении. */
const DESKTOP = '(width >= 64rem)';
const EASE = [0.25, 1, 0.5, 1] as const;

export function initNav() {
  const root = document.querySelector<HTMLDetailsElement>('details[data-nav]');
  const summary = root?.querySelector('summary');
  const panel = root?.querySelector<HTMLElement>('[data-nav-panel]');
  if (!root || !summary || !panel) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia(DESKTOP);

  /** Идущая анимация закрытия. Пока она есть, `open` ещё true. */
  let closing: ReturnType<typeof animate> | null = null;

  const animateIn = () => {
    if (reduced.matches) return;
    animate(
      panel,
      { opacity: [0, 1], transform: ['scale(0.92)', 'scale(1)'] },
      { duration: 0.18, ease: EASE },
    );
  };

  const close = () => {
    if (!root.open || closing) return;
    if (reduced.matches) {
      root.open = false;
      return;
    }
    // Закрытие короче открытия: уходящее меню читается как задержка, а
    // приходящее — как движение.
    const anim = animate(panel, { opacity: 0, transform: 'scale(0.96)' }, { duration: 0.12, ease: EASE });
    closing = anim;
    anim.then(() => {
      if (closing !== anim) return; // закрытие отменили, панель уже открыта
      closing = null;
      root.open = false;
      // Инлайновые стили от анимации сняты: без них следующее открытие
      // без JS-анимации (reduced-motion) не покажет панель прозрачной.
      panel.style.opacity = '';
      panel.style.transform = '';
    });
  };

  /*
    Открытие отдаём браузеру, закрытие перехватываем: <details> прячет
    содержимое мгновенно, и уходящей анимации просто негде случиться.
  */
  summary.addEventListener('click', (event) => {
    // Нажатие в те 120 мс, пока панель уезжает, значит «всё-таки открыть».
    if (closing) {
      event.preventDefault();
      closing.stop();
      closing = null;
      animateIn();
      return;
    }
    if (!root.open) return; // откроется само, анимацию поставит toggle
    event.preventDefault();
    close();
  });

  root.addEventListener('toggle', () => {
    if (root.open) animateIn();
  });

  // Клик мимо. Слушаем на документе, а не на подложке: подложки нет.
  document.addEventListener('click', (event) => {
    if (root.open && !root.contains(event.target as Node)) close();
  });

  // Переход по якорю закрывает меню сам: якорь уводит к секции, и панель
  // осталась бы висеть поверх того, куда только что привела.
  panel.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('a')) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !root.open) return;
    close();
    summary.focus();
  });

  desktop.addEventListener('change', (event) => {
    if (event.matches) root.open = false;
  });
}
