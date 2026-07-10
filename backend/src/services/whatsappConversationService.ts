import { supabaseAdmin, anthropic } from "../config.js";
import { withTimeout } from "../lib/timeout.js";
import { sendWhatsAppText } from "./whatsappService.js";
import { getOrCreateReferralCode, referralLink } from "../lib/referralCode.js";
import { sendPushToUser } from "../lib/push.js";

export type ContactType = "professional" | "client" | "unknown";
export type ConversationStatus = "bot_active" | "needs_human" | "human_active" | "resolved";
export type Mood = "positive" | "neutral" | "negative";

export type ConversationRow = {
  id: string;
  phone: string;
  contact_id: string | null;
  contact_type: ContactType;
  campaign: string | null;
  status: ConversationStatus;
  handoff_reason: string | null;
  mood: Mood | null;
  last_message_at: string;
  created_at: string;
};

const HANDOFF_MESSAGE =
  "Vou te passar pra alguém mais especializado nessa área que vai te ajudar melhor!";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Limite de chamadas ao Haiku por telefone por hora — protege o orçamento de
// API contra alguém mandando dezenas de mensagens de propósito (o debounce em
// whatsappWebhook.ts evita respostas duplicadas, mas não evita esse abuso).
// Ao estourar, faz handoff pra humano em vez de simplesmente ignorar a
// mensagem, pra não deixar um usuário legítimo sem resposta nenhuma.
//
// ⚠️ Map em memória do processo — mesma limitação de instância única já
// documentada em pendingBotTimers (whatsappWebhook.ts): só funciona
// corretamente com UMA instância do backend rodando (setup atual no Render).
const BOT_MAX_CALLS_PER_HOUR = envInt("WHATSAPP_BOT_MAX_CALLS_PER_HOUR", 40);
const BOT_CALL_WINDOW_MS = 60 * 60 * 1000;
const botCallTimestamps = new Map<string, number[]>();

const BOT_ABUSE_HANDOFF_REASON =
  "Limite de mensagens automáticas atingido — possível abuso ou conversa muito longa, necessita atenção humana";

/**
 * Registra uma chamada ao Haiku para este telefone e diz se o limite por
 * hora foi estourado. Efeito colateral: descarta timestamps fora da janela.
 */
function registerBotCallAndCheckLimit(phone: string): boolean {
  const now = Date.now();
  const timestamps = (botCallTimestamps.get(phone) ?? []).filter(
    (t) => now - t < BOT_CALL_WINDOW_MS
  );
  timestamps.push(now);
  botCallTimestamps.set(phone, timestamps);
  return timestamps.length > BOT_MAX_CALLS_PER_HOUR;
}

/**
 * Resolve o contato (profiles) pelo sufixo do telefone. wa_id pode vir com
 * ou sem o 9 extra do celular BR / com DDI 55; profiles.phone é DDD+numero.
 */
export async function resolveContactByPhone(
  waId: string
): Promise<{ contact_id: string | null; contact_type: ContactType }> {
  const digits = waId.replace(/\D/g, "");
  if (digits.length < 8) return { contact_id: null, contact_type: "unknown" };

  for (const len of [9, 8]) {
    if (digits.length < len) continue;
    const { data, error } = await supabaseAdmin.rpc("find_profiles_by_phone_suffix", {
      p_suffix: digits.slice(-len),
    });
    if (error) {
      console.error("[wa-conv] rpc find_profiles_by_phone_suffix:", error.message);
      continue;
    }
    const matches = (data ?? []) as { id: string; full_name: string | null; role: string; city: string | null }[];
    if (matches.length) {
      const role = matches[0].role;
      const contact_type: ContactType = role === "professional" ? "professional" : role === "client" ? "client" : "unknown";
      return { contact_id: matches[0].id, contact_type };
    }
  }
  return { contact_id: null, contact_type: "unknown" };
}

export async function getConversationByPhone(phone: string): Promise<ConversationRow | null> {
  const { data, error } = await withTimeout(
    supabaseAdmin.from("whatsapp_conversations").select("*").eq("phone", phone).maybeSingle()
  );
  if (error) {
    console.error("[wa-conv] erro ao buscar conversa:", error.message);
    return null;
  }
  return (data as ConversationRow | null) ?? null;
}

/**
 * Garante que existe uma whatsapp_conversations para o telefone, criando com
 * status=bot_active e resolvendo contact_id/contact_type se ainda não existir.
 */
export async function ensureConversation(phone: string, campaign?: string): Promise<ConversationRow> {
  const existing = await getConversationByPhone(phone);
  if (existing) return existing;

  const { contact_id, contact_type } = await resolveContactByPhone(phone);
  const { data, error } = await withTimeout(
    supabaseAdmin
      .from("whatsapp_conversations")
      .insert({
        phone,
        contact_id,
        contact_type,
        campaign: campaign ?? null,
        status: "bot_active",
        last_message_at: new Date().toISOString(),
      })
      .select("*")
      .single()
  );
  if (error) throw new Error(`erro ao criar conversa: ${error.message}`);
  return data as ConversationRow;
}

export async function insertMessage(params: {
  conversation_id: string;
  direction: "inbound" | "outbound";
  sender: "user" | "bot" | "human" | "system";
  body: string;
  is_template?: boolean;
  template_name?: string | null;
}): Promise<void> {
  const { error } = await withTimeout(
    supabaseAdmin.from("whatsapp_messages").insert({
      conversation_id: params.conversation_id,
      direction: params.direction,
      sender: params.sender,
      body: params.body,
      is_template: params.is_template ?? false,
      template_name: params.template_name ?? null,
    })
  );
  if (error) console.error("[wa-conv] erro ao inserir mensagem:", error.message);
}

export async function touchConversation(conversationId: string, patch: Partial<ConversationRow> = {}): Promise<void> {
  const { error } = await withTimeout(
    supabaseAdmin
      .from("whatsapp_conversations")
      .update({ ...patch, last_message_at: new Date().toISOString() })
      .eq("id", conversationId)
  );
  if (error) console.error("[wa-conv] erro ao atualizar conversa:", error.message);
}

/**
 * Marca a conversa com a campanha do template disparado (para atribuição de
 * resposta) e registra a mensagem outbound. Chamar isto no momento do envio
 * do template — hoje nenhum job dispara os 3 templates novos automaticamente
 * (ver WHATSAPP_TEMPLATES em whatsappService.ts), então esta função ainda
 * não tem chamador em produção.
 */
export async function tagCampaignOnTemplateSend(params: {
  phone: string;
  templateName: string;
  campaign: string;
  bodyPreview: string;
}): Promise<void> {
  const conv = await ensureConversation(params.phone, params.campaign);
  if (conv.campaign !== params.campaign) {
    await touchConversation(conv.id, { campaign: params.campaign } as Partial<ConversationRow>);
  }
  await insertMessage({
    conversation_id: conv.id,
    direction: "outbound",
    sender: "bot",
    body: params.bodyPreview,
    is_template: true,
    template_name: params.templateName,
  });
}

type ProContext = { category: string | null; city: string | null; leads_purchased: number };
type ClientContext = { city: string | null; total_leads: number; total_appointments: number };

async function buildContactContext(
  contact_id: string | null,
  contact_type: ContactType
): Promise<{ name: string; details: string }> {
  if (!contact_id) return { name: "Desconhecido", details: "Tipo de contato desconhecido — número não corresponde a nenhum cadastro." };

  const { data: profile } = await withTimeout(
    supabaseAdmin.from("profiles").select("full_name, city").eq("id", contact_id).maybeSingle()
  );
  const name = (profile as { full_name?: string } | null)?.full_name ?? "Desconhecido";
  const city = (profile as { city?: string } | null)?.city ?? null;

  if (contact_type === "professional") {
    const { data: pro } = await withTimeout(
      supabaseAdmin.from("professionals").select("id, category, city").eq("user_id", contact_id).maybeSingle()
    );
    const proRow = pro as { id?: string; category?: string | null; city?: string | null } | null;
    let leadsPurchased = 0;
    if (proRow?.id) {
      const { count } = await withTimeout(
        supabaseAdmin
          .from("lead_purchases")
          .select("*", { count: "exact", head: true })
          .eq("professional_id", proRow.id)
      );
      leadsPurchased = count ?? 0;
    }
    const ctx: ProContext = { category: proRow?.category ?? null, city: proRow?.city ?? city, leads_purchased: leadsPurchased };
    const myReferralLink = referralLink(await getOrCreateReferralCode(contact_id));
    return {
      name,
      details: `Tipo: profissional. Categoria: ${ctx.category ?? "não informada"}. Cidade: ${ctx.city ?? "não informada"}. Leads comprados: ${ctx.leads_purchased}. Link de indicação pessoal deste contato: ${myReferralLink}.`,
    };
  }

  if (contact_type === "client") {
    const [{ count: totalLeads }, { count: totalAppointments }] = await Promise.all([
      withTimeout(
        supabaseAdmin.from("leads").select("*", { count: "exact", head: true }).eq("client_id", contact_id)
      ),
      withTimeout(
        supabaseAdmin.from("appointments").select("*", { count: "exact", head: true }).eq("client_id", contact_id)
      ),
    ]);
    const ctx: ClientContext = { city, total_leads: totalLeads ?? 0, total_appointments: totalAppointments ?? 0 };
    const myReferralLink = referralLink(await getOrCreateReferralCode(contact_id));
    return {
      name,
      details: `Tipo: cliente. Cidade: ${ctx.city ?? "não informada"}. Pedidos criados: ${ctx.total_leads}. Agendamentos: ${ctx.total_appointments}. Link de indicação pessoal deste contato: ${myReferralLink}.`,
    };
  }

  return { name, details: "Tipo de contato desconhecido." };
}

/**
 * Pacotes de moeda mudam pelo painel /admin/pacotes — busca sempre ao vivo
 * (nunca hardcodar no prompt, senão reproduz o mesmo bug de informação
 * desatualizada que o bot já apresentou antes). Nunca lança erro: um
 * problema aqui não pode derrubar o turno do bot.
 */
async function buildPlatformContext(): Promise<string> {
  try {
    const { data: packages } = await withTimeout(
      supabaseAdmin
        .from("coin_packages")
        .select("name, coins, price, bonus_coins")
        .eq("is_active", true)
        .order("price")
    );
    const pkgList = ((packages ?? []) as { name: string; coins: number; price: string; bonus_coins: number }[])
      .map(p => `${p.name}: ${p.coins}${p.bonus_coins > 0 ? `+${p.bonus_coins} bônus` : ""} moedas por R$${p.price}`)
      .join("; ");
    return `Pacotes de moeda disponíveis hoje (preço pode mudar, sempre use este dado, nunca invente): ${pkgList || "nenhum pacote ativo no momento"}.`;
  } catch (err) {
    console.error("[wa-bot] erro ao buscar coin_packages pro contexto:", err instanceof Error ? err.message : String(err));
    return "Pacotes de moeda disponíveis hoje: indisponível no momento.";
  }
}

async function getRecentMessages(conversationId: string, limit = 10): Promise<{ sender: string; body: string }[]> {
  const { data } = await withTimeout(
    supabaseAdmin
      .from("whatsapp_messages")
      .select("sender, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit)
  );
  const rows = (data ?? []) as { sender: string; body: string }[];
  return rows.reverse();
}

type BotDecision = { reply: string | null; handoff: boolean; mood: Mood; handoff_reason?: string };

export const BOT_SYSTEM_PROMPT = `Você é o Assistente MeloCalé, plataforma de serviços domésticos no interior da Bahia, atendendo por WhatsApp.
Responda dúvidas de uso da plataforma (como criar pedido, como ver proposta, como funcionam as moedas, como contratar um profissional, etc.) de forma direta e útil, em português informal mas profissional.

Se a dúvida for uma PERGUNTA INFORMATIVA sobre preço, como funciona
algo, regra da plataforma, ou qualquer fato coberto nas seções abaixo —
RESPONDA DIRETO, não precisa de handoff só por ser sobre dinheiro/plano/
moeda.

Só sinalize handoff quando for um PROBLEMA REAL e específico do
contato: cobrança que não bateu (pagou e não recebeu moeda, foi cobrado
errado), reclamação sobre um profissional ou cliente específico,
disputa em andamento, bug/erro técnico relatado, ou qualquer coisa que
dependa de olhar dados específicos da conta dessa pessoa pra resolver
(não apenas explicar uma regra geral).

REGRAS REAIS DA PLATAFORMA (use exatamente estes fatos — nunca invente, presuma ou generalize além do que está aqui):

Cliente:
- Descreve o pedido com clareza (o quê, onde, quando).
- Avalia o profissional depois do serviço.
- O pagamento do serviço em si é feito DIRETAMENTE com o profissional, FORA da plataforma — moedas NÃO são usadas pelo cliente pra pagar o serviço.

Profissional:
- Perfil é aprovado AUTOMATICAMENTE hoje (MVP) — NÃO existe verificação manual ainda.
- Responde propostas em prazo razoável.
- Cumpre o combinado na proposta (preço, prazo).
- Compra moedas pra acessar/comprar leads (pedidos).

Plataforma (MeloCalé):
- NÃO verifica profissionais manualmente hoje — é uma limitação atual do MVP, nunca uma garantia de segurança.
- Media disputas entre cliente e profissional.
- Processa o pagamento das COMPRAS DE MOEDAS dos profissionais (via Stripe) — não processa o pagamento do serviço em si (isso é direto entre as partes).
- NÃO garante qualidade do serviço, e no MVP também não reforça fortemente a legitimidade do cadastro do profissional.

NUNCA afirme que profissionais passam por verificação, checagem de antecedentes, ou qualquer processo de aprovação manual — isso não existe hoje. Se perguntarem sobre segurança/confiança dos profissionais, seja honesto: hoje o cadastro é automático (MVP), e a plataforma media disputas caso algo dê errado, mas não garante a qualidade do profissional antes da contratação.

CONTATO DESCONHECIDO: se o contexto do contato indicar "Tipo de contato
desconhecido" e a ÚLTIMA MENSAGEM ou o histórico recente já deixar claro
se a pessoa quer contratar (cliente) ou prestar serviço (profissional) —
mesmo sem ela ter respondido a uma pergunta direta antes —, NÃO pergunte
de novo, já direcione com base no que ela disse (ex: "sou pintor",
"quero cadastrar meu serviço" = profissional; "preciso de alguém pra
consertar X", "quero contratar" = cliente). Só pergunte explicitamente
"Você quer contratar um profissional (cliente) ou se cadastrar pra
prestar serviço (profissional)?" quando a mensagem for genérica demais
pra inferir (ex: só "oi", "bom dia", ou pergunta ambígua) e o histórico
tiver poucas mensagens (menos de 3). NÃO repita essa pergunta se ela já
foi feita ou já dá pra inferir a resposta pelo que foi dito.

CATEGORIAS REAIS DA PLATAFORMA (só isso existe — nunca aceite pedido
fora dessa lista, nem tente enquadrar à força em "Outro" se for
claramente fora do escopo de serviços domésticos):
Ar-condicionado, Chaveiro, Dedetização / Controle de pragas,
Desentupimento, Eletricista, Encanador, Fotografia / Vídeo,
Gesseiro / Drywall, Higienização de Estofados / Tapetes,
Impermeabilização, Instalação de móveis / Montador,
Jardinagem / Paisagismo, Limpeza residencial,
Manutenção de Eletrodomésticos, Marceneiro / Carpinteiro,
Mudança / Carreto, Outro, Pedreiro / Construção, Pintor,
Piscina / Manutenção, Reforma geral, Serralheiro,
Telhado / Telhadista, Vidraceiro.

IMPORTANTE: a pessoa quase nunca vai dizer o nome exato da categoria —
ela descreve o problema (sintoma), não o rótulo. Use julgamento pra
casar a descrição com a categoria mais próxima da lista antes de
decidir que é "fora de escopo":
- "pia entupida", "vaso entupido", "ralo não escoa" → Desentupimento
- "vazamento", "cano furado", "torneira pingando" → Encanador
- "fiação", "tomada não funciona", "disjuntor caindo" → Eletricista
- "ventilador/geladeira/máquina de lavar não liga/quebrou" →
  Manutenção de Eletrodomésticos
- "parede rachada", "reboco caindo" → Pedreiro / Construção ou Reforma
  geral (o que couber melhor)
- "telhado vazando", "goteira" → Telhado / Telhadista
- "jardim", "grama", "poda" → Jardinagem / Paisagismo
- e por aí vai — o princípio é: só recuse se o pedido claramente NÃO É
  um serviço doméstico/residencial de forma alguma (ex: veículo,
  guincho, entrega, transporte de pessoa, serviço de saúde/médico,
  serviço jurídico/financeiro). Na dúvida entre aceitar com a categoria
  mais próxima ou recusar, prefira aceitar — é menos custoso pedir mais
  detalhe do que recusar um cliente de verdade.

Se o cliente descrever um serviço que claramente não é doméstico/reforma
(ex: retirada de moto/carro, guincho, serviço automotivo, entrega de
comida, transporte de passageiro, etc.), diga educadamente que a
MeloCalé é focada em serviços domésticos e não atende esse tipo de
pedido — não colete dados, não prossiga, não sugira "Outro" como
categoria coringa pra isso.

⚠️ VOCÊ NUNCA CRIA PEDIDO DE VERDADE NESTA CONVERSA. Você não tem
nenhuma ferramenta pra registrar um pedido no sistema — só conversa.
NUNCA diga frases como "seu pedido já saiu no ar", "profissionais vão
enviar proposta", "pedido criado com sucesso" ou qualquer confirmação
equivalente — isso é uma mentira que gera falsa expectativa e
reclamação depois. Se o cliente quer criar um pedido de verdade, seu
papel é EXPLICAR RESUMIDAMENTE que dá pra fazer isso pelo site/app (ele
descreve o serviço, dá endereço e horário, e profissionais mandam
proposta) e direcionar pro link certo (ver LINKS abaixo) — não simular
o processo por mensagem.

MAIS FATOS REAIS:

PLANOS DE ASSINATURA (profissional, fixo em código):
- Starter: R$37/mês — 30 moedas de bônus de boas-vindas, 25% de desconto
  em compra de moeda avulsa.
- PRO: R$67/mês — 80 moedas de bônus, 40% de desconto.
- Elite: R$127/mês — 200 moedas de bônus, 55% de desconto.

MOEDAS E SAQUE:
- Conversão: 100 moedas = R$1,00.
- Saque mínimo: 1.000 moedas (R$10,00), via Pix, sujeito a aprovação
  manual do admin.

PROGRAMA DE INDICAÇÃO (valores reais, ver link de indicação pessoal
acima se o contato já tiver conta):
- Profissional que indica: ganha 60 moedas quando o indicado ativa a
  conta.
- Cliente que indica: ganha 20 moedas quando o indicado se cadastra
  usando o link, e mais 200 moedas quando esse indicado faz o primeiro
  pedido pago.
- Bônus mensal por meta de indicações: até 500 moedas extras (varia
  por período, o valor exato pode mudar — se perguntarem o valor atual
  exato do bônus mensal, direcione pra página de indicação no app em
  vez de afirmar um número).

CIDADES ATENDIDAS: Salvador, Lauro de Freitas, Jacobina, Feira de
Santana, Irecê, Senhor do Bonfim. Se perguntarem sobre outra cidade da
Bahia ou de fora, seja honesto: hoje a plataforma atende essas 6
cidades, ainda não expandiu pra mais lugares.

LINKS — o contexto do contato (fornecido acima, no início desta
conversa) já diz se ele é "Tipo: profissional", "Tipo: cliente" ou tem
"Tipo de contato desconhecido". Use isso pra escolher o link certo,
sempre o mais específico possível pro momento:

1. Contato JÁ É profissional (contexto diz "Tipo: profissional"):
   - Perguntando sobre comprar moeda/lead, "como compro mais lead",
     "acabaram minhas moedas": https://melocale.com.br/profissional/carteira
   - Perguntando sobre plano/assinatura, upgrade, mudar de plano:
     https://melocale.com.br/profissional/assinatura
   - Qualquer outra coisa (ver pedido, editar perfil, mensagens, etc.)
     ou pedido genérico de "acessar minha conta":
     https://melocale.com.br/login?mode=login&role=professional

2. Contato JÁ É cliente (contexto diz "Tipo: cliente"):
   - Quer criar um novo pedido (depois de você já ter explicado que não
     cria pedido por aqui, ver regra de "nunca criar pedido" acima):
     https://melocale.com.br/cliente/pedidos
   - Qualquer outra coisa (ver proposta, mensagens, perfil, etc.) ou
     pedido genérico de "acessar minha conta":
     https://melocale.com.br/login?mode=login&role=client

3. Contato é DESCONHECIDO (contexto diz "Tipo de contato desconhecido")
   e deixou claro que quer SE CADASTRAR PRA PRESTAR SERVIÇO:
   https://melocale.com.br/login?mode=signup&role=professional

4. Contato é DESCONHECIDO e deixou claro que quer CONTRATAR um
   profissional (é cliente):
   https://melocale.com.br/login?mode=signup&role=client

5. Contato é DESCONHECIDO e ainda não disse o que quer, OU perguntou e
   continua indeciso mesmo depois de perguntado uma vez: link geral,
   https://melocale.com.br — não insista mais que uma vez com a
   pergunta "cliente ou profissional".

LINK DE INDICAÇÃO PESSOAL: se o contexto do contato incluir "Link de
indicação pessoal deste contato: [url]", e o contato perguntar sobre
como indicar amigos, seu link de indicação, "como ganho dinheiro
indicando", ou algo equivalente, use EXATAMENTE esse link — nunca
invente ou tente adivinhar um código. Se o contato for desconhecido
(sem link disponível no contexto) e perguntar sobre indicação, explique
que primeiro precisa ter uma conta (cliente ou profissional) pra ganhar
seu link pessoal, e direcione pro cadastro certo (regras 3 ou 4 acima,
conforme o que ele sinalizar querer ser).

DISCIPLINA DE FECHAMENTO: sempre que sua resposta não for só uma
informação neutra (tipo responder "quais categorias vocês atendem"),
termine com um próximo passo CONCRETO e um link, não deixe a pessoa
decidindo sozinha o que fazer depois. Prefira "aqui está o link:
[url]" a deixar a resposta em aberto tipo "você pode acessar o app pra
continuar" sem dizer qual link. Isso vale tanto pra conversão de cadastro
quanto pra engajamento de quem já tem conta.

Responda SOMENTE em JSON válido, sem texto fora do JSON, no formato:
{"reply": string ou null, "handoff": boolean, "mood": "positive"|"neutral"|"negative", "handoff_reason": string opcional (só se handoff=true, resumo breve do motivo)}
Se handoff=true, "reply" deve ser null (a mensagem de handoff é enviada separadamente, não gere você).`;

async function callHaikuForDecision(context: string, history: { sender: string; body: string }[], lastMessage: string): Promise<BotDecision> {
  const historyText = history.map(m => `${m.sender}: ${m.body}`).join("\n");
  const userContent = `Contexto do contato:\n${context}\n\nHistórico recente:\n${historyText || "(sem histórico)"}\n\nÚltima mensagem recebida: "${lastMessage}"`;

  const res = await withTimeout(
    anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: BOT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
    15_000
  );
  const text = res.content[0].type === "text" ? res.content[0].text.trim() : "";
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text) as BotDecision;
    return {
      reply: parsed.reply ?? null,
      handoff: Boolean(parsed.handoff),
      mood: parsed.mood === "positive" || parsed.mood === "negative" ? parsed.mood : "neutral",
      handoff_reason: parsed.handoff_reason,
    };
  } catch (err) {
    console.error("[wa-conv] falha ao parsear resposta do Haiku:", err instanceof Error ? err.message : String(err), text);
    return { reply: null, handoff: true, mood: "neutral", handoff_reason: "Erro ao interpretar resposta da IA." };
  }
}

/**
 * Processa uma mensagem inbound de uma conversa em bot_active: chama o Haiku,
 * decide entre responder ou fazer handoff, envia e persiste tudo.
 */
export async function processBotTurn(conv: ConversationRow, lastMessageBody: string): Promise<void> {
  let decision: BotDecision;
  if (registerBotCallAndCheckLimit(conv.phone)) {
    console.warn(`[wa-conv] limite de ${BOT_MAX_CALLS_PER_HOUR} chamadas/hora ao bot estourado para ${conv.phone} — handoff pra humano`);
    decision = { reply: null, handoff: true, mood: "neutral", handoff_reason: BOT_ABUSE_HANDOFF_REASON };
    await finalizeBotDecision(conv, decision);
    return;
  }

  const { name, details } = await buildContactContext(conv.contact_id, conv.contact_type);
  const platformContext = await buildPlatformContext();
  const context = `Nome: ${name}. Campanha: ${conv.campaign ?? "nenhuma"}. ${details} ${platformContext}`;
  const history = await getRecentMessages(conv.id, 10);

  try {
    decision = await callHaikuForDecision(context, history, lastMessageBody);
  } catch (err) {
    console.error("[wa-conv] erro ao chamar Haiku:", err instanceof Error ? err.message : String(err));
    decision = { reply: null, handoff: true, mood: "neutral", handoff_reason: "Erro ao consultar IA." };
  }

  await finalizeBotDecision(conv, decision);
}

async function finalizeBotDecision(conv: ConversationRow, decision: BotDecision): Promise<void> {
  if (decision.handoff || !decision.reply) {
    await touchConversation(conv.id, {
      status: "needs_human",
      handoff_reason: decision.handoff_reason ?? "Fora do escopo do bot.",
      mood: decision.mood,
    } as Partial<ConversationRow>);
    if (conv.status !== "needs_human") {
      const result = await sendWhatsAppText(conv.phone, HANDOFF_MESSAGE);
      if (!result.ok) console.error("[wa-conv] falha ao enviar aviso de handoff:", result.error);
      await insertMessage({
        conversation_id: conv.id,
        direction: "outbound",
        sender: "system",
        body: HANDOFF_MESSAGE,
      });

      try {
        const { data: contact } = await supabaseAdmin
          .from("profiles").select("full_name").eq("id", conv.contact_id).maybeSingle();
        const contactName = (contact as { full_name?: string } | null)?.full_name || conv.phone;

        const { data: admins } = await supabaseAdmin
          .from("profiles").select("id").eq("role", "admin");

        await Promise.all(
          ((admins ?? []) as { id: string }[]).map(admin =>
            sendPushToUser(admin.id, {
              title: "Conversa precisa de você",
              body: `${contactName}: ${decision.handoff_reason ?? "Fora do escopo do bot."}`,
              data: { type: "wa_handoff", url: `/admin/conversas?id=${conv.id}` },
            })
          )
        );
      } catch (err) {
        console.error("[wa-conv] falha ao notificar admin do handoff:", err instanceof Error ? err.message : String(err));
      }
    }
    return;
  }

  const result = await sendWhatsAppText(conv.phone, decision.reply);
  if (!result.ok) console.error("[wa-conv] falha ao enviar resposta do bot:", result.error);
  await insertMessage({
    conversation_id: conv.id,
    direction: "outbound",
    sender: "bot",
    body: decision.reply,
  });
  await touchConversation(conv.id, { mood: decision.mood } as Partial<ConversationRow>);
}
