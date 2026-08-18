import type { Candle, CandleDraft, CandleStatus, Rating } from './types';

/** Valid statuses. */
export const CANDLE_STATUSES: readonly CandleStatus[] = [
  'unlit',
  'burning',
  'finished',
] as const;

/** Valid ratings. */
export const RATINGS: readonly Rating[] = [1, 2, 3, 4, 5] as const;

/** Human-readable labels for statuses, used by UI and stats. */
export const STATUS_LABELS: Record<CandleStatus, string> = {
  unlit: 'Unlit',
  burning: 'Burning',
  finished: 'Finished',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Generate a RFC 4122 v4 UUID without external dependencies.
 * Uses `crypto.randomUUID` when available (modern browsers + Node 19+),
 * falling back to a Math.random implementation for older runtimes.
 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    const v = char === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isRating(value: unknown): value is Rating {
  return typeof value === 'number' && (RATINGS as readonly number[]).includes(value);
}

function isStatus(value: unknown): value is CandleStatus {
  return typeof value === 'string' && (CANDLE_STATUSES as readonly string[]).includes(value);
}

/**
 * Validate an unknown value as a `Candle`. Returns null (rather than throwing)
 * so the caller can decide how to handle invalid records — the storage layer
 * drops bad records instead of crashing the whole app.
 */
export function isCandle(value: unknown): value is Candle {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    UUID_RE.test(c.id) &&
    typeof c.name === 'string' &&
    c.name.trim().length > 0 &&
    typeof c.brand === 'string' &&
    typeof c.scentNotes === 'string' &&
    isStatus(c.status) &&
    isRating(c.rating) &&
    typeof c.notes === 'string' &&
    typeof c.createdAt === 'number' &&
    Number.isFinite(c.createdAt) &&
    typeof c.updatedAt === 'number' &&
    Number.isFinite(c.updatedAt)
  );
}

/** Error thrown when a draft fails field-level validation. */
export class ValidationError extends Error {
  /** Field keys that failed validation. */
  readonly fields: string[];

  constructor(fields: string[], message = 'Invalid candle data') {
    super(message);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

/**
 * Validate a user-submitted draft and produce a clean, normalized `Candle`.
 * Throws `ValidationError` listing offending fields so the UI can surface
 * exactly what needs fixing.
 */
export function createCandleFromDraft(draft: CandleDraft): Candle {
  const fields: string[] = [];

  const name = draft.name.trim();
  if (name.length === 0) fields.push('name');
  if (name.length > 120) fields.push('name');

  const brand = draft.brand.trim();
  if (brand.length === 0) fields.push('brand');
  if (brand.length > 120) fields.push('brand');

  const scentNotes = draft.scentNotes.trim();
  if (scentNotes.length > 300) fields.push('scentNotes');

  const notes = draft.notes.trim();
  if (notes.length > 1000) fields.push('notes');

  if (!isStatus(draft.status)) fields.push('status');
  if (!isRating(draft.rating)) fields.push('rating');

  if (fields.length > 0) {
    throw new ValidationError([...new Set(fields)]);
  }

  const now = Date.now();
  return {
    id: createId(),
    name,
    brand,
    scentNotes,
    status: draft.status,
    rating: draft.rating,
    notes,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Produce an updated `Candle` from a draft, preserving id and createdAt.
 * Used by the edit flow.
 */
export function updateCandleFromDraft(existing: Candle, draft: CandleDraft): Candle {
  const next = createCandleFromDraft(draft);
  return {
    ...next,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };
}
