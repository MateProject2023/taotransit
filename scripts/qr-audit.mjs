/**
 * Читает QR-коды с собранной страницы так, как их прочитает телефон.
 *
 *   node scripts/qr-audit.mjs [--url=http://127.0.0.1:4399] [ширина ...]
 *
 * Зачем: код не лежит картинкой, он собирается из адреса в
 * `src/content/landing.ts` (`src/lib/qr.ts`). Это защищает от расхождения
 * кода и ссылки, но не от того, что кода станет не видно, — модуль может
 * оказаться меньше пикселя, цвет может уйти, вёрстка может срезать зону
 * покоя. Всё это молчаливые поломки: на экране остаётся ровно такой же
 * квадратик, просто нечитаемый.
 *
 * Поэтому проверка не смотрит на разметку, а снимает элемент в его
 * фактическом размере и отдаёт снимок декодеру. Прочитанное сверяется с
 * `href` ссылки, внутри которой код нарисован: клик и сканирование обязаны
 * вести в одно место, а код, который читается, но ведёт не туда, хуже
 * нечитаемого.
 */
import { chromium } from 'playwright';
import jsQR from 'jsqr';

const args = process.argv.slice(2);
const url = (args.find((a) => a.startsWith('--url=')) || '--url=http://127.0.0.1:4399').slice(6);
const widths = args.filter((a) => /^\d+$/.test(a)).map(Number);
const WIDTHS = widths.length ? widths : [1440, 959, 479];

/* Сколько кодов должно быть на странице. Число здесь затем, чтобы код,
   потерянный вёрсткой, отличался от кода, которого и не было. */
const EXPECTED_COUNT = 2;

const browser = await chromium.launch();
let failures = 0;

for (const width of WIDTHS) {
  // deviceScaleFactor 1 намеренно: декодер должен получить столько пикселей,
  // сколько их достаётся телефону с обычным экраном, а не вдвое больше.
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'load' });

  const codes = page.locator('[data-qr]');
  const count = await codes.count();
  let bad = 0;

  if (count !== EXPECTED_COUNT) {
    bad += 1;
    console.log(`  ✗ кодов на странице ${count}, ожидали ${EXPECTED_COUNT}`);
  }

  for (let i = 0; i < count; i++) {
    const el = codes.nth(i);
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    const shot = await el.screenshot();

    /* Сверяем код не со списком в этом файле, а со ссылкой, внутри которой
       он нарисован. Это независимая проверка: href — то, что делает клик,
       код — то, что делает сканирование, и они обязаны совпадать. Список
       адресов рядом со списком в разметке проверял бы сам себя. */
    const href = await el.evaluate((node) => node.closest('a')?.href ?? null);

    const pixels = await page.evaluate(async (bytes) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return { w: canvas.width, h: canvas.height, data: Array.from(data) };
    }, Array.from(shot));

    const read = jsQR(Uint8ClampedArray.from(pixels.data), pixels.w, pixels.h);

    if (!href) {
      bad += 1;
      console.log(`  ✗ код #${i + 1} не лежит внутри ссылки — сверять не с чем`);
    } else if (!read) {
      bad += 1;
      console.log(`  ✗ код #${i + 1} (${Math.round(box.width)}px) не читается`);
    } else if (read.data !== href) {
      bad += 1;
      console.log(`  ✗ код #${i + 1} ведёт на ${read.data}, а ссылка под ним — на ${href}`);
    }
  }

  failures += bad;
  console.log(`${width}px — кодов ${count}, нарушений: ${bad}`);
  await page.close();
}

await browser.close();
console.log(failures ? `\n✗ QR: нарушений ${failures}` : '\n✓ QR читаются и ведут куда сказано');
process.exit(failures ? 1 : 0);
