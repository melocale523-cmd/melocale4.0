import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the integration of proposeReschedule → acceptReschedule
// by tracking the state transitions through mocked Supabase calls.

const fromCalls: Array<{ table: string; op: string; data?: unknown }> = [];

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  _getLastData: () => Record<string, unknown>;
}

function makeChain(resolvedData: unknown = null, resolvedError: unknown = null): MockChain {
  let lastData: Record<string, unknown> = {};
  const chain = {} as MockChain;
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn((d: unknown) => { lastData = d as Record<string, unknown>; return chain; });
  chain.update = vi.fn((d: unknown) => { lastData = d as Record<string, unknown>; return chain; });
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });
  chain._getLastData = () => lastData;
  return chain;
}

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('../lib/api', () => ({
  API_URL: '',
  apiFetch: vi.fn().mockResolvedValue({ ok: true }),
}));

import { appointmentService } from '../services/appointmentService';

const APPT_ID = 'appt-aaaaaaaa';
const CLIENT_ID = 'client-bbbbbbbb';
const PROPOSED_AT = '2026-06-15T10:00:00.000Z';

describe('Reschedule integration: proposeReschedule → acceptReschedule → scheduled_at updated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCalls.length = 0;
  });

  it('proposeReschedule sets status=rescheduled and proposed_at', async () => {
    const expectedAppt = {
      id: APPT_ID,
      status: 'rescheduled',
      proposed_at: PROPOSED_AT,
      proposed_by: 'professional',
      scheduled_at: '2026-06-10T10:00:00.000Z',
    };

    const chain = makeChain(expectedAppt);
    const notifChain = makeChain({ id: 'notif-1' });
    notifChain.insert = vi.fn().mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'notifications') return notifChain;
      return chain;
    });

    const result = await appointmentService.proposeReschedule(
      APPT_ID,
      PROPOSED_AT,
      'professional',
      CLIENT_ID,
    );

    expect(result.status).toBe('rescheduled');
    expect(result.proposed_at).toBe(PROPOSED_AT);
    expect(result.proposed_by).toBe('professional');
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rescheduled',
        proposed_at: PROPOSED_AT,
        proposed_by: 'professional',
      })
    );
  });

  it('acceptReschedule moves proposed_at to scheduled_at and sets status=confirmed', async () => {
    // First call: fetch current appointment (proposed_at)
    const currentAppt = {
      proposed_at: PROPOSED_AT,
      proposed_by: 'professional',
      client_id: CLIENT_ID,
      professional_id: 'prof-1',
    };

    // Second call: update appointment
    const updatedAppt = {
      id: APPT_ID,
      status: 'confirmed',
      scheduled_at: PROPOSED_AT,
      proposed_at: null,
      proposed_by: null,
    };

    let callCount = 0;
    const apptChain1 = makeChain(currentAppt);
    const apptChain2 = makeChain(updatedAppt);
    const notifChain = makeChain();
    notifChain.insert = vi.fn().mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'notifications') return notifChain;
      // first from('appointments') → fetch, second → update
      callCount++;
      return callCount === 1 ? apptChain1 : apptChain2;
    });

    const result = await appointmentService.acceptReschedule(APPT_ID, CLIENT_ID);

    expect(result.status).toBe('confirmed');
    expect(result.scheduled_at).toBe(PROPOSED_AT);
    expect(result.proposed_at).toBeNull();
    expect(result.proposed_by).toBeNull();

    // The update call should set scheduled_at = proposed_at from the first fetch
    expect(apptChain2.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'confirmed',
        scheduled_at: PROPOSED_AT,
        proposed_at: null,
        proposed_by: null,
      })
    );
  });

  it('full flow: propose then accept results in scheduled_at = proposedAt', async () => {
    const originalScheduledAt = '2026-06-10T10:00:00.000Z';

    // --- proposeReschedule ---
    const proposedAppt = {
      id: APPT_ID,
      status: 'rescheduled',
      scheduled_at: originalScheduledAt,
      proposed_at: PROPOSED_AT,
      proposed_by: 'client',
    };
    const proposeChain = makeChain(proposedAppt);

    // --- acceptReschedule: fetch current ---
    const currentState = {
      proposed_at: PROPOSED_AT,
      proposed_by: 'client',
      client_id: CLIENT_ID,
      professional_id: 'prof-1',
    };
    const fetchChain = makeChain(currentState);

    // --- acceptReschedule: update ---
    const acceptedAppt = {
      id: APPT_ID,
      status: 'confirmed',
      scheduled_at: PROPOSED_AT,   // <-- KEY: moved from proposed_at
      proposed_at: null,
      proposed_by: null,
    };
    const updateChain = makeChain(acceptedAppt);

    const notifChain = makeChain();
    notifChain.insert = vi.fn().mockResolvedValue({ data: null, error: null });

    let globalCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notifications') return notifChain;
      globalCallCount++;
      if (globalCallCount === 1) return proposeChain;  // propose update
      if (globalCallCount === 2) return fetchChain;    // accept fetch
      return updateChain;                               // accept update
    });

    // Step 1: propose
    const proposed = await appointmentService.proposeReschedule(
      APPT_ID, PROPOSED_AT, 'client'
    );
    expect(proposed.status).toBe('rescheduled');
    expect(proposed.proposed_at).toBe(PROPOSED_AT);

    // Step 2: accept
    const accepted = await appointmentService.acceptReschedule(APPT_ID);
    expect(accepted.status).toBe('confirmed');
    expect(accepted.scheduled_at).toBe(PROPOSED_AT);
    expect(accepted.scheduled_at).not.toBe(originalScheduledAt);
  });
});
