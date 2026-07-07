// Confirma o cap de chamadas ao Haiku por telefone por hora (proteção de
// custo de API — alguém mandando dezenas de mensagens de propósito não deve
// gerar dezenas de chamadas ao Haiku). Ao estourar o limite, a conversa deve
// ir para needs_human com o handoff_reason específico de abuso, sem uma
// chamada adicional ao Haiku.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Debounce mínimo (não é o foco deste teste) e limite baixo pra não precisar
// mandar 16 mensagens reais — precisa ser setado antes do módulo do webhook
// ser importado (vi.hoisted roda antes dos imports estáticos).
vi.hoisted(() => {
  process.env.WHATSAPP_BOT_DEBOUNCE_MS = '10';
  process.env.WHATSAPP_BOT_MAX_CALLS_PER_HOUR = '3';
});

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

const WA_ID = '5511999998888';
const CREATED_CONV = {
  id: 'conv-abuse-1',
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

// Payloads capturados de whatsapp_conversations.update(...) — usados para
// confirmar o handoff_reason específico de estouro de limite.
const updatePayloads: Record<string, unknown>[] = [];
let conversationExists = false;

function buildChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn((payload: Record<string, unknown>) => {
    updatePayloads.push(payload);
    return chain;
  });
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn().mockImplementation(() =>
    Promise.resolve({ data: conversationExists ? CREATED_CONV : null, error: null })
  );
  chain.single = vi.fn().mockImplementation(() => {
    conversationExists = true;
    return Promise.resolve({ data: CREATED_CONV, error: null });
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
              messages: [{ from: WA_ID, id: wamid, type: 'text', text: { body } }],
            },
          },
        ],
      },
    ],
  };
}

async function sendAndWaitDebounce(body: string, wamid: string) {
  const res = await request(app)
    .post('/api/whatsapp-webhook')
    .set('content-type', 'application/json')
    .send(JSON.stringify(textMessagePayload(body, wamid)));
  expect(res.status).toBe(200);
  // Espera o debounce (10ms) + processamento assíncrono passarem antes de
  // mandar a próxima mensagem — precisa ser sequencial pra cada uma contar
  // como uma "chamada" separada ao limite por hora.
  await new Promise((r) => setTimeout(r, 100));
}

describe('POST /api/whatsapp-webhook — limite de chamadas ao bot por telefone/hora', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conversationExists = false;
    updatePayloads.length = 0;
    mockFrom.mockImplementation(() => buildChain());
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ reply: 'Resposta normal do bot.', handoff: false, mood: 'neutral' }) }],
    });
  });

  it('para de chamar o Haiku após o limite (3/h no teste) e faz handoff com o motivo de abuso', async () => {
    // As 3 primeiras mensagens ficam dentro do limite — cada uma dispara uma
    // chamada ao Haiku.
    await sendAndWaitDebounce('Mensagem 1', 'wamid.1');
    await sendAndWaitDebounce('Mensagem 2', 'wamid.2');
    await sendAndWaitDebounce('Mensagem 3', 'wamid.3');
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(3);

    // A 4ª mensagem estoura o limite — não deve chamar o Haiku de novo, e a
    // conversa deve ser marcada needs_human com o motivo específico de abuso.
    await sendAndWaitDebounce('Mensagem 4', 'wamid.4');
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(3);

    const abuseUpdate = updatePayloads.find(
      (p) => p.handoff_reason === 'Limite de mensagens automáticas atingido — possível abuso ou conversa muito longa, necessita atenção humana'
    );
    expect(abuseUpdate).toBeDefined();
    expect(abuseUpdate?.status).toBe('needs_human');
  });
});
