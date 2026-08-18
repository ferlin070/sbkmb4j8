import { describe, expect, it } from 'vitest';
import {
  compareCandles,
  computeStats,
  filterCandles,
  sortCandles,
  viewCandles,
} from '../src/domain';
import type { Candle, FilterState, SortState } from '../src/types';

function candle(overrides: Partial<Candle> = {}): Candle {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Vanilla Bean',
    brand: 'Yankee',
    scentNotes: 'vanilla, cream',
    status: 'unlit',
    rating: 3,
    notes: '',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

const all: Candle[] = [
  candle({ id: '11111111-1111-4111-8111-111111111111', name: 'Midnight Ember', brand: 'Boy Smells', status: 'burning', rating: 5, scentNotes: 'cedarwood, amber' }),
  candle({ id: '22222222-2222-4222-8222-222222222222', name: 'Sea Salt', brand: 'P.F.', status: 'finished', rating: 4 }),
  candle({ id: '33333333-3333-4333-8333-333333333333', name: 'Vanilla Bean', brand: 'Yankee', status: 'unlit', rating: 3, notes: 'tunneled badly' }),
];

const noFilter: FilterState = { search: '', status: 'all' };

describe('matchesFilter / filterCandles', () => {
  it('returns all candles with an empty filter', () => {
    expect(filterCandles(all, noFilter)).toHaveLength(3);
  });

  it('filters by status', () => {
    const filtered = filterCandles(all, { search: '', status: 'burning' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toBe('Midnight Ember');
  });

  it('searches across name, brand, scent, and notes case-insensitively', () => {
    expect(filterCandles(all, { search: 'CEDARWOOD', status: 'all' })).toHaveLength(1);
    expect(filterCandles(all, { search: 'tunneled', status: 'all' })).toHaveLength(1);
    expect(filterCandles(all, { search: 'p.f.', status: 'all' })).toHaveLength(1);
    expect(filterCandles(all, { search: 'zzz', status: 'all' })).toHaveLength(0);
  });
});

describe('sortCandles', () => {
  it('sorts by rating descending', () => {
    const sort: SortState = { key: 'rating', direction: 'desc' };
    const sorted = sortCandles(all, sort);
    expect(sorted.map((c) => c.rating)).toEqual([5, 4, 3]);
  });

  it('sorts by name ascending', () => {
    const sort: SortState = { key: 'name', direction: 'asc' };
    const sorted = sortCandles(all, sort);
    expect(sorted[0]?.name).toBe('Midnight Ember');
    expect(sorted[2]?.name).toBe('Vanilla Bean');
  });

  it('does not mutate the input array', () => {
    const copy = [...all];
    sortCandles(all, { key: 'rating', direction: 'desc' });
    expect(all).toEqual(copy);
  });
});

describe('computeStats', () => {
  it('counts totals and per-status values and averages rating', () => {
    const stats = computeStats(all);
    expect(stats.total).toBe(3);
    expect(stats.unlit).toBe(1);
    expect(stats.burning).toBe(1);
    expect(stats.finished).toBe(1);
    expect(stats.averageRating).toBe(4);
  });

  it('returns null average for empty collection', () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.averageRating).toBeNull();
  });

  it('rounds the average to one decimal', () => {
    const two = [candle({ rating: 4 }), candle({ rating: 5 })];
    expect(computeStats(two).averageRating).toBe(4.5);
    const three = [candle({ rating: 4 }), candle({ rating: 5 }), candle({ rating: 5 })];
    expect(computeStats(three).averageRating).toBe(4.7);
  });
});

describe('viewCandles', () => {
  it('combines filter and sort', () => {
    const result = viewCandles(all, { search: '', status: 'all' }, { key: 'rating', direction: 'desc' });
    expect(result.map((c) => c.rating)).toEqual([5, 4, 3]);
  });
});

describe('compareCandles', () => {
  it('is stable for equal values', () => {
    const a = candle({ name: 'A', rating: 3 });
    const b = candle({ name: 'A', rating: 3 });
    expect(compareCandles(a, b, { key: 'name', direction: 'asc' })).toBe(0);
  });
});
