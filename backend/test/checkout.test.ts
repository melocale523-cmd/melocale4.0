import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockSessionCreate = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockAuthGetUser = vi.hoisted(() => vi.fn());

vi.mock('stripe', () => {
  function MockStripe() {
    return {
      webhooks: { constructEvent: vi.fn() },
      checkout: { sessions: { create: mockSessionCreate } },
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
  default: vi.fn(function() { return {}; }),
}));

import { createApp } from '../server';

const app = createApp();
const AUTH_TOKEN = 'Bearer test-token';
const USER_ID = '11111111-1111-1111-8111-111111111111';

describe('POST /api/create-checkout-session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });

    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: '11111111-1111-1111-8111-111111111111', email: 'test@test.com' } },
      error: null,
    });

    const pkgChain: any = {};
    pkgChain.select = vi.fn(() => pkgChain);
    pkgChain.eq = vi.fn(() => pkgChain);
    pkgChain.single = vi.fn().mockResolvedValue({
      data: { id: 'pack_starter', name: 'Básico', coins: 60, price: 24.90, is_active: true },
      error: null,
    });

    const subChain: any = {};
    subChain.select = vi.fn(() => subChain);
    subChain.eq = vi.fn(() => subChain);
    subChain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_subscriptions') return subChain;
      return pkgChain;
    });

    mockSessionCreate.mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/test' });
  });

  it('returns 401 when no auth token', async () => {
    const res = await request(app).post('/api/create-checkout-session').send({
      package_id: 'pack_starter',
      user_id: USER_ID,
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid Zod schema (missing package_id)', async () => {
    const res = await request(app)
      .post('/api/create-checkout-session')
      .set('Authorization', AUTH_TOKEN)
      .send({ user_id: USER_ID });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid UUID user_id', async () => {
    const res = await request(app)
      .post('/api/create-checkout-session')
      .set('Authorization', AUTH_TOKEN)
      .send({ package_id: 'pack_starter', user_id: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });

  it('returns 403 when user_id does not match authenticated user', async () => {
    const res = await request(app)
      .post('/api/create-checkout-session')
      .set('Authorization', AUTH_TOKEN)
      .send({
        package_id: 'pack_starter',
        user_id: '22222222-2222-1222-8222-222222222222',
      });

    expect(res.status).toBe(403);
  });

  it('creates a Stripe session for coin purchase and returns url', async () => {
    const res = await request(app)
      .post('/api/create-checkout-session')
      .set('Authorization', AUTH_TOKEN)
      .send({ package_id: 'pack_starter', user_id: USER_ID, type: 'one_time' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.com/test');
    expect(mockSessionCreate).toHaveBeenCalledOnce();
  });

  it('creates a subscription session for plan purchases', async () => {
    mockSessionCreate.mockResolvedValue({ id: 'cs_sub_456', url: 'https://checkout.stripe.com/sub' });

    const res = await request(app)
      .post('/api/create-checkout-session')
      .set('Authorization', AUTH_TOKEN)
      .send({ package_id: 'plan_pro', user_id: USER_ID, type: 'subscription' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.com/sub');
    const callArg = mockSessionCreate.mock.calls[0][0];
    expect(callArg.mode).toBe('subscription');
  });
});
