import type { APIRoute } from 'astro';
import { sitePages } from '../lib/chat-context';

// The pages the chat may link to, fetched by the chat script when it opens, so it never links to a page that does not exist.
export const GET: APIRoute = async () =>
  new Response(JSON.stringify((await sitePages()).map((page) => page.path)), { headers: { 'Content-Type': 'application/json' } });
