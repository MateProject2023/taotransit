# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## What this project is

A **rebuild of the taotransit.com landing page** — currently a Tilda one-pager — as a static Astro + Tailwind site. TAO Transit is a China→CIS freight-forwarding agent (buyout, consolidation, QC, delivery), same client family as the `mate` project in `../mate/mate`.

**Current state: stage 1 (layout) is built, the design refresh on top of it is done, and the lead form is wired end to end — front end, delivery module, server endpoint and worker.** Astro 7 + Tailwind 4, all 13 visible sections rebuilt, no console errors, and — until the visitor accepts the cookie banner — zero external requests (see § Analytics). `PLAN.md` holds the agreed staging.

The refresh moved the page off the inherited Tilda palette onto the MATE brand tokens in `design-tokens/`. **The site is now light**, on the client's decision — the package is applied as a light system, not ported to a dark ground. Brief and system: `PRODUCT.md` and `DESIGN.md` (see "Design context"). `DESIGN.md` § 7 records all eight passes; the sixth is the light migration, the eighth brings back the original's gradients and rebuilds the surface map, and it names what is still open.

**The Two Surfaces Rule governs every section.** There are exactly two surfaces — paper `#F9FAFD` and brand `#2C3192` — and each section belongs entirely to one of them. No half-tones, no grey section grounds, no third background value: `--panel: #2B2E39` is **gone** from the build (the client had the contact-line shutters repainted brand, which was its last use).

**Surfaces now strictly alternate**, the one doubled place being the first screen plus «За все время мы успели…» — one colour field, because the achievements continue the hero's claim. The section-by-section map is a table in `DESIGN.md` § 2; read it before adding or reordering a section. It was rebuilt in the eighth pass, and moving one section's surface now costs a rethink of its neighbours.

⚠️ **One amendment, made by the client: a card may dissolve into its own section's fill** — the gradient in «Этапы работы» and in the achievement pills, both ports of the original. The rule still stands (no gradient as a *section* ground), but the stops are **re-measured, not ported**: on the original the fade ran dark→dark and any text colour read anywhere along it; here it runs into white, and its middle is a light lilac where white text drops below 4.5:1 at 30% white and ink drops below 4.5:1 at 65%. Hence the single rule for both utilities — **never more under a text than that text can carry**. In the pills that means the fade simply ends where the text begins, and the boundary is one number seen from two sides: the gradient's transparent stop at 48% and the text block's `max-w-[52%]`. Change one and you must change the other.

In the steps it works differently, because cutting the fade off under the text left the card's top indistinguishable from the section fill — the text hung above the card instead of standing in it, which is exactly what the client caught. So that gradient runs the full height of the card, with a **kink**: 22% white at the bottom line of the text (5.84:1), a tenth at the very top. A straight ramp from solid to transparent would put 39% under that line and fail.

⚠️ The step card's `pb` and `--fill-fade` are the same number seen from two sides — the kink has to land on the text's bottom line. Change one, change the other.

⚠️ **`--color-on-brand` cannot stand on a fade at all** — 6.10:1 on flat brand, below 4.5:1 at 11% white under it. That is why the step description is white, not muted. Measured table in `DESIGN.md` § 2.

`scripts/contrast-audit.mjs` cannot see any of this (it reads `background-color`); `scripts/gradient-audit.mjs` measures the actual painted pixels.

**There are no shadows at all.** Elevation comes from a white card on paper. The `glow-*` utilities are gone; don't reintroduce them.

### Project layout

- `src/content/landing.ts` — **all copy lives here**, nothing inline in markup. The client edits this file.
- `src/components/*.astro` — one component per section, in page order.
- `src/layouts/Layout.astro` — `<head>`, meta, OG, JSON-LD, font preload.
- `src/styles/global.css` — `@theme` tokens + `@font-face` + `site-container` utility.
- `PRODUCT.md` / `DESIGN.md` — the design brief and the target visual system. See "Design context".
- `src/content/legal.ts` — the four legal documents and the consent-banner copy. See "Юридические документы".
- `src/lib/qr.ts` — build-time QR generator. The Telegram-channel code (`ChannelCard.astro`, at the end of «О нас») is **generated from `site.channel`, not committed as an image**: the client edits that address, and a file would silently start pointing elsewhere. `qrcode-generator` is a build-time dependency; nothing reaches the client bundle.
- `src/lib/telegram.ts` — how a Telegram link is captioned: `@matebox` for a public channel, `t.me/+…` for an invite link, which has no name to show. Derived from the URL, never written beside it.
- `FORM.md` — **the lead-delivery spec** (Telegram + amoCRM): routing, request contract, env vars, traps, rollout order and what is still unanswered. Everything about the form's insides lives there, not here.
- `src/lib/lead.js` — the isomorphic delivery module. **Both receivers bundle this one file**, so a change to it needs two deploys (site + `wrangler deploy`). Web APIs only: a `node:*` import breaks the Worker, not the site.
- `src/pages/api/lead.ts` — the server receiver: amoCRM always, Telegram when there is no worker or it failed. The only on-demand route on the site.
- `workers/lead-relay/` — the Cloudflare Worker (Telegram only). Optional on Vercel; see § Hosting.
- `scripts/amo-fields.mjs` / `scripts/tg-chat.mjs` — the diagnostics that turn the remaining blockers into commands: amo pipelines and fields, the bot's webhook state and chat ids. Both read `.env`.
- `.env.example` — the annotated template for everything above. The real `.env` is not committed.
- `src/scripts/analytics.ts` — both counters, and the consent gate in front of them. See § Analytics.
- `design-tokens/` — the vendored MATE brand package (tokens, font, README). Light-theme; ported, not imported.
- `reference/` — the acceptance material: `tilda-page.html` (original markup), `content-dump.txt` (per-section text), `assets/` (originals pulled from the CDN), `screenshots/` (original at 5 widths), `shots/` (our build, same widths), `competitors/` (ChinaToday, Sinoruss, Forto at 1440 — the category we are steering away from), `hero-source-rutube.mp4`.
- `scripts/capture-reference.mjs` — re-shoots the original; `scripts/shoot.mjs` — shoots our build. Both take widths as args.

**Interactivity is a handful of tiny vanilla scripts and nothing else**: the video facade, the scroll-top button, the scroll animations, the timeline line, the lead form (`src/scripts/lead.ts`), the custom select (`src/scripts/select.ts`), the legal dialogs plus consent banner (`src/scripts/legal.ts`), the counters behind that consent (`src/scripts/analytics.ts`), the contact lines' clipboard copy (`src/scripts/contacts.ts`) and the mobile menu (`src/scripts/nav.ts`). The services accordion is `<details>`, the cases carousel is scroll-snap, the legal documents are native `<dialog>`, and the contact lines' shutter and marquee are pure CSS.  No framework islands, no hydration.

**All of them are booted from one `<script>` in `Layout.astro`, and each `init*` is wrapped in its own `try/catch` (`run(name, init)`).** They share a bundle, so without the wrapper an exception in any one of them silently killed every call after it. Order is not decorative either: **the form goes first**, then its listbox and its counter, then everything else. It used to sit fourth, behind the timeline — the most fragile script on the page (SVG path measurement, motion, `document.fonts.ready`) — so a crash there left the form with no submit handler. Verified by breaking `getTotalLength()` on purpose: the timeline dies, the form still submits.

⚠️ Adding a script means adding a `run(...)` line, not a bare call. A bare call re-arms exactly the failure this replaced.

**Stage 1 (layout) is done, and the form's back end is now built on top of it** — a faithful, improved rebuild of everything visible, plus a working lead pipeline. What is still deferred: the domain cutover and the secrets themselves (`FORM.md` § 14 lists who owes what).

⚠️ **The form's code is complete; its `.env` is not.** With no secrets set the endpoint answers `503 not_configured` and the form honestly says «Не отправилось» instead of a fake success — see `FORM.md` § 1, which tabulates the three states of an unfilled config.

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
| 13 | `rec618180396` | «Как начать работу?» → concierge bot — **rebuilt as «Как мы работаем»**; the anchor `#howtostart` is unchanged |
| 14 | `rec618938766` | «Рост и развитие» |
| 15 | `rec629222891` | Final CTA — «Начни с результата вместе с нами!» — **removed by the client**; the form section took its place at the end of the funnel |
| 16 | `rec616037673` | Footer — контакты, почта, тг-канал, менеджер, консьерж-бот. **Re-laid as full-bleed contact lines ported from `mate`** — see «Контактные полосы» |

Interleaved `t215` records are decorative/spacer blocks (no text).

**One block on the page has no Tilda counterpart:** the CTA band between «Наши кейсы» and «О нас» (`src/components/CasesCta.astro`, copy in `casesCta`). It was added on the client's instruction; its two lines are written, not ported. Same for the case-card `figureNote` captions and everything in `leadForm` / `legal.ts`. Everywhere else the wording is still the original.

~9 800 characters of copy total.

### Assets — all of them, verified

37 `static.tildacdn.com` URLs appear in the page, but **21 are Tilda's own libraries** (jquery, `tilda-zero-*.js`, `tilda-forms`, grid/popup CSS) — irrelevant to us. The actual asset set is **15 images + 1 favicon, 6.6 MB total**, already downloaded and measured:

- 4 logo/decor SVGs (`tao_transit_bb`, `tao_transit_2line_bb` ×2, `tao_black`, `gradient_line`) — vector, nothing to recover
- 4 square photos 1080×1080 PNG (520–784 KB each)
- 4 banners 1280×270 PNG (472–600 KB each)
- 1 photo 1448×1086 PNG (1.9 MB) — **the founders at the containers**, `src/assets/img/about-founders.png`.
  ⚠️ Do not trust the CDN filename here: it arrives as `chatmost_ru_17879298.png`, a leftover upload name, and the earlier note in this file called it a screenshot. It is the photo «Иван и Ян, руководители Tao Transit».
- `Bisma_logo_white2x.png` 1787×748
- `TAO_favicon.ico`

**These are the originals.** The URLs carry no `-/resize/` segment, and probing `-/resize/2000x/` and `-/format/webp/` on the CDN returns 404 — there is no larger variant and no retina set to miss. Resolutions are adequate for web; the PNGs are simply uncompressed, and `astro:assets` → webp/avif will cut the 6.6 MB by roughly an order of magnitude.

⚠️ **Do not harvest assets by parsing `data-original` / `srcset`** — Zero Block keeps its image URLs inside inline JS init objects, so attribute-based extraction finds only 4 of 15. Grep every `https://static.tildacdn.*` URL out of the raw HTML and filter by extension.

### Design tokens

**The live palette is `DESIGN.md` § 2, not this table.** What follows is the *original Tilda* palette — a dark one — kept only for reading the reference screenshots and `reference/tilda-page.css`. **The site itself is light and shares none of these values.**

| Token | Value | Occurrences | Use on the original |
|---|---|---|---|
| Background | `#11101c` | 46 | page ground |
| Text / headings | `#ebebf7` | 208 | body + headings |
| Accent | `#5b35e5` | 153 | buttons, fills, decor |
| Accent light | `#977bff` | 8 | text links |

Also present: `#08070d` (deeper-than-background), `#f3f1ff`.

⚠️ `#5b35e5` on `#11101c` measures ≈**2.8:1** — below WCAG AA. This is why the refreshed palette drops it: at oklch chroma 0.244 / hue 283 it sits two steps hotter than the MATE brand indigo and pulls the page toward neon.

**Font: CraftworkSans** — the same face as `mate`. **Do not download it**: it ships in this repo at `design-tokens/fonts/` (woff2 + woff, five weights), and also sits in `../mate/mate/src/styles/fonts/`. The build serves woff2 from `public/fonts/`.

**Weight 500 is not part of the system.** `design-tokens/craft-font.css` deliberately omits it: hierarchy is built on 400 vs 700 vs 900, and an intermediate step blurs it. The file is present in `fonts/` only in case another direction needs it. Our build currently violates this — `Medium` is declared in `global.css` **and** sits in a `<link rel="preload">`, i.e. 16 KB in the critical path for a banned weight, used in 7 places. Removing it is part of the refresh.

⚠️ **Licensing, unresolved.** Craftwork Sans is a commercial face and it is committed to this repository. That is fine for a private repo; if `mate-and-partners` (or this one) is ever made public, check the licence before it ships. Flagged by the token-package author, not yet answered.

### `design-tokens/` — the MATE brand package

Vendored at the repo root, 216 KB with the font. `tokens.css` (46 CSS variables, no dependencies), `tokens.json` (same, machine-readable, with usage notes), `craft-font.css` + `fonts/`, and a `README.md` whose five rules are the reasoning behind the values.

**It is a light-theme system** — `#F9FAFD` paper, `#111111` ink, `#2C3192` indigo, sections alternating between paper and brand for 30–60% of the vertical. **The site now matches it**, so the values are used verbatim rather than re-derived. Exactly one colour is ours: `--color-line-on-brand: #8083BE`, a hairline for dividers inside brand fills (white 40% into brand, 3.01:1 — the package has no token for that case).

Still **don't `@import tokens.css`**: Tailwind v4 is CSS-first and the tokens live in the `@theme` block of `src/styles/global.css`, where they also become utility classes. The package stays the reference, not a dependency.

Two things from the package that are easy to miss: hover moves **down** in lightness, never up (brand button → `#1D1A77`; white button → paper fill plus deep-violet text); and `--panel: #2B2E39`, the package's "rare dark inset", **has no use left here** — the video backing went to paper with the light migration, the contact-line shutters went brand in the eighth pass, and the token was removed rather than left to rot. Bringing it back means introducing a third surface.

⚠️ Two package figures don't hold as written and were re-measured: `#6C6E78` is 5.1:1 on **white** but 4.86:1 on paper, and a white card on paper is 1.03:1 — enough for large planes, not enough for a card that has to read as an object (timeline cards sit on the snake line, case cards sit in a scroll strip). Those get a `--line` hairline. See "Правило белой карточки" in `DESIGN.md` § 2.

### Two Rutube videos (found only at runtime — not in the HTML)

Neither video appears in the page source, the page CSS, or the page JS: Tilda injects both `<iframe>`s at runtime, so **only a browser session reveals them**. Both were captured with Playwright:

| Where | Rutube id | What we did |
|---|---|---|
| Hero background (`rec615637541`) | `353748922aabee57166d68f663c7fcda` | 20.6 s, 1280×720, silent. **Self-hosted**: `public/video/hero-bg.{webm,mp4}` (1.2 / 1.4 MB) + poster, played by a plain `<video>`. |
| «Как начать работу» (`rec618180396`) | `04f62f33c29b5d66966477acb057a804` | 2:22, has audio. **Self-hosted too**: `public/video/bot-video.{webm,mp4}` (5.8 / 4.6 MB), `preload="none"` — nothing but the 13 KB cover loads until the visitor clicks. |

**The page makes no external requests of its own** — both Rutube embeds are gone. The only outbound traffic left is the two analytics counters, and they load solely after the visitor presses «Принять» (§ Analytics).

Re-download either video with `scripts/fetch-rutube.mjs <id|url> <name> [--bg]` (`--bg` = silent, heavily compressed, for the hero loop). Originals are kept out of the build in `reference/*-source-rutube.mp4`.

Note on codecs for the bot video: VP9 does **not** win on this material (a screencast of a phone UI). At comparable quality webm came out at 5.8 MB against 4.6 MB for h264 — the `<source>` order still puts webm first, but swapping it costs nothing if size matters more than fidelity.

Why it matters: the Rutube embed drags in the player, its own analytics, and **two third-party Yandex.Metrica counters that are not ours** (`39751470`, `53182297`) — on every visitor, for a silent background loop, with no way to gate any of it on consent. The rebuilt page loads **nothing third-party except our own two counters, and those only after consent**.

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
- **`@astrojs/vercel` is the adapter**, and it exists for exactly one route (`src/pages/api/lead.ts`). Don't switch `output` to `'server'` to "make it work" — per-route `prerender = false` is the mechanism, and flipping `output` would un-prerender the whole page.
- **`security.checkOrigin` is deliberately `false`.** Read § The form before restoring it.
- `astro:assets` `<Image />` for all imagery (auto webp/avif, explicit dimensions, lazy by default).

## The form

**The whole mechanism lives in `FORM.md`. Read it before touching anything on either side of the form** — routing, request contract, env vars, fifteen traps, the rollout order and the open questions are all there. What follows is only what a reader of this file needs to know.

**Front end: built (stage 1).** `src/components/LeadForm.astro` + `src/scripts/lead.ts` + `leadForm` in `landing.ts`. It is its own section `#lead`, placed **right after «Как мы работаем»** — the bot section explains how the service works and ends with a button into the bot, and the form is the second way in. Every CTA on the page anchors to it, so no anchor ever scrolls backwards. The section carries its own concierge-bot button beside the form; that is the page's only real fork. Every other CTA is a single button — `DESIGN.md` § 5 «Кнопка бота» has the reasoning, including why the paired buttons that existed briefly were removed.

The «Что нужно» field is a custom listbox (`src/components/Select.astro` + `src/scripts/select.ts`), not a native `<select>`. The original reason was that a native select rendered a light system panel on a dark form; that reason is gone with the dark theme, but the arrow, padding and typography still come from the browser and differ in each. It reproduces native keyboard behaviour; if you touch it, keep that.

The client assembles the complete request body: `requestId`, all 11 tracking marks, `_ym_uid` from the Metrica cookie, the relay/origin split and the fallback retry. Verified in a browser against a live build — all 11 marks arrive non-empty in both parallel requests, with one shared `requestId`.

**Back end: built.** `src/lib/lead.js` (the isomorphic delivery module both receivers bundle), `src/pages/api/lead.ts` (the server receiver), `workers/lead-relay/` (Cloudflare Worker, Telegram only), `scripts/amo-fields.mjs` and `scripts/tg-chat.mjs` (diagnostics), `.env.example` (the template). Decisions taken, with reasoning in `FORM.md`:

- **Telegram: the same bot as `mate`, not the concierge `@taotransit_bot`** — the client's call. That retires the worst trap of the earlier plan: nothing we run touches the concierge bot's webhook. The chat is **new** (`CHAT_ID`); TAO leads must not land where mate's leads land.
  - The rule still holds on any live bot: **never call `setWebhook`/`deleteWebhook`**. `scripts/tg-chat.mjs` deliberately cannot, and it refuses `getUpdates` if it finds a webhook.
- **amoCRM:** same account (`mategrouptrade`), same private integration and long-lived token, **different pipeline** (`AMO_PIPELINE_ID`). The pipeline must have «Неразобранное» enabled or nothing is created — `node scripts/amo-fields.mjs pipelines` prints that per pipeline.
- **The delivery module is isomorphic on purpose** — Web APIs only, no `node:*`, no bundler aliases — because the Worker and the Astro route bundle the same file. A stray Node import breaks `wrangler deploy`, not the site build, so it surfaces weeks later.
- ⚠️ `ALLOWED_ORIGINS` lives in one file but feeds two deploy targets — a change needs **both** a site deploy and a manual `wrangler deploy`, or the receivers drift.
- ⚠️ **`security.checkOrigin` is off in `astro.config.mjs`, on purpose.** Astro's built-in CSRF check rejects cross-origin POSTs with a `text/plain` body — exactly what the form sends (no `Content-Type`, so no preflight). The problem is not strictness but that it is a *second door with different rules*, invisible to `ALLOWED_ORIGINS`, which would make the two receivers answer the same request differently. Ours is the stricter of the two: it 403s when `Origin` is absent, which Astro's does not. `FORM.md` § 9.
- The endpoint answers **200 almost always** (showing a user a 5xx is pointless, and retries make duplicates). The single exception: when no requested channel is configured at all, it answers `503 not_configured` so the form says «Не отправилось» rather than lying. `GET /api/lead` is a health-check that prints which channels are configured, no secrets in the response.

**About the Tilda popup.** The original markup contains a form (`rec629175892`, 11 `t-input`s, `data-tilda-formskey="7a831eecc53726e35e855bb967566459"`), but **nothing on the page opens it** (verified — see CTA table above) and the client confirms no form is in use. Tilda keeps receivers server-side (`formservices[]` is empty in the HTML), so it is worth a glance in the Tilda panel before cutover — but the evidence says this popup is dead markup, not a live channel. Our form is **not** a revival of it: `DESIGN.md` § 6 forbids modals, so the form is inline.

## Контактные полосы

Секция «Контакты» (`src/components/Footer.astro`) — перенесённый из `mate` приём, а не наша выдумка: исходник `../mate/src/app/[lang]/components/Footer/ContactLine.jsx`, стили в `global.css` (`contact-line`, `contact-cover`, `contact-reveal`, `contact-track`).

Полоса во всю ширину экрана закрыта брендовой «шторкой»; подпись внутри выровнена по `site-container`. При наведении шторка схлопывается по высоте к середине и открывает бегущую строку под ней — то есть наведение переворачивает пару поверхностей: фиолет уходит, бумага выходит. Прежний серо-синий `#2B2E39` снят по просьбе заказчика, и вместе с ним из сборки ушёл сам токен `--panel`.

Полосы стоят вплотную и теперь все брендовые, поэтому между ними нужна волосяная линия `--color-line-on-brand`: без неё четыре шторки сливаются в один прямоугольник.

Что отличается от исходника и почему:

- бегущая строка на `@keyframes`, а не на `react-marquee-slider` — зависимость ради одного эффекта не нужна. Дорожка содержит **два одинаковых набора** и уезжает на `-50%`: стык приходится ровно на повтор. Если менять число повторов — менять `REPEAT` в компоненте, но не трогать `-50%`;
- дорожка крутится только пока полоса открыта (`animation-play-state`), иначе анимация идёт вхолостую под непрозрачной шторкой;
- у почты в бегущей строке настоящий адрес (`reveal` в `footer.links`), а не подпись: наведение показывает адрес, не открывая почтовый клиент.

Схлопывание по `:hover` заперто в `@media (hover: hover)` — на тач-экране `:hover` залипает после тапа и шторка остаётся открытой. Правило для `:focus-visible` вынесено из этого условия намеренно: фокус с клавиатуры бывает и там, где курсора нет.

Клик по почте кладёт адрес в буфер (`src/scripts/contacts.ts`) и на две секунды подменяет подпись — как в `mate`, потому что почтовый клиент настроен не у всех. `mailto:` при этом не отменяется.

## Юридические документы

Four documents live in `src/content/legal.ts` and open as native `<dialog>` modals from the footer, from the consent line under the form button, and from the cookie banner. Rendered by `src/components/LegalDocs.astro`, wired by `src/scripts/legal.ts`.

| id | Документ | Обязателен потому что |
|---|---|---|
| `privacy` | Политика в отношении обработки персональных данных | 152-ФЗ ст. 18.1 ч. 2 — оператор обязан опубликовать её |
| `consent` | Согласие на обработку персональных данных | 152-ФЗ ст. 9 — основание обработки данных из формы |
| `cookie` | Файлы cookie и технические данные | уведомление о сборе; на него ссылается плашка |
| `terms` | Пользовательское соглашение | не обязательно строго, но входит в стандартный набор коммерческого сайта |

⚠️ **These are a working draft written by a non-lawyer, not legal advice.** They describe exactly what the site does — that part is accurate and was written against the actual request body in `FORM.md` § 4 — but the client's lawyer has to read them before launch.

### Что заказчик должен дозаполнить

`legalCompany` in `src/content/legal.ts` has two values and five blanks. Blanks render as «—» in the requisites block of every document, so they are visible, not silently missing.

- **Есть:** `name: 'Mate inc.'`, `email: 'keepintouch@matestrade.com'`.
- **Нужно:** `legalName` (полное фирменное наименование), `address`, `registryNumber` (ОГРН/ОГРНИП или иностранный аналог), `taxNumber` (ИНН), `phone`, `updatedAt` (дата редакции документов).

Note the mismatch worth raising with the client: `Mate inc.` reads as a foreign entity, while the documents are written for a Russian-facing site under 152-ФЗ. Which legal person is the оператор персональных данных decides whose ОГРН/ИНН goes in — and whether 152-ФЗ is the right frame at all.

### Что ещё не сделано

- **Отдельные адреса.** Модалка удовлетворяет «общедоступности» формально, но для проверки Роскомнадзора удобнее реальные URL — `/privacy`, `/consent`, `/cookie`, `/terms`. Когда тексты утвердят, стоит завести страницы и оставить модалки как быстрый доступ.
- **Уведомление в Роскомнадзор о начале обработки ПДн.** Подаётся оператором, не нами. С 30 мая 2025 неподача — штраф до 300 000 ₽ (420-ФЗ). Сказать заказчику.
- **Фиксация согласий.** Закон ждёт, что оператор сможет доказать факт согласия: IP, время, текст. Сейчас в заявку уходит IP и время, но текст согласия нигде не версионируется. Если понадобится — версия документа кладётся в тело заявки одним полем.

## Analytics

**Both counters are in, and both are the client's own** (given by them, not inherited from Tilda): Yandex.Metrica **`112274964`** and the Google tag **`G-C19XJZ9B84`** (gtag.js / GA4 — *not* a GTM container; there is no container id and no `dataLayer`-driven tag manager on the site). Everything about them lives in `src/scripts/analytics.ts`; nothing is inlined into `<head>`.

The old counter on the live Tilda page — **`94685921`** — is *not* carried over. The domain isn't changing, so retiring it discards the existing history; that was the client's call, but it is worth naming out loud before cutover.

⚠️ **Nothing loads before consent, by design.** `analyticsAllowed()` in `src/scripts/legal.ts` is true only after «Принять»; `onConsentAnswer()` (added for this) wakes the counters on the same visit, so the answer takes effect without a reload. Not one request leaves the page before the banner is answered — verified with a routed browser run: 0 external requests before, 0 after «Только необходимые», both tags after «Принять». Reintroducing an eager tag would make the «Только необходимые» button a lie and § 2 of the cookie document false.

Four consequences of that stance, each easy to undo by accident:

- **No `<noscript>` pixel for Metrica.** Without JS there is no banner, so there is no consent — a pixel would count the visit anyway. The counter's own snippet ships one; ours deliberately doesn't.
- **Google's own Consent Mode order is rejected.** Google's documented flow ("load the tag always, signal consent separately") still fires cookieless pings while denied, i.e. a request goes out. We load the tag only after consent and *then* declare state: `analytics_storage: granted`, all three ad categories `denied` — the site runs no ad accounts and the visitor agreed to none. Add Google Ads later and that block is what has to change.
- **Local builds never count.** `import.meta.env.DEV` plus a localhost check keeps development out of the client's statistics; the console says so instead. To exercise the real thing locally, point a hostname at the file server (`--host-resolver-rules=MAP taotransit.test 127.0.0.1`) rather than removing the check.
- **The ids are public and live in the code**, with `PUBLIC_YM_ID` / `PUBLIC_GA_ID` as an off switch only: setting either to an empty string kills that counter on a given build. There is nothing secret to configure.

Two things that were waiting on a counter are now wired: the `sendForm` goal (`trackLead()` in `analytics.ts`, called from `src/scripts/lead.ts` **only after delivery succeeds**, so undelivered attempts don't inflate it — GA4 gets the standard `generate_lead` alongside), and `_ym_uid`, the one tracking mark read from a cookie rather than the URL. ⚠️ **The `sendForm` goal has to be created in the Metrica interface** — the call sends nothing until a goal with that id exists.

⚠️ **`_ym_uid` ships empty for anyone who refused analytics** — the cookie is a Metrica cookie and Metrica never loads. That is correct behaviour, not a bug to route around.

`cookieNotice.storageKey` was bumped to `tao-consent-v2` with this change: the set of trackers went from none to two, and everyone who answered the old banner answered a different question. Bump it again whenever that set changes.

SEO baseline on the current page is thin: `<title>` exists, **`meta description` does not**, `robots.txt` is Tilda's boilerplate and points at an `http://` sitemap. Parity is trivial; add description / OG / JSON-LD in the rebuild.

## Hosting

**Vercel, by the client's decision.** The repo is wired for it: `@astrojs/vercel` as adapter, `output` untouched (so still `'static'`), and exactly one route rendered on demand — `src/pages/api/lead.ts`, the lead receiver, via `export const prerender = false`. Every page still prerenders. `vercel.json` pins the framework, the build command and three header rules. Connect the GitHub repo in the Vercel dashboard and it deploys.

⚠️ **The adapter moves the build out of `dist/` into `.vercel/output/`** (Build Output API). That is why `outputDirectory` was removed from `vercel.json` — left in, Vercel would serve a directory that is no longer the output. After the first deploy, check with `curl -I` that the three security headers from `vercel.json` still arrive: the Build Output API and `vercel.json` routing are merged by the platform, and that merge is the one thing here not verifiable locally.

The serverless function weighs ~22 MB, almost all of it `sharp` (bundled for the `/_image` endpoint, which nothing uses — every image is optimized at build). Vercel's limit is 250 MB, so this is noise, not a problem.

⚠️ **Vercel is unreliable from Russia without a VPN**, and the audience — sellers in RU/KZ/UZ — is exactly who has to open the link. This was the reason the earlier plan ruled Vercel out for the client preview (`PLAN.md` § 1.5). The client chose it anyway; say it out loud before the domain cutover, not after.

### The site URL is env-driven

`astro.config.mjs` resolves `site` from, in order: `PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → `https://taotransit.com`. Everything absolute on the page comes out of it: canonical, `og:url`, `og:image`, JSON-LD `url`, `robots.txt`.

That indirection is not decoration. **taotransit.com still serves the old Tilda site**, so a build that hardcodes it would point `og:image` at a file that does not exist on someone else's page and `canonical` at that page itself.

### Indexing is gated on the host

`src/lib/site.ts` answers one question — is this build on `taotransit.com`? Two things read it:

- `src/pages/robots.txt.ts` — production emits `Allow: /` plus the sitemap; anything else emits `Disallow: /`.
- `src/layouts/Layout.astro` — anything else also gets `<meta name="robots" content="noindex, nofollow">`.

So the `*.vercel.app` deploy cannot become a duplicate of the client's live site. **At cutover, set `PUBLIC_SITE_URL=https://taotransit.com` in the Vercel project** — that flips both back on. `sitemap.xml` always names the production domain: it describes the site, not the deployment.

taotransit.com currently sits behind **DDoS-Guard**. Any cutover has to start from a full DNS zone export — MX/TXT/SPF/DKIM included.

### If Vercel turns out to be unreachable

The `mate` Timeweb VPS remains the fallback (`147.45.157.229` is the live box, `89.223.70.95` is idle standby — the `mate-server` SSH alias points at the standby, not the live one). If we go there, read `mate`'s CLAUDE.md § "RU reachability / ТСПУ" **before** touching nginx or certbot: HTTP/2 on every `:443` listen line is load-bearing for Russian reachability, and `certbot --nginx --expand` can silently strip it.

Two consequences for the form. amoCRM is called from outside Russia — reachable, just slower. And **the Cloudflare Worker becomes optional**: it existed to reach Telegram from a Russian VPS, and Vercel reaches Telegram directly. With `PUBLIC_LEAD_RELAY_URL` empty the form sends one request to `/api/lead` and the server carries both channels; the client code already branches on that with no edit. Deploy the worker only for a second independent route to Telegram, or for the rate limit — `FORM.md` § 11 and `workers/lead-relay/README.md`.

## Conventions

- Copy lives in **one content module**, not inline in markup — the page is 100% Russian marketing copy that the client will revise.
- **Anchors point where the original pointed**, and it is not obvious: Tilda hangs them on empty spacer records *before* the section. `#adventages` → «Почему мы?» (not the achievements strip, which has no anchor), `#services` → the services accordion, `#contacts` → footer. Verified against the original markup, don't "fix" them by name.
- **Thirteen scope passes are already closed.** The rebuild was "responsive behaviour and contrast only"; the refresh after it moved palette, typography, density and states onto the MATE tokens and re-authored four sections («Почему мы?», «Ценности», «Этапы работы», «Достижения»); the third added the lead form and, with it, the site's second contact channel; the fourth promoted the form to the page's primary destination (its own `#lead` section) and added the legal layer; the fifth rebuilt the tail — «Как начать работу ?» became «Как мы работаем» and was re-laid as a single vertical line, the form moved up behind it, and the final-CTA section was removed; **the sixth moved the whole site from the dark palette to the light MATE system** and, with it, removed «перевод средств» from every section and relabelled the form CTAs; the seventh rebuilt the four structural items the client had flagged — first screen geometry, «Этапы работы» as staggered cards, «Как мы работаем» in two columns, and the cases strip's alignment and navigation; **the eighth brought back two gradients from the original** (the step cards and the achievement pills), repainted the contact shutters brand, re-laid «Почему мы?» as a bento, and rebuilt the surface map around all of that. Imagery was left untouched throughout and still should be; the only asset that changed is the bot video's cover frame, taken from the same clip.

  **The ninth pass is the timeline's scroll behaviour** and nothing else: the drawing head now runs at 80% of the viewport instead of along its bottom edge, the scroll range is measured from the line's own span rather than the `<svg>` box, and on desktop a dot carries the head while the cards and labels grow out of it one at a time. No copy, no colour, no layout moved.

  **The tenth pass is three separate client notes.** The hero veil went from 85% to 75% plus a 3px `backdrop-blur`. The Telegram channel got a tile in the footer: a QR beside the heading, the link as its caption, the code generated at build time from `site.channel`. And the mobile navigation stopped being a horizontal strip — below 1024px there is now a burger on the left and a `<details>` panel growing out of its corner, holding the eight sections, a hairline rule, and the four footer contacts under it.

  **The eleventh pass is the second round on those same three.** The veil went down again to **62%**, and `scripts/veil-audit.mjs` was written to justify it: measured under the taglines' own boxes it is 5.18:1, where the same density across the whole frame would be 3.73:1. The channel moved to the public `t.me/matebox`, its caption became `@matebox` (`src/lib/telegram.ts`), and a second, quiet code appeared beside the bot button in «Как мы работаем». The menu's opening was rewritten to stop feeling janky.

  **The twelfth pass moved the channel tile up the page.** The quiet code beside the bot button is gone — next to the video and the CTA it was a third thing competing for attention in a block that had exactly one action. The tile itself left the footer for the end of «О нас», right behind the timeline: the company's history ends there and the channel is where it continues this week. It is now `ChannelCard.astro`, and its copy grew a teaser of the latest post. In the contact strip «тг канал» dropped to last — the four lines are ordered by how fast someone answers, and a channel is reading, not contact.

  **The thirteenth pass repainted that tile brand.** White card → brand slab, white text, the QR on a white plate inside it, and the post headline now links to the post itself (`t.me/matebox/21`) rather than to the channel. The slab is not a third surface — a brand slab inside a paper section is the guarantee slab in «Почему мы?». ⚠️ Repainting a card onto the fill moves three colours at once, and forgetting any of them yields an invisible element rather than an ugly one: secondary text `#6C6E78` → `#C0C3D1`, hairline `#8D8F99` → `#8083BE`, focus ring brand → white. And the QR has to stay dark-on-light — half of all scanners will not read an inverted code.

  ⚠️ **`channel.latest*` does not update itself.** It is the one place on the page that goes stale on its own — three fields of one record (headline, teaser, post URL) that must not drift apart. A tile that promises freshness and shows last year's headline is worse than no tile: if the client stops maintaining it, drop the block rather than let it rot.

  ⚠️ **The menu's jank had two causes and both are easy to reintroduce.** `<details>` fires `toggle` asynchronously, so waiting for it lets the browser paint the panel at full strength for a frame before the animation snaps it back — the start state has to be set *before* `open = true`, in the same task. And `<details>` hides its content instantly, so the exit has to be animated before `open` is cleared, which would leave the burger showing a cross for another 130 ms — `data-nav-closing` is what reverts the icon on the press. Both are in `src/scripts/nav.ts`, measured frame by frame.

Copy has been touched seven times, always on the client's explicit instruction: the fifth pass rewrote that one section's heading and lead; the sixth changed the «Почему мы?» guarantee line, the form's heading and consent line, and deleted every mention of money transfers; the tenth added the two lines of `footer.channel`; the eleventh added `howToStart.channel` and swapped the channel address for the public `t.me/matebox`; the twelfth dropped `howToStart.channel` again and wrote the whole `channel` block, teaser of the latest post included; the thirteenth sharpened that teaser and cut it off on an ellipsis. Everything else is still the original Tilda wording. Don't start a fourteenth pass without asking. **All client feedback is now closed**; what remains open is on the client's side, not ours (legal requisites, their own Metrica counter, the form's receivers).
- Reference screenshots at every original breakpoint are the acceptance artifact for *fidelity* questions — capture before, compare after. Since the light migration they are **no longer the acceptance criterion for colour at all**; for anything visual, `DESIGN.md` is. They remain useful for layout, composition and copy.
- **Measure colour, don't look at it.** Six tools, all committed:
  - `scripts/contrast-audit.mjs [ширины]` — walks every text node on the built page and checks it against the colour actually painted underneath, at each width. Exits non-zero on any AA failure. ⚠️ It parses `oklab()` on purpose: Tailwind v4 resolves `color-mix` results into that notation, and a naive `rgb()` parser reads the white 90% header pill as near-black and reports eight phantom failures.
  - `scripts/contrast.mjs "#111 #F9FAFD" …` — one WCAG pair from the command line.
  - `scripts/gradient-audit.mjs [ширины]` — the same question for text standing on a gradient, which the audit above is blind to: it hides the text (`visibility: hidden`, the background stays), screenshots its box and reads the real pixels. ⚠️ It scrolls with `block: 'center'`, not `scrollIntoViewIfNeeded` — otherwise the fixed header lies over the box being measured and its `ring-line` lands in the sample as "the background under the text" (3.32:1 out of thin air; caught exactly that way).
  - ⚠️ The audit skips `aria-hidden="true"` subtrees. Exactly one thing relies on that: the embossed roman numerals in «Этапы работы», at 1.34:1 by design (the `<ol>` already carries step order). **Never hide real text behind `aria-hidden` to pass the audit.**
  - `scripts/veil-audit.mjs [--alpha=…] [ШxВ…]` — the hero veil, which none of the others can see. It pauses the background clip, steps it every half-second, hides the taglines (`visibility: hidden`, the background stays) and reads the real pixels under their boxes across five viewports. `--alpha` overrides the veil density on the fly — that is how the density was picked.
  - `scripts/qr-audit.mjs [ширины]` — not colour, same family: it screenshots every `[data-qr]` at its real size (`deviceScaleFactor: 1`, i.e. as many pixels as a plain phone screen gets) and hands the shot to a decoder, then checks what was read against the `href` of the link the code is drawn inside. That comparison is independent — the href is what a click does, the code is what a scan does — where a list of addresses in the script would only check itself. A code that scans but leads elsewhere is worse than one that doesn't scan.
  - `scripts/serve-build.mjs` — поднимает собранную страницу на 4399 (`npm run preview`); без него замерять нечего, потому что `astro preview` с адаптером не работает.
  - `scripts/compare-feedback.mjs` — shoots the live original, our build and mate's contact block at the same places and states into `reference/compare/` (git-ignored — regenerate, don't commit).

  ⚠️ **The hero veil used to be a blind spot of all of them** — `contrast-audit.mjs` reads `background-color`, and under the hero taglines that is the section's solid `bg-brand`, i.e. 10.71:1 out of thin air. `veil-audit.mjs` now covers it, and the number it reports depends on **where the bright content sits in this particular clip**: at 62% the worst pixel under the taglines is 5.18:1, while across the whole frame the same 62% would be 3.73:1. **Replace the clip and the density has to be picked again** — run `veil-audit`, don't assume 62% still holds. Blur buys nothing here: the clip's white areas are large, and even σ=10 moves the worst pixel by hundredths.

  These exist because "на глаз" has been wrong here four times: `#5b35e5` at 2.8:1, `--fg-faint` on panel at 4.35:1, the header items at 4.25:1 over the hero, and the phantom failures above.

## Design context

Two root files carry the design brief. **Read them before any visual work**; every `impeccable` command loads them automatically.

- **`PRODUCT.md`** — who the visitor is, what the page is for, brand personality, anti-references, five strategic principles. Register: `brand`.
- **`DESIGN.md`** — the visual system: palette with measured contrast, type scale, elevation, components, do's and don'ts, and § 7, which records what the migration changed plus the one item left open.

Three things from them worth carrying in your head:

1. **The visitor already has an agent.** They are not shopping for logistics, they are deciding whether to switch. Every section answers "what happens when it goes wrong".
2. **The North Star is «Дневная смена».** It replaced «Ночная смена» in the sixth pass: dark used to be justified by the timezone gap, and the client chose brand unity with MATE instead. The rule that follows: *colour goes to the claim, paper to the proof.* Brand fill is the scarce resource — first screen, the guarantee, the CTA band, the form. Paper goes to what is read slowly: cases, history, rates.
3. **The humour is load-bearing.** «Обернуть скотчем 6 китайских стен», the 3D objects, the founders at the containers. They are what keeps the page from drifting into a generic light SaaS template — the trap of the light theme, which replaced the old trap of dark-plus-violet (a Linear clone). Don't tidy them away.

## Соответствие оригиналу: что снято замерами, а не на глаз

Всё ниже вытащено из живой страницы (Playwright + разбор разметки), значения лежат в `reference/`:

**Типографика.** Заголовки секций — **96px / 900 / line-height 1** (утилита `section-title`), «Все началось в 2013…» — 48/900. Подзаголовки карточек в «Почему мы?» и «Ценностях» — **400, не жирные** (частая ошибка на глаз). Текст пилюль достижений — 24/900, «1 день» в этапах — 36/900, заголовки кейсов и тарифов — 36/900. Кнопки — 24/700. Подписи hero — 20/400 и 22/400. Меню — Black.

**Градиенты оригинала.** Их шесть, и два из них возвращены заказчиком в восьмом заходе — карточки «Этапов» (`linear-gradient(0turn, #5b35e5 0%, rgba(17,16,28,0) 95%)`, ровно три применения: залита каждая вторая карточка) и пилюли достижений (`linear-gradient(.25turn|.75turn, #5b35e5 23%, transparent 100%)`, по два в каждую сторону: хвост всегда гаснет в сторону 3D-объекта). ⚠️ Числа стопов **не переносятся**: на светлой системе они ставят текст на полутон. Пересчёт и замеры — `DESIGN.md` § 2.

**Свечения оригинала** (`box-shadow`, spread всегда 0). Их девять, и **ни одно не воспроизводится** — на светлой системе теней нет вовсе. Таблица оставлена для чтения эталонных снимков:

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

**Прочерчивание линеек** (`data-rule`) — второй вид того же появления, добавленный заказчиком в восьмом заходе: линия идёт `scaleX(0) → 1` от левого края за 800 мс. Разделители аккордеона «Услуги» и выносные линии тарифной сетки ведут себя как змейка — до них не дошли, их нет. Наблюдатель тот же, отдельного прохода нет, различается только целевое преобразование. ⚠️ Внутрь `<details>` линейку класть нельзя: браузер прячет всё, кроме `<summary>`, пока пункт закрыт, — поэтому у каждого пункта аккордеона своя обёртка.

⚠️ **Быстрая программная прокрутка не запускает появления.** IntersectionObserver считает пересечения раз в кадр, и `window.scrollTo` в тесном цикле без `requestAnimationFrame` не даёт браузеру ни одного кадра: элементы остаются при `opacity: 0`, а сдвинутые на 330px пилюли раздувают `body.scrollWidth` до 1525. Оба эффекта — артефакт замерялки, а не страницы. Любой скрипт, который листает страницу перед снимком, обязан ждать кадр (см. `scripts/gradient-audit.mjs`).

**Змейка «Все началось в 2013…».** Шесть кривых Безье — это `path` из SVG оригинала, нормализованные к `viewBox 0 0 669 797` (`src/content/timeline-geometry.ts` вместе с позициями карточек и меток и углами их поворота). На ≥1280px область таймлайна **фиксирована в 1057px** — ровно как в оригинале; растягивание искажало стыки линий с карточками. Ниже 1280px абсолютная раскладка не выживает, там вертикальная ось.

Линия **прорисовывается по мере прокрутки** (`src/scripts/timeline.ts`): длины всех шести путей складываются, `stroke-dashoffset` раскрывается последовательно, прогресс берётся из `scroll()` motion.

**Голову линии несёт точка, и на десктопе из неё по очереди вырастают карточки и метки** (`data-tl-card`, `data-tl-label`, стартовое состояние — `.anim [data-tl-*]` в `global.css`, заперто в `@media (width >= 80rem)`). Четыре вещи, которые ломаются, если их не знать:

- ⚠️ **Рост кончается на приходе линии, а не начинается с него** (`k = (drawn - at + GROW) / GROW`). Иначе последняя карточка, чей приход совпадает с концом линии, не появится никогда.
- ⚠️ **`GROW = 150` — не вкус, а замер.** Метки и карточки чередуются вдоль линии, самый тесный промежуток между соседями 122 единицы из 3566. Больше 150 — и элементы начнут появляться парами вместо очереди.
- ⚠️ **Прокрутка отмеряется по размаху линии, а не по рамке `<svg>`** (`pathSpan()`). На узких экранах рамка тянется во всю ленту, а линия кончается у последнего узла: голова убегала вверх и к концу оказывалась на 41% экрана вместо 80.
- ⚠️ **Первая карточка не помечена намеренно** — она стоит в начале линии и видна сразу. Порядок пометок = порядок кривых: карточка привязана к концу своей кривой, и восьмая запись сломала бы это соответствие.

Место меток ищется замером (ближайшая точка выборки к центру метки), поэтому метку можно двигать в `timeline-geometry.ts`, ничего не правя в скрипте. Точки роста карточек считаются по их рамкам и пересчитываются после `document.fonts.ready` — но **только они**: полный пересбор снял бы подписку и мигнул бы, если шрифт доедет, когда читатель уже в змейке.

Эталоны для сверки: `reference/lines/timeline-svg.png` (оригинал), `reference/lines/our-timeline.png` (наша версия), `reference/lines/coords.json` (замеры).

## Про motion

`motion` — обычный npm-пакет, никакой интеграции с Astro не требует: импортируется в `<script>` компонента или в модуль под `src/scripts/`, Vite бандлит его как любой клиентский код. Островов и фреймворка не нужно.

Важно для веса: **`animate` берём из `motion/mini`** (обёртка над WAAPI), а `inView`/`scroll` — из основного пакета. Полный `motion` тянул 68 КБ JS, эта комбинация — 23 КБ.

## Грабли dev-сервера

Дважды за разработку `astro dev` вводил в заблуждение:

1. **500 на всех `/_image`** — процесс, поднятый до переименования файлов в `src/assets/img/`, продолжал отдавать битые ссылки; на странице были пустые места вместо картинок.
2. **Старые стили из `<style>` компонента при новой разметке.** После правки блока стилей в `About.astro` dev отдавал прежний CSS вместе с обновлённым HTML: карточки таймлайна получались 342×66 вместо 398×110 — без полей, текст впритык, линии в пустоте. Сборка при этом была правильной.

**Правило: после правок в `<style>` компонента или переименования ассетов — перезапускать dev начисто**, а не полагаться на HMR:

```
npx astro dev stop && rm -rf node_modules/.vite .astro && npm run dev -- --host --port 4321
```

Если увиденное расходится с ожиданиями — сначала сверяться с собранной страницей на отдельном порту, и только потом искать баг в коде:

```
npm run build && npm run preview      # http://127.0.0.1:4399
```

⚠️ **`astro preview` больше не работает** — адаптер `@astrojs/vercel` эту команду не реализует, а сама сборка уезжает из `dist/` в `.vercel/output/static/`. `npm run preview` теперь поднимает `scripts/serve-build.mjs`, файловый сервер по этой папке. Порт 4399 совпадает с дефолтом `contrast-audit.mjs`, так что замерялки запускаются без флагов.

Одного он не отдаёт: `/api/lead` — эндпоинт рендерится по запросу и лежит в `.vercel/output/functions`. Для него нужен `npm run dev`.
