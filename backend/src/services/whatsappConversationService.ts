import { supabaseAdmin, anthropic } from "../config.js";
import { withTimeout } from "../lib/timeout.js";
import { sendWhatsAppText } from "./whatsappService.js";

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
    return {
      name,
      details: `Tipo: profissional. Categoria: ${ctx.category ?? "não informada"}. Cidade: ${ctx.city ?? "não informada"}. Leads comprados: ${ctx.leads_purchased}.`,
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
    return {
      name,
      details: `Tipo: cliente. Cidade: ${ctx.city ?? "não informada"}. Pedidos criados: ${ctx.total_leads}. Agendamentos: ${ctx.total_appointments}.`,
    };
  }

  return { name, details: "Tipo de contato desconhecido." };
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

const BOT_SYSTEM_PROMPT = `Você é o Assistente MeloCalé, plataforma de serviços domésticos no interior da Bahia, atendendo por WhatsApp.
Responda dúvidas de uso da plataforma (como criar pedido, como ver proposta, como funcionam as moedas, como contratar um profissional, etc.) de forma direta e útil, em português informal mas profissional.
Se a dúvida for algo que você não consegue responder com segurança (problema técnico, cobrança, reclamação, disputa, ou qualquer coisa fora do escopo de uso básico da plataforma), não tente resolver: sinalize handoff.

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

CONTATO DESCONHECIDO: se o contexto do contato indicar "Tipo de contato desconhecido" (número não corresponde a nenhum cadastro) e o histórico da conversa tiver poucas mensagens (menos de 3), pergunte educadamente, antes de entrar em detalhes: "Você quer contratar um profissional (cliente) ou se cadastrar pra prestar serviço (profissional)?" — e adapte a resposta seguinte com base nisso. NÃO repita essa pergunta se ela já foi feita ou respondida no histórico da conversa.

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
  const { name, details } = await buildContactContext(conv.contact_id, conv.contact_type);
  const context = `Nome: ${name}. Campanha: ${conv.campaign ?? "nenhuma"}. ${details}`;
  const history = await getRecentMessages(conv.id, 10);

  let decision: BotDecision;
  try {
    decision = await callHaikuForDecision(context, history, lastMessageBody);
  } catch (err) {
    console.error("[wa-conv] erro ao chamar Haiku:", err instanceof Error ? err.message : String(err));
    decision = { reply: null, handoff: true, mood: "neutral", handoff_reason: "Erro ao consultar IA." };
  }

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
