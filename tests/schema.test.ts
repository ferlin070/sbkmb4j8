import { describe, expect, it } from 'vitest';
import { createCandleFromDraft, createId, isCandle, updateCandleFromDraft, ValidationError } from '../src/schema';
import type { Candle, CandleDraft } from '../src/types';

const d = (o: Partial<CandleDraft> = {}): CandleDraft => ({ name: 'Midnight Ember', brand: 'Boy Smells', scentNotes: 'cedarwood, amber', status: 'burning', rating: 5, notes: 'cozy', ...o });

describe('schema', () => {
  it('createId returns unique UUID v4', () => {
    const a = createId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(a).not.toBe(createId());
  });

  it('creates a valid, trimmed candle', () => {
    const x = createCandleFromDraft(d({ name: '  Ember  ', brand: '  B  ' }));
    expect(isCandle(x)).toBe(true);
    expect(x.name).toBe('Ember');
    expect(x.brand).toBe('B');
    expect(x.status).toBe('burning');
    expect(x.rating).toBe(5);
  });

  it('throws ValidationError listing offending fields', () => {
    try {
      createCandleFromDraft(d({ name: '', brand: '' }));
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).fields).toEqual(expect.arrayContaining(['name', 'brand']));
    }
  });

  it('rejects overlong fields and invalid rating/status', () => {
    expect(() => createCandleFromDraft(d({ notes: 'x'.repeat(1001) }))).toThrow(ValidationError);
    expect(() => createCandleFromDraft(d({ rating: 6 as CandleDraft['rating'] }))).toThrow(ValidationError);
    expect(() => createCandleFromDraft(d({ status: 'nope' as CandleDraft['status'] }))).toThrow(ValidationError);
  });

  it('update preserves id/createdAt, bumps updatedAt', () => {
    const original: Candle = { id: '11111111-1111-4111-8111-111111111111', name: 'Old', brand: 'B', scentNotes: '', status: 'unlit', rating: 1, notes: '', createdAt: 1000, updatedAt: 1000 };
    const u = updateCandleFromDraft(original, d({ name: 'New' }));
    expect(u.id).toBe(original.id);
    expect(u.createdAt).toBe(1000);
    expect(u.name).toBe('New');
    expect(u.updatedAt).toBeGreaterThanOrEqual(1000);
  });

  it('isCandle rejects malformed values', () => {
    const valid = createCandleFromDraft(d());
    expect(isCandle(null)).toBe(false);
    expect(isCandle('str')).toBe(false);
    expect(isCandle({})).toBe(false);
    expect(isCandle({ ...valid, id: 'not-a-uuid' })).toBe(false);
    expect(isCandle({ ...valid, rating: 9 })).toBe(false);
  });
});
