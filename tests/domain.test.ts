import { describe, expect, it } from 'vitest';
import { compareCandles, computeStats, filterCandles, sortCandles, viewCandles } from '../src/domain';
import type { Candle } from '../src/types';

const c = (o: Partial<Candle> = {}): Candle => ({ id: '11111111-1111-4111-8111-111111111111', name: 'Vanilla Bean', brand: 'Yankee', scentNotes: 'vanilla, cream', status: 'unlit', rating: 3, notes: '', createdAt: 1000, updatedAt: 1000, ...o });

const all: Candle[] = [
  c({ id: '11111111-1111-4111-8111-111111111111', name: 'Midnight Ember', brand: 'Boy Smells', status: 'burning', rating: 5, scentNotes: 'cedarwood, amber' }),
  c({ id: '22222222-2222-4222-8222-222222222222', name: 'Sea Salt', brand: 'P.F.', status: 'finished', rating: 4 }),
  c({ id: '33333333-3333-4333-8333-333333333333', name: 'Vanilla Bean', brand: 'Yankee', status: 'unlit', rating: 3, notes: 'tunneled badly' }),
];

describe('domain', () => {
  it('filters by status and searches name/brand/scent/notes', () => {
    expect(filterCandles(all, { search: '', status: 'all' })).toHaveLength(3);
    expect(filterCandles(all, { search: '', status: 'burning' }).map((x) => x.name)).toEqual(['Midnight Ember']);
    expect(filterCandles(all, { search: 'CEDARWOOD', status: 'all' })).toHaveLength(1);
    expect(filterCandles(all, { search: 'tunneled', status: 'all' })).toHaveLength(1);
    expect(filterCandles(all, { search: 'zzz', status: 'all' })).toHaveLength(0);
  });

  it('sorts by rating desc and name asc without mutating input', () => {
    expect(sortCandles(all, { key: 'rating', direction: 'desc' }).map((x) => x.rating)).toEqual([5, 4, 3]);
    expect(sortCandles(all, { key: 'name', direction: 'asc' })[0]?.name).toBe('Midnight Ember');
    const copy = [...all];
    sortCandles(all, { key: 'rating', direction: 'desc' });
    expect(all).toEqual(copy);
  });

  it('computes stats with a one-decimal average', () => {
    const s = computeStats(all);
    expect(s.total).toBe(3);
    expect(s.unlit).toBe(1);
    expect(s.burning).toBe(1);
    expect(s.finished).toBe(1);
    expect(s.averageRating).toBe(4);
    expect(computeStats([]).averageRating).toBeNull();
    expect(computeStats([c({ rating: 4 }), c({ rating: 5 }), c({ rating: 5 })]).averageRating).toBe(4.7);
  });

  it('combines filter and sort via viewCandles', () => {
    const r = viewCandles(all, { search: '', status: 'all' }, { key: 'rating', direction: 'desc' });
    expect(r.map((x) => x.rating)).toEqual([5, 4, 3]);
  });

  it('compareCandles is stable for equal values', () => {
    expect(compareCandles(c({ name: 'A', rating: 3 }), c({ name: 'A', rating: 3 }), { key: 'name', direction: 'asc' })).toBe(0);
  });
});
