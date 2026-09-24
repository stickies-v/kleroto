export class SourceError extends Error {}

export async function fetchText(url: string): Promise<string | null> {
  const response = await fetch(url, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new SourceError(`${url} returned HTTP ${response.status}`);
  return (await response.text()).trim();
}

export function fulfilled<T>(results: PromiseSettledResult<T>[]): T[] {
  return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
}
