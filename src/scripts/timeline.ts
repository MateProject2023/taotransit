/**
 * Змейка в «Все началось в 2013…»: линия прорисовывается по мере прокрутки.
 *
 * Две раскладки, один механизм отрисовки:
 *
 * — Десктоп (≥1280px): шесть кривых оригинала, снятых с его SVG. Идут одна
 *   за другой, поэтому раскрываются последовательно по общей длине. Голову
 *   линии несёт точка, и из неё вырастают карточки и метки — см. `collectReveals`.
 * — Узкие экраны: вертикальная ось, которую строим сами. Высота карточек
 *   зависит от длины текста и от кегля, выставленного читателем, поэтому путь
 *   считается по фактическим позициям узлов, а не задаётся константами.
 */
import { scroll } from 'motion';

/* Тот же порог, что `xl:` в разметке и `@media (width >= 80rem)` в стилях
   About.astro. Значение продублировано, потому что matchMedia не читает
   токены Tailwind; при смене `--breakpoint-xl` править надо все три места. */
const DESKTOP = '(width >= 80rem)';

/* Где на экране стоит голова линии. Раньше здесь было `end` — нижняя кромка
   окна: линия начинала чертиться, едва блок показывался из-за края, и голова
   так и ехала по самому низу экрана. Смотреть было не на что — ни на точку,
   ни на то, как из неё вырастает карточка. Теперь голова идёт на пятой части
   экрана выше дна. */
const HEAD = '80%';

/* Длина участка, на котором элемент вырастает, в единицах длины пути.
   Отсчитывается назад от точки прибытия: карточка дорастает ровно к приходу
   линии, а не после него — иначе последняя карточка, чей приход совпадает с
   концом линии, не появилась бы никогда.

   Величина не произвольная. Вдоль линии карточки и метки строго чередуются,
   самый тесный промежуток между соседями — 122 единицы из 3566 (метка «шаги
   к успеху» и карточка 2017 года). При 150 соседи задевают друг друга на
   28 единиц, это около 6px прокрутки. Больше — и элементы начнут появляться
   парами вместо очереди. */
const GROW = 150;

type Reveal = {
  el: HTMLElement;
  /** Длина вдоль общей линии, к которой элемент должен дорасти. */
  at: number;
  /** Последнее записанное значение — чтобы не трогать стиль вхолостую. */
  last: number;
};

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** smoothstep: у появления нет рывка ни в начале, ни в конце. */
const ease = (v: number) => v * v * (3 - 2 * v);

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

/**
 * Размах линии внутри рамки SVG, в долях её высоты.
 *
 * `getBBox()` берётся намеренно: он описывает геометрию и не зависит ни от
 * dasharray, которым линия обрезана прямо сейчас, ни от толщины обводки.
 */
function pathSpan(svg: SVGSVGElement, paths: SVGPathElement[]) {
  const ctm = svg.getScreenCTM();
  const box = svg.getBoundingClientRect();
  if (!ctm || !box.height) return { from: 0, to: 100 };

  let top = Infinity;
  let bottom = -Infinity;
  for (const p of paths) {
    const b = p.getBBox();
    top = Math.min(top, b.y);
    bottom = Math.max(bottom, b.y + b.height);
  }
  if (!(top < bottom)) return { from: 0, to: 100 };

  const pt = svg.createSVGPoint();
  pt.y = top;
  const y0 = pt.matrixTransform(ctm).y;
  pt.y = bottom;
  const y1 = pt.matrixTransform(ctm).y;
  return {
    from: ((y0 - box.top) / box.height) * 100,
    to: ((y1 - box.top) / box.height) * 100,
  };
}

/**
 * Ставит карточкам точку роста — место, где линия в них входит.
 *
 * Карточка вырастает из шарика, а не проявляется из середины, поэтому
 * `transform-origin` считается по концу соответствующей кривой. Рамку
 * меряем без масштаба, который уже стоит на элементе из CSS, иначе доли
 * поедут. Вынесено отдельно, потому что высота карточек зависит от шрифта
 * и после его подмены доли надо пересчитать — а вот `at` не зависит:
 * концы кривых заданы геометрией, метки центрируются на своей координате.
 */
function setCardOrigins(
  svg: SVGSVGElement,
  paths: SVGPathElement[],
  lengths: number[],
  cards: HTMLElement[],
) {
  // На скрытом SVG матрицы нет — но сюда мы попадаем только в десктопной
  // раскладке, где он отрисован.
  const ctm = svg.getScreenCTM();
  if (!ctm) return;

  cards.forEach((el, i) => {
    if (i >= paths.length) return;
    const arrival = paths[i].getPointAtLength(lengths[i]).matrixTransform(ctm);
    const kept = el.style.transform;
    el.style.transform = 'none';
    const box = el.getBoundingClientRect();
    el.style.transform = kept;
    if (!box.width || !box.height) return;
    const ox = ((arrival.x - box.left) / box.width) * 100;
    const oy = ((arrival.y - box.top) / box.height) * 100;
    el.style.transformOrigin = `${ox.toFixed(1)}% ${oy.toFixed(1)}%`;
  });
}

/**
 * Считает, на какой длине линии оживает каждая карточка и каждая метка.
 *
 * Карточки: каждая из шести кривых оригинала упирается в следующую карточку
 * (проверено замером — все шесть концов попадают в её рамку), поэтому
 * карточка привязана к концу своей кривой. Первая карточка стоит в самом
 * начале линии и потому не помечена вовсе: она видна сразу, как и просил
 * заказчик.
 *
 * Метки лежат прямо на линии, но не в узлах, поэтому их место ищется
 * замером: линия разбивается на точки, и для каждой метки берётся ближайшая.
 * Так метку можно двигать в `timeline-geometry.ts`, ничего здесь не правя.
 */
function collectReveals(
  svg: SVGSVGElement,
  paths: SVGPathElement[],
  lengths: number[],
  cards: HTMLElement[],
): Reveal[] {
  const reveals: Reveal[] = [];
  const ctm = svg.getScreenCTM();
  if (!ctm) return reveals;
  const toScreen = (p: DOMPoint) => p.matrixTransform(ctm);

  let end = 0;
  lengths.forEach((len, i) => {
    end += len;
    if (cards[i]) reveals.push({ el: cards[i], at: end, last: -1 });
  });

  const labels = [...document.querySelectorAll<HTMLElement>('[data-tl-label]')];
  if (!labels.length) return reveals;

  // Одна выборка на всю линию, а не своя на каждую метку: около девятисот
  // замеров вместо пяти с половиной тысяч. Шаг 4 единицы — точнее, чем
  // разброс самих меток относительно линии (2…11px по замеру).
  const samples: { x: number; y: number; at: number }[] = [];
  let base = 0;
  paths.forEach((path, i) => {
    for (let l = 0; l <= lengths[i]; l += 4) {
      const pt = toScreen(path.getPointAtLength(l));
      samples.push({ x: pt.x, y: pt.y, at: base + l });
    }
    base += lengths[i];
  });

  labels.forEach((el) => {
    // Поворот и масштаб метки заданы от её центра, поэтому центр от них не
    // зависит и мерить его можно прямо в стартовом состоянии.
    const box = el.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    let at = 0;
    let best = Infinity;
    for (const s of samples) {
      const d = (s.x - cx) ** 2 + (s.y - cy) ** 2;
      if (d < best) {
        best = d;
        at = s.at;
      }
    }
    reveals.push({ el, at, last: -1 });
  });

  return reveals;
}

export function initTimeline() {
  const desktopSvg = document.querySelector<SVGSVGElement>('[data-timeline-svg]');
  const mobileSvg = document.querySelector<SVGSVGElement>('[data-timeline-mobile]');
  if (!desktopSvg && !mobileSvg) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stop: (() => void) | null = null;
  let reveals: Reveal[] = [];
  let refreshOrigins: (() => void) | null = null;
  const dot = desktopSvg?.querySelector<SVGCircleElement>('[data-timeline-dot]') ?? null;

  /** Подписывает набор путей на прокрутку, раскрывая их последовательно.
   *  `dot` — только у десктопной змейки: у мобильной оси головы нет, и гонять
   *  getPointAtLength каждый кадр ради невидимого круга незачем. */
  const wire = (
    svg: SVGSVGElement,
    paths: SVGPathElement[],
    lengths: number[],
    dot: SVGCircleElement | null,
  ) => {
    const total = lengths.reduce((a, b) => a + b, 0);
    if (!total) return;

    // Длина пути постоянна между пересборками, поэтому dasharray ставится
    // один раз здесь, а не на каждом кадре внутри draw().
    paths.forEach((p, i) => {
      p.style.strokeDasharray = `${lengths[i]}`;
    });

    /** Точка на общей линии — в системе координат viewBox. */
    const pointAt = (len: number) => {
      let rest = clamp(len / total) * total;
      for (let i = 0; i < paths.length; i += 1) {
        if (rest <= lengths[i]) return paths[i].getPointAtLength(rest);
        rest -= lengths[i];
      }
      return paths[paths.length - 1].getPointAtLength(lengths[lengths.length - 1]);
    };

    const draw = (progress: number) => {
      const drawn = progress * total;

      let rest = drawn;
      paths.forEach((p, i) => {
        const visible = Math.max(0, Math.min(lengths[i], rest));
        p.style.strokeDashoffset = `${lengths[i] - visible}`;
        rest -= lengths[i];
      });

      for (const r of reveals) {
        // Округление — не косметика: без него каждый кадр переписывает стиль
        // всем двенадцати элементам, хотя растёт в этот момент один.
        const k = Math.round(ease(clamp((drawn - r.at + GROW) / GROW)) * 1000) / 1000;
        if (k === r.last) continue;
        r.last = k;
        r.el.style.opacity = `${k}`;
        r.el.style.transform = k === 1 ? 'none' : `scale(${(0.55 + 0.45 * k).toFixed(3)})`;
      }

      if (dot) {
        const head = pointAt(drawn);
        dot.setAttribute('cx', head.x.toFixed(1));
        dot.setAttribute('cy', head.y.toFixed(1));
        // Гаснет на самых концах: до прокрутки точки ещё нет, а на дочерченной
        // линии голова уже никуда не движется и превращается в кляксу.
        dot.style.opacity = (clamp(progress / 0.03) * clamp((1 - progress) / 0.03)).toFixed(3);
      }
    };

    if (reduced) {
      draw(1);
      return;
    }

    /* Рисуем, пока блок въезжает снизу: как только он целиком в кадре, линия
       уже дорисована.

       Отмеряем не по рамке SVG, а по размаху самой линии. У мобильной оси это
       далеко не одно и то же: рамка растянута во всю ленту, а линия кончается
       у последнего узла — карточка под ним ещё сотни две пикселей. Голова из-за
       этого убегала вверх и к концу оказывалась на середине экрана (замер:
       41–76% вместо ровных 80). */
    const span = pathSpan(svg, paths);
    stop = scroll((progress: number) => draw(progress), {
      target: svg,
      offset: [`${span.from.toFixed(2)}% ${HEAD}`, `${span.to.toFixed(2)}% ${HEAD}`],
    });
  };

  let mode: 'desktop' | 'mobile' | null = null;

  const setup = () => {
    stop?.();
    stop = null;

    // Инлайновые стили от прошлой раскладки. На узких экранах карточки и
    // метки видны все сразу (стартовое состояние в CSS заперто в десктопной
    // ширине), и масштаб от десктопа пережил бы смену раскладки.
    for (const r of reveals) {
      r.el.style.opacity = '';
      r.el.style.transform = '';
      r.el.style.transformOrigin = '';
    }
    reveals = [];
    refreshOrigins = null;
    if (dot) dot.style.opacity = '';

    if (matchMedia(DESKTOP).matches) {
      mode = 'desktop';
      if (!desktopSvg) return;
      const paths = [...desktopSvg.querySelectorAll<SVGPathElement>('path')];
      const lengths = paths.map((p) => p.getTotalLength());
      const cards = [...document.querySelectorAll<HTMLElement>('[data-tl-card]')];
      setCardOrigins(desktopSvg, paths, lengths, cards);
      refreshOrigins = () => setCardOrigins(desktopSvg, paths, lengths, cards);
      reveals = collectReveals(desktopSvg, paths, lengths, cards);
      wire(desktopSvg, paths, lengths, dot);
      return;
    }

    mode = 'mobile';
    if (!mobileSvg) return;
    // Путь пересобирается при каждой раскладке: перенос строк меняет высоты.
    if (!buildMobilePath(mobileSvg)) return;
    const paths = [...mobileSvg.querySelectorAll<SVGPathElement>('path')];
    wire(mobileSvg, paths, paths.map((p) => p.getTotalLength()), null);
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

  /*
    Высоты карточек десктопной змейки зависят от шрифта, а точки роста
    считаются по их рамкам. Пока CraftworkSans едет, рамки другие. Полный
    setup() здесь не годится: он снимает подписку и сбрасывает инлайновые
    стили, а значит мигает, если шрифт доедет, когда читатель уже в змейке.
    Пересчитываем только доли. Мобильную ось это же событие догоняет через
    ResizeObserver.
  */
  document.fonts?.ready.then(() => refreshOrigins?.());
}
