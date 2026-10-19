import { join } from 'node:path';
import sharp from 'sharp';

type Size = { width: number; height: number };
const cache = new Map<string, Promise<Size | undefined>>();

// Reads the pixel size of an image in /public so <img> tags can carry width and height and the page does not shift while loading.
export function imageSize(publicPath: string): Promise<Size | undefined> {
  let size = cache.get(publicPath);
  if (!size) {
    size = sharp(join(process.cwd(), 'public', publicPath))
      .metadata()
      .then(({ width, height }) => (width && height ? { width, height } : undefined))
      .catch(() => undefined);
    cache.set(publicPath, size);
  }
  return size;
}
