import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCandles, saveCandles, STORAGE_KEY } from '../src/storage';
import { createCandleFromDraft } from '../src/schema';
import type { CandleDraft } from '../src/types';

const d = (): CandleDraft => ({ name: 'Ember', brand: 'Boy Smells', scentNotes: 'cedarwood', status: 'burning', rating: 5, notes: '' });

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('seeds sample data on first load', () => {
    expect(loadCandles().ok).toBe(true);
    expect(loadCandles().candles.length).toBeGreaterThan(0);
  });

  it('round-trips save then load', () => {
    expect(saveCandles([createCandleFromDraft(d())]).ok).toBe(true);
    const load = loadCandles();
    expect(load.candles).toHaveLength(1);
    expect(load.candles[0]?.name).toBe('Ember');
  });

  it('drops invalid records without crashing', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'bad', name: 'No uuid' }, 'garbage', 42]));
    const r = loadCandles();
    expect(r.ok).toBe(true);
    expect(r.candles).toHaveLength(0);
    expect(r.error).toContain('invalid record');
  });

  it('reports error on corrupt JSON and non-array shapes', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(loadCandles().ok).toBe(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'array' }));
    expect(loadCandles().ok).toBe(false);
  });

  it('surfaces quota and getItem errors rather than throwing', () => {
    const s1 = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    expect(saveCandles([createCandleFromDraft(d())]).ok).toBe(false);
    s1.mockRestore();
    const s2 = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(loadCandles().ok).toBe(false);
    s2.mockRestore();
  });
});
