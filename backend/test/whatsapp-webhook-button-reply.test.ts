// Confirma que um clique em botão de resposta rápida de template
// (payload `interactive`/`button_reply` da Meta) é tratado exatamente como
// uma mensagem de texto normal, passando pelo mesmo pipeline do bot
// (ensureConversation → insertMessage → processBotTurn).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

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

function buildChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  // Sem conversa existente pro telefone
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  // Resultado da criação da conversa (ensureConversation)
  chain.single = vi.fn().mockResolvedValue({ data: CREATED_CONV, error: null });
  // Resolução genérica pra chains sem terminal explícito (insert/update/select
  // usados diretamente como Promise, como o supabase-js real faz)
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  return chain;
}

function buttonReplyPayload(buttonTitle: string) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              messages: [
                {
                  from: WA_ID,
                  id: 'wamid.test123',
                  type: 'interactive',
                  interactive: {
                    type: 'button_reply',
                    button_reply: { id: 'btn_sim_quero_saber', title: buttonTitle },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe('POST /api/whatsapp-webhook — clique em botão de resposta rápida', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => buildChain());
    mockRpc.mockResolvedValue({ data: [], error: null }); // find_profiles_by_phone_suffix: sem match
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ reply: 'Claro! Deixa eu te explicar...', handoff: false, mood: 'positive' }) }],
    });
  });

  it('processa o título do botão como mensagem de texto normal (200 + pipeline do bot chamado)', async () => {
    // supertest/superagent serializa um Buffer passado a .send() como JSON
    // ({"type":"Buffer","data":[...]}) quando o content-type é application/json
    // — envia a string já serializada crua pra chegar como express.raw() espera.
    const rawJson = JSON.stringify(buttonReplyPayload('Sim, quero saber'));

    const res = await request(app)
      .post('/api/whatsapp-webhook')
      .set('content-type', 'application/json')
      .send(rawJson);

    expect(res.status).toBe(200);

    // Dá tempo pro processamento assíncrono (best-effort, pós-200) rodar
    await new Promise((r) => setTimeout(r, 50));

    // ensureConversation: buscou conversa existente (maybeSingle) e criou uma nova
    expect(mockFrom).toHaveBeenCalledWith('whatsapp_conversations');
    // insertMessage: registrou a mensagem inbound com o título do botão
    expect(mockFrom).toHaveBeenCalledWith('whatsapp_messages');
    // processBotTurn: chamou o Haiku (conversa nova = bot_active)
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
    const call = mockAnthropicCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain('Sim, quero saber');
  });

  it('ignora mensagens interactive que não são button_reply', async () => {
    const payload = buttonReplyPayload('Sim, quero saber');
    (payload.entry[0].changes[0].value.messages[0] as { interactive: { type: string } }).interactive.type = 'list_reply';

    const res = await request(app)
      .post('/api/whatsapp-webhook')
      .set('content-type', 'application/json')
      .send(JSON.stringify(payload));

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });
});
