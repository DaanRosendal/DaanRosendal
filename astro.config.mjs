// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Static output for Cloudflare Pages (no SSR needed for resume + highlights)
export default defineConfig({
  site: 'https://daanrosendal.com',
  output: 'static',
  integrations: [sitemap()],
  // Astro 7 defaults to 'jsx', which strips the whitespace between inline elements.
  compressHTML: true,
  // Inline the small stylesheet so it does not block the first paint.
  build: { inlineStylesheets: 'always' },
  vite: {
    plugins: [tailwindcss()],
  },
});
