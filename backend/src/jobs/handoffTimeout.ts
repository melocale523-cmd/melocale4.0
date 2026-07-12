import cron from "node-cron";
import { supabaseAdmin } from "../config.js";
import { sendTelegram } from "../lib/telegram.js";
import { sendPushToUser } from "../lib/push.js";
import { sendWhatsAppText } from "../services/whatsappService.js";

const ESCALATION_HOURS = 2;
const AUTO_REVERT_HOURS = 24;

interface StaleConversation {
  id: string;
  phone: string;
  handoff_reason: string | null;
  last_message_at: string;
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
    // WhatsApp provavelmente já fechou. sendWhatsAppText só funciona DENTRO
    // dessa janela, então este aviso é best-effort: se falhar (esperado,
    // não é bug), a reversão de status já aconteceu de qualquer forma —
    // só não dá pra avisar o contato por enquanto (precisaria de template
    // aprovado pela Meta pra alcançar fora da janela, como em
    // whatsappReengagement.ts).
    const { data: toRevert } = await supabaseAdmin
      .from("whatsapp_conversations")
      .select("id, phone")
      .eq("status", "needs_human")
      .lt("last_message_at", revertCutoff);

    for (const conv of (toRevert ?? []) as Pick<StaleConversation, "id" | "phone">[]) {
      const { error } = await supabaseAdmin
        .from("whatsapp_conversations")
        .update({ status: "bot_active", handoff_reason: null, handoff_escalated_at: null })
        .eq("id", conv.id);
      if (error) {
        console.error("[handoffTimeout] erro ao reverter pro bot:", error.message);
        continue;
      }

      const result = await sendWhatsAppText(
        conv.phone,
        "Oi! Peço desculpa pela demora — nosso time pode estar sem conseguir responder agora. Enquanto isso, posso ajudar com dúvidas sobre a plataforma, preços, ou como funciona. É só perguntar! 😊"
      );
      if (!result.ok) {
        console.warn(`[handoffTimeout] aviso de reversão não entregue (esperado se fora da janela de 24h): ${conv.phone} — ${result.error}`);
      }
    }
  } catch (err) {
    console.error("[handoffTimeout] erro inesperado:", err instanceof Error ? err.message : String(err));
  }
}

export function startHandoffTimeoutJob(): void {
  cron.schedule("*/15 * * * *", () => {
    void checkStaleHandoffs();
  });
  console.log("[handoffTimeout] job agendado (a cada 15 minutos)");
}
