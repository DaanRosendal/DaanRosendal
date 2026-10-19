# AGENTS.md

## Project

Minimal personal website — resume + blog. Deployed to Cloudflare Pages via native Git integration.

## Tech Stack

- **Astro 6** with `output: "static"` (fully static — no SSR adapter needed)
- **Tailwind CSS v4** (`@tailwindcss/vite` Vite plugin — NOT `@astrojs/tailwind`, which is deprecated)
- **Cloudflare Pages** — native Git integration, serves static `dist/` output (no GitHub Actions needed)
- **Node.js 22+** required

## Commands

```bash
npm run dev      # Start dev server (uses Cloudflare workerd runtime)
npm run build    # Build to ./dist
npm run preview  # Preview production build locally
```

## Git

- Use **Conventional Commits** for every new commit (for example: `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`).
- **Work longer, then commit once.** The history is public, so do not commit every small change. Make the edits for a feature or a batch of requests, then create a single commit for it. Only commit when asked, or when a piece of work is finished.
- Never push without being asked. A push to `master` deploys the site.
- When rewriting history, preserve commit contents and metadata unless the task explicitly requires changing them.

## Project Structure

```text
/
├── src/
│   ├── components/        # Highlights, achievement cards, gallery, photo viewer, timelines
│   ├── content/
│   │   ├── achievements/  # Highlight entries (Build / Compete / Research), one Markdown file each
│   │   └── blog/        # Markdown blog posts
│   ├── content.config.ts  # Content Layer API config (Astro 6 style)
│   ├── layouts/
│   │   └── Layout.astro   # Shared page layout
│   ├── lib/
│   │   └── marketplace.ts # Live install counts with fallbacks
│   ├── pages/
│   │   ├── index.astro    # Resume/home
│   │   ├── achievements/
│   │   │   └── [id].astro     # Achievement detail page
│   │   └── blog/
│   │       ├── index.astro    # Blog listing
│   │       └── [id].astro     # Individual post
│   └── styles/
│       └── global.css     # @import "tailwindcss"
├── astro.config.mjs
├── wrangler.jsonc
└── README.md              # ⚠️ DO NOT MODIFY — GitHub Profile README
```

## Styling Conventions

- **Dark mode** is system-preference only (`prefers-color-scheme`) — no toggle, no JS. Tailwind v4 handles this automatically via `dark:` utilities.
- **Use `neutral-*` for all dark mode color variants** — Tailwind v4's `gray-*` and `zinc-*` both have a blue/cool tint in oklch color space. `neutral-*` is truly colorless. Light mode can use `gray-*` as normal.
- **Icons**: `@lucide/astro` for UI icons. Brand icons (GitHub, LinkedIn) must be inline SVGs with `fill="currentColor"` — Lucide removed brand logos due to trademark concerns.

## Images and performance

- The site is tuned for a Lighthouse score of 100 on every page (mobile and desktop, light and dark). Re-check with `npx lighthouse <url>` after changes to layout, images or colors.
- Photos live in `public/achievements/` as **WebP**. Per photo keep three sizes: `name.webp` (about 420 px wide, or 600-800 px for a lead photo), `name-sm.webp` (200 px, or 360 px for a lead photo, used by `srcset` on phones) and `full/name.webp` (up to 2400 px, opened in the photo viewer). Strip metadata (EXIF, location) before adding a photo.
- Cards on the home page use a baked 16:9 crop of 560 x 315 set with `cardImage` in the entry's frontmatter.
- Give every `<img>` a `width` and `height` (see `src/lib/image.ts`) and load the first image on a page eagerly with `fetchpriority="high"`.
- Muted text uses `text-gray-500 dark:text-neutral-400` or darker, so contrast stays at 4.5:1 or better. Do not use `gray-400` or `neutral-500` for text.
- Use a hyphen, not an en or em dash, in copy, titles and dates.

## Live install counts

- `{installs}`, `{downloads}`, `{total}` and `{asOf}` in an achievement entry are filled at build time by `src/lib/marketplace.ts` (with fallbacks from the frontmatter) and wrapped in `<span data-live>`. `src/scripts/live-counts.ts` refreshes them in the visitor's browser from the Marketplace and Open VSX, and only then shows " as of today". Both APIs allow cross-origin requests. If a request fails the numbers from the build stay.

## Hard Constraints

- **NEVER modify, overwrite, or delete `README.md`** — it is the GitHub Profile README and controls the public profile page.
- Do not add GitHub Actions YAML — Cloudflare native Git handles deploys.
- Content collections must use the **Content Layer API** (`src/content.config.ts` with `loader`). The legacy v2 API is removed in Astro 6.
- Use `entry.id` not `entry.slug` — slug was removed in Astro 6.

## Deployment

Push to `master` → Cloudflare auto-builds and deploys.

Cloudflare build settings:

- Build command: `npm run build`
- Output directory: `dist`
- Node.js version env var: `NODE_VERSION=22`
