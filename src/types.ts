/**
 * Core domain types for the Candle Collection Log.
 *
 * A `Candle` is the single source of truth for the app's data shape.
 * Every value that crosses a trust boundary (localStorage, user input)
 * is validated against these constraints by the schema module.
 */

/** The lifecycle state of a candle in a collection. */
export type CandleStatus = 'unlit' | 'burning' | 'finished';

/** A 1–5 integer rating, where 1 is "would not rebuy" and 5 is "holy grail". */
export type Rating = 1 | 2 | 3 | 4 | 5;

/** A fully validated candle record. */
export interface Candle {
  /** Stable unique id (UUID v4). */
  id: string;
  /** The candle's product name, e.g. "Midnight Ember". */
  name: string;
  /** The brand / maker, e.g. "Boy Smells". */
  brand: string;
  /** Scent notes as a single comma-separated string, e.g. "cedarwood, vanilla". */
  scentNotes: string;
  status: CandleStatus;
  rating: Rating;
  /** Free-form personal notes. */
  notes: string;
  /** Epoch milliseconds of when the record was created. */
  createdAt: number;
  /** Epoch milliseconds of the last edit. */
  updatedAt: number;
}

/** Shape of the data a user submits in the add/edit form (before validation). */
export interface CandleDraft {
  name: string;
  brand: string;
  scentNotes: string;
  status: CandleStatus;
  rating: Rating;
  notes: string;
}

/** Summary counts shown in the header bar. */
export interface CollectionStats {
  total: number;
  unlit: number;
  burning: number;
  finished: number;
  /** Average rating across all candles, rounded to 1 decimal, or null when empty. */
  averageRating: number | null;
}

/** Sort options for the collection view. */
export type SortKey = 'name' | 'brand' | 'rating' | 'updatedAt' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

/** Filter options for the collection view. */
export interface FilterState {
  /** Free-text search across name, brand, scent notes, and notes. */
  search: string;
  /** If set, only show candles of this status. */
  status: CandleStatus | 'all';
}

/** Result shape returned by storage read operations. */
export interface LoadResult {
  ok: boolean;
  candles: Candle[];
  /** Present when `ok` is false; a human-readable description of the failure. */
  error?: string;
}
