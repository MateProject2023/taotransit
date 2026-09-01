/**
 * Снимает оригинал (taotransit.com), нашу сборку и блок контактов mate
 * в тех местах, которые отметил заказчик, — чтобы сравнивать состояние
 * в состояние, а не по памяти.
 *
 *   node scripts/compare-feedback.mjs [--ours=http://127.0.0.1:4399]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const ours = (args.find((a) => a.startsWith('--ours=')) || '--ours=http://127.0.0.1:4399').slice(7);
const OUT = path.resolve('reference/compare');
const WIDTH = 1440;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

async function open(url, { motion = 'reduce' } = {}) {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: motion,
  });
  await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
  // прокрутка до конца: и на Тильде, и у нас есть ленивые картинки и анимации
  await page.evaluate(async () => {
    await new Promise((r) => {
      let y = 0;
      const step = () => {
        y += innerHeight * 0.8;
        scrollTo(0, y);
        if (y < document.body.scrollHeight) setTimeout(step, 90);
        else setTimeout(r, 600);
      };
      step();
    });
  });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
  return page;
}

/** Снимок области экрана — для шапки: у Тильды её запись нулевой высоты. */
async function clipShot(page, file, clip = { x: 0, y: 0, width: WIDTH, height: 150 }) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, file), clip });
  console.log(`  ✓ ${file}`);
}

/** Снимок элемента; если элемента нет или он нулевой — говорит, а не падает. */
async function shot(page, selector, file, prepare) {
  const el = page.locator(selector).first();
  if (!(await el.count())) return console.log(`  ✗ нет ${selector} → ${file}`);
  const box = await el.boundingBox();
  if (!box || box.height < 8) return console.log(`  ✗ пустой ${selector} → ${file}`);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  if (prepare) { await prepare(el); await page.waitForTimeout(500); }
  await el.screenshot({ path: path.join(OUT, file) });
  console.log(`  ✓ ${file}`);
}

// ─────────────────────────── оригинал ───────────────────────────
console.log('taotransit.com');
{
  const page = await open('https://taotransit.com/');
  // 1. шапка — обычная и под курсором
  await clipShot(page, 'old-01-header.png');
  await page.locator('#rec615636676 a').nth(2).hover();
  await page.waitForTimeout(500);
  await clipShot(page, 'old-01-header-hover.png');
  // 2. первый экран
  await shot(page, '#rec615637541', 'old-02-hero.png');
  // 3. почему мы
  await shot(page, '#rec619190593', 'old-03-whyus.png');
  // 4. услуги: закрытый и раскрытый пункт — картинки лежат внутри
  await shot(page, '#rec617712402', 'old-04-services.png');
  await shot(page, '#rec617712402', 'old-04-services-open.png', async (el) =>
    el.locator('button').first().click());
  // 5. этапы работы
  await shot(page, '#rec615999667', 'old-05-steps.png');
  // 6. кейсы
  await shot(page, '#rec617854248', 'old-06-cases-heading.png');
  await shot(page, '#rec617850570', 'old-06-cases.png');
  // 7. как начать работу
  await shot(page, '#rec618180396', 'old-07-howtostart.png');
  // 8. контакты
  await shot(page, '#rec616037673', 'old-08-contacts.png');
  await page.close();
}

// ─────────────────────────── наша сборка ───────────────────────────
console.log('наша сборка');
{
  const page = await open(ours);
  await page.evaluate(() => {
    // плашка cookie перекрывает низ экрана и мешает сравнению
    document.querySelector('[data-cookie-banner]')?.remove();
  });
  await clipShot(page, 'new-01-header.png');
  await page.locator('header a').nth(2).hover();
  await page.waitForTimeout(500);
  await clipShot(page, 'new-01-header-hover.png');
  await shot(page, '#mainpic', 'new-02-hero.png');
  await shot(page, '#adventages', 'new-03-whyus.png');
  await shot(page, '#services', 'new-04-services.png');
  await shot(page, '#services', 'new-04-services-open.png', async (el) =>
    el.locator('summary').first().click());
  await shot(page, '#steps', 'new-05-steps.png');
  await shot(page, '#cases', 'new-06-cases.png');
  await shot(page, '#howtostart', 'new-07-howtostart.png');
  await shot(page, '#contacts', 'new-08-contacts.png');
  await page.close();
}

// ─────────────── контакты mate: то, что переносим ───────────────
console.log('matestrade.com');
try {
  const page = await open('https://matestrade.com/ru', { motion: 'no-preference' });
  await shot(page, '#contactWithUs', 'mate-contacts.png');
  await shot(page, '#contactWithUs', 'mate-contacts-hover.png', async (el) =>
    el.locator('> div').first().hover());
  await shot(page, 'footer', 'mate-footer.png');
  await page.close();
} catch (e) {
  console.log('  ✗ matestrade.com недоступен:', e.message.split('\n')[0]);
}

await browser.close();
console.log(`\nготово → ${OUT}`);
