import { describe, expect, it } from 'vitest';
import {
  createCandleFromDraft,
  createId,
  isCandle,
  updateCandleFromDraft,
  ValidationError,
} from '../src/schema';
import type { Candle, CandleDraft } from '../src/types';

function validDraft(overrides: Partial<CandleDraft> = {}): CandleDraft {
  return {
    name: 'Midnight Ember',
    brand: 'Boy Smells',
    scentNotes: 'cedarwood, amber',
    status: 'burning',
    rating: 5,
    notes: 'cozy',
    ...overrides,
  };
}

describe('createId', () => {
  it('returns a valid UUID v4 string', () => {
    const id = createId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('returns unique ids', () => {
    const a = createId();
    const b = createId();
    expect(a).not.toBe(b);
  });
});

describe('createCandleFromDraft', () => {
  it('produces a valid candle from a valid draft', () => {
    const candle = createCandleFromDraft(validDraft());
    expect(isCandle(candle)).toBe(true);
    expect(candle.name).toBe('Midnight Ember');
    expect(candle.status).toBe('burning');
    expect(candle.rating).toBe(5);
  });

  it('trims whitespace from text fields', () => {
    const candle = createCandleFromDraft(
      validDraft({ name: '  Ember  ', brand: '  Brand  ', scentNotes: '  vanilla  ' }),
    );
    expect(candle.name).toBe('Ember');
    expect(candle.brand).toBe('Brand');
    expect(candle.scentNotes).toBe('vanilla');
  });

  it('throws ValidationError with the offending fields', () => {
    expect(() => createCandleFromDraft(validDraft({ name: '   ' }))).toThrow(ValidationError);
    try {
      createCandleFromDraft(validDraft({ name: '', brand: '' }));
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).fields).toEqual(expect.arrayContaining(['name', 'brand']));
    }
  });

  it('rejects overlong fields', () => {
    expect(() =>
      createCandleFromDraft(validDraft({ notes: 'x'.repeat(1001) })),
    ).toThrow(ValidationError);
  });

  it('rejects invalid rating and status', () => {
    expect(() =>
      createCandleFromDraft(validDraft({ rating: 6 as CandleDraft['rating'] })),
    ).toThrow(ValidationError);
    expect(() =>
      createCandleFromDraft(validDraft({ status: 'nope' as CandleDraft['status'] })),
    ).toThrow(ValidationError);
  });
});

describe('updateCandleFromDraft', () => {
  it('preserves id and createdAt while bumping updatedAt', () => {
    const original: Candle = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Old',
      brand: 'Old Brand',
      scentNotes: '',
      status: 'unlit',
      rating: 1,
      notes: '',
      createdAt: 1000,
      updatedAt: 1000,
    };
    const updated = updateCandleFromDraft(original, validDraft({ name: 'New' }));
    expect(updated.id).toBe(original.id);
    expect(updated.createdAt).toBe(1000);
    expect(updated.name).toBe('New');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(original.updatedAt);
  });
});

describe('isCandle', () => {
  it('rejects non-objects, missing fields, and malformed ids', () => {
    expect(isCandle(null)).toBe(false);
    expect(isCandle('str')).toBe(false);
    expect(isCandle({})).toBe(false);
    const valid = createCandleFromDraft(validDraft());
    expect(isCandle({ ...valid, id: 'not-a-uuid' })).toBe(false);
    expect(isCandle({ ...valid, rating: 9 })).toBe(false);
  });
});
