/**
 * Снимает нашу сборку на тех же брейкпоинтах, что и эталон,
 * чтобы сравнивать секции один в один.
 *   node scripts/shoot.mjs [--url=http://localhost:4321] [ширина ...]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const url = (args.find((a) => a.startsWith('--url=')) || '--url=http://localhost:4321').slice(6);
const widths = args.filter((a) => /^\d+$/.test(a)).map(Number);
const WIDTHS = widths.length ? widths : [1440, 959, 479];
const OUT = path.resolve('reference/shots');

const browser = await chromium.launch();
for (const width of WIDTHS) {
  const dir = path.join(OUT, String(width));
  await mkdir(dir, { recursive: true });
  // reducedMotion вместо ручного проставления стилей: этот путь уже обслужен
  // и в global.css, и в animations.ts, и в timeline.ts (там он доводит линию
  // до конца), поэтому снимок совпадает с конечным состоянием страницы.
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.evaluate(async () => {
    await new Promise((r) => {
      let y = 0;
      const step = () => {
        y += window.innerHeight * 0.8;
        window.scrollTo(0, y);
        if (y < document.body.scrollHeight) setTimeout(step, 80);
        else setTimeout(r, 400);
      };
      step();
    });
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, 'full.png'), fullPage: true, animations: 'disabled' });
  // не только section[id]: часть секций без якоря, а подвал — <footer>
  const blocks = await page.$$('main > section, body > footer');
  for (const [i, block] of blocks.entries()) {
    const id = (await block.getAttribute('id')) || (await block.evaluate((n) => n.tagName.toLowerCase()));
    const name = `${String(i + 1).padStart(2, '0')}-${id}`;
    try {
      await block.screenshot({ path: path.join(dir, `${name}.png`), animations: 'disabled', timeout: 8000 });
    } catch {
      console.warn(`  ! ${width}px ${name}: снять не удалось`);
    }
  }
  console.log(`${width}px готово`);
  await page.close();
}
await browser.close();
