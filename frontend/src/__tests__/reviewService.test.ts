import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reviewService } from '../services/reviewService';

// Build a reusable chainable Supabase query mock
function makeChain(terminalMap: Record<string, unknown> = {}) {
  const chain: any = {};
  const r = () => chain;
  chain.from = r;
  chain.select = r;
  chain.insert = r;
  chain.eq = r;
  chain.order = r;
  chain.limit = r;
  chain.in = r;
  chain.not = r;
  chain.single = vi.fn().mockResolvedValue(terminalMap.single ?? { data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue(terminalMap.maybeSingle ?? { data: null, error: null });
  return chain;
}

vi.mock('../lib/supabase', () => {
  let _chain = makeChain();
  const supabase = {
    from: vi.fn(() => _chain),
    _setChain: (c: any) => { _chain = c; supabase.from = vi.fn(() => _chain); },
  };
  return { supabase };
});

import { supabase } from '../lib/supabase';
const mockSupabase = supabase as any;

describe('reviewService.submitReview', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a review and returns it', async () => {
    const fakeReview = {
      id: 'rev-1',
      client_id: 'client-1',
      professional_id: 'prof-1',
      appointment_id: 'appt-1',
      rating: 5,
      comment: 'Excellent!',
      created_at: new Date().toISOString(),
    };
    mockSupabase._setChain(makeChain({ single: { data: fakeReview, error: null } }));

    const result = await reviewService.submitReview({
      client_id: 'client-1',
      professional_id: 'prof-1',
      appointment_id: 'appt-1',
      rating: 5,
      comment: 'Excellent!',
    });

    expect(result).toEqual(fakeReview);
  });

  it('throws when Supabase returns an error', async () => {
    const dbError = { message: 'unique constraint violation', code: '23505' };
    mockSupabase._setChain(makeChain({ single: { data: null, error: dbError } }));

    await expect(
      reviewService.submitReview({
        client_id: 'c', professional_id: 'p', appointment_id: 'a', rating: 4,
      })
    ).rejects.toEqual(dbError);
  });
});

describe('reviewService.hasReview', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when a review exists for the appointment', async () => {
    mockSupabase._setChain(makeChain({ maybeSingle: { data: { id: 'rev-1' }, error: null } }));

    const result = await reviewService.hasReview('appt-1');
    expect(result).toBe(true);
  });

  it('returns false when no review exists', async () => {
    mockSupabase._setChain(makeChain({ maybeSingle: { data: null, error: null } }));

    const result = await reviewService.hasReview('appt-1');
    expect(result).toBe(false);
  });
});
