import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockConstructEvent = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockAuthGetUser = vi.hoisted(() => vi.fn());

vi.mock('stripe', () => {
  function MockStripe() {
    return {
      webhooks: { constructEvent: mockConstructEvent },
      checkout: { sessions: { create: vi.fn() } },
      subscriptions: { retrieve: vi.fn(), update: vi.fn() },
    };
  }
  return { default: MockStripe };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(function() {
    return {
      from: mockFrom,
      rpc: mockRpc,
      auth: {
        getUser: mockAuthGetUser,
        admin: { listUsers: vi.fn() },
      },
    };
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function() { return { messages: { create: vi.fn() } }; }),
}));

import { createApp } from '../server';

const app = createApp();

const VALID_SIG = 'valid-sig';
const SESSION_ID = 'cs_test_abc';
const EVENT_ID = 'evt_test_abc';
const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

function makeCheckoutEvent(extra: Record<string, unknown> = {}) {
  return {
    type: 'checkout.session.completed',
    id: EVENT_ID,
    data: {
      object: {
        id: SESSION_ID,
        metadata: {
          user_id: USER_ID,
          package_id: 'pack_starter',
          coins: '60',
          type: 'one_time',
          ...extra,
        },
      },
    },
  };
}

describe('POST /api/stripe-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
  });

  it('returns 400 for invalid Stripe signature', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const res = await request(app)
      .post('/api/stripe-webhook')
      .set('stripe-signature', 'bad-sig')
      .set('content-type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(400);
  });

  it('deduplicates: returns received:true when insert hits unique constraint', async () => {
    mockConstructEvent.mockReturnValue(makeCheckoutEvent());

    // insert returns 23505 unique-constraint error → dedup path
    const dupChain: any = {};
    dupChain.insert = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });
    // ignoreDuplicates upsert (payments audit) must also be present
    dupChain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(dupChain);
    mockRpc.mockResolvedValue({ error: null });

    const res = await request(app)
      .post('/api/stripe-webhook')
      .set('stripe-signature', VALID_SIG)
      .set('content-type', 'application/json')
      .send(Buffer.from(JSON.stringify(makeCheckoutEvent())));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it('returns 500 when user_subscriptions upsert fails on subscription checkout', async () => {
    const subEvent = makeCheckoutEvent({ type: 'subscription', package_id: 'plan_pro' });
    mockConstructEvent.mockReturnValue(subEvent);

    const upsertChain: any = {};
    upsertChain.select = vi.fn(() => upsertChain);
    upsertChain.eq = vi.fn(() => upsertChain);
    upsertChain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    upsertChain.upsert = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'db connection error', code: '08000' },
    });

    mockFrom.mockImplementation(() => upsertChain);
    mockRpc.mockResolvedValue({ error: null });

    const res = await request(app)
      .post('/api/stripe-webhook')
      .set('stripe-signature', VALID_SIG)
      .set('content-type', 'application/json')
      .send(Buffer.from(JSON.stringify(subEvent)));

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('subscription_write_failed');
  });

  it('returns 500 when user_subscriptions update fails on subscription.updated event', async () => {
    const subUpdatedEvent = {
      type: 'customer.subscription.updated',
      id: 'evt_sub_upd',
      data: {
        object: {
          id: 'sub_test_123',
          cancel_at_period_end: false,
          status: 'active',
        },
      },
    };
    mockConstructEvent.mockReturnValue(subUpdatedEvent);

    const updateChain: any = {};
    updateChain.update = vi.fn(() => updateChain);
    updateChain.eq = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'network timeout', code: '08006' },
    });

    mockFrom.mockImplementation(() => updateChain);

    const res = await request(app)
      .post('/api/stripe-webhook')
      .set('stripe-signature', VALID_SIG)
      .set('content-type', 'application/json')
      .send(Buffer.from(JSON.stringify(subUpdatedEvent)));

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('subscription_update_failed');
  });

  it('processes new event: calls credit_wallet and inserts transaction', async () => {
    mockConstructEvent.mockReturnValue(makeCheckoutEvent());

    const noTxChain: any = {};
    noTxChain.select = vi.fn(() => noTxChain);
    noTxChain.eq = vi.fn(() => noTxChain);
    noTxChain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    // payments audit upsert (added by PR #280)
    noTxChain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });

    const insertChain: any = {};
    insertChain.insert = vi.fn().mockResolvedValue({ data: { id: 'new-tx' }, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'wallet_transactions') return { ...noTxChain, ...insertChain };
      return noTxChain;
    });

    mockRpc.mockResolvedValue({ error: null });

    const res = await request(app)
      .post('/api/stripe-webhook')
      .set('stripe-signature', VALID_SIG)
      .set('content-type', 'application/json')
      .send(Buffer.from(JSON.stringify(makeCheckoutEvent())));

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('credit_professional_coins', expect.objectContaining({
      p_user_id: USER_ID,
      p_amount: 60,
    }));
  });
});
