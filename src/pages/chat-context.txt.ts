import type { APIRoute } from 'astro';
import { buildContext } from '../lib/chat-context';

// The chat Worker's knowledge of the site. The chat-context integration moves this file out of dist/ into
// src/worker/ at the end of the build, so it is bundled into the Worker and never served.
export const GET: APIRoute = async () =>
  new Response(await buildContext(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
