// Env vars lidas em tempo de chamada (não no import) para que o serviço
// funcione tanto no servidor quanto em scripts standalone (smoke-test),
// sem depender do config.ts — que exige Stripe/Supabase/Anthropic no boot.
const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

function getCredentials(): { accessToken: string; phoneNumberId: string } {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  };
}

export type WhatsAppSendResult =
  | { ok: true; messageId: string; response: unknown }
  | { ok: false; error: string; response?: unknown };

function whatsappConfigured(): boolean {
  const { accessToken, phoneNumberId } = getCredentials();
  return Boolean(accessToken && phoneNumberId);
}

/**
 * Normaliza telefone BR para E.164 sem "+" (formato aceito pela Cloud API).
 * Ex.: "(11) 98888-7777" → "5511988887777". Retorna null se inválido.
 */
export function normalizeBrazilianPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Já com DDI 55 (12–13 dígitos: 55 + DDD + 8/9 dígitos)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  // DDD + número (10–11 dígitos)
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}

async function postToGraphApi(payload: Record<string, unknown>): Promise<WhatsAppSendResult> {
  if (!whatsappConfigured()) {
    return { ok: false, error: "WhatsApp não configurado (env vars ausentes)" };
  }
  const { accessToken, phoneNumberId } = getCredentials();
  try {
    const res = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const graphError = (body as { error?: { message?: string } } | null)?.error?.message;
      const error = graphError ?? `Graph API HTTP ${res.status}`;
      console.error("[whatsapp] erro Graph API:", error);
      return { ok: false, error, response: body };
    }
    const messageId =
      (body as { messages?: { id?: string }[] } | null)?.messages?.[0]?.id ?? "";
    return { ok: true, messageId, response: body };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[whatsapp] exceção ao chamar Graph API:", error);
    return { ok: false, error };
  }
}

/**
 * Mensagem de texto simples — só funciona dentro da janela de 24h de
 * atendimento (usuário mandou mensagem antes). Usada para smoke-test.
 */
export async function sendWhatsAppText(to: string, body: string): Promise<WhatsAppSendResult> {
  return postToGraphApi({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body },
  });
}

/**
 * Mensagem via template aprovado pela Meta (funciona fora da janela 24h).
 * `variables` são os parâmetros POSICIONAIS do body ({{1}}, {{2}}, ...),
 * na ordem definida no template submetido à Meta.
 * Early-return silencioso se as env vars não estão configuradas — nunca
 * quebra o fluxo principal.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  variables: string[]
): Promise<WhatsAppSendResult> {
  if (!whatsappConfigured()) {
    return { ok: false, error: "WhatsApp não configurado (env vars ausentes)" };
  }
  const parameters = variables.map((text) => ({
    type: "text" as const,
    text,
  }));
  return postToGraphApi({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: parameters.length ? [{ type: "body", parameters }] : [],
    },
  });
}

/**
 * Marca a mensagem inbound como lida (✓✓ azul) e mostra o indicador de
 * "digitando..." por até 25s (ou até a resposta ser enviada, o que vier
 * primeiro) — ajuda a mascarar a latência real do fluxo (debounce + Haiku).
 * Não tem contrapartida de "online"/"visto por último": a Cloud API de
 * Business não expõe presença, isso é exclusivo de contas pessoais.
 */
export async function markReadWithTyping(messageId: string): Promise<WhatsAppSendResult> {
  const result = await postToGraphApi({
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
    typing_indicator: { type: "text" },
  });
  return result.ok ? { ...result, messageId } : result;
}

// --- Nomes dos templates (submissão na Meta, categoria Utility, pt_BR) ---
export const WHATSAPP_TEMPLATES = {
  NEW_LEAD: "novo_pedido_disponivel",
  PROPOSAL_RECEIVED: "proposta_recebida",
  // Reengajamento (ver backend/src/jobs/whatsappReengagement.ts). O job
  // verifica WHATSAPP_TEMPLATE_*_APPROVED antes de disparar.
  // Categoria Marketing, tipo Padrão, sem cabeçalho/rodapé, com botão de
  // resposta rápida ("Sim, quero saber" / "Sim, me ajuda" — ver
  // whatsappWebhook.ts pro tratamento do clique via payload `interactive`).
  //
  // `profissional_sem_pedido` (sem sufixo) teve conflito de exclusão no
  // WhatsApp Manager e precisou ser recriado como `profissional_sem_pedido_v2_`
  // (com underscore final — confirmado no WhatsApp Manager; sem ele a Meta
  // rejeita com #132001 "Template name does not exist in the translation")
  // — o nome do template na Meta mudou, mas o valor da campanha/cooldown em
  // whatsapp_conversations.campaign usa esta mesma constante, então não há
  // nada mais pra atualizar manualmente.
  PROFISSIONAL_SEM_PEDIDO: "profissional_sem_pedido_v2_",
  CLIENTE_SEM_PEDIDO_OU_PROPOSTA: "cliente_sem_pedido_ou_proposta",
  // Reversão automática de handoff travado (ver handoffTimeout.ts) — avisa o
  // contato fora da janela de 24h que o time pode estar sem responder, mas
  // o bot pode ajudar nesse meio tempo. Gated por
  // WHATSAPP_TEMPLATE_RETOMADA_ATENDIMENTO_APPROVED — mesma cautela já
  // registrada acima sobre PROFISSIONAL_SEM_PEDIDO: confirmar o nome exato
  // aprovado no WhatsApp Manager antes de ativar, pode sair diferente do
  // que foi submetido.
  RETOMADA_ATENDIMENTO: "retomada_atendimento_bot",
  // Divulgação do programa de indicação — disparado manualmente via
  // /admin/suporte (ver BROADCASTABLE_TEMPLATES abaixo), não por job
  // automatizado. Nome usado nas mensagens de teste desta sessão; ainda não
  // submetido/confirmado no WhatsApp Manager — mesma cautela de sempre.
  DIVULGACAO_INDICACAO: "divulgacao_indicacao_v1",
} as const;

// Templates habilitados pra disparo em massa via /admin (broadcast),
// distinto dos templates de notificação individual/reengajamento acima.
// Cada entrada só fica disponível na UI depois que a env var
// correspondente estiver "true" — mesmo padrão de segurança já usado
// pros templates de reengajamento e retomada de handoff.
export const BROADCASTABLE_TEMPLATES: Record<string, { templateName: string; envGate: string; label: string }> = {
  divulgacao_indicacao: {
    templateName: WHATSAPP_TEMPLATES.DIVULGACAO_INDICACAO,
    envGate: "WHATSAPP_TEMPLATE_DIVULGACAO_INDICACAO_APPROVED",
    label: "Divulgação do programa de indicação",
  },
};
