# AGENTS.md

## Project

Minimal personal website - resume and highlights (projects, competitions and research). The blog code is kept but not published (see Blog). Deployed to Cloudflare Workers (static assets) via Workers Builds.

## Tech Stack

- **Astro 7** with `output: "static"` (fully static - no SSR adapter needed) and `@astrojs/sitemap`
- **Tailwind CSS v4** (`@tailwindcss/vite` Vite plugin - NOT `@astrojs/tailwind`, which is deprecated)
- **Cloudflare Workers (static assets)** - Workers Builds Git integration, serves the static `dist/` output, plus a small Worker script that runs only for `/api/*` (the chat, see Chat). No GitHub Actions needed. It replaced Cloudflare Pages in 2026-11 because Cloudflare builds new features on Workers only.
- **Node.js 22.23.4+** required (Astro 7)

## Commands

```bash
npm run dev      # Start the Astro dev server
npm run build    # Build to ./dist
npm run preview  # Preview production build locally
npm run build && npx wrangler dev   # Run the site and the chat Worker locally on :8787 (see Chat)
```

## Git

- Use **Conventional Commits** for every new commit (for example: `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`).
- **Work longer, then commit once.** The history is public, so do not commit every small change. Make the edits for a feature or a batch of requests, then create a single commit for it. Only commit when asked, or when a piece of work is finished.
- Never push unless the user says so. A push to `master` deploys the site. Committing is not permission to push, and a go-ahead to push once does not carry over to later commits: ask again each time.
- When rewriting history, preserve commit contents and metadata unless the task explicitly requires changing them.

## Project Structure

```text
/
├── src/
│   ├── components/        # ChatHost (the chat's static shell), highlights, highlight cards, gallery, photo viewer, timelines
│   ├── content/
│   │   ├── highlights/    # Highlight entries (Projects / Competitions / Research), one Markdown file each
│   │   └── blog/        # Markdown blog posts (not published, see Blog)
│   ├── content.config.ts  # Content Layer API config (zod comes from astro/zod)
│   ├── layouts/
│   │   └── Layout.astro   # Shared page layout
│   ├── lib/
│   │   ├── highlights.ts  # Tracks (build / compete / research), their headings and URL sections, highlightUrl()
│   │   ├── experience.ts  # Experience data (the website's source of truth), rendered by ExperienceList.astro
│   │   ├── education.ts   # Education data, rendered by EducationList.astro
│   │   ├── timeline.ts    # TimelineItem, Bullet and TimelineLink types
│   │   ├── chat-context.ts # buildContext(): the whole site as plain text for the chat assistant, and sitePages(): the pages it may link to
│   │   ├── marketplace.ts # Live install counts with fallbacks (build time)
│   │   ├── count.ts       # Shared count formatting and rounding
│   │   └── image.ts       # imageSize(): pixel size of a /public image for width and height attributes
│   ├── worker/            # The chat Worker (index.ts, limiter.ts, prompt.ts, log.ts), see Chat
│   ├── integrations/
│   │   └── chat-context.ts # After the build, moves dist/chat-context.txt to src/worker/context.generated.txt
│   ├── vendor/limmat/     # Built copy of limmat, the streaming markdown renderer (see its README)
│   ├── scripts/
│   │   ├── chat.ts        # The chat (modes, wave, dock, saved conversation), loaded only when the pill is used or a minimised chat is restored
│   │   ├── chat.css       # The conversation's styles, imported as an inline string by chat.ts
│   │   ├── live-counts.ts # Refreshes install counts in the browser and adds the hover note
│   │   ├── drag.ts        # startDrag(): one pointer's drag, shared by the two 404 scripts
│   │   ├── fall-404.ts    # Falling, draggable "404" letters on the 404 page (skipped with reduced motion)
│   │   └── cat-stack.ts   # The cat photo pile on the 404 page: deal-in, flick, tilt, fan
│   ├── pages/
│   │   ├── index.astro    # Resume/home
│   │   ├── [section]/
│   │   │   ├── index.astro    # Section index: /projects/, /competitions/ or /research/
│   │   │   └── [id].astro     # Highlight detail page: /projects/<id>/, /competitions/<id>/ or /research/<id>/
│   │   ├── 404.astro          # The 404 page: falling letters and the cat photo pile (see 404 page)
│   │   └── _blog/             # Unpublished blog pages (the underscore keeps them out of the build)
│   │       ├── index.astro    # Blog listing
│   │       └── [id].astro     # Individual post
│   └── styles/
│       └── global.css     # @import "tailwindcss"
├── migrations/            # D1 schema for the saved chats (see Chat), applied with wrangler d1 migrations apply
├── public/
│   ├── _redirects         # Old site URLs (/portfolio, /resumes/..., /achievements/...) redirected to current ones, plus the /go/ tracked links
│   ├── _headers           # Cache rules and the security headers
│   ├── og.png             # Social preview image
│   ├── media/cat/         # The 404 page's cat photos, one 540 x 720 WebP each
│   └── robots.txt         # Points to the sitemap generated by @astrojs/sitemap, disallows /go/ and /api/
├── resume/                # resume.tex (public one-page resume), resume-phone.tex (local copy with the phone number), secrets.tex (ignored)
├── astro.config.mjs
├── wrangler.jsonc
└── README.md              # GitHub Profile README (this repo is also the profile repo)
```

## Resume and website

- Source of truth: the website (the data in `src/lib/experience.ts` and `src/lib/education.ts`) holds all the information. LinkedIn is a bullet-for-bullet copy of it (see LinkedIn). The resume is a one-page selection of it: it may drop roles, bullets, courses and tech names, but whatever it says must agree with the website.
- Edit the website first, then bring LinkedIn in line, and update the resume if the changed text appears on it.
- `resume/resume.tex` is the curated one-page resume. `latexmk -pdf resume.tex` (run inside `resume/`) builds it and `.latexmkrc` copies the PDF to `public/Daan_Rosendal_Resume.pdf`. Keep it on one page and check the page count after every edit.
- The website (`src/components/ExperienceList.astro` and `EducationList.astro`) is the extensive version of the same history. Whenever a resume bullet, title, date or link changes, update the matching website entry in the same batch of work.
- The website keeps the longer content that the resume leaves out: course lists, second bullets, the "5 evaluations" CERN bullet and older roles such as Deltion College and GWBO. There is space for it, so never trim the website to match the resume.
- Roles that are left off the resume are flagged `earlier: true` in `src/lib/experience.ts`. They glow when the resume's "See all roles" link (`/#earlier-experience`) is opened. When a role is dropped from or restored to the resume, update its flag.
- The resume's last Experience row summarises those flagged roles: "Earlier experience, <first year>-<last year>: <names>", with the link "See all experience" to `/#earlier-experience`. List every `earlier: true` role as one name per employer (two projects at the same place count once), newest first, with the Oxford comma; the years span all of them. When another name would leave less than about 10 pt before the link, keep the newest names and end with "and N more". Update the row in the same batch whenever a role is flagged or unflagged, and re-check the page count. Never rename the `earlier-experience` anchor, because PDFs already in circulation link to it.
- Every `daanrosendal.com` link in `resume.tex` goes through `/go/resume` (for example `daanrosendal.com/go/resume/research/federated-learning-paper/`). The two rules at the end of `public/_redirects` send it on with a 302, and Cloudflare's edge analytics then count each click by path, which is the only way to see resume traffic because PDF clicks carry no referrer. Never delete those rules, or the resume links 404. When counting clicks in the edge data (`httpRequestsAdaptiveGroups`, `clientRequestPath_like: "/go/%"`), filter on `requestSource: "eyeball"`: Cloudflare's Early Hints cache adds a fake 504 row per hit that is not a visitor. Use another name for another source (`/go/<source>/...`), and keep it out of the sitemap (`robots.txt` disallows `/go/`).
- In `resume.tex`, comment out single bullets that might come back and delete everything else. Do not keep dead blocks.

## LinkedIn

- LinkedIn lists every bullet and mirrors the website (`src/lib/experience.ts`, `src/lib/education.ts`), not the one-page resume. The website is the source of truth: content that only exists on LinkedIn is added to the website first, then LinkedIn follows.
- After any change to a bullet, title, date, company or link in the website or the resume, check LinkedIn in the same batch of work. Read `https://www.linkedin.com/in/daanrosendal/details/experience/` and `/details/education/` with Claude in Chrome (the user is already signed in and the interface is Dutch), compare them with the website entries and report every mismatch.
- Never edit LinkedIn without asking. Show the exact new text for each change and wait for a yes before saving. Never sign in or enter credentials, and do not install LinkedIn automation tools or MCP servers (they cannot edit profiles anyway and put the account at risk).
- Never share or announce anything. Keep "Netwerk op de hoogte stellen" (notify network) off, and never click "Nu plaatsen" or any other post, share or "Connectie maken" button. After a save, the only screen to dismiss is "people you may know", with "Overslaan". If anything else appears (a post composer or a new prompt), stop and ask the user.
- When adding or editing a role, keep the profile headline unchanged ("Kopregel van profiel bijwerken": pick the current headline) and leave "Huidige functie beëindigen" unticked. Re-read the saved text afterwards, because typing into LinkedIn's rich-text boxes can drop characters.
- Expected differences, not drift: LinkedIn titles carry the type in brackets (for example "Cloud Solution Architect (Intern)"), the company is LinkedIn's entity ("Lakera, now part of Check Point"), and dates use Dutch month names. Projects synced from linked apps cannot be edited on LinkedIn. The plain "Via Rent Your Student Scrum Team (RYSST): <url>" line under the Print.one and Univé highlights on LinkedIn is the website's "Via Rent Your Student Scrum Team (RYSST)" link, not a bullet.

## 404 page

- `src/pages/404.astro` holds the markup and its CSS (`<style is:global>` is bundled into that page only). The behaviour lives in `src/scripts/fall-404.ts` (letter physics), `cat-stack.ts` (photo pile) and `drag.ts` (shared drag tracking). They are hand-written, with no animation or physics library.
- It must fit the window without scrolling, on laptops and phones. Sizes come from the window height (`--f` for the letters, `--sh` for the pile). The `6rem` is the body padding in `Layout.astro` and the `19rem` is the room for the text and button row: after changing either, or the copy, re-check the fit at a short laptop and a small phone size.
- Photos: one 540 x 720 (3:4) WebP per photo in `public/media/cat/`, cropped from the original with metadata stripped. There is no `-sm` or `full/` copy, because the pile is small and never opens the photo viewer. Cloudflare caches `/media/` for 30 days, so give a replacement photo a new file name instead of overwriting the old one. To add one, list it in the `cats` array in `404.astro` (with alt text and a tilt); the glow colors are sampled from the file at build time.
- It honors `prefers-reduced-motion` (static letters, no autoplay or springs) and works without JavaScript (a static row and a static pile).

## Chat

- **The chat UI is switched off** (`CHAT_UI_ENABLED` is `false` in `src/lib/chat-flag.ts`, since 2026-11-10, because the feature is unfinished). Set it to `true` and rebuild to bring back the pill, the dock, and everything below. The Worker at `/api/chat` is untouched and has its own kill switch (`CHAT_ENABLED` in `wrangler.jsonc`). Unfinished items: see the chat notes in the assistant memory (real-model test of Junior's voice, an optional movable dock, a privacy line, limmat v0.1 on npm).
- When enabled, every page except the 404 has a typable "Ask Junior about Daan" pill (`src/components/ChatHost.astro`, included by `Layout.astro`; pass `chat={false}` to leave it out). It fades in after about 2 s, and its cross hides it for 30 days (`localStorage` `chat:off`, with an "Ask Junior" text link at the page end to bring it back). The chat is driven by `html[data-chat]`: absent (closed, only the pill), `open` (small window), `full` (water takeover on the first message), `dock` (bottom right, a one-line bar on phones). An inline head script in `Layout.astro` sets `data-chat="dock"` from `sessionStorage` (`chat:v1`) before the first paint, so a minimised chat is already in place on the next page. Pages are full loads (no router); the conversation is restored from `sessionStorage`, `pageshow` handles the back-forward cache, and `@view-transition` keeps the dock steady. `src/scripts/chat.ts` is fetched only when the pill is used (hover, focus, click) or when a minimised chat has to be restored, so Lighthouse stays at 100. Links in answers to real site pages (checked against `/chat-pages.json`, built from `sitePages()`) minimise the chat to the dock and then navigate. The chat is Junior, Daan's cat: its avatar is `public/media/cat/junior-clean.webp` (a 96 px crop of `tower.webp`, face and ears centered, the holly leaf in the background retouched out (new file name per change: /media/ is cached for 30 days)) and the system prompt makes the bot Junior. Answers are markdown, rendered by limmat (our own streaming renderer, vendored in `src/vendor/limmat/` until v0.1 is on npm; it builds DOM nodes only, never HTML) with `@speed-highlight/core` loaded lazily per language for code blocks.
- The Worker answers with Workers AI (`MODELS` in `src/worker/index.ts`: Gemma 4 first, GLM 4.7 flash when Gemma is deprecated or no longer free). It is on the Free plan on purpose: the allowance is 10,000 neurons a day, shared by the whole account, and nothing bills past it. Check the model catalog and changelog when changing the model, because free access to models keeps shrinking.
- The system prompt (`src/worker/prompt.ts`) is deliberately short and loose: Daan wants the bot as free as possible (text only, sandboxed, configured on purpose so visitors can have fun), with the whole site text injected as context. Do not add topic restrictions or refusal rules without asking. The site text comes from `src/lib/chat-context.ts` (the same experience, education, and highlight data the pages use), is written to `dist/chat-context.txt` during the build and moved to the gitignored `src/worker/context.generated.txt` by `src/integrations/chat-context.ts`, and is bundled into the Worker. So the website stays the single source of truth: never hand-write facts into the prompt, and run `npm run build` before `wrangler dev`. The prompt just tells the model that Daan is a man.
- Layers, in order: `Origin` and method checks, Turnstile (Managed, `daanrosendal.com` only, secret in the Worker secret `TURNSTILE_SECRET`), then the Durable Object `Limiter` (`src/worker/limiter.ts`, one instance per UTC day): 20 messages a day and 3 a minute per visitor (salted hash of the IP), about a quarter of the neurons per visitor, and 7,000 neurons a day overall (70% of the allowance). It holds back an estimate before the AI call and swaps in the real usage afterwards. A 3036 error from Workers AI closes the chat for the rest of the UTC day.
- `wrangler.jsonc` sends only `/api/*` to the Worker (`assets.run_worker_first`). Never widen it: every request that runs the Worker counts against the 100,000 a day Free limit, and static pages are free and unlimited. `_headers` and `_redirects` do not apply to Worker responses, so the Worker sets its own headers.
- Saved chats: every question and answer is written to D1 (`DB`, database `daanrosendal-chats`, created in the EU jurisdiction, which cannot be changed later) by `src/worker/log.ts`, after the response has gone out (`waitUntil`, so a failing database never touches the chat). Schema: `migrations/0001_create_chat_log.sql`, two tables, `conversations` (one per chat: random browser id, country, device, browser and OS family, language, window size bucket, color scheme, entry page, referrer host, plus `visitor`, `city`, `region`, `timezone`) and `turns` (one per question: `turn_number`, page, `source` pill, full, or dock, question, answer, `outcome` including the blocked ones, finish reason, model, `prompt_version`, tokens, neurons, `ttft_ms`, `ms`). Kept indefinitely, except that the daily cron (03:17 UTC, `scheduled()` in `index.ts`, `clearOld()` in `log.ts`) sets `visitor`, `city`, `region`, and `timezone` to NULL on chats older than 90 days (in chunks of 1,000). `visitor` is the same salted IP hash the limiter uses (stable, so the salt `TURNSTILE_SECRET` must not be rotated). Never stored: the IP address, the user-agent string, coordinates, the postal code, the network name (ASN), and cookies or tracking ids. The stored answer is the model's raw text (dashes included, so `SELECT` shows whether the prompt rules work; the browser replaces them on display). Read it with `npx wrangler d1 execute daanrosendal-chats --remote --command "select ..."`. The privacy notice must say this (see the chat notes in the assistant memory). Time Travel keeps only 7 days of backups on the Free plan, so export the database now and then (`wrangler d1 export`).
- Kill switch: set `CHAT_ENABLED` to `"0"` in `wrangler.jsonc` and deploy. Console logs are one JSON line per request with no message text (the text goes only to D1).
- Local testing: `.dev.vars` (gitignored) holds Cloudflare's public Turnstile test secret and `DRY_RUN=1`, which streams a canned answer and spends no neurons. Remove `DRY_RUN` to call the real model, which spends real neurons from the account's daily allowance even locally. Locally the dialog uses Turnstile's test sitekey. The `AI` binding is always remote, so `wrangler dev` needs a Cloudflare login (in a non-interactive shell it fails to start). To test the saving without one, use a throwaway config that leaves out `ai` (with `DRY_RUN=1`), apply the migration with `wrangler d1 migrations apply DB --local`, and trigger the cron with `curl localhost:<port>/cdn-cgi/local/scheduled`.
- Do not add the Astro Cloudflare adapter for this: the site stays fully static.

## Blog

- The blog is deliberately not published: `src/pages/_blog/` is ignored by the router, so there is no `/blog/` page, no sitemap entry and nothing to index. The collection in `src/content/blog/` and its schema stay in place.
- `src/content/blog/first-post.md` is a placeholder. Replace it with a real post before publishing.
- To publish: move `src/pages/_blog` back to `src/pages/blog`, link to it from the home page, and add an RSS feed (`@astrojs/rss`) if wanted. The sitemap then picks the pages up on its own.

## Styling Conventions

- **Dark mode** is system-preference only (`prefers-color-scheme`) - no toggle, no JS. Tailwind v4 handles this automatically via `dark:` utilities.
- **Use `neutral-*` for all dark mode color variants** - Tailwind v4's `gray-*` and `zinc-*` both have a blue/cool tint in oklch color space. `neutral-*` is truly colorless. Light mode can use `gray-*` as normal.
- **Icons**: `@lucide/astro` for UI icons. Brand icons (GitHub, LinkedIn) must be inline SVGs with `fill="currentColor"` - Lucide removed brand logos due to trademark concerns.

## Images and performance

- The site is tuned for a Lighthouse score of 100 on every page (mobile and desktop, light and dark). Re-check with `npx lighthouse <url>` after changes to layout, images or colors.
- Photos live in `public/media/` as **WebP**. Per photo keep three sizes: `name.webp` (about 420 px wide, or 600-800 px for a lead photo), `name-sm.webp` (200 px, or 360 px for a lead photo, used by `srcset` on phones) and `full/name.webp` (up to 2400 px, opened in the photo viewer). Strip metadata (EXIF, location) before adding a photo.
- A YouTube demo video (`galleryVideo`) shows a local copy of its thumbnail from `public/media/youtube/<video id>.webp` (about 420 px wide), so the page makes no request to YouTube before the visitor plays it. Add that file together with the video id.
- The 404 page's cat photos are 540 x 720 (3:4) WebP files in `public/media/cat/`, cropped from the originals with metadata stripped, and listed in `src/pages/404.astro`.
- Cards on the home page use a baked 16:9 crop of 560 x 315 set with `cardImage` in the entry's frontmatter.
- Give every `<img>` a `width` and `height` (see `src/lib/image.ts`) and load the first image on a page eagerly with `fetchpriority="high"`.
- Muted text uses `text-gray-500 dark:text-neutral-400` or darker, so contrast stays at 4.5:1 or better. Do not use `gray-400` or `neutral-500` for text.
- Use a hyphen, not an en or em dash, in copy, titles and dates.
- Use the Oxford comma in lists of three or more ("A, B, and C"), on the site, the resume and LinkedIn.

## Live install counts

- `{installs}`, `{downloads}`, `{total}` and `{asOf}` in a highlight entry are filled at build time by `src/lib/marketplace.ts` (with fallbacks from the frontmatter) and wrapped in `<span data-live>`. `src/scripts/live-counts.ts` refreshes them in the visitor's browser from the Marketplace and Open VSX, and only then shows " as of today". Both APIs allow cross-origin requests. If a request fails the numbers from the build stay. Numbers that were refreshed live get a dotted underline and a small hover and focus note ("Fetched live from ...").

## Hard Constraints

- **`README.md` is the GitHub profile README** and controls the public profile page. Only edit it when asked, never delete it, and keep it minimal: one sentence and a row of text links to the site, resume, LinkedIn and email. No badges, stats cards, skill icons or hotlinked third-party images, and no `daanrosendal.com` paths other than the home page and the resume PDF.
- Do not add GitHub Actions YAML - Workers Builds handles deploys.
- Keep the chat on the Cloudflare Free plan: no Workers Paid features, no paid-only models, and no widening of `run_worker_first` (see Chat).
- Content collections must use the **Content Layer API** (`src/content.config.ts` with `loader`). The legacy v2 API was removed in Astro 6.
- Use `entry.id` not `entry.slug` - slug was removed in Astro 6.

## Deployment

Push to `master` → Workers Builds auto-builds and deploys the `daanrosendal` Worker.

Workers Builds settings (Worker `daanrosendal` > Settings > Builds):

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Static assets: `assets.directory` in `wrangler.jsonc` is `./dist`. `not_found_handling` is `404-page`, which serves `dist/404.html` (the cat page) with a 404 status. Without it unknown URLs get a bare 404.
- `public/_redirects` and `public/_headers` work the same as on Pages. `public/.assetsignore` keeps `.DS_Store` out of the upload.
- Node.js: the Workers Builds default is fine (Astro 7 needs 22.23.4 or newer). Set a `NODE_VERSION` build variable only to pin a different one.
- `workers_dev` is `false`, so the site is served only on `daanrosendal.com` (and `www`, which redirects to it) and no second host gets indexed. Set it `true` only while testing a change on `daanrosendal.<account>.workers.dev`, and back to `false` afterwards.
- The domains `daanrosendal.com` and `www.daanrosendal.com` are Worker custom domains. The old Pages project was deleted on 2026-11-08, and Pages can be set up again from this repo if ever needed.
- Rollback: `npx wrangler rollback` or Deployments > Rollback in the dashboard.
