/**
 * Появление блоков при прокрутке — повторяет анимации оригинала
 * (в Тильде это data-animate-style + distance + delay).
 *
 * Начальное состояние задаёт CSS (см. `.anim [data-anim]` в global.css),
 * здесь только переход к нулю. `animate` берём из motion/mini — это
 * обёртка над WAAPI, она в разы легче основного бандла.
 */
import { animate } from 'motion/mini';
import { inView } from 'motion';

export function initAnimations() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const els = document.querySelectorAll<HTMLElement>('[data-anim]');
  if (!els.length) return;

  // Порядок querySelectorAll — порядок документа, а он здесь совпадает
  // с вертикальным. На это опирается sweep ниже.
  const pending = new Set<HTMLElement>(els);

  const show = (el: HTMLElement) => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  };

  /*
    Страховка от «невидим навсегда». IntersectionObserver сравнивает состояние
    между кадрами: если элемент пролетел весь экран за один кадр (очень быстрая
    прокрутка, переход по якорю, восстановление позиции при перезагрузке),
    пересечения он не увидит и обратный вызов не сработает никогда — а
    начальное состояние в CSS это opacity: 0.

    Поймано замером: скриншотилка листает со скоростью ~9000 px/с и стабильно
    оставляла «Ценности» пустыми.

    Обход коалесцируется в кадр и разделён на фазы: сперва читаем геометрию,
    потом пишем стили. Запись внутри цикла чтения инвалидировала бы стиль и
    форсировала перевёрстку на каждой итерации — прямо в обработчике прокрутки.
  */
  let queued = 0;
  const sweep = () => {
    queued = 0;
    const done: HTMLElement[] = [];
    for (const el of pending) {
      // Элементы идут сверху вниз: как только встретился тот, что ещё не
      // уехал за верхний край, ниже проверять нечего.
      if (el.getBoundingClientRect().bottom >= 0) break;
      done.push(el);
    }
    for (const el of done) {
      show(el);
      pending.delete(el);
    }
    if (pending.size === 0) removeEventListener('scroll', onScroll);
  };
  const onScroll = () => {
    if (queued) return;
    queued = requestAnimationFrame(sweep);
  };
  addEventListener('scroll', onScroll, { passive: true });

  // Один наблюдатель на все элементы: inView создаёт IntersectionObserver
  // на каждый вызов, поэтому поэлементный цикл давал двадцать наблюдателей
  // с одинаковыми настройками.
  inView(
    els,
    (el) => {
      const target = el as HTMLElement;
      pending.delete(target);
      animate(
        target,
        { opacity: 1, transform: 'translate3d(0, 0, 0)' },
        // 600 мс вместо унаследованной от Тильды секунды: на дистанции
        // 330 px секунда читается как вязкость, особенно с телефона.
        // Кривая — та же ease-out-quart, что у всех переходов в global.css.
        { duration: 0.6, delay: Number(target.dataset.animDelay ?? 0), ease: [0.25, 1, 0.5, 1] },
      );
      return false; // как в оригинале — один раз
    },
    { amount: 0.15 },
  );
}
