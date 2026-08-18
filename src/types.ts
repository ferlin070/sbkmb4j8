export type CandleStatus = 'unlit' | 'burning' | 'finished';
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface Candle {
  id: string;
  name: string;
  brand: string;
  scentNotes: string;
  status: CandleStatus;
  rating: Rating;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface CandleDraft {
  name: string;
  brand: string;
  scentNotes: string;
  status: CandleStatus;
  rating: Rating;
  notes: string;
}

export interface CollectionStats {
  total: number;
  unlit: number;
  burning: number;
  finished: number;
  averageRating: number | null;
}

export type SortKey = 'name' | 'brand' | 'rating' | 'updatedAt' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export interface FilterState {
  search: string;
  status: CandleStatus | 'all';
}

export interface LoadResult {
  ok: boolean;
  candles: Candle[];
  error?: string;
}
