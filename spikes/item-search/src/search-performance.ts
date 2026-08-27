import type { ItemGuide } from './catalog.ts';
import { searchItemGuides } from './search.ts';

export type SearchPerformanceMeasurement = Readonly<{
  query: string;
  resultCount: number;
  firstMs: number;
  p50Ms: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
}>;

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function nearestRank(
  values: readonly number[],
  percentile: number,
): number {
  if (values.length === 0) throw new RangeError('values must not be empty.');
  if (percentile <= 0 || percentile > 1) {
    throw new RangeError('percentile must be greater than 0 and at most 1.');
  }

  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(percentile * sorted.length) - 1];
}

export function measureSearchPerformance(
  items: readonly ItemGuide[],
  synonyms: Readonly<Record<string, string>>,
  queries: readonly string[],
  sampleCount: number,
  now: () => number = () => globalThis.performance.now(),
): SearchPerformanceMeasurement[] {
  if (!Number.isInteger(sampleCount) || sampleCount < 1) {
    throw new RangeError('sampleCount must be a positive integer.');
  }

  return queries.map((query) => {
    const firstStartedAt = now();
    const firstResults = searchItemGuides(items, synonyms, query);
    const firstMs = now() - firstStartedAt;
    const samples = Array.from({ length: sampleCount }, () => {
      const startedAt = now();
      searchItemGuides(items, synonyms, query);
      return now() - startedAt;
    });

    return {
      query,
      resultCount: firstResults.length,
      firstMs: roundMs(firstMs),
      p50Ms: roundMs(nearestRank(samples, 0.5)),
      p95Ms: roundMs(nearestRank(samples, 0.95)),
      minMs: roundMs(Math.min(...samples)),
      maxMs: roundMs(Math.max(...samples)),
    };
  });
}
