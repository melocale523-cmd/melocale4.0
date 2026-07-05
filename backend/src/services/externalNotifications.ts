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
 * Opt-out: coluna email_new_lead em user_notification_preferences.
 */
export async function notifyProfessionalsNewLead(
  userIds: string[],
  lead: { leadTitle: string; category: string; location: string }
): Promise<void> {
  const { subject, html } = newLeadEmailTemplate(lead);
  await Promise.all(userIds.map(async (userId) => {
    try {
      const email = await getOptedInEmail(userId, "email_new_lead");
      if (!email) return;

      await sendEmail(email, subject, html);

      // WhatsApp usa o mesmo opt-out por evento (email habilitado = envia)
      const phone = await getUserPhone(userId);
      if (phone) {
        await sendWhatsAppTemplate(phone, WHATSAPP_TEMPLATES.NEW_LEAD, {
          categoria: lead.category,
          cidade: lead.location,
          titulo: lead.leadTitle,
        });
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
      await sendWhatsAppTemplate(phone, WHATSAPP_TEMPLATES.PROPOSAL_RECEIVED, {
        profissional: professionalName,
      });
    }
  } catch (err) {
    console.error(`[extern-notif] proposal_received falhou para ${clientId}:`, err instanceof Error ? err.message : String(err));
  }
}
