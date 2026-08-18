import type {
  Candle,
  CollectionStats,
  FilterState,
  SortState,
} from './types';

export function matchesFilter(candle: Candle, filter: FilterState): boolean {
  if (filter.status !== 'all' && candle.status !== filter.status) return false;
  const q = filter.search.trim().toLowerCase();
  if (q.length > 0) {
    const haystack = [candle.name, candle.brand, candle.scentNotes, candle.notes]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

export function filterCandles(candles: Candle[], filter: FilterState): Candle[] {
  return candles.filter((c) => matchesFilter(c, filter));
}

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
      result = a.rating - b.rating || a.name.localeCompare(b.name);
      break;
    case 'updatedAt':
      result = a.updatedAt - b.updatedAt;
      break;
    default:
      result = a.createdAt - b.createdAt;
  }
  return sort.direction === 'asc' ? result : -result;
}

export function sortCandles(candles: Candle[], sort: SortState): Candle[] {
  return [...candles].sort((a, b) => compareCandles(a, b, sort));
}

export function computeStats(candles: Candle[]): CollectionStats {
  const total = candles.length;
  let unlit = 0;
  let burning = 0;
  let finished = 0;
  let ratingSum = 0;
  for (const c of candles) {
    if (c.status === 'unlit') unlit += 1;
    else if (c.status === 'burning') burning += 1;
    else finished += 1;
    ratingSum += c.rating;
  }
  return { total, unlit, burning, finished, averageRating: total === 0 ? null : Math.round((ratingSum / total) * 10) / 10 };
}

export function viewCandles(candles: Candle[], filter: FilterState, sort: SortState): Candle[] {
  return sortCandles(filterCandles(candles, filter), sort);
}
