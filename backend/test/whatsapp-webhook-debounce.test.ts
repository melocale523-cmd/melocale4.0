// Confirma o fix do bug de "IA responde duas vezes quase igual": duas
// mensagens chegando em sequência rápida pro mesmo telefone (ex.: "Como
// funciona" + "?" a poucos segundos de distância) devem resultar em UMA
// única chamada ao Haiku, não duas — o debounce por telefone em
// whatsappWebhook.ts (scheduleBotTurn) precisa agrupar as duas mensagens
// numa janela de espera antes de acionar o bot.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Debounce curto pra este teste não precisar esperar os 3.5s padrão —
// precisa ser setado antes do módulo do webhook ser importado (vi.hoisted
// roda antes dos imports estáticos).
vi.hoisted(() => { process.env.WHATSAPP_BOT_DEBOUNCE_MS = '80'; });

const mockConstructEvent = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockAnthropicCreate = vi.hoisted(() => vi.fn());

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
      auth: { getUser: vi.fn(), admin: { listUsers: vi.fn() } },
    };
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function() { return { messages: { create: mockAnthropicCreate } }; }),
}));

import { createApp } from '../server';

const app = createApp();

const WA_ID = '5511988887777';
const CREATED_CONV = {
  id: 'conv-1',
  phone: WA_ID,
  contact_id: null,
  contact_type: 'unknown',
  campaign: null,
  status: 'bot_active',
  handoff_reason: null,
  mood: null,
  last_message_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

// Conversas "criadas" por telefone — precisa ser por-telefone (não um
// booleano global) porque um dos testes usa 2 telefones diferentes e cada
// um precisa da SUA PRÓPRIA conversa (senão o debounce, que agrupa por
// conv.phone, veria os dois como o mesmo telefone).
const conversationsByPhone = new Map<string, typeof CREATED_CONV>();

function buildChain() {
  const chain: Record<string, unknown> = {};
  let lastEqValue: string | undefined;
  let insertedPhone: string | undefined;
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn((_col: string, val: string) => { lastEqValue = val; return chain; });
  chain.in = vi.fn(() => chain);
  chain.insert = vi.fn((payload: { phone?: string }) => { insertedPhone = payload?.phone; return chain; });
  chain.update = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn().mockImplementation(() => {
    const conv = lastEqValue ? conversationsByPhone.get(lastEqValue) : undefined;
    return Promise.resolve({ data: conv ?? null, error: null });
  });
  chain.single = vi.fn().mockImplementation(() => {
    const phone = insertedPhone ?? WA_ID;
    const conv = { ...CREATED_CONV, phone, id: `conv-${phone}` };
    conversationsByPhone.set(phone, conv);
    return Promise.resolve({ data: conv, error: null });
  });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  return chain;
}

function textMessagePayload(body: string, wamid: string) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              messages: [
                { from: WA_ID, id: wamid, type: 'text', text: { body } },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe('POST /api/whatsapp-webhook — debounce de mensagens em sequência rápida', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conversationsByPhone.clear();
    mockFrom.mockImplementation(() => buildChain());
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ reply: 'Você pede o serviço e um profissional te manda uma proposta!', handoff: false, mood: 'neutral' }) }],
    });
  });

  it('chama o Haiku UMA única vez quando duas mensagens chegam poucos ms depois uma da outra', async () => {
    const req1 = request(app)
      .post('/api/whatsapp-webhook')
      .set('content-type', 'application/json')
      .send(JSON.stringify(textMessagePayload('Como funciona', 'wamid.1')));

    const req2 = request(app)
      .post('/api/whatsapp-webhook')
      .set('content-type', 'application/json')
      .send(JSON.stringify(textMessagePayload('?', 'wamid.2')));

    // Dispara os dois POSTs quase simultaneamente (sem await sequencial),
    // simulando os dois webhooks da Meta chegando com poucos ms de diferença.
    const [res1, res2] = await Promise.all([req1, req2]);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Ainda dentro da janela de debounce (80ms) — o bot não deve ter sido
    // chamado ainda, mesmo as duas mensagens já tendo chegado.
    await new Promise((r) => setTimeout(r, 30));
    expect(mockAnthropicCreate).not.toHaveBeenCalled();

    // Espera a janela de debounce passar.
    await new Promise((r) => setTimeout(r, 150));

    // Só UMA chamada ao Haiku, não duas — essa é a confirmação do fix.
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);

    // A chamada deve usar a mensagem mais recente ("?"), não a primeira.
    const call = mockAnthropicCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain('Última mensagem recebida: "?"');
  });

  it('mensagens pra telefones diferentes não são agrupadas (cada uma dispara sua própria chamada)', async () => {
    const OTHER_WA_ID = '5511988887778';

    await Promise.all([
      request(app).post('/api/whatsapp-webhook').set('content-type', 'application/json')
        .send(JSON.stringify(textMessagePayload('Oi', 'wamid.a'))),
      request(app).post('/api/whatsapp-webhook').set('content-type', 'application/json')
        .send(JSON.stringify({
          object: 'whatsapp_business_account',
          entry: [{ changes: [{ field: 'messages', value: { messages: [{ from: OTHER_WA_ID, id: 'wamid.b', type: 'text', text: { body: 'Oi' } }] } }] }],
        })),
    ]);

    await new Promise((r) => setTimeout(r, 150));
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(2);
  });
});
