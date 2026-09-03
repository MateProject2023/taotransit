/**
 * Замер контраста НА ВУАЛИ ПЕРВОГО ЭКРАНА.
 *
 * Слепое пятно двух остальных проверок. `contrast-audit.mjs` читает
 * `background-color` — под подписями hero это сплошной `bg-brand` секции, то
 * есть 10.71:1 из воздуха: ни видео, ни полупрозрачной вуали над ним для него
 * не существует. `gradient-audit.mjs` смотрит на `background-image`, а вуаль
 * не градиент. Плотность вуали до сих пор приходилось замерять вручную,
 * раскладывая ролик в кадры, — этот файл делает то же самое браузером.
 *
 *   node scripts/veil-audit.mjs [--url=…] [--alpha=0.62] [ШИРИНАxВЫСОТА…]
 *
 * Ролик ставится на паузу и перематывается по секундам; на каждом кадре
 * подписи прячутся (`visibility: hidden`, фон остаётся), их рамки снимаются
 * и раскладываются в пиксели. Худший пиксель под текстом сравнивается с
 * белым. Выход не ноль при любом нарушении AA.
 *
 * `--alpha` подменяет плотность вуали на лету — так подбиралось само
 * значение. Замер под настоящими рамками подписей заметно мягче, чем по
 * целому кадру: белые области ролика под текст не попадают. По кадру 62%
 * давали бы 3.73:1, под подписями — 5.18:1.
 *
 * ⚠️ Размытие вуали на эти числа почти не влияет: белые области в ролике
 * крупные, и даже σ=10 снимает с худшего пикселя сотые доли. Полагаться на
 * блюр как на запас по контрасту нельзя — запас даёт только плотность.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const args = process.argv.slice(2);
const url = (args.find((a) => a.startsWith('--url=')) || '--url=http://127.0.0.1:4399/').slice(6);
const alphaArg = args.find((a) => a.startsWith('--alpha='));
const alpha = alphaArg ? Number(alphaArg.slice(8)) : null;
/* Не только ширины: вуаль лежит на видео с object-cover, и от высоты окна
   зависит, какой кусок кадра окажется под подписью. Короткий ноутбук и
   маленький телефон дают другую обрезку, чем 1440×900. */
const custom = args.filter((a) => /^\d+x\d+$/i.test(a)).map((a) => a.toLowerCase().split('x').map(Number));
const VIEWPORTS = custom.length
  ? custom
  : [
      [1440, 900],
      [1440, 720],
      [959, 900],
      [390, 844],
      [390, 667],
    ];

/* Что стоит на вуали. Логотип — картинка, кнопка несёт собственную заливку:
   под требование AA попадают только эти две подписи. */
const SELECTOR = '#mainpic p';
/* Через сколько секунд ролика брать кадр. Ролик 20.6 с и зациклен; полсекунды
   это 41 кадр на прогон — достаточно, чтобы яркое пятно не проскочило между
   выборками, и ещё терпимо по времени. */
const STEP = 0.5;

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const onWhite = (px) => 1.05 / (lum(...px) + 0.05);

const browser = await chromium.launch();
let failures = 0;
let globalWorst = { ratio: Infinity };

for (const [width, height] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width, height } });
  // Плашка согласия перекрывает низ первого экрана на узких ширинах.
  await page.addInitScript(() => {
    try { localStorage.setItem('tao-consent-v1', 'necessary'); } catch {}
  });
  await page.goto(url, { waitUntil: 'load' });

  if (alpha !== null) {
    await page.evaluate((a) => {
      document.querySelector('[data-veil]').style.backgroundColor = `rgb(44 49 146 / ${a})`;
    }, alpha);
  }

  const duration = await page.evaluate(async () => {
    const video = document.querySelector('#mainpic video');
    video.pause();
    if (!video.duration) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
    return video.duration;
  });

  let bad = 0;
  let worst = { ratio: Infinity };

  /* Рамки берём один раз: подписи между кадрами не двигаются, а лишний
     getBoundingClientRect на каждый кадр — это лишняя перевёрстка. Текст
     прячем тоже один раз и на всё время замера. */
  const boxes = await page.$$eval(SELECTOR, (nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect();
      node.style.visibility = 'hidden';
      return { x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)), w: Math.round(r.width), h: Math.round(r.height) };
    }),
  );

  for (let t = 0; t < duration; t += STEP) {
    await page.evaluate(async (time) => {
      const video = document.querySelector('#mainpic video');
      video.currentTime = time;
      await new Promise((r) => video.addEventListener('seeked', r, { once: true }));
      // Кадр должен успеть попасть на экран, иначе снимок покажет предыдущий.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, t);

    // Один снимок на кадр, рамки вырезаются из него: скриншот дорогой,
    // а подписей на первом экране две.
    const shot = await page.screenshot();
    for (const [i, box] of boxes.entries()) {
      if (box.w < 2 || box.h < 2) continue;
      const { data, info } = await sharp(shot)
        .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let o = 0; o < data.length; o += info.channels) {
        const px = [data[o], data[o + 1], data[o + 2]];
        const ratio = onWhite(px);
        if (ratio < worst.ratio) worst = { ratio, px, t, i };
      }
    }
  }

  if (worst.ratio < 4.5) {
    bad += 1;
    console.log(`  ✗ подпись #${worst.i + 1} на ${worst.t}-й секунде: белое на rgb(${worst.px}) — ${worst.ratio.toFixed(2)}:1`);
  }
  if (worst.ratio < globalWorst.ratio) globalWorst = { ...worst, width, height };

  failures += bad;
  console.log(`${width}×${height} — худший кадр ${worst.ratio.toFixed(2)}:1, нарушений: ${bad}`);
  await page.close();
}

await browser.close();
console.log(
  failures
    ? `\n✗ вуаль первого экрана: нарушений ${failures}`
    : `\n✓ вуаль первого экрана проходит AA — худшее место ${globalWorst.ratio.toFixed(2)}:1 (${globalWorst.width}×${globalWorst.height}, ${globalWorst.t}-я секунда)`,
);
process.exit(failures ? 1 : 0);
