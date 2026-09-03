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
 * фактическом размере и отдаёт снимок декодеру. Совпадение с ожидаемым
 * адресом проверяется тут же: код, который читается, но ведёт не туда,
 * хуже нечитаемого.
 */
import { chromium } from 'playwright';
import jsQR from 'jsqr';
import { site } from '../src/content/landing.ts';

const args = process.argv.slice(2);
const url = (args.find((a) => a.startsWith('--url=')) || '--url=http://127.0.0.1:4399').slice(6);
const widths = args.filter((a) => /^\d+$/.test(a)).map(Number);
const WIDTHS = widths.length ? widths : [1440, 959, 479];

/** Что должно прочитаться в каждом коде страницы, по порядку. */
const EXPECTED = [site.channel];

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

  if (count !== EXPECTED.length) {
    bad += 1;
    console.log(`  ✗ кодов на странице ${count}, ожидали ${EXPECTED.length}`);
  }

  for (let i = 0; i < count; i++) {
    const el = codes.nth(i);
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    const shot = await el.screenshot();

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
    const want = EXPECTED[i];

    if (!read) {
      bad += 1;
      console.log(`  ✗ код #${i + 1} (${Math.round(box.width)}px) не читается`);
    } else if (read.data !== want) {
      bad += 1;
      console.log(`  ✗ код #${i + 1} ведёт на ${read.data}, а рядом написано ${want}`);
    }
  }

  failures += bad;
  console.log(`${width}px — кодов ${count}, нарушений: ${bad}`);
  await page.close();
}

await browser.close();
console.log(failures ? `\n✗ QR: нарушений ${failures}` : '\n✓ QR читаются и ведут куда сказано');
process.exit(failures ? 1 : 0);
