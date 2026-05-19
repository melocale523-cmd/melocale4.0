import { describe, it, expect, vi, beforeEach } from 'vitest';

type ChainFn = () => MockChain;

interface MockChain {
  select: ChainFn;
  insert: ChainFn;
  update: ChainFn;
  eq: ChainFn;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function makeChain(overrides: Partial<Record<string, unknown>> = {}): MockChain {
  const chain = {} as MockChain;
  const r: ChainFn = () => chain;
  chain.select = r;
  chain.insert = r;
  chain.update = r;
  chain.eq = r;
  chain.single = vi.fn().mockResolvedValue(overrides['single'] ?? { data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue(overrides['maybeSingle'] ?? { data: null, error: null });
  return chain;
}

const mockRpc = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}));

vi.mock('../lib/api', () => ({
  API_URL: '',
  apiFetch: vi.fn().mockResolvedValue({ ok: true }),
}));

// leadService imports supabase — import AFTER mock
import { leadService } from '../services/leadService';

const VALID_LEAD_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const VALID_IDEM_KEY = 'bbbbbbbb-0000-0000-0000-000000000002';
const INVALID_LEAD_ID = 'not-a-uuid';

describe('leadService.purchaseLead', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: RPC succeeds
    mockRpc.mockResolvedValue({ data: { purchase_id: 'purchase-1', lead_id: VALID_LEAD_ID }, error: null });

    // Default: from() chains resolve without error
    const updateChain = makeChain();
    const leadChain = makeChain({ single: { data: { client_id: 'client-1' }, error: null } });
    const notifChain = makeChain();
    notifChain.insert = vi.fn().mockResolvedValue({ data: null, error: null }) as ChainFn;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'leads') return { ...updateChain, ...leadChain };
      if (table === 'notifications') return notifChain;
      return updateChain;
    });
  });

  it('throws for an invalid UUID', async () => {
    await expect(leadService.purchaseLead(INVALID_LEAD_ID, VALID_IDEM_KEY)).rejects.toThrow('Invalid lead UUID');
  });

  it('calls purchase_lead RPC with the correct lead id', async () => {
    await leadService.purchaseLead(VALID_LEAD_ID, VALID_IDEM_KEY);

    expect(mockRpc).toHaveBeenCalledWith(
      'purchase_lead',
      expect.objectContaining({ p_lead_id: VALID_LEAD_ID })
    );
  });

  it('throws if RPC returns an error', async () => {
    const rpcError = { message: 'insufficient coins', code: 'P0001' };
    mockRpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(leadService.purchaseLead(VALID_LEAD_ID, VALID_IDEM_KEY)).rejects.toEqual(rpcError);
  });

  it('throws if RPC returns no data', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(leadService.purchaseLead(VALID_LEAD_ID, VALID_IDEM_KEY)).rejects.toThrow('purchase_lead returned no data');
  });

  it('returns the purchase result on success', async () => {
    const expected = { purchase_id: 'purchase-1', lead_id: VALID_LEAD_ID };
    mockRpc.mockResolvedValue({ data: expected, error: null });

    const result = await leadService.purchaseLead(VALID_LEAD_ID, VALID_IDEM_KEY);
    expect(result).toEqual(expected);
  });

  it('fires purchase_lead RPC which handles lead status update server-side', async () => {
    const expected = { purchase_id: 'purchase-1', lead_id: VALID_LEAD_ID };
    mockRpc.mockResolvedValue({ data: expected, error: null });

    const result = await leadService.purchaseLead(VALID_LEAD_ID, VALID_IDEM_KEY);

    expect(mockRpc).toHaveBeenCalledWith(
      'purchase_lead',
      expect.objectContaining({ p_lead_id: VALID_LEAD_ID })
    );
    expect(result).toEqual(expected);
  });
});
