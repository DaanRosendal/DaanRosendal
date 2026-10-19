// Shared by the build and the browser: counts are rounded down so a number stays true between updates.
// 742 -> 740, 4,482 -> 4,400.
export function roundDown(count: number): number {
  if (count < 100) return count;
  const step = count < 1000 ? 10 : 100;
  return Math.floor(count / step) * step;
}

export function formatCount(count: number): string {
  const rounded = roundDown(count);
  return count < 100 ? String(rounded) : `${rounded.toLocaleString('en-US')}+`;
}
