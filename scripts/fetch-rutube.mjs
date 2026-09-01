/**
 * Забирает ролик с Rutube и готовит его к самостоятельному хостингу.
 *
 *   node scripts/fetch-rutube.mjs <id|url> <имя-файла> [--bg]
 *
 *   --bg  фоновый режим: без звука, сильное сжатие, webm + mp4 + постер
 *         (для hero, где видео затемнено и качество не читается)
 *   без флага: обычный ролик со звуком, mp4 720p + постер
 *
 * Почему так, а не yt-dlp: Rutube отдаёт HLS, а API плейлиста требует
 * заголовок Referer — без него приходит Forbidden. Параметр `referer`
 * в query добавлять НЕ надо, с ним запрос тоже отклоняется.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [input, name, ...flags] = process.argv.slice(2);
if (!input || !name) {
  console.error('использование: node scripts/fetch-rutube.mjs <id|url> <имя> [--bg]');
  process.exit(1);
}

const id = (input.match(/[0-9a-f]{32}/) || [input])[0];
const background = flags.includes('--bg');
const outDir = background ? 'public/video' : 'public/video';
const posterDir = 'src/assets/img';
mkdirSync(outDir, { recursive: true });

const api = `https://rutube.ru/api/play/options/${id}/?no_404=true`;
const meta = JSON.parse(
  execFileSync('curl', [
    '-s', '--max-time', '30',
    '-H', 'Referer: https://rutube.ru/',
    '-H', 'User-Agent: Mozilla/5.0',
    api,
  ]).toString(),
);

const m3u8 = meta?.video_balancer?.m3u8;
if (!m3u8) {
  console.error('плейлист не отдан — проверь id или доступность ролика');
  process.exit(1);
}
console.log(`«${meta.title}», ${Math.round((meta.duration || 0) / 1000)} с`);

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const src = path.join(outDir, `${name}-source.mp4`);

ff(['-headers', 'Referer: https://rutube.ru/\r\n', '-i', m3u8, '-c', 'copy', '-bsf:a', 'aac_adtstoasc', src]);
console.log('исходник:', src);

if (background) {
  ff(['-i', src, '-an', '-c:v', 'libx264', '-crf', '28', '-preset', 'slow',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(outDir, `${name}.mp4`)]);
  ff(['-i', src, '-an', '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0',
      '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', path.join(outDir, `${name}.webm`)]);
} else {
  // webm/vp9 — основной источник, mp4/h264 — запасной для старых браузеров
  ff(['-i', src, '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1',
      '-deadline', 'good', '-cpu-used', '2', '-vf', 'scale=-2:720',
      '-c:a', 'libopus', '-b:a', '80k', path.join(outDir, `${name}.webm`)]);
  ff(['-i', src, '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-vf', 'scale=-2:720',
      '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', path.join(outDir, `${name}.mp4`)]);
}
ff(['-i', src, '-ss', '0.5', '-frames:v', '1', '-q:v', '4', path.join(posterDir, `${name}-poster.jpg`)]);
writeFileSync(path.join(outDir, `${name}.source.txt`), `${meta.title}\nhttps://rutube.ru/video/${id}/\n`);
console.log('готово. Исходник можно удалить, он не нужен в сборке.');
