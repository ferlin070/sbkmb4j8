import { isCandle } from './schema';
import type { Candle, LoadResult } from './types';

const STORAGE_KEY = 'candle-collection-log:v1';

function seedCandles(): Candle[] {
  const now = Date.now();
  const make = (name: string, brand: string, scentNotes: string, status: Candle['status'], rating: Candle['rating'], notes: string, ageMs: number): Candle =>
    ({ id: crypto.randomUUID(), name, brand, scentNotes, status, rating, notes, createdAt: now - ageMs, updatedAt: now - ageMs });

  const day = 60 * 60 * 1000 * 24;
  return [
    make('Midnight Ember', 'Boy Smells', 'cedarwood, amber, smoke', 'burning', 5, 'Perfect for evenings. Burns clean and slow.', day * 3),
    make('Sea Salt & Sage', 'P.F. Candle Co.', 'sea salt, sage, driftwood', 'finished', 4, 'Gifted to mom — she loved it.', day * 10),
    make('Vanilla Bean', 'Yankee Candle', 'vanilla, cream, sugar', 'unlit', 3, 'Tunneled badly. Needs a foil wrap.', day),
    make('Sandalwood & Fig', 'Nest', 'sandalwood, fig, coconut', 'unlit', 4, 'Backup, not lit yet.', 60 * 60 * 1000 * 2),
  ];
}

export function loadCandles(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { ok: false, candles: [], error: 'Could not access local storage. Your collection may not persist.' };
  }

  if (raw === null) {
    const seeded = seedCandles();
    const saved = saveCandles(seeded);
    return saved.ok ? { ok: true, candles: seeded } : { ok: true, candles: seeded, error: saved.error };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, candles: [], error: 'Stored data was corrupt and could not be read.' };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, candles: [], error: 'Stored data had an unexpected shape.' };
  }

  const candles = parsed.filter(isCandle);
  const dropped = parsed.length - candles.length;
  return { ok: true, candles, error: dropped > 0 ? `${dropped} invalid record(s) were skipped.` : undefined };
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export function saveCandles(candles: Candle[]): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(candles));
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'QuotaExceededError'
        ? 'Storage is full. Your latest change could not be saved.'
        : 'Your change could not be saved to local storage.';
    return { ok: false, error: message };
  }
}

export { STORAGE_KEY };
