import { isCandle } from './schema';
import type { Candle, LoadResult } from './types';

/**
 * Storage layer — the single module that talks to `localStorage`.
 *
 * Design goals:
 * - Never throw on read/write; every operation returns a result the UI can
 *   act on (surfacing failures instead of silently swallowing them).
 * - Validate and normalize on read so corrupt or partially-written data
 *   cannot crash the app.
 */

const STORAGE_KEY = 'candle-collection-log:v1';

/** Seed data used on first load so the app never opens to a blank screen. */
function seedCandles(): Candle[] {
  const now = Date.now();
  const make = (
    name: string,
    brand: string,
    scentNotes: string,
    status: Candle['status'],
    rating: Candle['rating'],
    notes: string,
    offsetMs: number,
  ): Candle => ({
    id: crypto.randomUUID(),
    name,
    brand,
    scentNotes,
    status,
    rating,
    notes,
    createdAt: now - offsetMs,
    updatedAt: now - offsetMs,
  });

  return [
    make(
      'Midnight Ember',
      'Boy Smells',
      'cedarwood, amber, smoke',
      'burning',
      5,
      'Perfect for evenings. Burns clean and slow.',
      60 * 60 * 1000 * 24 * 3,
    ),
    make(
      'Sea Salt & Sage',
      'P.F. Candle Co.',
      'sea salt, sage, driftwood',
      'finished',
      4,
      'Gifted to mom — she loved it.',
      60 * 60 * 1000 * 24 * 10,
    ),
    make(
      'Vanilla Bean',
      'Yankee Candle',
      'vanilla, cream, sugar',
      'unlit',
      3,
      'Tunneled badly the first burn. Needs a foil wrap.',
      60 * 60 * 1000 * 24 * 1,
    ),
    make(
      'Sandalwood & Fig',
      'Nest',
      'sandalwood, fig, coconut',
      'unlit',
      4,
      'Bought as a backup. Haven’t lit yet.',
      60 * 60 * 1000 * 2,
    ),
  ];
}

/**
 * Read and validate all candles from storage.
 * Returns `{ ok: true, candles }` on success (including an empty first load,
 * which is then seeded) and `{ ok: false, error }` when storage is
 * unavailable or corrupt.
 */
export function loadCandles(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    return {
      ok: false,
      candles: [],
      error: 'Could not access local storage. Your collection may not persist.',
    };
  }

  // First run: no key yet. Seed and persist.
  if (raw === null) {
    const seeded = seedCandles();
    const saved = saveCandles(seeded);
    if (!saved.ok) {
      // Seed exists in memory even if persistence failed, so the app still works.
      return { ok: true, candles: seeded, error: saved.error };
    }
    return { ok: true, candles: seeded };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      candles: [],
      error: 'Stored data was corrupt and could not be read.',
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      candles: [],
      error: 'Stored data had an unexpected shape.',
    };
  }

  // Drop invalid records, keep valid ones. This is "normalize on read".
  const candles = parsed.filter(isCandle);
  const dropped = parsed.length - candles.length;

  return {
    ok: true,
    candles,
    error: dropped > 0 ? `${dropped} invalid record(s) were skipped.` : undefined,
  };
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

/**
 * Persist candles to storage. Catches quota / security errors and returns
 * them so the UI can notify the user rather than failing silently.
 */
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

/** Remove all stored candles (used for a "clear collection" action). */
export function clearCandles(): SaveResult {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not clear storage.' };
  }
}

export { STORAGE_KEY };
