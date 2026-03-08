// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Static output for Cloudflare Pages (no SSR needed for resume + blog)
export default defineConfig({
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
