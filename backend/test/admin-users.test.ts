import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockAuthGetUser = vi.hoisted(() => vi.fn());
const mockAdminListUsers = vi.hoisted(() => vi.fn());

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
        admin: { listUsers: mockAdminListUsers },
      },
    };
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function() { return { messages: { create: vi.fn() } }; }),
}));

import { createApp } from '../server';

const app = createApp();

const ADMIN_TOKEN = 'Bearer admin-token';
const USER_TOKEN = 'Bearer user-token';

describe('GET /api/admin/active-users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/admin/active-users');
    expect(res.status).toBe(401);
  });

  it('returns 403 when the authenticated user is not admin', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

    const profileChain: any = {};
    profileChain.select = vi.fn(() => profileChain);
    profileChain.eq = vi.fn(() => profileChain);
    profileChain.single = vi.fn().mockResolvedValue({ data: { role: 'professional' }, error: null });
    mockFrom.mockReturnValue(profileChain);

    const res = await request(app)
      .get('/api/admin/active-users')
      .set('Authorization', USER_TOKEN);

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('returns 200 with count of users active in the last 24h', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });

    const profileChain: any = {};
    profileChain.select = vi.fn(() => profileChain);
    profileChain.eq = vi.fn(() => profileChain);
    profileChain.single = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null });
    mockFrom.mockReturnValue(profileChain);

    const recentAt = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const oldAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    mockAdminListUsers.mockResolvedValue({
      data: {
        users: [
          { id: 'u1', last_sign_in_at: recentAt },
          { id: 'u2', last_sign_in_at: recentAt },
          { id: 'u3', last_sign_in_at: oldAt },
          { id: 'u4', last_sign_in_at: null },
        ],
      },
      error: null,
    });

    const res = await request(app)
      .get('/api/admin/active-users')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });
});
