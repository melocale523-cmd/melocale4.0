import { supabaseAdmin } from "../config.js";
import {
  sendEmail,
  getOptedInEmail,
  newLeadEmailTemplate,
  proposalReceivedEmailTemplate,
} from "./emailService.js";
import {
  sendWhatsAppTemplate,
  normalizeBrazilianPhone,
  WHATSAPP_TEMPLATES,
} from "./whatsappService.js";

// Canais externos (email + WhatsApp) disparados nos mesmos pontos das
// notificações in-app. Tudo best-effort: nenhuma falha aqui pode quebrar
// o fluxo principal — sempre chamar com `void notifyX(...).catch(...)`
// ou confiar que as funções não lançam.

async function getUserPhone(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("phone")
    .eq("id", userId)
    .maybeSingle();
  return normalizeBrazilianPhone(data?.phone);
}

/**
 * Novo pedido na categoria/cidade → notifica profissionais por email e
 * WhatsApp (mesmo ponto da notificação in-app de lead).
 * Email: opt-out via email_new_lead.
 * WhatsApp: template Marketing — exige whatsapp_marketing_opt_in = true
 * (consentimento no cadastro) E whatsapp_connected = true (confirmação
 * técnica via webhook).
 */
export async function notifyProfessionalsNewLead(
  userIds: string[],
  lead: { leadTitle: string; category: string; location: string }
): Promise<void> {
  const { subject, html } = newLeadEmailTemplate(lead);
  await Promise.all(userIds.map(async (userId) => {
    try {
      const email = await getOptedInEmail(userId, "email_new_lead");
      if (email) await sendEmail(email, subject, html);

      const { data: pref } = await supabaseAdmin
        .from("user_notification_preferences")
        .select("whatsapp_marketing_opt_in, whatsapp_connected")
        .eq("user_id", userId)
        .maybeSingle();
      const row = pref as { whatsapp_marketing_opt_in?: boolean | null; whatsapp_connected?: boolean | null } | null;
      const whatsappAllowed = row?.whatsapp_marketing_opt_in === true && row?.whatsapp_connected === true;
      if (!whatsappAllowed) return;

      const phone = await getUserPhone(userId);
      if (phone) {
        // {{1}}=categoria, {{2}}=cidade, {{3}}=descrição
        await sendWhatsAppTemplate(phone, WHATSAPP_TEMPLATES.NEW_LEAD, [
          lead.category,
          lead.location,
          lead.leadTitle,
        ]);
      }
    } catch (err) {
      console.error(`[extern-notif] new_lead falhou para ${userId}:`, err instanceof Error ? err.message : String(err));
    }
  }));
}

/**
 * Proposta recebida → notifica o cliente por email e WhatsApp.
 * Opt-out: coluna email_messages em user_notification_preferences
 * (não existe coluna específica de proposta na tabela).
 */
export async function notifyClientProposalReceived(
  clientId: string,
  professionalName: string
): Promise<void> {
  try {
    const email = await getOptedInEmail(clientId, "email_messages");
    if (!email) return;

    const { subject, html } = proposalReceivedEmailTemplate({ professionalName });
    await sendEmail(email, subject, html);

    const phone = await getUserPhone(clientId);
    if (phone) {
      // {{1}}=nome do profissional
      await sendWhatsAppTemplate(phone, WHATSAPP_TEMPLATES.PROPOSAL_RECEIVED, [professionalName]);
    }
  } catch (err) {
    console.error(`[extern-notif] proposal_received falhou para ${clientId}:`, err instanceof Error ? err.message : String(err));
  }
}
