/**
 * Навигация ленты кейсов.
 *
 * Лента остаётся обычным скролл-контейнером со scroll-snap: свайп, колесо
 * и клавиатура работают сами. Кнопки — надстройка для тех, у кого нет ни
 * того, ни другого под рукой; заказчик просил «понятный навигационный
 * элемент» вместо тонкого скроллбара, который приходилось дёргать.
 *
 * Поэтому кнопки отдаются скрытыми и показываются скриптом: без JS они
 * были бы мёртвыми, а лента без них всё равно прокручивается.
 */
export function initCases() {
  document.querySelectorAll<HTMLElement>('[data-cases]').forEach((root) => {
    const strip = root.querySelector<HTMLElement>('[data-cases-strip]');
    const nav = root.querySelector<HTMLElement>('[data-cases-nav]');
    const prev = root.querySelector<HTMLButtonElement>('[data-cases-prev]');
    const next = root.querySelector<HTMLButtonElement>('[data-cases-next]');
    const counter = root.querySelector<HTMLElement>('[data-cases-counter]');
    if (!strip || !nav || !prev || !next || !counter) return;

    const cards = [...strip.children] as HTMLElement[];
    if (cards.length < 2) return;

    nav.hidden = false;

    /** Шаг прокрутки — расстояние между началами соседних карточек.
     *  Считается каждый раз: ширина карточки задана в vw и меняется
     *  вместе с окном. */
    const step = () => cards[1].offsetLeft - cards[0].offsetLeft;

    const sync = () => {
      const max = strip.scrollWidth - strip.clientWidth;
      // допуск в 1px: scrollLeft бывает дробным при масштабировании
      const atEnd = strip.scrollLeft >= max - 1;
      prev.disabled = strip.scrollLeft <= 1;
      next.disabled = atEnd;

      /* В самом конце последняя карточка к левому краю не встаёт — за ней
         нечему прокручиваться, — и деление на шаг даёт предпоследний номер.
         Досчитываем явно, иначе счётчик показывает «3 / 4», когда четвёртая
         карточка целиком на экране. */
      const i = atEnd
        ? cards.length - 1
        : Math.min(cards.length - 1, Math.round(strip.scrollLeft / step()));
      counter.textContent = `${i + 1} / ${cards.length}`;
    };

    const go = (dir: number) => strip.scrollBy({ left: dir * step(), behavior: 'smooth' });

    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    strip.addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync, { passive: true });
    sync();
  });
}
