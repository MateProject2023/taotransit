# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## What this project is

A **rebuild of the taotransit.com landing page** — currently a Tilda one-pager — as a static Astro + Tailwind site. TAO Transit is a China→CIS freight-forwarding agent (buyout, consolidation, QC, delivery), same client family as the `mate` project in `../mate/mate`.

**Current state: stage 1 (layout) is built.** Astro 7 + Tailwind 4 project with all 13 visible sections rebuilt, zero external requests, no console errors. `PLAN.md` holds the agreed staging.

### Project layout

- `src/content/landing.ts` — **all copy lives here**, nothing inline in markup. The client edits this file.
- `src/components/*.astro` — one component per section, in page order.
- `src/layouts/Layout.astro` — `<head>`, meta, OG, JSON-LD, font preload.
- `src/styles/global.css` — `@theme` tokens + `@font-face` + `site-container` utility.
- `reference/` — the acceptance material: `tilda-page.html` (original markup), `content-dump.txt` (per-section text), `assets/` (originals pulled from the CDN), `screenshots/` (original at 5 widths), `shots/` (our build, same widths), `hero-source-rutube.mp4`.
- `scripts/capture-reference.mjs` — re-shoots the original; `scripts/shoot.mjs` — shoots our build. Both take widths as args.

**Interactivity is three tiny inline scripts and nothing else**: the Rutube facade, the scroll-top button, and… that's it. The services accordion is `<details>`, the cases carousel is scroll-snap, the mobile nav is an overflow-scroll strip. No framework islands, no hydration.

**Stage 1 (current) is layout only** — a faithful, improved rebuild of everything visible, to show the client. Form backend, analytics counter, hosting and the domain cutover are explicitly deferred to stage 2+. Don't build stage-2 machinery while stage 1 is running.

## Source of truth for content

The live Tilda page **is** the spec: `https://taotransit.com/`. It is public — `curl` pulls the full HTML (~624 KB) and every asset on `static.tildacdn.com` downloads without auth. The client's low Tilda subscription blocks only the ZIP-export button, which we don't need (Tilda's export is unusable as code anyway).

`sitemap.xml` lists exactly **one URL** — this is a single page, not a site.

### Page structure (27 Tilda records, in DOM order)

14 of them are **Zero Blocks** (`t396`) — absolutely-positioned coordinate markup with separate variants at 1199 / 959 / 639 / 479 px. **They cannot be ported mechanically.** Every section gets re-authored as semantic flex/grid against screenshots of the original. This is the bulk of the work.

| # | rec id | Section |
|---|---|---|
| 1 | `rec615636676` | Header / nav — Услуги, Тарифы, Преимущества, Этапы работы, Кейсы, Контакты, О нас, Как начать |
| 2 | `rec618926896` | overlay/fixed element (t890) |
| 3 | `rec615637541` | Hero — «Надежный агент по доставкам грузов из Китая» + CTA «Начать с нами» |
| 4 | `rec629175892` | **Popup (t702)** — «Начни с результата!», Name + Phone, mask `+7 (999) 999-9999`. See "The form" below |
| 5 | `rec616025001` | «За все время мы успели…» — achievement counters |
| 6 | `rec619190593` | «Почему мы?» + guarantees |
| 7 | `rec617707852` | «Услуги» heading |
| 8 | `rec617712402` | Service cards (t585) — выкуп, консолидация, проверка товаров, … |
| 9 | `rec615860618` | «Тарифы по доставке» — rate table (авто/жд/авиа, сроки) |
| 10 | `rec615999667` | «Этапы работы» — numbered V→I, counts **down** |
| 11 | `rec617854248` + `rec617857179` + `rec617850570` | «Наши кейсы» + case cards |
| 12 | `rec617826795` | «Tao Transit это про:» + mission |
| 13 | `rec618180396` | «Как начать работу?» → concierge bot |
| 14 | `rec618938766` | «Рост и развитие» |
| 15 | `rec629222891` | Final CTA — «Начни с результата вместе с нами!» |
| 16 | `rec616037673` | Footer — контакты, почта, тг-канал, менеджер, консьерж-бот |

Interleaved `t215` records are decorative/spacer blocks (no text).

~9 800 characters of copy total.

### Assets — all of them, verified

37 `static.tildacdn.com` URLs appear in the page, but **21 are Tilda's own libraries** (jquery, `tilda-zero-*.js`, `tilda-forms`, grid/popup CSS) — irrelevant to us. The actual asset set is **15 images + 1 favicon, 6.6 MB total**, already downloaded and measured:

- 4 logo/decor SVGs (`tao_transit_bb`, `tao_transit_2line_bb` ×2, `tao_black`, `gradient_line`) — vector, nothing to recover
- 4 square photos 1080×1080 PNG (520–784 KB each)
- 4 banners 1280×270 PNG (472–600 KB each)
- `chatmost_ru` screenshot 1448×1086 PNG (1.9 MB)
- `Bisma_logo_white2x.png` 1787×748
- `TAO_favicon.ico`

**These are the originals.** The URLs carry no `-/resize/` segment, and probing `-/resize/2000x/` and `-/format/webp/` on the CDN returns 404 — there is no larger variant and no retina set to miss. Resolutions are adequate for web; the PNGs are simply uncompressed, and `astro:assets` → webp/avif will cut the 6.6 MB by roughly an order of magnitude.

⚠️ **Do not harvest assets by parsing `data-original` / `srcset`** — Zero Block keeps its image URLs inside inline JS init objects, so attribute-based extraction finds only 4 of 15. Grep every `https://static.tildacdn.*` URL out of the raw HTML and filter by extension.

### Design tokens, measured from the live CSS

| Token | Value | Occurrences | Use |
|---|---|---|---|
| Background | `#11101c` | 46 | page ground |
| Text / headings | `#ebebf7` | 208 | body + headings |
| Accent | `#5b35e5` | 153 | buttons, fills, decor |
| Accent light | `#977bff` | 8 | **use for text links** |

⚠️ `#5b35e5` on `#11101c` measures ≈**2.8:1** — below WCAG AA (4.5:1) for text. Keep it for fills and buttons; `#977bff` on the same ground is ≈**6:1** and passes. The site already ships both, so this costs nothing.

Also present: `#08070d` (deeper-than-background), `#f3f1ff`.

**Font: CraftworkSans** — the same face as `mate`. **Do not download it**: five weights in woff2 (Regular/Medium/Semibold/Bold/Black) already sit in `../mate/mate/src/styles/fonts/`, next to `craft-font.css`. Copy from there.

### Two Rutube videos (found only at runtime — not in the HTML)

Neither video appears in the page source, the page CSS, or the page JS: Tilda injects both `<iframe>`s at runtime, so **only a browser session reveals them**. Both were captured with Playwright:

| Where | Rutube id | What we did |
|---|---|---|
| Hero background (`rec615637541`) | `353748922aabee57166d68f663c7fcda` | 20.6 s, 1280×720, silent. **Self-hosted**: `public/video/hero-bg.{webm,mp4}` (1.2 / 1.4 MB) + poster, played by a plain `<video>`. |
| «Как начать работу» (`rec618180396`) | `04f62f33c29b5d66966477acb057a804` | 2:22, has audio. **Self-hosted too**: `public/video/bot-video.{webm,mp4}` (5.8 / 4.6 MB), `preload="none"` — nothing but the 13 KB cover loads until the visitor clicks. |

**The page now makes zero external requests** — both Rutube embeds are gone.

Re-download either video with `scripts/fetch-rutube.mjs <id|url> <name> [--bg]` (`--bg` = silent, heavily compressed, for the hero loop). Originals are kept out of the build in `reference/*-source-rutube.mp4`.

Note on codecs for the bot video: VP9 does **not** win on this material (a screencast of a phone UI). At comparable quality webm came out at 5.8 MB against 4.6 MB for h264 — the `<source>` order still puts webm first, but swapping it costs nothing if size matters more than fidelity.

Why it matters: the Rutube embed drags in the player, its own analytics, and **two third-party Yandex.Metrica counters that are not ours** (`39751470`, `53182297`) — on every visitor, for a silent background loop. The rebuilt page makes **zero external requests**.

To refresh the hero video: `curl` the Rutube play-options API with a `Referer: https://rutube.ru/` header, take `video_balancer.m3u8`, then `ffmpeg -headers 'Referer: https://rutube.ru/' -i <m3u8> -c copy`, and re-encode (`-an -crf 28` for mp4, `-crf 38` for webm).

### CTAs — every one is a plain Telegram link (verified)

There is no phone number, no email form receiver, and **no popup trigger anywhere in the markup**: the only `#rec` anchor on the page points at the footer, and no `#popup:` href exists. So the `t702` popup form (`rec629175892`) is **orphaned — nothing opens it**, which matches what the client said. Confirmed CTA targets:

| CTA | Target |
|---|---|
| «Начать с нами» (hero) | `t.me/TradewithMate_Rail` |
| «напишите менеджеру» | `t.me/TradeWithMate_Rail` |
| «консьерж бот» | `t.me/taotransit_bot` |
| «Начни с результата вместе с нами!» (final CTA) | `t.me/taotransit_bot` |

Footer links: concierge bot, `t.me/TradeWithMate_Rail` (manager), `t.me/+UfG8_bV1wO5lYmQ6` (channel invite), `keepintouch@matestrade.com`, and `t.me/bahtiarismagilov` (BISMA credit).

⚠️ **Fixed a broken link from the original**: the footer's email was `href="keepintouch@matestrade.com"` with **no `mailto:` scheme** — a relative URL that resolved to `taotransit.com/keepintouch@matestrade.com` and 404'd. Our footer uses a real `mailto:`. Note the address belongs to the *mate* domain.

**Telegram is the entire current lead channel, and it stays as-is** — stage 2 adds a form *beside* these buttons, it does not replace them. Note the hero CTA points at the *mate* rail chat, so the two projects already share a manager.

## Stack

- **Astro 7.2** + **Tailwind 4.3**, wired via the `@tailwindcss/vite` plugin.
- **Never use `@astrojs/tailwind`** — it is a Tailwind v3 wrapper, deprecated, and with v4 it either fails or silently emits wrong CSS.
- **Never copy `mate`'s `tailwind.config.js`.** Tailwind v4 is CSS-first: tokens go in an `@theme` block in `src/styles/global.css`. Port values, not the file.
- Astro 7 needs **Node 22.12+ at build time only**. Output is static; nothing runs on the server but a file server.
- **Zero JS by default.** Popup, burger menu and phone mask are small vanilla scripts. No React islands on a one-pager — blanket `client:load` is the standard Astro anti-pattern.
- `astro:assets` `<Image />` for all imagery (auto webp/avif, explicit dimensions, lazy by default).

## The form (stage 2 — do not build during stage 1)

The Tilda markup contains a popup form (`rec629175892`, 11 `t-input`s, `data-tilda-formskey="7a831eecc53726e35e855bb967566459"`), but **nothing on the page opens it** (verified — see CTA table above) and the client confirms no form is in use. Tilda keeps receivers server-side (`formservices[]` is empty in the HTML), so it is still worth a glance in the Tilda panel before cutover — but the evidence says this popup is dead markup, not a live channel.

What we build in stage 2, **alongside** the bot link (the bot link is not replaced):

- A `mate`-style contact form → **Telegram + amoCRM**, with **UTM/tracking marks exactly as in `mate`**.
- **Telegram: the concierge bot already on the site — `@taotransit_bot`** — posting to a **separate chat** (new `CHAT_ID`), not the one clients talk in. Needs from the client: the bot token (BotFather), plus the bot added to the target group with posting rights, to read its `chat_id`.
  - Safe to do: `sendMessage` does **not** conflict with whatever runs that bot — a webhook and outbound sends coexist. **Never call `setWebhook`/`deleteWebhook` on this token** — that would silently break the client's live concierge flow.
- **amoCRM:** same account (`mategrouptrade`), **different pipeline** (`AMO_PIPELINE_ID`).

**Port the pipeline, not the framework.** `../mate/mate/src/lib/lead.js` is deliberately isomorphic — Web APIs only, no `next/*`, no `fs`, no `@/` alias — so `normalizeLead` / `buildTelegramText` / `buildAmoUnsortedPayload` / `TRACKING_KEYS` / `deliverLead` and the `workers/lead-relay` Worker all move over unchanged. Read `../mate/mate/CLAUDE.md` § "Form submission" first; the constraints there (channel split, `retryable` duplicate protection, `ALLOWED_ORIGINS` shared between Worker and origin route, amo marks by `field_code` not id) apply verbatim.

Known trap from `mate`: `ALLOWED_ORIGINS` lives in one file but feeds two deploy targets — a change needs **both** a push and a manual `wrangler deploy`, or the receivers drift.

## Analytics

The live page runs **Yandex.Metrica `94685921`** and no GA. The client wants **a new counter of their own**, added later. Note when doing it: the domain isn't changing, so dropping `94685921` discards the existing history — worth a second look before retiring it.

SEO baseline on the current page is thin: `<title>` exists, **`meta description` does not**, `robots.txt` is Tilda's boilerplate and points at an `http://` sitemap. Parity is trivial; add description / OG / JSON-LD in the rebuild.

## Hosting

**Undecided — deliberately.** Stage 1 needs only a preview URL for the client. The `mate` Timeweb VPS is a candidate for later (`147.45.157.229` is the live box, `89.223.70.95` is idle standby — the `mate-server` SSH alias points at the standby, not the live one). If we go there, read `mate`'s CLAUDE.md § "RU reachability / ТСПУ" **before** touching nginx or certbot: HTTP/2 on every `:443` listen line is load-bearing for Russian reachability, and `certbot --nginx --expand` can silently strip it.

taotransit.com currently sits behind **DDoS-Guard**. Any cutover has to start from a full DNS zone export — MX/TXT/SPF/DKIM included.

## Conventions

- Copy lives in **one content module**, not inline in markup — the page is 100% Russian marketing copy that the client will revise.
- **Anchors point where the original pointed**, and it is not obvious: Tilda hangs them on empty spacer records *before* the section. `#adventages` → «Почему мы?» (not the achievements strip, which has no anchor), `#services` → the services accordion, `#contacts` → footer. Verified against the original markup, don't "fix" them by name.
- **The scope of "improved" is fixed: responsive behaviour and contrast only.** Section composition, order and visual concept stay as they are — the target is "as close as possible to the original, but built correctly". Zero Block's five hand-tuned breakpoint sets are re-authored as real fluid layout; nothing gets redesigned. Composition changes, if any, come later as a separate pass.
- Reference screenshots at every original breakpoint are the acceptance artifact — capture them before rebuilding, compare after.

## Соответствие оригиналу: что снято замерами, а не на глаз

Всё ниже вытащено из живой страницы (Playwright + разбор разметки), значения лежат в `reference/`:

**Типографика.** Заголовки секций — **96px / 900 / line-height 1** (утилита `section-title`), «Все началось в 2013…» — 48/900. Подзаголовки карточек в «Почему мы?» и «Ценностях» — **400, не жирные** (частая ошибка на глаз). Текст пилюль достижений — 24/900, «1 день» в этапах — 36/900, заголовки кейсов и тарифов — 36/900. Кнопки — 24/700. Подписи hero — 20/400 и 22/400. Меню — Black.

**Свечения** (`box-shadow`, spread всегда 0, утилиты `glow-*`):

| Где | Значение |
|---|---|
| Кнопки hero и «Остались сомнения?» | `0 0 72px 0 #5b35e5` |
| Кнопка «консьерж бот» | `0 0 36px 0 #5b35e5` |
| Панель «Услуги», карточка тарифов | `0 0 36px 0 #5b35e5` |
| Карточка миссии в «О нас» | `0 0 36px 0 rgba(235,235,247,.7)` |
| Финальный призыв | `0 0 72px 0 #ebebf7` |

Радиусы: кнопки 12px, панели и карточки 24px.

**Анимации появления.** В оригинале это `data-animate-style` + `distance` + `delay`, duration везде 1 с. Повторено ровно там, где есть в оригинале, с теми же дистанциями: достижения — вылет с боков на 330px, «Почему мы?» и «Ценности» — ±100px, шапка «Услуг» — 87px справа, этапы — 164px снизу; задержки 0.1–0.4 с.

Как это устроено: элемент помечается `data-anim` и inline-стилем `--anim-x` / `--anim-y`. **Стартовое состояние задаёт CSS** (`.anim [data-anim]` в `global.css`), класс `anim` вешает инлайн-скрипт в `<head>`. Так без JS контент виден сразу, а с JS нет прыжка после гидратации — раньше начальное состояние ставилось из скрипта и давало CLS 0.086.

**Змейка «Все началось в 2013…».** Шесть кривых Безье — это `path` из SVG оригинала, нормализованные к `viewBox 0 0 669 797` (`src/content/timeline-geometry.ts` вместе с позициями карточек и меток и углами их поворота). На ≥1280px область таймлайна **фиксирована в 1057px** — ровно как в оригинале; растягивание искажало стыки линий с карточками. Ниже 1280px абсолютная раскладка не выживает, там вертикальная ось.

Линия **прорисовывается по мере прокрутки** (`src/scripts/timeline.ts`): длины всех шести путей складываются, `stroke-dashoffset` раскрывается последовательно, прогресс берётся из `scroll()` motion.

Эталоны для сверки: `reference/lines/timeline-svg.png` (оригинал), `reference/lines/our-timeline.png` (наша версия), `reference/lines/coords.json` (замеры).

## Про motion

`motion` — обычный npm-пакет, никакой интеграции с Astro не требует: импортируется в `<script>` компонента или в модуль под `src/scripts/`, Vite бандлит его как любой клиентский код. Островов и фреймворка не нужно.

Важно для веса: **`animate` берём из `motion/mini`** (обёртка над WAAPI), а `inView`/`scroll` — из основного пакета. Полный `motion` тянул 68 КБ JS, эта комбинация — 23 КБ.

## Грабли dev-сервера

Дважды за разработку `astro dev` вводил в заблуждение:

1. **500 на всех `/_image`** — процесс, поднятый до переименования файлов в `src/assets/img/`, продолжал отдавать битые ссылки; на странице были пустые места вместо картинок.
2. **Старые стили из `<style>` компонента при новой разметке.** После правки блока стилей в `About.astro` dev отдавал прежний CSS вместе с обновлённым HTML: карточки таймлайна получались 342×66 вместо 398×110 — без полей, текст впритык, линии в пустоте. Сборка (`astro preview`) при этом была правильной.

**Правило: после правок в `<style>` компонента или переименования ассетов — перезапускать dev начисто**, а не полагаться на HMR:

```
npx astro dev stop && rm -rf node_modules/.vite .astro && npm run dev -- --host --port 4321
```

Если увиденное расходится с ожиданиями — сначала сверяться с `astro preview` на отдельном порту, и только потом искать баг в коде.
