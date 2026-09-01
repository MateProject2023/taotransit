/**
 * Появление блоков при прокрутке — повторяет анимации оригинала
 * (в Тильде это data-animate-style + distance + delay, duration 1 с).
 *
 * Начальное состояние задаёт CSS (см. `.anim [data-anim]` в global.css),
 * здесь только переход к нулю. `animate` берём из motion/mini — это
 * обёртка над WAAPI, она в разы легче основного бандла.
 */
import { animate } from 'motion/mini';
import { inView } from 'motion';

export function initAnimations() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll<HTMLElement>('[data-anim]').forEach((el) => {
    const delay = Number(el.dataset.animDelay ?? 0);

    inView(
      el,
      () => {
        animate(
          el,
          { opacity: 1, transform: 'translate3d(0, 0, 0)' },
          { duration: 1, delay, ease: [0.22, 0.61, 0.36, 1] },
        );
        return false; // как в оригинале — один раз
      },
      { amount: 0.15 },
    );
  });
}
