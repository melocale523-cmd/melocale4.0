import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockAuthGetUser = vi.hoisted(() => vi.fn());

vi.mock('stripe', () => {
  function MockStripe() {
    return {
      webhooks: { constructEvent: vi.fn() },
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

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });

    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.limit = vi.fn().mockResolvedValue({ data: [{}], error: null });
    mockFrom.mockReturnValue(chain);
  });

  it('returns status ok with uptime, version and db=connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.db).toBe('connected');
    expect(res.body).toHaveProperty('version');
  });

  it('returns db=error when Supabase times out', async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.limit = vi.fn().mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    );
    mockFrom.mockReturnValue(chain);

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('error');
  }, 10000);
});
