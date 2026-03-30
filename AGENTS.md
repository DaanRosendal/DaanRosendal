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
- When rewriting history, preserve commit contents and metadata unless the task explicitly requires changing them.

## Project Structure

```text
/
├── src/
│   ├── content/
│   │   └── blog/        # Markdown blog posts
│   ├── content.config.ts  # Content Layer API config (Astro 6 style)
│   ├── layouts/
│   │   └── Layout.astro   # Shared page layout
│   ├── pages/
│   │   ├── index.astro    # Resume/home
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
