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
 *
 * ⚠️ Открытие и закрытие ведёт скрипт, `preventDefault` стоит на каждом
 * нажатии. Так пришлось из-за двух источников дёрганья, и оба неочевидны:
 *
 *  1. Событие `toggle` у <details> асинхронное. Если ждать его, браузер
 *     успевает нарисовать уже открытую панель в полную силу, и только
 *     следующим кадром она прыгает в масштаб 0.92 и начинает выезжать.
 *     Поэтому стартовое состояние ставится ДО `open = true`, в том же
 *     такте: первый же кадр рисуется уже правильным.
 *  2. <details> прячет содержимое мгновенно, поэтому уход панели
 *     приходится анимировать до снятия `open` — а значит крест держался бы
 *     ещё 130 мс после нажатия. На время ухода вешаем `data-nav-closing`,
 *     и CSS возвращает штрихи сразу (см. `nav-toggle` в global.css).
 */
import { animate } from 'motion/mini';

/* Тот же порог, что `lg:` в разметке. Совпадение обязано держаться: при
   переходе на десктоп панель надо закрыть, иначе она останется раскрытой
   в разметке и вернётся при обратном сужении. */
const DESKTOP = '(width >= 64rem)';
const EASE = [0.25, 1, 0.5, 1] as const;
const OPEN_MS = 0.18;
/* Уход короче прихода: уходящее меню читается как задержка, а приходящее —
   как движение. */
const CLOSE_MS = 0.13;

export function initNav() {
  const root = document.querySelector<HTMLDetailsElement>('details[data-nav]');
  const summary = root?.querySelector('summary');
  const panel = root?.querySelector<HTMLElement>('[data-nav-panel]');
  if (!root || !summary || !panel) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia(DESKTOP);

  /** Идущая анимация ухода. Пока она есть, `open` ещё стоит. */
  let leaving: ReturnType<typeof animate> | null = null;

  const clearLeaving = () => {
    leaving = null;
    root.removeAttribute('data-nav-closing');
  };

  const open = () => {
    if (reduced.matches) {
      root.open = true;
      return;
    }
    // Стартовое состояние — до раскрытия и в том же такте: см. п. 1 выше.
    panel.style.opacity = '0';
    panel.style.transform = 'scale(0.92)';
    root.open = true;
    animate(panel, { opacity: 1, transform: 'scale(1)' }, { duration: OPEN_MS, ease: EASE });
  };

  const close = () => {
    if (!root.open || leaving) return;
    if (reduced.matches) {
      root.open = false;
      return;
    }
    // Иконка возвращается сразу, панель — за CLOSE_MS: см. п. 2 выше.
    root.setAttribute('data-nav-closing', '');
    const anim = animate(panel, { opacity: 0, transform: 'scale(0.96)' }, { duration: CLOSE_MS, ease: EASE });
    leaving = anim;
    anim.then(() => {
      if (leaving !== anim) return; // уход отменили, панель уже открыта
      clearLeaving();
      root.open = false;
      // Инлайновые стили от анимации сняты: иначе следующее открытие без
      // анимации (reduced-motion) покажет панель прозрачной.
      panel.style.opacity = '';
      panel.style.transform = '';
    });
  };

  summary.addEventListener('click', (event) => {
    event.preventDefault(); // раскрытием управляем сами, всегда
    // Нажатие в те 130 мс, пока панель уезжает, значит «всё-таки открыть».
    if (leaving) {
      leaving.stop();
      clearLeaving();
      animate(panel, { opacity: 1, transform: 'scale(1)' }, { duration: OPEN_MS, ease: EASE });
      return;
    }
    if (root.open) close();
    else open();
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
    if (event.matches) {
      root.open = false;
      clearLeaving();
    }
  });
}
