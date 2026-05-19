import cron from "node-cron";
import { supabaseAdmin } from "../config.js";
import { sendPushToUser } from "../lib/push.js";
import { withTimeout } from "../lib/timeout.js";

type AppointmentRow = {
  id: string;
  title: string;
  scheduled_at: string;
  client_id: string;
  professional_id: string;
  reminder_sent_at: string | null;
};

type ProfessionalRow = { user_id: string };

async function runAppointmentReminderJob(): Promise<void> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const { data: appointments, error } = await withTimeout(
      supabaseAdmin
        .from("appointments")
        .select("id, title, scheduled_at, client_id, professional_id, reminder_sent_at")
        .gte("scheduled_at", windowStart.toISOString())
        .lte("scheduled_at", windowEnd.toISOString())
        .is("reminder_sent_at", null)
        .in("status", ["scheduled", "confirmed"])
    );

    if (error) {
      console.error("[appointmentReminder] query error:", error.message);
      return;
    }

    if (!appointments?.length) return;

    for (const appt of appointments as AppointmentRow[]) {
      const scheduledDate = new Date(appt.scheduled_at);
      const dateStr = scheduledDate.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });

      await sendPushToUser(appt.client_id, {
        title: "Lembrete de agendamento",
        body: `Você tem "${appt.title}" amanhã — ${dateStr}`,
        data: { appointment_id: appt.id, type: "reminder_24h" },
      });

      const { data: prof } = await withTimeout(
        supabaseAdmin
          .from("professionals")
          .select("user_id")
          .eq("id", appt.professional_id)
          .single()
      );

      if ((prof as ProfessionalRow | null)?.user_id) {
        await sendPushToUser((prof as ProfessionalRow).user_id, {
          title: "Lembrete de agendamento",
          body: `Você tem "${appt.title}" amanhã — ${dateStr}`,
          data: { appointment_id: appt.id, type: "reminder_24h_prof" },
        });
      }

      // Mark as sent to prevent duplicate reminders (idempotency guard)
      await withTimeout(
        supabaseAdmin
          .from("appointments")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", appt.id)
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[appointmentReminder] processed ${appointments.length} appointment(s)`);
    }
  } catch (err: unknown) {
    console.error("[appointmentReminder] error:", err instanceof Error ? err.message : String(err));
  }
}

export function startAppointmentReminderJob(): void {
  // Run at minute 0 of every hour
  cron.schedule("0 * * * *", () => {
    void runAppointmentReminderJob();
  });
  console.log("[appointmentReminder] job scheduled (hourly at :00)");
}
