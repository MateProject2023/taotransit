/**
 * Змейка в «Все началось в 2013…»: линия прорисовывается по мере прокрутки.
 *
 * Шесть кривых оригинала идут одна за другой, поэтому раскрываем их
 * последовательно — по общей длине, чтобы стык был незаметен.
 */
import { scroll } from 'motion';

export function initTimeline() {
  const svg = document.querySelector<SVGSVGElement>('[data-timeline-svg]');
  if (!svg) return;

  const paths = [...svg.querySelectorAll<SVGPathElement>('path')];
  if (!paths.length) return;

  const lengths = paths.map((p) => p.getTotalLength());
  const total = lengths.reduce((a, b) => a + b, 0);

  paths.forEach((p, i) => {
    p.style.strokeDasharray = `${lengths[i]}`;
    p.style.strokeDashoffset = `${lengths[i]}`;
  });

  const draw = (progress: number) => {
    let drawn = progress * total;
    paths.forEach((p, i) => {
      const visible = Math.max(0, Math.min(lengths[i], drawn));
      p.style.strokeDashoffset = `${lengths[i] - visible}`;
      drawn -= lengths[i];
    });
  };

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    draw(1);
    return;
  }

  // motion передаёт в колбэк прогресс числом (объект info — второй аргумент)
  // Рисуем, пока блок въезжает снизу: как только он целиком в кадре, линия
  // уже дорисована. При прежней настройке (end 0.75) нижняя половина змейки
  // появлялась только после прокрутки за блок — секция выглядела оборванной.
  scroll((progress: number) => draw(progress), {
    target: svg,
    offset: ['start end', 'end end'],
  });
}
