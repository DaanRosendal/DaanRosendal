// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import chatContext from './src/integrations/chat-context.ts';

export default defineConfig({
  site: 'https://daanrosendal.com',
  output: 'static',
  integrations: [sitemap(), chatContext()],
  // Astro 7 defaults to 'jsx', which strips the whitespace between inline elements.
  compressHTML: true,
  // Inline the small stylesheet so it does not block the first paint.
  build: { inlineStylesheets: 'always' },
  vite: {
    plugins: [tailwindcss()],
  },
});
