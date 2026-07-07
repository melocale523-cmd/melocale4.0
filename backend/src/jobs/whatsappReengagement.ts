import cron from "node-cron";
import { supabaseAdmin } from "../config.js";
import { withTimeout } from "../lib/timeout.js";
import { sendWhatsAppTemplate, normalizeBrazilianPhone, WHATSAPP_TEMPLATES } from "../services/whatsappService.js";

// Reengajamento via WhatsApp — 2 campanhas:
//   1. profissional_sem_pedido: profissional ativo, nunca comprou um lead
//   2. cliente_sem_pedido_ou_proposta: cliente sem nenhum pedido, ou com
//      proposta recebida (lead comprado) mas sem agendamento e parada há
//      alguns dias
//
// ⚠️ Os 2 templates acima foram só ESCRITOS em texto — ninguém os criou/
// submeteu no WhatsApp Manager da Meta ainda. Este job SÓ dispara de
// verdade quando a env var de aprovação correspondente estiver "true"
// (ver TEMPLATE_APPROVAL_ENV abaixo). Até lá, roda em modo dry-run: calcula
// os alvos e loga, mas não chama a Graph API.
//
// ⚠️ CONSENTIMENTO — LEIA ANTES DE MEXER:
// Para PROFISSIONAIS, este job reaproveita a MESMA regra já estabelecida
// pro template `novo_pedido_disponivel` (Marketing): só dispara pra quem
// tem user_notification_preferences.whatsapp_marketing_opt_in = true E
// whatsapp_connected = true (confirmação técnica via wa.me, feita no
// webhook). Nada novo aqui.
//
// Para CLIENTES, investigamos e NÃO existe nenhuma estrutura de
// consentimento equivalente: nenhuma UI de opt-in, nenhum onboarding step,
// e o webhook só conecta profissionais (`find_professionals_by_phone_suffix`
// é específico da tabela `professionals` — não há fluxo que jamais marque
// whatsapp_connected=true pra um cliente). A tabela
// `user_notification_preferences` é genérica por user_id (não tem FK só pra
// profissional), então TECNICAMENTE dá pra reaproveitar as mesmas colunas —
// mas como isso nunca foi usado/revisado pra clientes, e tem implicação de
// LGPD, NÃO decidimos isso sozinhos. O código abaixo:
//   - aplica a MESMA checagem opt_in && connected pra clientes também (que,
//     hoje, bloqueia 100% dos clientes na prática, já que nada liga
//     whatsapp_connected=true pra eles — é o comportamento seguro por
//     construção);
//   - além disso, exige explicitamente WHATSAPP_CLIENT_CAMPAIGNS_ENABLED=true
//     como um segundo interruptor manual, pra nunca depender só do acaso de
//     ninguém ter mexido na tabela. Sem essa env var, o disparo pra clientes
//     fica em modo dry-run mesmo que o template esteja aprovado.
export const WHATSAPP_CLIENT_CAMPAIGNS_ENV = "WHATSAPP_CLIENT_CAMPAIGNS_ENABLED";

const TEMPLATE_APPROVAL_ENV: Record<string, string> = {
  [WHATSAPP_TEMPLATES.PROFISSIONAL_SEM_PEDIDO]: "WHATSAPP_TEMPLATE_PROFISSIONAL_SEM_PEDIDO_APPROVED",
  [WHATSAPP_TEMPLATES.CLIENTE_SEM_PEDIDO_OU_PROPOSTA]: "WHATSAPP_TEMPLATE_CLIENTE_SEM_PEDIDO_OU_PROPOSTA_APPROVED",
};

function isTemplateApproved(templateName: string): boolean {
  const envVar = TEMPLATE_APPROVAL_ENV[templateName];
  return envVar ? process.env[envVar] === "true" : false;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const COOLDOWN_DAYS = envInt("WHATSAPP_CAMPAIGN_COOLDOWN_DAYS", 14);
const STALE_PROPOSAL_DAYS = envInt("WHATSAPP_STALE_PROPOSAL_DAYS", 5);
const DAILY_LIMIT = envInt("WHATSAPP_CAMPAIGN_DAILY_LIMIT", 50);

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function firstName(fullName: string | null): string {
  return fullName?.trim().split(/\s+/)[0] ?? "";
}

type ConversationRow = {
  id: string;
  phone: string;
  status: string;
  campaign: string | null;
  last_message_at: string;
};

type Candidate = {
  contactId: string;
  contactType: "professional" | "client";
  phone: string;
  fullName: string | null;
};

/** true = pode disparar; false = bloqueado (conversa em andamento ou cooldown da mesma campanha) */
function passesConversationGate(conv: ConversationRow | undefined, campaign: string): boolean {
  if (!conv) return true;
  if (conv.status !== "resolved") return false; // conversa em andamento — não interromper
  if (conv.campaign === campaign && daysSince(conv.last_message_at) < COOLDOWN_DAYS) return false;
  return true;
}

/**
 * Cria (ou atualiza) a whatsapp_conversations pro envio do template e
 * registra a mensagem outbound — equivalente ao que
 * `tagCampaignOnTemplateSend` faz em whatsappConversationService.ts (branch
 * do PR #406, ainda não mesclada). Reimplementado aqui standalone pra este
 * PR não depender/empilhar em cima do #406. Ao mesclar os dois, considerar
 * consolidar num único helper compartilhado.
 */
async function tagCampaignOnSend(params: {
  conv: ConversationRow | undefined;
  phone: string;
  contactId: string;
  contactType: "professional" | "client";
  campaign: string;
  templateName: string;
  bodyPreview: string;
}): Promise<void> {
  const { conv, phone, contactId, contactType, campaign, templateName, bodyPreview } = params;
  const nowIso = new Date().toISOString();
  let conversationId = conv?.id;

  if (conversationId) {
    await withTimeout(
      supabaseAdmin
        .from("whatsapp_conversations")
        .update({ campaign, status: "bot_active", last_message_at: nowIso })
        .eq("id", conversationId)
    );
  } else {
    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("whatsapp_conversations")
        .insert({
          phone,
          contact_id: contactId,
          contact_type: contactType,
          campaign,
          status: "bot_active",
          last_message_at: nowIso,
        })
        .select("id")
        .single()
    );
    if (error) throw new Error(`erro ao criar whatsapp_conversations: ${error.message}`);
    conversationId = (data as { id: string }).id;
  }

  const { error: msgErr } = await withTimeout(
    supabaseAdmin.from("whatsapp_messages").insert({
      conversation_id: conversationId,
      direction: "outbound",
      sender: "bot",
      body: bodyPreview,
      is_template: true,
      template_name: templateName,
    })
  );
  if (msgErr) console.error("[wa-reengage] erro ao inserir whatsapp_messages:", msgErr.message);
}

async function fetchConversationsByPhone(phones: string[]): Promise<Map<string, ConversationRow>> {
  if (!phones.length) return new Map();
  const { data, error } = await withTimeout(
    supabaseAdmin.from("whatsapp_conversations").select("id, phone, status, campaign, last_message_at").in("phone", phones)
  );
  if (error) {
    console.error("[wa-reengage] erro ao buscar whatsapp_conversations:", error.message);
    return new Map();
  }
  const map = new Map<string, ConversationRow>();
  for (const row of (data ?? []) as ConversationRow[]) map.set(row.phone, row);
  return map;
}

// --- 1. Profissionais sem nunca ter comprado um lead ---
async function targetProfissionaisSemPedido(): Promise<Candidate[]> {
  const { data: pros, error: prosErr } = await withTimeout(
    supabaseAdmin.from("professionals").select("id, user_id").eq("is_active", true)
  );
  if (prosErr) {
    console.error("[wa-reengage] erro ao buscar professionals:", prosErr.message);
    return [];
  }
  const proRows = (pros ?? []) as { id: string; user_id: string }[];
  if (!proRows.length) return [];

  const { data: purchases, error: purchasesErr } = await withTimeout(
    supabaseAdmin.from("lead_purchases").select("professional_id")
  );
  if (purchasesErr) {
    console.error("[wa-reengage] erro ao buscar lead_purchases:", purchasesErr.message);
    return [];
  }
  const withPurchase = new Set(((purchases ?? []) as { professional_id: string }[]).map(p => p.professional_id));
  const neverPurchased = proRows.filter(p => !withPurchase.has(p.id));
  if (!neverPurchased.length) return [];

  const userIds = neverPurchased.map(p => p.user_id);
  const [{ data: profiles }, { data: prefs }] = await Promise.all([
    withTimeout(supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", userIds)),
    withTimeout(supabaseAdmin.from("user_notification_preferences").select("user_id, whatsapp_marketing_opt_in, whatsapp_connected").in("user_id", userIds)),
  ]);

  const profileMap = new Map(((profiles ?? []) as { id: string; full_name: string | null; phone: string | null }[]).map(p => [p.id, p]));
  const prefMap = new Map(
    ((prefs ?? []) as { user_id: string; whatsapp_marketing_opt_in: boolean | null; whatsapp_connected: boolean | null }[]).map(p => [p.user_id, p])
  );

  const candidates: Candidate[] = [];
  for (const userId of userIds) {
    const profile = profileMap.get(userId);
    if (!profile?.phone) continue;
    const pref = prefMap.get(userId);
    // Sem linha de preferências = default do banco (opt-in true, connected false)
    const optIn = pref?.whatsapp_marketing_opt_in !== false;
    const connected = pref?.whatsapp_connected === true;
    if (!optIn || !connected) continue;
    const normalized = normalizeBrazilianPhone(profile.phone);
    if (!normalized) continue;
    candidates.push({ contactId: userId, contactType: "professional", phone: normalized, fullName: profile.full_name });
  }
  return candidates;
}

// --- 2. Clientes sem pedido, ou com proposta recebida e parada ---
async function targetClientesSemPedidoOuProposta(): Promise<Candidate[]> {
  const { data: clientProfiles, error: profilesErr } = await withTimeout(
    supabaseAdmin.from("profiles").select("id, full_name, phone").eq("role", "client")
  );
  if (profilesErr) {
    console.error("[wa-reengage] erro ao buscar profiles (clientes):", profilesErr.message);
    return [];
  }
  const clients = (clientProfiles ?? []) as { id: string; full_name: string | null; phone: string | null }[];
  if (!clients.length) return [];
  const clientIds = clients.map(c => c.id);

  const [{ data: leadsData }, { data: leadPurchasesData }, { data: appointmentsData }] = await Promise.all([
    withTimeout(supabaseAdmin.from("leads").select("id, client_id, purchases_count, updated_at").in("client_id", clientIds)),
    withTimeout(supabaseAdmin.from("lead_purchases").select("id, lead_id")),
    withTimeout(supabaseAdmin.from("appointments").select("lead_purchase_id").not("lead_purchase_id", "is", null)),
  ]);

  const leads = (leadsData ?? []) as { id: string; client_id: string; purchases_count: number; updated_at: string }[];
  const leadPurchases = (leadPurchasesData ?? []) as { id: string; lead_id: string }[];
  const apptLeadPurchaseIds = new Set(((appointmentsData ?? []) as { lead_purchase_id: string }[]).map(a => a.lead_purchase_id));

  const purchaseIdsByLead = new Map<string, string[]>();
  for (const lp of leadPurchases) {
    const arr = purchaseIdsByLead.get(lp.lead_id) ?? [];
    arr.push(lp.id);
    purchaseIdsByLead.set(lp.lead_id, arr);
  }

  const leadsByClient = new Map<string, typeof leads>();
  for (const lead of leads) {
    const arr = leadsByClient.get(lead.client_id) ?? [];
    arr.push(lead);
    leadsByClient.set(lead.client_id, arr);
  }

  const eligibleClientIds = new Set<string>();
  for (const clientId of clientIds) {
    const clientLeads = leadsByClient.get(clientId) ?? [];
    if (clientLeads.length === 0) {
      eligibleClientIds.add(clientId); // nunca criou pedido
      continue;
    }
    const hasStaleProposal = clientLeads.some(lead => {
      if (lead.purchases_count <= 0) return false; // sem proposta
      const purchaseIds = purchaseIdsByLead.get(lead.id) ?? [];
      const hasAppointment = purchaseIds.some(id => apptLeadPurchaseIds.has(id));
      if (hasAppointment) return false; // proposta virou agendamento
      return daysSince(lead.updated_at) >= STALE_PROPOSAL_DAYS;
    });
    if (hasStaleProposal) eligibleClientIds.add(clientId);
  }
  if (!eligibleClientIds.size) return [];

  const { data: prefs } = await withTimeout(
    supabaseAdmin
      .from("user_notification_preferences")
      .select("user_id, whatsapp_marketing_opt_in, whatsapp_connected")
      .in("user_id", Array.from(eligibleClientIds))
  );
  const prefMap = new Map(
    ((prefs ?? []) as { user_id: string; whatsapp_marketing_opt_in: boolean | null; whatsapp_connected: boolean | null }[]).map(p => [p.user_id, p])
  );

  const candidates: Candidate[] = [];
  for (const client of clients) {
    if (!eligibleClientIds.has(client.id) || !client.phone) continue;
    const pref = prefMap.get(client.id);
    const optIn = pref?.whatsapp_marketing_opt_in !== false;
    const connected = pref?.whatsapp_connected === true; // hoje, nunca true pra cliente (nenhum fluxo conecta)
    if (!optIn || !connected) continue;
    const normalized = normalizeBrazilianPhone(client.phone);
    if (!normalized) continue;
    candidates.push({ contactId: client.id, contactType: "client", phone: normalized, fullName: client.full_name });
  }
  return candidates;
}

async function runCampaign(
  campaignName: string,
  templateName: string,
  candidates: Candidate[],
  remainingBudget: number,
  clientCampaignsGate: boolean
): Promise<{ sent: number; skippedOptIn: number; skippedCooldown: number; skippedDryRun: number }> {
  let sent = 0;
  let skippedCooldown = 0;
  const skippedOptIn = 0; // já filtrado em targetX (mantido por clareza no log)

  const approved = isTemplateApproved(templateName);
  const isClientCampaign = candidates.some(c => c.contactType === "client");
  const dryRun = !approved || (isClientCampaign && !clientCampaignsGate);

  if (!approved) {
    console.log(`[wa-reengage] ${campaignName}: template "${templateName}" ainda não aprovado (${TEMPLATE_APPROVAL_ENV[templateName]} != "true") — dry-run, ${candidates.length} candidato(s) computado(s), nenhum envio real.`);
  } else if (isClientCampaign && !clientCampaignsGate) {
    console.log(`[wa-reengage] ${campaignName}: template aprovado mas ${WHATSAPP_CLIENT_CAMPAIGNS_ENV} != "true" (decisão de consentimento de cliente pendente) — dry-run, ${candidates.length} candidato(s) computado(s), nenhum envio real.`);
  }

  const conversations = await fetchConversationsByPhone(candidates.map(c => c.phone));
  let skippedDryRun = 0;

  for (const candidate of candidates) {
    if (sent >= remainingBudget) break;
    const conv = conversations.get(candidate.phone);
    if (!passesConversationGate(conv, campaignName)) {
      skippedCooldown++;
      continue;
    }
    if (dryRun) {
      skippedDryRun++;
      continue;
    }

    const variables = [firstName(candidate.fullName)];
    const result = await sendWhatsAppTemplate(candidate.phone, templateName, variables);
    if (!result.ok) {
      console.error(`[wa-reengage] ${campaignName}: falha ao enviar pra ${candidate.phone}:`, result.error);
      continue;
    }
    try {
      await tagCampaignOnSend({
        conv,
        phone: candidate.phone,
        contactId: candidate.contactId,
        contactType: candidate.contactType,
        campaign: campaignName,
        templateName,
        bodyPreview: `[template ${templateName}] enviado para ${firstName(candidate.fullName) || "contato"}`,
      });
    } catch (err) {
      console.error(`[wa-reengage] ${campaignName}: falha ao registrar conversa/mensagem pra ${candidate.phone}:`, err instanceof Error ? err.message : String(err));
    }
    sent++;
  }

  return { sent, skippedOptIn, skippedCooldown, skippedDryRun };
}

export async function runWhatsappReengagement(): Promise<void> {
  console.log("[wa-reengage] iniciando disparo de reengajamento...");
  const clientCampaignsGate = process.env[WHATSAPP_CLIENT_CAMPAIGNS_ENV] === "true";

  try {
    const [proCandidates, clientCandidates] = await Promise.all([
      targetProfissionaisSemPedido(),
      targetClientesSemPedidoOuProposta(),
    ]);

    let budgetLeft = DAILY_LIMIT;

    const proResult = await runCampaign(
      WHATSAPP_TEMPLATES.PROFISSIONAL_SEM_PEDIDO,
      WHATSAPP_TEMPLATES.PROFISSIONAL_SEM_PEDIDO,
      proCandidates,
      budgetLeft,
      clientCampaignsGate
    );
    budgetLeft -= proResult.sent;

    const clientResult = await runCampaign(
      WHATSAPP_TEMPLATES.CLIENTE_SEM_PEDIDO_OU_PROPOSTA,
      WHATSAPP_TEMPLATES.CLIENTE_SEM_PEDIDO_OU_PROPOSTA,
      clientCandidates,
      Math.max(0, budgetLeft),
      clientCampaignsGate
    );

    console.log(
      `[wa-reengage] concluído — ${WHATSAPP_TEMPLATES.PROFISSIONAL_SEM_PEDIDO}: ${proResult.sent} enviado(s), ${proResult.skippedCooldown} pulado(s) (conversa ativa/cooldown), ${proResult.skippedDryRun} pulado(s) (dry-run) de ${proCandidates.length} elegível(is) por opt-in. ` +
      `${WHATSAPP_TEMPLATES.CLIENTE_SEM_PEDIDO_OU_PROPOSTA}: ${clientResult.sent} enviado(s), ${clientResult.skippedCooldown} pulado(s) (conversa ativa/cooldown), ${clientResult.skippedDryRun} pulado(s) (dry-run) de ${clientCandidates.length} elegível(is) por opt-in. ` +
      `Teto diário: ${DAILY_LIMIT}.`
    );
  } catch (err) {
    console.error("[wa-reengage] erro geral:", err instanceof Error ? err.message : String(err));
  }
}

export function startWhatsappReengagementJob(): void {
  // Roda todo dia às 10:00 horário de Brasília (= 13:00 UTC)
  cron.schedule("0 13 * * *", () => {
    void runWhatsappReengagement();
  });
  console.log("[wa-reengage] job agendado (diário às 13:00 UTC / 10:00 BRT)");
}
