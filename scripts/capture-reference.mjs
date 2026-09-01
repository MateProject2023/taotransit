/**
 * Снимает эталон исходного тильда-лендинга: полная страница + каждая секция
 * на всех брейкпоинтах, которые Zero Block использует в оригинале.
 *
 * Тильда грузит картинки лениво, поэтому перед съёмкой страницу нужно
 * промотать до конца и дать отработать анимациям появления.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const URL = 'https://taotransit.com/';
const OUT = path.resolve('reference/screenshots');

// 1440 — десктопный дизайн-размер; остальные четыре взяты из @media-правил оригинала
const WIDTHS = [1440, 1199, 959, 639, 479];

// Записи в DOM-порядке; подписи — из CLAUDE.md
// `npm run capture -- 01-header 10-cases-list` — дозаснять отдельные секции
const only = process.argv.slice(2);

const SECTIONS = [
  ['rec615636676', '01-header'],
  ['rec615637541', '02-hero'],
  ['rec616025001', '03-achievements'],
  ['rec619190593', '04-why-us'],
  ['rec617707852', '05-services-heading'],
  ['rec617712402', '06-services-cards'],
  ['rec615860618', '07-pricing'],
  ['rec615999667', '08-steps'],
  ['rec617854248', '09-cases-heading'],
  ['rec617857179', '10-cases-list'],
  ['rec617850570', '11-cases-detail'],
  ['rec617826795', '12-about'],
  ['rec618180396', '13-how-to-start'],
  ['rec618938766', '14-growth'],
  ['rec629222891', '15-final-cta'],
  ['rec616037673', '16-footer'],
];

async function settle(page) {
  // прокрутка до конца — триггерит tilda-lazyload и анимации появления
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = () => {
        y += window.innerHeight * 0.8;
        window.scrollTo(0, y);
        if (y < document.body.scrollHeight) setTimeout(step, 120);
        else setTimeout(resolve, 600);
      };
      step();
    });
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
}

const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    const dir = path.join(OUT, String(width));
    await mkdir(dir, { recursive: true });

    const page = await browser.newPage({
      viewport: { width, height: 900 },
      deviceScaleFactor: 2,
    });
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60_000 });
    await settle(page);

    if (only.length === 0) {
      await page.screenshot({ path: path.join(dir, '00-full.png'), fullPage: true });
    }

    const targets = only.length ? SECTIONS.filter(([, n]) => only.includes(n)) : SECTIONS;
    let taken = 0;
    for (const [id, name] of targets) {
      const el = page.locator(`#${id}`);
      if ((await el.count()) === 0) continue;
      const file = path.join(dir, `${name}.png`);
      try {
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
        // sticky-хедер и карусель кейсов анимируются бесконечно, поэтому
        // element-скриншот не дожидается стабильности — гасим анимации,
        // а если и это не помогает, снимаем вьюпорт по bounding box.
        await el.screenshot({ path: file, animations: 'disabled', timeout: 8000 });
        taken++;
      } catch {
        try {
          const box = await el.boundingBox();
          if (!box) throw new Error('нет bounding box');
          await page.screenshot({
            path: file,
            animations: 'disabled',
            clip: {
              x: Math.max(0, box.x),
              y: Math.max(0, box.y),
              width: Math.min(box.width, width),
              height: Math.min(box.height, 4000),
            },
          });
          taken++;
        } catch (err) {
          console.warn(`  ! ${width}px ${name}: ${err.message.split('\n')[0]}`);
        }
      }
    }
    console.log(`${width}px → ${taken}/${targets.length} секций`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`\nГотово: ${OUT}`);
