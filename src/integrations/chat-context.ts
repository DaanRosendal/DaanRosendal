import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

// After the build, moves dist/chat-context.txt to src/worker/context.generated.txt. The chat Worker imports that file as
// text, so wrangler bundles it with the script, and the site does not publish a copy.
export default function chatContext(): AstroIntegration {
  return {
    name: 'chat-context',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const built = fileURLToPath(new URL('chat-context.txt', dir));
        const target = fileURLToPath(new URL('../../src/worker/context.generated.txt', import.meta.url));
        mkdirSync(fileURLToPath(new URL('../../src/worker/', import.meta.url)), { recursive: true });
        copyFileSync(built, target);
        rmSync(built);
      },
    },
  };
}
