import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Reviewed 2026-06-17: /api/health returns { status: 'ok' } only — no Supabase ping,
// no uptime/version fields. Tests updated to match the actual endpoint shape.

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
  });

  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns exactly { status: ok } with no extra fields', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
