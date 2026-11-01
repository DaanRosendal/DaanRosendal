// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Static output for Cloudflare Pages (no SSR needed for resume + highlights)
export default defineConfig({
  site: 'https://daanrosendal.com',
  output: 'static',
  integrations: [sitemap()],
  // Inline the small stylesheet so it does not block the first paint.
  build: { inlineStylesheets: 'always' },
  vite: {
    plugins: [tailwindcss()],
  },
});
