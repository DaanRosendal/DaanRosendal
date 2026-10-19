import { defineCollection } from 'astro:content';
import { z } from 'zod';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
  }),
});

const achievements = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/achievements' }),
  schema: z.object({
    title: z.string(),
    track: z.enum(['compete', 'build', 'research']),
    when: z.string(),
    stat: z.string(),
    summary: z.string(),
    order: z.number(),
    date: z.coerce.date().optional(),
    youtube: z.string().optional(),
    marketplace: z.string().optional(),
    installsFallback: z.number().optional(),
    openVsx: z.string().optional(),
    downloadsFallback: z.number().optional(),
    thumbnail: z.string().optional(),
    thumbnailPosition: z.string().default('center'),
    gallery: z
      .array(z.object({ src: z.string(), alt: z.string(), full: z.string().optional(), position: z.string().optional() }))
      .default([]),
    galleryVideo: z.string().optional(),
    links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
  }),
});

export const collections = { blog, achievements };
