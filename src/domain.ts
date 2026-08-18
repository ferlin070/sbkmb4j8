import type {
  Candle,
  CandleDraft,
  CandleStatus,
  CollectionStats,
  FilterState,
  SortState,
} from './types';

/**
 * Pure domain logic for the collection — filtering, sorting, and statistics.
 * These functions are intentionally side-effect free so they can be unit
 * tested without a DOM or storage.
 */

/** Normalize a search query for case-insensitive matching. */
function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

/** Whether a single candle matches the current filter state. */
export function matchesFilter(candle: Candle, filter: FilterState): boolean {
  const q = normalizeQuery(filter.search);
  if (filter.status !== 'all' && candle.status !== filter.status) return false;

  if (q.length > 0) {
    const haystack = [candle.name, candle.brand, candle.scentNotes, candle.notes]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  return true;
}

/** Filter a list of candles against the filter state. */
export function filterCandles(candles: Candle[], filter: FilterState): Candle[] {
  return candles.filter((c) => matchesFilter(c, filter));
}

/** Compare two candles by a given sort key. */
export function compareCandles(a: Candle, b: Candle, sort: SortState): number {
  let result: number;
  switch (sort.key) {
    case 'name':
      result = a.name.localeCompare(b.name);
      break;
    case 'brand':
      result = a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name);
      break;
    case 'rating':
      result = a.rating - b.rating;
      if (result === 0) result = a.name.localeCompare(b.name);
      break;
    case 'updatedAt':
      result = a.updatedAt - b.updatedAt;
      break;
    case 'createdAt':
      result = a.createdAt - b.createdAt;
      break;
  }
  return sort.direction === 'asc' ? result : -result;
}

/** Sort a list of candles by the given sort state. */
export function sortCandles(candles: Candle[], sort: SortState): Candle[] {
  return [...candles].sort((a, b) => compareCandles(a, b, sort));
}

/** Compute the header summary counts. */
export function computeStats(candles: Candle[]): CollectionStats {
  const total = candles.length;
  let unlit = 0;
  let burning = 0;
  let finished = 0;
  let ratingSum = 0;

  for (const c of candles) {
    switch (c.status) {
      case 'unlit':
        unlit += 1;
        break;
      case 'burning':
        burning += 1;
        break;
      case 'finished':
        finished += 1;
        break;
    }
    ratingSum += c.rating;
  }

  const averageRating =
    total === 0 ? null : Math.round((ratingSum / total) * 10) / 10;

  return { total, unlit, burning, finished, averageRating };
}

/** Filter + sort combined, for a single render pipeline. */
export function viewCandles(
  candles: Candle[],
  filter: FilterState,
  sort: SortState,
): Candle[] {
  return sortCandles(filterCandles(candles, filter), sort);
}

/** Re-export types used by consumers for convenience. */
export type { CandleDraft, CandleStatus };
