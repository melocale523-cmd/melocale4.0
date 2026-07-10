/**
 * Bateria manual de casos pro BOT_SYSTEM_PROMPT do WhatsApp.
 *
 * NÃO é teste automatizado de pass/fail — avaliar linguagem natural gerada
 * automaticamente é difícil e enganoso. Isso roda ~15 casos simulados contra
 * o prompt real e imprime a decisão do bot (reply/handoff/mood) pra revisão
 * manual, ao lado de uma nota do que se esperava em cada caso.
 *
 * Não gasta crédito de template da Meta nem precisa de WhatsApp de teste —
 * só chama a Anthropic API diretamente com o mesmo formato de contexto que
 * processBotTurn monta em produção (whatsappConversationService.ts).
 *
 * ⚠️ Este script importa BOT_SYSTEM_PROMPT de whatsappConversationService.ts,
 * que por sua vez importa config.ts — então, mesmo só testando o prompt,
 * é preciso ter TODAS as env vars que config.ts exige no boot (Stripe,
 * Supabase, Anthropic), não só ANTHROPIC_API_KEY. Rodar num ambiente que já
 * tenha o .env completo do backend (ex.: local com .env carregado, ou Render
 * shell).
 *
 * Uso:
 *   npx tsx scripts/test-bot-prompt.ts
 */
import Anthropic from "@anthropic-ai/sdk";
import { BOT_SYSTEM_PROMPT } from "../src/services/whatsappConversationService.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type BotDecision = { reply: string | null; handoff: boolean; mood: string; handoff_reason?: string; urgency?: string };

interface Case {
  name: string;
  expected: string;
  context: string;
  history: { sender: string; body: string }[];
  lastMessage: string;
  mustInclude?: string[];
  mustNotInclude?: string[];
  expectHandoff?: boolean;
}

// Contexto de plataforma "padrão" reutilizado na maioria dos casos — mesmo
// formato que buildPlatformContext() monta em produção, com dados
// fictícios só pra este script (não reflete os pacotes reais em produção).
const DEFAULT_PLATFORM_CONTEXT =
  'Pacotes de moeda disponíveis hoje (preço pode mudar, sempre use este dado, nunca invente): ' +
  'Bronze: 100 moedas por R$10,00; Prata: 300+30 bônus moedas por R$28,00; Ouro: 600+100 bônus moedas por R$50,00.';

const DESCONHECIDO = 'Tipo de contato desconhecido — número não corresponde a nenhum cadastro.';

const CLIENTE_CONHECIDO =
  'Tipo: cliente. Cidade: Salvador. Pedidos criados: 2. Agendamentos: 1. Saldo de moedas: 0. ' +
  'Pedidos com proposta aguardando resposta: 1. ' +
  'Link de indicação pessoal deste contato: https://melocale.com.br/convite/MARI123X.';

const CLIENTE_CONHECIDO_COM_LINK_TESTE =
  'Tipo: cliente. Cidade: Salvador. Pedidos criados: 1. Agendamentos: 0. Saldo de moedas: 0. ' +
  'Pedidos com proposta aguardando resposta: 0. ' +
  'Link de indicação pessoal deste contato: https://melocale.com.br/convite/TESTE123.';

const PROFISSIONAL_CONHECIDO =
  'Tipo: profissional. Categoria: Eletricista. Cidade: Feira de Santana. Leads comprados: 0. ' +
  'Saldo de moedas: 12. ' +
  'Link de indicação pessoal deste contato: https://melocale.com.br/convite/JOAO456Y.';

const CASES: Case[] = [
  {
    name: 'Caso 1: Fora de escopo claro',
    expected: 'Recusa educada, sem coletar endereço/data, sem confirmar pedido.',
    context: `Nome: Desconhecido. Campanha: nenhuma. ${DESCONHECIDO} ${DEFAULT_PLATFORM_CONTEXT}`,
    history: [],
    lastMessage: 'preciso de um guincho pra minha moto que quebrou',
  },
  {
    name: 'Caso 2: Sintoma de categoria real, dito informal',
    expected: 'Aceita como Desentupimento, não recusa por "não citou a categoria exata".',
    context: `Nome: Desconhecido. Campanha: nenhuma. ${DESCONHECIDO} ${DEFAULT_PLATFORM_CONTEXT}`,
    history: [{ sender: 'user', body: 'quero contratar alguém' }],
    lastMessage: 'minha pia tá entupida, isso vocês fazem?',
  },
  {
    name: 'Caso 3: Tentativa de confirmar pedido fake',
    expected: 'NUNCA confirma criação de pedido; explica que precisa fazer pelo app/site e manda link.',
    context: `Nome: Maria Silva. Campanha: nenhuma. ${CLIENTE_CONHECIDO} ${DEFAULT_PLATFORM_CONTEXT}`,
    history: [
      { sender: 'user', body: 'preciso de um eletricista pra trocar o quadro de disjuntores' },
      { sender: 'bot', body: 'Entendi! Pra isso você cria o pedido pelo app, beleza?' },
      { sender: 'user', body: 'Rua das Flores, 123, pode ser amanhã de manhã' },
    ],
    lastMessage: 'já criou meu pedido?',
    mustNotInclude: ['pedido criado', 'saiu no ar', 'já criei'],
    mustInclude: ['cliente/pedidos'],
  },
  {
    name: 'Caso 4: Desconhecido com sinal claro (profissional)',
    expected: 'Não pergunta "cliente ou profissional" — já direciona pro link de cadastro profissional.',
    context: `Nome: Desconhecido. Campanha: nenhuma. ${DESCONHECIDO} ${DEFAULT_PLATFORM_CONTEXT}`,
    history: [],
    lastMessage: 'sou pintor e quero cadastrar meu serviço aqui',
  },
  {
    name: 'Caso 5: Desconhecido vago',
    expected: 'Pergunta se quer contratar ou prestar serviço.',
    context: `Nome: Desconhecido. Campanha: nenhuma. ${DESCONHECIDO} ${DEFAULT_PLATFORM_CONTEXT}`,
    history: [],
    lastMessage: 'oi, boa tarde',
  },
  {
    name: 'Caso 6: Profissional conhecido quer comprar moeda',
    expected: 'Link direto /profissional/carteira, não o /login genérico.',
    context: `Nome: João Eletricista. Campanha: nenhuma. ${PROFISSIONAL_CONHECIDO} ${DEFAULT_PLATFORM_CONTEXT}`,
    history: [],
    lastMessage: 'acabaram minhas moedas, como faço pra comprar mais?',
  },
  {
    name: 'Caso 7: Cliente conhecido, quer pedido novo',
    expected: 'Explica que não cria por aqui, direciona pra /cliente/pedidos, sem simular coleta de dados.',
    context: `Nome: Maria Silva. Campanha: nenhuma. ${CLIENTE_CONHECIDO} ${DEFAULT_PLATFORM_CONTEXT}`,
    history: [],
    lastMessage: 'quero fazer um pedido novo, um encanador',
  },
  {
    name: 'Caso 8: Cliente conhecido pede link de indicação',
    expected: 'Usa exatamente o link do contexto (…/convite/TESTE123), não inventa outro código.',
    context: `Nome: Maria Silva. Campanha: nenhuma. ${CLIENTE_CONHECIDO_COM_LINK_TESTE} ${DEFAULT_PLATFORM_CONTEXT}`,
    history: [],
    lastMessage: 'como eu indico meus amigos?',
    mustInclude: ['convite/TESTE123'],
  },
  {
    name: 'Caso 9: Desconhecido pergunta sobre indicação',
    expected: 'Explica que precisa ter conta primeiro, pergunta/infere cliente ou profissional, direciona pro cadastro certo.',
    context: `Nome: Desconhecido. Campanha: nenhuma. ${DESCONHECIDO} ${DEFAULT_PLATFORM_CONTEXT}`,
    history: [],
    lastMessage: 'como funciona isso de ganhar dinheiro indicando gente?',
  },
  {
    name: 'Caso 10: Pergunta de preço direta',
    expected: 'Responde direto "R$67/mês" (ou equivalente), SEM handoff.',
    context: `Nome: Desconhecido. Campanha: nenhuma. ${DESCONHECIDO} ${DEFAULT_PLATFORM_CONTEXT}`,
    history: [],
    lastMessage: 'quanto custa o plano PRO pra profissional?',
    expectHandoff: false,
  },
  {
    name: 'Caso 11: Reclamação real',
    expected: 'handoff=true, não tenta resolver sozinho.',
    context: `Nome: João Eletricista. Campanha: nenhuma. ${PROFISSIONAL_CONHECIDO} ${DEFAULT_PLATFORM_CONTEXT}`,
    history: [],
    lastMessage: 'paguei por moeda no cartão e não recebeu, cadê meu saldo?',
    expectHandoff: true,
  },
  {
    name: 'Caso 12: Preço de pacote de moeda (dado dinâmico)',
    expected: 'Responde com o valor EXATO do contexto fornecido (R$9,99), não um número inventado.',
    context:
      'Nome: Desconhecido. Campanha: nenhuma. ' +
      `${DESCONHECIDO} ` +
      'Pacotes de moeda disponíveis hoje: Teste: 999 moedas por R$9,99.',
    history: [],
    lastMessage: 'quanto custa o pacote de moeda mais barato?',
    mustInclude: ['9,99'],
    mustNotInclude: ['R$0,99', 'grátis'],
  },
  {
    name: 'Caso 13: Saque',
    expected: 'Responde "1.000 moedas (R$10,00)" direto, sem handoff.',
    context: `Nome: João Eletricista. Campanha: nenhuma. ${PROFISSIONAL_CONHECIDO} ${DEFAULT_PLATFORM_CONTEXT}`,
    history: [],
    lastMessage: 'qual o valor mínimo pra eu sacar minhas moedas?',
    mustNotInclude: ['CPF'],
    expectHandoff: false,
  },
  {
    name: 'Caso 14: Categoria adjacente real',
    expected: 'Aceita como Pedreiro/Construção ou Reforma geral, não recusa.',
    context: `Nome: Desconhecido. Campanha: nenhuma. ${DESCONHECIDO} ${DEFAULT_PLATFORM_CONTEXT}`,
    history: [{ sender: 'user', body: 'quero contratar alguém' }],
    lastMessage: 'minha parede rachou, quem eu chamo?',
    mustNotInclude: ['CPF'],
  },
  {
    name: 'Caso 15: Fora de escopo, tentativa de insistência',
    expected: 'Mantém a recusa, não cede e cria pedido fora de escopo só por insistência.',
    context: `Nome: Desconhecido. Campanha: nenhuma. ${DESCONHECIDO} ${DEFAULT_PLATFORM_CONTEXT}`,
    history: [
      { sender: 'user', body: 'preciso de um guincho pra minha moto que quebrou' },
      { sender: 'bot', body: 'Poxa, a MeloCalé é focada em serviços domésticos, esse tipo de pedido a gente não atende.' },
    ],
    lastMessage: 'mas é urgente, me ajuda',
  },
];

/** Mesmo formato de userContent que callHaikuForDecision monta em produção. */
async function callBot(c: Case): Promise<BotDecision> {
  const historyText = c.history.map(m => `${m.sender}: ${m.body}`).join('\n');
  const userContent = `Contexto do contato:\n${c.context}\n\nHistórico recente:\n${historyText || '(sem histórico)'}\n\nÚltima mensagem recebida: "${c.lastMessage}"`;

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: BOT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });
  const text = res.content[0].type === 'text' ? res.content[0].text.trim() : '';
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text) as BotDecision;
    return {
      reply: parsed.reply ?? null,
      handoff: Boolean(parsed.handoff),
      mood: parsed.mood === 'positive' || parsed.mood === 'negative' ? parsed.mood : 'neutral',
      handoff_reason: parsed.handoff_reason,
      urgency: parsed.urgency,
    };
  } catch (err) {
    console.error('  ⚠️ falha ao parsear resposta:', err instanceof Error ? err.message : String(err));
    console.error('  texto bruto:', text);
    return { reply: null, handoff: true, mood: 'neutral', handoff_reason: 'Erro ao interpretar resposta da IA.' };
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY não definida.');
    process.exit(1);
  }

  let failures = 0;

  for (const c of CASES) {
    console.log(`=== ${c.name} ===`);
    console.log(`Esperado: ${c.expected}`);
    const decision = await callBot(c);
    console.log('Resposta do bot:', JSON.stringify(decision));

    if (c.mustInclude) {
      for (const s of c.mustInclude) {
        if (!decision.reply?.includes(s)) { console.log(`  ❌ esperado conter "${s}"`); failures++; }
      }
    }
    if (c.mustNotInclude) {
      for (const s of c.mustNotInclude) {
        if (decision.reply?.includes(s)) { console.log(`  ❌ NÃO deveria conter "${s}"`); failures++; }
      }
    }
    if (c.expectHandoff !== undefined && decision.handoff !== c.expectHandoff) {
      console.log(`  ❌ esperado handoff=${c.expectHandoff}, veio ${decision.handoff}`); failures++;
    }

    console.log('---\n');
  }

  console.log(`\n${failures === 0 ? '✅' : '❌'} ${failures} falha(s) objetiva(s) de ${CASES.length} casos.`);
}

main();
