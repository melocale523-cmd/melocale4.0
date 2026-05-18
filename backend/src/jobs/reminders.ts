import { supabaseAdmin } from "../config.js";
import { withTimeout } from "../lib/timeout.js";
import { sendPushToUser } from "../lib/push.js";

export async function jobLembrete24h() {
  try {
    const { data: appointments, error } = await withTimeout(
      supabaseAdmin
        .from("appointments")
        .select("id, title, scheduled_at, client_id, professional_id, professionals!inner(user_id)")
        .in("status", ["confirmed", "scheduled"])
        .gte("scheduled_at", new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString())
        .lte("scheduled_at", new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString())
    );

    if (error) {
      console.error("[job] lembrete24h query error:", error.message);
      return;
    }

    for (const apt of appointments ?? []) {
      const profUserId = (apt.professionals as unknown as { user_id: string } | null)?.user_id;

      // INSERT ON CONFLICT DO NOTHING via unique partial index notifications_reminder_dedup.
      const { error: clientNotifErr } = await withTimeout(
        supabaseAdmin.from("notifications").insert({
          user_id: apt.client_id,
          title: "⏰ Lembrete de agendamento",
          body: `Seu agendamento "${apt.title}" é amanhã. Confirme sua disponibilidade.`,
          data: { appointment_id: apt.id, type: "reminder_24h" },
        })
      );
      if (!clientNotifErr) {
        void sendPushToUser(apt.client_id, {
          title: "⏰ Lembrete de agendamento",
          body: `Seu agendamento "${apt.title}" é amanhã. Confirme sua disponibilidade.`,
          data: { appointment_id: apt.id, type: "reminder_24h" },
        });
      } else if ((clientNotifErr as { code?: string }).code !== "23505") {
        console.error("[job] lembrete24h client notif error:", clientNotifErr.message);
      }

      if (profUserId) {
        const { error: profNotifErr } = await withTimeout(
          supabaseAdmin.from("notifications").insert({
            user_id: profUserId,
            title: "⏰ Lembrete de agendamento",
            body: `Você tem o agendamento "${apt.title}" amanhã. Prepare-se!`,
            data: { appointment_id: apt.id, type: "reminder_24h_prof" },
          })
        );
        if (!profNotifErr) {
          void sendPushToUser(profUserId, {
            title: "⏰ Lembrete de agendamento",
            body: `Você tem o agendamento "${apt.title}" amanhã. Prepare-se!`,
            data: { appointment_id: apt.id, type: "reminder_24h_prof" },
          });
        } else if ((profNotifErr as { code?: string }).code !== "23505") {
          console.error("[job] lembrete24h prof notif error:", profNotifErr.message);
        }
      }
    }
  } catch (err) {
    console.error("[job] lembrete24h error:", err instanceof Error ? err.message : String(err));
  }
}

export function startJobs() {
  setInterval(jobLembrete24h, 60 * 60 * 1000);
  void jobLembrete24h();
  console.log("[job] lembrete24h iniciado");
}
