/**
 * Змейка в «Все началось в 2013…»: линия прорисовывается по мере прокрутки.
 *
 * Две раскладки, один механизм отрисовки:
 *
 * — Десктоп (≥1280px): шесть кривых оригинала, снятых с его SVG. Идут одна
 *   за другой, поэтому раскрываются последовательно по общей длине.
 * — Узкие экраны: вертикальная ось, которую строим сами. Высота карточек
 *   зависит от длины текста и от кегля, выставленного читателем, поэтому путь
 *   считается по фактическим позициям узлов, а не задаётся константами.
 */
import { scroll } from 'motion';

/* Тот же порог, что `xl:` в разметке и `@media (width >= 80rem)` в стилях
   About.astro. Значение продублировано, потому что matchMedia не читает
   токены Tailwind; при смене `--breakpoint-xl` править надо все три места. */
const DESKTOP = '(width >= 80rem)';

/**
 * Собирает ось мобильной ленты: линия идёт сверху вниз через узлы записей.
 *
 * Раньше она делала петлю к каждой метке и обратно. На узкой колонке это
 * читалось как кисель: линия виляла без ритма, а между записями оставались
 * пустоты. Теперь метка стоит внутри записи, а ось только чуть дышит между
 * узлами — ровно настолько, чтобы не быть чертёжной прямой.
 */
function buildMobilePath(svg: SVGSVGElement): boolean {
  const path = svg.querySelector<SVGPathElement>('[data-timeline-mobile-path]');
  const nodes = [...document.querySelectorAll<HTMLElement>('[data-tl-node]')];
  if (!path || nodes.length < 2) return false;

  const box = svg.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return false;

  const pts = nodes.map((el) => {
    const b = el.getBoundingClientRect();
    return { x: b.left - box.left + b.width / 2, y: b.top - box.top + b.height / 2 };
  });

  // Амплитуда «дыхания» оси. Больше 9px на колонке в 44px уже читается
  // как виляние, меньше 4px незаметно вовсе.
  const amp = 7;

  let d = `M ${pts[0].x.toFixed(1)} ${(pts[0].y - 24).toFixed(1)}`;
  d += ` L ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const c = pts[i + 1];
    const bend = i % 2 === 0 ? amp : -amp;
    const pull = (c.y - a.y) * 0.42;
    d += ` C ${(a.x + bend).toFixed(1)} ${(a.y + pull).toFixed(1)}`;
    d += ` ${(c.x + bend).toFixed(1)} ${(c.y - pull).toFixed(1)}`;
    d += ` ${c.x.toFixed(1)} ${c.y.toFixed(1)}`;
  }

  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${(last.y + 24).toFixed(1)}`;

  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  path.setAttribute('d', d);
  return true;
}

export function initTimeline() {
  const desktopSvg = document.querySelector<SVGSVGElement>('[data-timeline-svg]');
  const mobileSvg = document.querySelector<SVGSVGElement>('[data-timeline-mobile]');
  if (!desktopSvg && !mobileSvg) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stop: (() => void) | null = null;

  /** Подписывает набор путей на прокрутку, раскрывая их последовательно. */
  const wire = (svg: SVGSVGElement, paths: SVGPathElement[]) => {
    const lengths = paths.map((p) => p.getTotalLength());
    const total = lengths.reduce((a, b) => a + b, 0);
    if (!total) return;

    // Длина пути постоянна между пересборками, поэтому dasharray ставится
    // один раз здесь, а не на каждом кадре внутри draw().
    paths.forEach((p, i) => {
      p.style.strokeDasharray = `${lengths[i]}`;
    });

    const draw = (progress: number) => {
      let drawn = progress * total;
      paths.forEach((p, i) => {
        const visible = Math.max(0, Math.min(lengths[i], drawn));
        p.style.strokeDashoffset = `${lengths[i] - visible}`;
        drawn -= lengths[i];
      });
    };

    if (reduced) {
      draw(1);
      return;
    }

    // Рисуем, пока блок въезжает снизу: как только он целиком в кадре, линия
    // уже дорисована. При прежней настройке (end 0.75) нижняя половина змейки
    // появлялась только после прокрутки за блок — секция выглядела оборванной.
    stop = scroll((progress: number) => draw(progress), {
      target: svg,
      offset: ['start end', 'end end'],
    });
  };

  let mode: 'desktop' | 'mobile' | null = null;

  const setup = () => {
    stop?.();
    stop = null;

    if (matchMedia(DESKTOP).matches) {
      mode = 'desktop';
      if (!desktopSvg) return;
      wire(desktopSvg, [...desktopSvg.querySelectorAll<SVGPathElement>('path')]);
      return;
    }

    mode = 'mobile';
    if (!mobileSvg) return;
    // Путь пересобирается при каждой раскладке: перенос строк меняет высоты.
    if (!buildMobilePath(mobileSvg)) return;
    wire(mobileSvg, [...mobileSvg.querySelectorAll<SVGPathElement>('path')]);
  };

  setup();

  // Смена раскладки — отдельное событие, а не побочный эффект ресайза.
  matchMedia(DESKTOP).addEventListener('change', setup);

  /*
    Пересборка после перевёрстки нужна только мобильной оси: у десктопной
    геометрия фиксирована (viewBox и 1057px), её длина не меняется никогда.
    ResizeObserver на блоке ловит и смену ширины окна, и подмену шрифта,
    и раскрытие соседних блоков — в отличие от resize, который на подмену
    шрифта не срабатывает. Но на десктопе он молотил бы полный teardown
    подписки motion на каждый кадр перетаскивания края окна.
  */
  const host = mobileSvg?.parentElement;
  if (host && typeof ResizeObserver !== 'undefined') {
    let queued = 0;
    new ResizeObserver(() => {
      if (mode === 'desktop') return;
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(setup);
    }).observe(host);
  }
}
