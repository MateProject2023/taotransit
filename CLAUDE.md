# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## What this project is

A **rebuild of the taotransit.com landing page** — currently a Tilda one-pager — as a static Astro + Tailwind site. TAO Transit is a China→CIS freight-forwarding agent (buyout, consolidation, QC, delivery), same client family as the `mate` project in `../mate/mate`.

**Current state: stage 1 (layout) is built, the design refresh on top of it is done, and the lead form's front end is in.** Astro 7 + Tailwind 4, all 13 visible sections rebuilt, zero external requests, no console errors. `PLAN.md` holds the agreed staging.

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
- `src/lib/qr.ts` — build-time QR generator. The Telegram-channel code in the footer is **generated from `site.channel`, not committed as an image**: the client edits that address, and a file would silently start pointing elsewhere. `qrcode-generator` is a build-time dependency; nothing reaches the client bundle.
- `FORM.md` — **the lead-delivery spec** (Telegram + amoCRM): routing, request contract, full sources to copy, env vars, traps, rollout order and what is still unanswered. Everything about the form's insides lives there, not here.
- `design-tokens/` — the vendored MATE brand package (tokens, font, README). Light-theme; ported, not imported.
- `reference/` — the acceptance material: `tilda-page.html` (original markup), `content-dump.txt` (per-section text), `assets/` (originals pulled from the CDN), `screenshots/` (original at 5 widths), `shots/` (our build, same widths), `competitors/` (ChinaToday, Sinoruss, Forto at 1440 — the category we are steering away from), `hero-source-rutube.mp4`.
- `scripts/capture-reference.mjs` — re-shoots the original; `scripts/shoot.mjs` — shoots our build. Both take widths as args.

**Interactivity is a handful of tiny vanilla scripts and nothing else**: the video facade, the scroll-top button, the scroll animations, the timeline line, the lead form (`src/scripts/lead.ts`), the custom select (`src/scripts/select.ts`), the legal dialogs plus consent banner (`src/scripts/legal.ts`), the contact lines' clipboard copy (`src/scripts/contacts.ts`) and the mobile menu (`src/scripts/nav.ts`). The services accordion is `<details>`, the cases carousel is scroll-snap, the legal documents are native `<dialog>`, and the contact lines' shutter and marquee are pure CSS. No framework islands, no hydration.

**Stage 1 (current) is layout plus the form's front end** — a faithful, improved rebuild of everything visible, to show the client. The form **backend**, the analytics counter, hosting and the domain cutover are still deferred to stage 2+. Don't build stage-2 machinery while stage 1 is running.

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

## The form

**The whole mechanism lives in `FORM.md`. Read it before touching anything on either side of the form** — routing, request contract, the full sources to copy from `mate`, env vars, ten traps, the rollout order and the open questions are all there. What follows is only what a reader of this file needs to know.

**Front end: built (stage 1).** `src/components/LeadForm.astro` + `src/scripts/lead.ts` + `leadForm` in `landing.ts`. It is its own section `#lead`, placed **right after «Как мы работаем»** — the bot section explains how the service works and ends with a button into the bot, and the form is the second way in. Every CTA on the page anchors to it, so no anchor ever scrolls backwards. The section carries its own concierge-bot button beside the form; that is the page's only real fork. Every other CTA is a single button — `DESIGN.md` § 5 «Кнопка бота» has the reasoning, including why the paired buttons that existed briefly were removed.

The «Что нужно» field is a custom listbox (`src/components/Select.astro` + `src/scripts/select.ts`), not a native `<select>`. The original reason was that a native select rendered a light system panel on a dark form; that reason is gone with the dark theme, but the arrow, padding and typography still come from the browser and differ in each. It reproduces native keyboard behaviour; if you touch it, keep that.

The client already assembles the complete request body: `requestId`, all 11 tracking marks, `_ym_uid` from the Metrica cookie, the relay/origin split and the fallback retry. Stage 2 adds addresses, not client code.

⚠️ **Demo mode.** With neither `PUBLIC_LEAD_RELAY_URL` nor `PUBLIC_LEAD_ORIGIN_URL` set at build time, the form **sends nothing**: it shows the success screen and warns in the console. That is the state of every build right now — if the client tests the form, say so out loud. The mode switches off by itself once either address appears in `.env`.

**Back end: not started.** No worker, no `src/lib/lead.js`, no `src/pages/api/lead.ts`, no secrets. Decisions already taken (details and reasoning in `FORM.md`):

- **Telegram: the concierge bot already on the site — `@taotransit_bot`** — posting to a **separate chat** (new `CHAT_ID`), not the one clients talk in.
  - `sendMessage` does **not** conflict with whatever runs that bot — a webhook and outbound sends coexist. **Never call `setWebhook`/`deleteWebhook` on this token**, and note that **`getUpdates` is also unusable** on a bot with a live webhook, so the chat id has to be obtained another way.
- **amoCRM:** same account (`mategrouptrade`), **different pipeline** (`AMO_PIPELINE_ID`).
- **Port the pipeline, not the framework.** `../mate/mate/src/lib/lead.js` is deliberately isomorphic — Web APIs only, no `next/*`, no `fs`, no `@/` alias — so it and the `workers/lead-relay` Worker move over unchanged. `FORM.md` § 8 carries both files verbatim, already retargeted, so the `mate` repo is not a dependency.
- Known trap: `ALLOWED_ORIGINS` lives in one file but feeds two deploy targets — a change needs **both** a push and a manual `wrangler deploy`, or the receivers drift.

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

The live page runs **Yandex.Metrica `94685921`** and no GA. The client wants **a new counter of their own**, added later. Note when doing it: the domain isn't changing, so dropping `94685921` discards the existing history — worth a second look before retiring it.

Two things wait on that counter: the `sendForm` goal in `src/scripts/lead.ts` (the call site is marked, the call itself is absent) and `_ym_uid`, the one tracking mark that comes from a cookie rather than the URL — without a counter the cookie never exists and the mark ships empty.

⚠️ **The counter must be gated on consent.** `analyticsAllowed()` in `src/scripts/legal.ts` returns true only after the visitor pressed «Принять» in the banner. Load the counter behind it, and re-check after the banner is answered — otherwise the «Только необходимые» button is a lie and the cookie policy text (`src/content/legal.ts`, § 2 of the cookie doc) becomes false. Bumping `cookieNotice.storageKey` re-asks everyone; do that if the set of trackers changes.

SEO baseline on the current page is thin: `<title>` exists, **`meta description` does not**, `robots.txt` is Tilda's boilerplate and points at an `http://` sitemap. Parity is trivial; add description / OG / JSON-LD in the rebuild.

## Hosting

**Vercel, by the client's decision.** The repo is wired for it: no adapter, `output: 'static'`, Vercel's Astro preset builds `npm run build` → `dist/`. `vercel.json` pins the framework, the build command and three header rules. Nothing else is needed — connect the GitHub repo in the Vercel dashboard and it deploys.

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

Note for stage 2: a Vercel deploy also changes the form's back end. Vercel supports the API route (`@astrojs/vercel` adapter, `prerender = false`), but amoCRM would then be called from outside Russia — see `FORM.md` § 11.

## Conventions

- Copy lives in **one content module**, not inline in markup — the page is 100% Russian marketing copy that the client will revise.
- **Anchors point where the original pointed**, and it is not obvious: Tilda hangs them on empty spacer records *before* the section. `#adventages` → «Почему мы?» (not the achievements strip, which has no anchor), `#services` → the services accordion, `#contacts` → footer. Verified against the original markup, don't "fix" them by name.
- **Ten scope passes are already closed.** The rebuild was "responsive behaviour and contrast only"; the refresh after it moved palette, typography, density and states onto the MATE tokens and re-authored four sections («Почему мы?», «Ценности», «Этапы работы», «Достижения»); the third added the lead form and, with it, the site's second contact channel; the fourth promoted the form to the page's primary destination (its own `#lead` section) and added the legal layer; the fifth rebuilt the tail — «Как начать работу ?» became «Как мы работаем» and was re-laid as a single vertical line, the form moved up behind it, and the final-CTA section was removed; **the sixth moved the whole site from the dark palette to the light MATE system** and, with it, removed «перевод средств» from every section and relabelled the form CTAs; the seventh rebuilt the four structural items the client had flagged — first screen geometry, «Этапы работы» as staggered cards, «Как мы работаем» in two columns, and the cases strip's alignment and navigation; **the eighth brought back two gradients from the original** (the step cards and the achievement pills), repainted the contact shutters brand, re-laid «Почему мы?» as a bento, and rebuilt the surface map around all of that. Imagery was left untouched throughout and still should be; the only asset that changed is the bot video's cover frame, taken from the same clip.

  **The ninth pass is the timeline's scroll behaviour** and nothing else: the drawing head now runs at 80% of the viewport instead of along its bottom edge, the scroll range is measured from the line's own span rather than the `<svg>` box, and on desktop a dot carries the head while the cards and labels grow out of it one at a time. No copy, no colour, no layout moved.

  **The tenth pass is three separate client notes.** The hero veil went from 85% to 75% plus a 3px `backdrop-blur` — the density is a measurement off the clip, not a taste call, and it is the one number on the page no audit can check (see the warning under "Measure colour"). The Telegram channel got a tile in the footer: a QR beside the heading, the link as its caption, the code generated at build time from `site.channel`. And the mobile navigation stopped being a horizontal strip — below 1024px there is now a burger on the left and a panel growing out of its corner, holding the eight sections, a hairline rule, and the four footer contacts under it. Copy added: `footer.channel`, two lines.

Copy has been touched four times, always on the client's explicit instruction: the fifth pass rewrote that one section's heading and lead; the sixth changed the «Почему мы?» guarantee line, the form's heading and consent line, and deleted every mention of money transfers; the tenth added the two lines of `footer.channel`. Everything else is still the original Tilda wording. Don't start an eleventh pass without asking. **All client feedback is now closed**; what remains open is on the client's side, not ours (legal requisites, their own Metrica counter, the form's receivers).
- Reference screenshots at every original breakpoint are the acceptance artifact for *fidelity* questions — capture before, compare after. Since the light migration they are **no longer the acceptance criterion for colour at all**; for anything visual, `DESIGN.md` is. They remain useful for layout, composition and copy.
- **Measure colour, don't look at it.** Five tools, all committed:
  - `scripts/contrast-audit.mjs [ширины]` — walks every text node on the built page and checks it against the colour actually painted underneath, at each width. Exits non-zero on any AA failure. ⚠️ It parses `oklab()` on purpose: Tailwind v4 resolves `color-mix` results into that notation, and a naive `rgb()` parser reads the white 90% header pill as near-black and reports eight phantom failures.
  - `scripts/contrast.mjs "#111 #F9FAFD" …` — one WCAG pair from the command line.
  - `scripts/gradient-audit.mjs [ширины]` — the same question for text standing on a gradient, which the audit above is blind to: it hides the text (`visibility: hidden`, the background stays), screenshots its box and reads the real pixels. ⚠️ It scrolls with `block: 'center'`, not `scrollIntoViewIfNeeded` — otherwise the fixed header lies over the box being measured and its `ring-line` lands in the sample as "the background under the text" (3.32:1 out of thin air; caught exactly that way).
  - ⚠️ The audit skips `aria-hidden="true"` subtrees. Exactly one thing relies on that: the embossed roman numerals in «Этапы работы», at 1.34:1 by design (the `<ol>` already carries step order). **Never hide real text behind `aria-hidden` to pass the audit.**
  - `scripts/qr-audit.mjs [ширины]` — not colour, same family: it screenshots every `[data-qr]` at its real size (`deviceScaleFactor: 1`, i.e. as many pixels as a plain phone screen gets) and hands the shot to a decoder, then checks what was read against the address written beside it. A code that scans but leads elsewhere is worse than one that doesn't scan.
  - `scripts/compare-feedback.mjs` — shoots the live original, our build and mate's contact block at the same places and states into `reference/compare/` (git-ignored — regenerate, don't commit).

  ⚠️ **The hero veil is a blind spot of all of them.** `contrast-audit.mjs` reads `background-color`, and under the hero taglines that is the section's solid `bg-brand` — the video and the veil over it do not exist for it. The veil's density was measured separately, off the clip itself (frames to rgb24, averaged in 9×8 blocks, composited): the clip contains pure white areas, so the worst case is white, and at 75% white text gets 5.31:1 there. **Touch `bg-brand/75` and no audit will say a word** — re-measure by hand. Table in `DESIGN.md` § 7, tenth pass.

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
2. **Старые стили из `<style>` компонента при новой разметке.** После правки блока стилей в `About.astro` dev отдавал прежний CSS вместе с обновлённым HTML: карточки таймлайна получались 342×66 вместо 398×110 — без полей, текст впритык, линии в пустоте. Сборка (`astro preview`) при этом была правильной.

**Правило: после правок в `<style>` компонента или переименования ассетов — перезапускать dev начисто**, а не полагаться на HMR:

```
npx astro dev stop && rm -rf node_modules/.vite .astro && npm run dev -- --host --port 4321
```

Если увиденное расходится с ожиданиями — сначала сверяться с `astro preview` на отдельном порту, и только потом искать баг в коде.
