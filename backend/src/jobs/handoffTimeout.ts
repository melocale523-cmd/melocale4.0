import cron from "node-cron";
import { runTrackedJob } from "../lib/automationJobs.js";
import { supabaseAdmin } from "../config.js";
import { sendTelegram } from "../lib/telegram.js";
import { sendPushToUser } from "../lib/push.js";
import { sendWhatsAppTemplate, WHATSAPP_TEMPLATES } from "../services/whatsappService.js";

const ESCALATION_HOURS = 2;
const AUTO_REVERT_HOURS = 24;

interface StaleConversation {
  id: string;
  phone: string;
  contact_id: string | null;
  handoff_reason: string | null;
  last_message_at: string;
}

// Mesmo padrão de firstName() em whatsappReengagement.ts — o template exige
// {{1}} preenchido, então "você" é o fallback pra contato sem nome salvo
// (ainda não conhecido) em vez de deixar vazio (a Meta rejeitaria).
async function getContactFirstName(contactId: string | null): Promise<string> {
  if (!contactId) return "você";
  const { data } = await supabaseAdmin.from("profiles").select("full_name").eq("id", contactId).maybeSingle();
  const fullName = (data as { full_name?: string | null } | null)?.full_name;
  return fullName?.trim().split(/\s+/)[0] || "você";
}

async function checkStaleHandoffs(): Promise<void> {
  try {
    const escalationCutoff = new Date(Date.now() - ESCALATION_HOURS * 60 * 60 * 1000).toISOString();
    const revertCutoff = new Date(Date.now() - AUTO_REVERT_HOURS * 60 * 60 * 1000).toISOString();

    // Estágio 1 (2h): só avisa — não mexe no status. handoff_escalated_at
    // IS NULL garante que o alerta dispara uma vez só por handoff, não a
    // cada 15min enquanto continuar parada.
    const { data: toEscalate } = await supabaseAdmin
      .from("whatsapp_conversations")
      .select("id, phone, handoff_reason, last_message_at")
      .eq("status", "needs_human")
      .lt("last_message_at", escalationCutoff)
      .is("handoff_escalated_at", null);

    if (toEscalate?.length) {
      const { data: admins } = await supabaseAdmin.from("profiles").select("id").eq("role", "admin");
      const adminIds = ((admins ?? []) as { id: string }[]).map((a) => a.id);

      for (const conv of toEscalate as StaleConversation[]) {
        await Promise.all(
          adminIds.map((adminId) =>
            sendPushToUser(adminId, {
              title: "⏰ Conversa esperando há 2h+",
              body: `${conv.phone}: ${conv.handoff_reason ?? "sem motivo registrado"}`,
              data: { type: "wa_handoff", url: `/admin/conversas?id=${conv.id}` },
            })
          )
        );
        void sendTelegram(`⏰ Conversa esperando resposta humana há mais de 2h: ${conv.phone}`);

        const { error } = await supabaseAdmin
          .from("whatsapp_conversations")
          .update({ handoff_escalated_at: new Date().toISOString() })
          .eq("id", conv.id);
        if (error) console.error("[handoffTimeout] erro ao marcar escalonamento:", error.message);
      }
    }

    // Estágio 2 (24h): volta pro bot. Nota: last_message_at marca a última
    // mensagem do CONTATO (é o que dispara o handoff) — a esta altura já
    // se passaram 24h dela, ou seja, a janela de atendimento de 24h do
    // WhatsApp provavelmente já fechou. Texto livre (sendWhatsAppText) só
    // funciona DENTRO dessa janela, por isso o aviso ao contato só é
    // tentado via template aprovado (funciona fora da janela) — e só se
    // WHATSAPP_TEMPLATE_RETOMADA_ATENDIMENTO_APPROVED === "true". Enquanto
    // não estiver aprovado, a reversão de status acontece normalmente
    // (sempre funciona), só não tenta mandar mensagem nenhuma — mais
    // seguro que tentar texto livre que sabidamente falha fora da janela.
    const { data: toRevert } = await supabaseAdmin
      .from("whatsapp_conversations")
      .select("id, phone, contact_id")
      .eq("status", "needs_human")
      .lt("last_message_at", revertCutoff);

    for (const conv of (toRevert ?? []) as Pick<StaleConversation, "id" | "phone" | "contact_id">[]) {
      const { error } = await supabaseAdmin
        .from("whatsapp_conversations")
        .update({ status: "bot_active", handoff_reason: null, handoff_escalated_at: null })
        .eq("id", conv.id);
      if (error) {
        console.error("[handoffTimeout] erro ao reverter pro bot:", error.message);
        continue;
      }

      if (process.env.WHATSAPP_TEMPLATE_RETOMADA_ATENDIMENTO_APPROVED === "true") {
        const firstName = await getContactFirstName(conv.contact_id);
        const result = await sendWhatsAppTemplate(conv.phone, WHATSAPP_TEMPLATES.RETOMADA_ATENDIMENTO, [firstName]);
        if (!result.ok) {
          console.error(`[handoffTimeout] falha ao enviar template retomada_atendimento_bot pra ${conv.phone}:`, result.error);
        }
      } else {
        console.warn(`[handoffTimeout] template retomada_atendimento_bot ainda não aprovado — revertendo status sem notificar ${conv.phone}`);
      }
    }
  } catch (err) {
    console.error("[handoffTimeout] erro inesperado:", err instanceof Error ? err.message : String(err));
  }
}

export function startHandoffTimeoutJob(): void {
  cron.schedule("*/15 * * * *", () => {
    void runTrackedJob("handoff_timeout", checkStaleHandoffs);
  });
  console.log("[handoffTimeout] job agendado (a cada 15 minutos)");
}
