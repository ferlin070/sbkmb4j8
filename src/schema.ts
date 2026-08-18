import type { Candle, CandleDraft, CandleStatus, Rating } from './types';

export const CANDLE_STATUSES: readonly CandleStatus[] = ['unlit', 'burning', 'finished'] as const;
export const RATINGS: readonly Rating[] = [1, 2, 3, 4, 5] as const;

export const STATUS_LABELS: Record<CandleStatus, string> = {
  unlit: 'Unlit',
  burning: 'Burning',
  finished: 'Finished',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    return (char === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function isRating(value: unknown): value is Rating {
  return typeof value === 'number' && (RATINGS as readonly number[]).includes(value);
}

function isStatus(value: unknown): value is CandleStatus {
  return typeof value === 'string' && (CANDLE_STATUSES as readonly string[]).includes(value);
}

export function isCandle(value: unknown): value is Candle {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  const s = (v: unknown): v is string => typeof v === 'string';
  const n = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  return s(c.id) && UUID_RE.test(c.id) && s(c.name) && c.name.trim().length > 0 &&
    s(c.brand) && s(c.scentNotes) && s(c.notes) && isStatus(c.status) && isRating(c.rating) &&
    n(c.createdAt) && n(c.updatedAt);
}

export class ValidationError extends Error {
  readonly fields: string[];
  constructor(fields: string[], message = 'Invalid candle data') {
    super(message);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export function createCandleFromDraft(draft: CandleDraft): Candle {
  const fields: string[] = [];
  const name = draft.name.trim();
  const brand = draft.brand.trim();
  const scentNotes = draft.scentNotes.trim();
  const notes = draft.notes.trim();
  if (name.length === 0 || name.length > 120) fields.push('name');
  if (brand.length === 0 || brand.length > 120) fields.push('brand');
  if (scentNotes.length > 300) fields.push('scentNotes');
  if (notes.length > 1000) fields.push('notes');
  if (!isStatus(draft.status)) fields.push('status');
  if (!isRating(draft.rating)) fields.push('rating');
  if (fields.length > 0) throw new ValidationError([...new Set(fields)]);

  const now = Date.now();
  return { id: createId(), name, brand, scentNotes, status: draft.status, rating: draft.rating, notes, createdAt: now, updatedAt: now };
}

export function updateCandleFromDraft(existing: Candle, draft: CandleDraft): Candle {
  const next = createCandleFromDraft(draft);
  return { ...next, id: existing.id, createdAt: existing.createdAt, updatedAt: Date.now() };
}
