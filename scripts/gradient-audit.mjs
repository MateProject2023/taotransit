/**
 * Замер контраста НА ГРАДИЕНТНЫХ ПОДЛОЖКАХ.
 *
 * `scripts/contrast-audit.mjs` читает `background-color` и о `background-image`
 * ничего не знает: для карточки с растяжкой он возьмёт цвет секции под ней и
 * отчитается о цифре, которой на экране нет. Здесь наоборот — текст на время
 * прячется (`visibility: hidden`, фон при этом остаётся), рамка снимается,
 * снимок раскладывается в пиксели, и худший из них сравнивается с цветом
 * текста. Замеряется то, что действительно нарисовано.
 *
 * Правило, которое проверяет этот файл, одно (см. «Градиентные подложки»
 * в `src/styles/global.css`): **растяжка кончается там, где начинается
 * текст.** Ни один абзац не должен стоять на полутоне. Если правило
 * соблюдено, худший пиксель под текстом — это чистая поверхность:
 * фиолет 10.71:1 под белым, белое 18.09:1 под чернилами.
 *
 *   node scripts/gradient-audit.mjs [ширины…]      # по умолчанию 1440 768 390
 *
 * Выход не ноль при любом нарушении AA.
 *
 * ⚠️ Прокрутка к элементу — `block: 'center'`, а не `scrollIntoViewIfNeeded`.
 * Иначе фиксированная шапка ложится поверх замеряемой рамки, и её рамка
 * (`ring-line`, #8D8F99) попадает в выборку как «фон под текстом»: 3.32:1
 * на пустом месте. Поймано ровно так.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const URL = process.env.AUDIT_URL ?? 'http://localhost:4321/';
const widths = process.argv.slice(2).map(Number).filter(Boolean);
const WIDTHS = widths.length ? widths : [1440, 768, 390];

/* Что замеряем: всё, что стоит на градиенте. Список короткий и должен таким
   оставаться — если он растёт, растяжек на странице стало больше, чем нужно. */
const SPECS = [
  ['«Этапы»: описание шага', '#steps li > p:nth-child(2)'],
  ['«Этапы»: срок', '#steps li > p:nth-child(1)'],
  ['«Достижения»: подпись', 'main > section:nth-child(2) li p > span:not(.figure-lead)'],
  ['«Достижения»: число', 'main > section:nth-child(2) li p > span.figure-lead'],
];

const channel = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const rgb = (css) => css.match(/[\d.]+/g).slice(0, 3).map(Number);

const browser = await chromium.launch();
let failures = 0;

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle' });
  // Плашка cookie перекрывает нижнюю часть экрана и попадает в выборку.
  await page.evaluate(() => document.querySelector('[data-cookie-banner]')?.remove());
  // Медленный проход, чтобы отработали появления: при быстрых прыжках
  // IntersectionObserver не получает ни одного кадра и элементы остаются
  // при opacity: 0 — замер тогда идёт по пустому месту.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 100)));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);

  let bad = 0;
  for (const [label, selector] of SPECS) {
    for (const [i, el] of (await page.$$(selector)).entries()) {
      await el.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForTimeout(150);
      const box = await el.evaluate((node) => {
        const r = node.getBoundingClientRect();
        node.style.visibility = 'hidden';
        return { x: r.x, y: r.y, w: r.width, h: r.height, color: getComputedStyle(node).color };
      });
      if (box.w < 2 || box.h < 2) {
        await el.evaluate((node) => { node.style.visibility = ''; });
        continue;
      }
      const shot = await page.screenshot({
        clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.w, height: box.h },
      });
      await el.evaluate((node) => { node.style.visibility = ''; });

      const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
      const ink = rgb(box.color);
      let worst = null;
      let worstRatio = Infinity;
      for (let o = 0; o < data.length; o += info.channels) {
        const px = [data[o], data[o + 1], data[o + 2]];
        const r = contrast(ink, px);
        if (r < worstRatio) {
          worstRatio = r;
          worst = px;
        }
      }
      if (worstRatio < 4.5) {
        bad += 1;
        console.log(
          `  ✗ ${label} #${i + 1}: текст ${box.color} на rgb(${worst}) — ${worstRatio.toFixed(2)}:1`,
        );
      }
    }
  }
  failures += bad;
  console.log(`${width}px — нарушений: ${bad}`);
  await page.close();
}

await browser.close();
console.log(failures ? `\n✗ градиентные подложки: нарушений ${failures}` : '\n✓ градиентные подложки проходят AA');
process.exit(failures ? 1 : 0);
