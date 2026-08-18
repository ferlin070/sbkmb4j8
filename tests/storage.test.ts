import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCandles, loadCandles, saveCandles, STORAGE_KEY } from '../src/storage';
import { createCandleFromDraft } from '../src/schema';
import type { CandleDraft } from '../src/types';

function draft(): CandleDraft {
  return {
    name: 'Ember',
    brand: 'Boy Smells',
    scentNotes: 'cedarwood',
    status: 'burning',
    rating: 5,
    notes: '',
  };
}

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds sample data on first load', () => {
    const result = loadCandles();
    expect(result.ok).toBe(true);
    expect(result.candles.length).toBeGreaterThan(0);
  });

  it('round-trips a save then load', () => {
    const candle = createCandleFromDraft(draft());
    const saveResult = saveCandles([candle]);
    expect(saveResult.ok).toBe(true);

    const load = loadCandles();
    expect(load.ok).toBe(true);
    expect(load.candles).toHaveLength(1);
    expect(load.candles[0]?.name).toBe('Ember');
  });

  it('drops invalid records on load without crashing', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'bad', name: 'No uuid' }, 'garbage', 42]),
    );
    const result = loadCandles();
    expect(result.ok).toBe(true);
    expect(result.candles).toHaveLength(0);
    expect(result.error).toContain('invalid record');
  });

  it('reports an error when storage is corrupt (invalid JSON)', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    const result = loadCandles();
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('reports an error when storage is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }));
    const result = loadCandles();
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('surfaces a quota error rather than throwing', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const err = new DOMException('quota', 'QuotaExceededError');
      throw err;
    });
    const result = saveCandles([createCandleFromDraft(draft())]);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    setItem.mockRestore();
  });

  it('surfaces a getItem security error rather than throwing', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const result = loadCandles();
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    getItem.mockRestore();
  });

  it('clears storage', () => {
    saveCandles([createCandleFromDraft(draft())]);
    const result = clearCandles();
    expect(result.ok).toBe(true);
    expect(loadCandles().candles.length).toBeGreaterThan(0); // reseeds after clear
  });
});
