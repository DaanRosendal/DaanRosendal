// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Static output for Cloudflare Pages (no SSR needed for resume + blog)
export default defineConfig({
  site: 'https://daanrosendal.com',
  output: 'static',
  // Inline the small stylesheet so it does not block the first paint.
  build: { inlineStylesheets: 'always' },
  vite: {
    plugins: [tailwindcss()],
  },
});
