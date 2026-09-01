/** Контраст двух цветов по WCAG 2.1. `node scripts/contrast.mjs "#111 #F9FAFD" ...` */
const lum = (hex) => {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? [...h].map((c) => c + c) : h.match(/../g);
  const [r, g, b] = f.map((v) => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const pair of process.argv.slice(2)) {
    const [a, b] = pair.trim().split(/\s+/);
    const r = ratio(a, b);
    console.log(`${a} на ${b} → ${r.toFixed(2)}:1  ${r >= 4.5 ? 'AA текст' : r >= 3 ? 'AA крупный/граница' : '✗'}`);
  }
}
