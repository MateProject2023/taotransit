/**
 * Прогоняет контраст по собранной странице: каждый текстовый узел против
 * фактически закрашенного под ним фона.
 *
 *   node scripts/contrast-audit.mjs [--url=http://127.0.0.1:4399] [ширина ...]
 *
 * Зачем скриптом, а не глазом: в этом проекте «на глаз» ошибались уже
 * трижды — #5b35e5 при 2.8:1, --fg-faint на панели при 4.35:1 и пункты
 * шапки при 4.25:1 над первым экраном.
 *
 * Тонкость: Tailwind v4 считает часть цветов через color-mix в oklab, и
 * getComputedStyle отдаёт их записью oklab(), а не rgb(). Без разбора
 * oklab белая полупрозрачная пилюля читается как почти чёрная и даёт
 * восемь ложных срабатываний.
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const url = (args.find((a) => a.startsWith('--url=')) || '--url=http://127.0.0.1:4399').slice(6);
const widths = args.filter((a) => /^\d+$/.test(a)).map(Number);
const WIDTHS = widths.length ? widths : [1440, 959, 479];

const audit = () => {
  const num = (s) => (s.match(/-?[\d.]+/g) || []).map(Number);

  /** oklab → sRGB 0..255 (матрицы из спецификации CSS Color 4) */
  const oklabToRgb = (L, a, b) => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    return lin.map((v) => {
      const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
      return Math.min(255, Math.max(0, c * 255));
    });
  };

  const parse = (str) => {
    if (!str || str === 'transparent') return null;
    const n = num(str);
    if (!n.length) return null;
    if (str.startsWith('oklab')) return { rgb: oklabToRgb(n[0], n[1], n[2]), a: n[3] ?? 1 };
    if (str.startsWith('color(')) return { rgb: n.slice(0, 3).map((v) => v * 255), a: n[3] ?? 1 };
    return { rgb: n.slice(0, 3), a: n[3] ?? 1 };
  };

  const lum = ([r, g, b]) => {
    const f = [r, g, b].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  const ratio = (x, y) => {
    const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
    return (hi + 0.05) / (lo + 0.05);
  };

  /** Складывает полупрозрачные слои сверху вниз до первого непрозрачного. */
  const bgOf = (el) => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (!c || c.a === 0) continue;
      stack.push(c);
      if (c.a >= 0.999) break;
    }
    let out = parse(getComputedStyle(document.body).backgroundColor)?.rgb ?? [255, 255, 255];
    for (let i = stack.length - 1; i >= 0; i--) {
      const { rgb, a } = stack[i];
      out = out.map((v, k) => rgb[k] * a + v * (1 - a));
    }
    return out;
  };

  const out = [];
  document.querySelectorAll('body *').forEach((el) => {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim())
      .join(' ');
    if (!text) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    if (el.closest('[hidden]') || el.closest('.sr-only')) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const fg = parse(cs.color);
    if (!fg) return;
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    const got = ratio(fg.rgb, bgOf(el));
    if (got < need) {
      const where = el.closest('section,footer,header');
      out.push({
        got: +got.toFixed(2),
        need,
        size,
        where: where?.id || where?.tagName || '?',
        text: text.slice(0, 44),
      });
    }
  });
  return out;
};

const browser = await chromium.launch();
let total = 0;
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  // раскрываем всё, что по умолчанию свёрнуто: внутри тоже есть текст
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
  await page.waitForTimeout(400);
  const bad = await page.evaluate(audit);
  total += bad.length;
  console.log(`${width}px — нарушений: ${bad.length}`);
  bad.forEach((x) => console.log(`  ${x.got}:1 < ${x.need}  ${x.size}px  [${x.where}]  «${x.text}»`));
  await page.close();
}
await browser.close();
console.log(total === 0 ? '\nвсё проходит AA' : `\nвсего нарушений: ${total}`);
process.exit(total === 0 ? 0 : 1);
