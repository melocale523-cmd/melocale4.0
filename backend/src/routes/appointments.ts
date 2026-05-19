import { Router, Response } from "express";
import { supabaseAdmin } from "../config.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { sendPushToUser } from "../lib/push.js";
import { withTimeout } from "../lib/timeout.js";

const router = Router();

// PATCH /api/appointments/:id/confirm
// Client confirms physical presence for an upcoming appointment.
// Changes status: 'scheduled' | 'rescheduled' → 'confirmed'
// Sets confirmed_at and sends push to the professional.
router.patch("/appointments/:id/confirm", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.authUser!.id;

    const { data: appt, error: fetchErr } = await withTimeout(
      supabaseAdmin
        .from("appointments")
        .select("id, status, scheduled_at, client_id, professional_id, confirmed_at")
        .eq("id", id)
        .single()
    );

    if (fetchErr || !appt) {
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }

    if (appt.client_id !== userId) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    if (appt.status !== "scheduled" && appt.status !== "rescheduled") {
      return res.status(400).json({
        error: "Apenas agendamentos pendentes ou reagendados podem ter presença confirmada.",
      });
    }

    if (new Date(appt.scheduled_at) <= new Date()) {
      return res.status(400).json({ error: "Não é possível confirmar um agendamento que já passou." });
    }

    if (appt.confirmed_at) {
      return res.status(400).json({ error: "Presença já confirmada." });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await withTimeout(
      supabaseAdmin
        .from("appointments")
        .update({ status: "confirmed", confirmed_at: now, updated_at: now })
        .eq("id", id)
        .select()
        .single()
    );

    if (updateErr || !updated) {
      return res.status(500).json({ error: "Erro ao confirmar presença." });
    }

    const { data: prof } = await withTimeout(
      supabaseAdmin
        .from("professionals")
        .select("user_id")
        .eq("id", appt.professional_id)
        .single()
    );

    if (prof?.user_id) {
      void sendPushToUser(prof.user_id as string, {
        title: "Presença confirmada!",
        body: "O cliente confirmou presença para o agendamento.",
        data: { appointment_id: id, type: "presence_confirmed" },
      });
    }

    return res.json(updated);
  } catch (err: unknown) {
    console.error("[appointments] PATCH /confirm error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno ao confirmar presença." });
  }
});

export default router;
