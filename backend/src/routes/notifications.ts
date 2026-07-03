import { Router, Request, Response } from "express";
import { z } from "zod";
import { AuthRequest, requireAuth } from "../middleware/auth.js";
import { supabaseAdmin, sensitiveLimiter } from "../config.js";
import { withTimeout } from "../lib/timeout.js";
import { sendPushToUser } from "../lib/push.js";

const router = Router();

const sendEventSchema = z.object({
  event_type: z.enum([
    "lead_purchased", "proposal_sent", "proposal_accepted",
    "appointment_created", "appointment_updated",
    "appointment_cancelled", "message_sent",
  ]),
  resource_id: z.string().uuid(),
  cancelled_reason: z.string().max(500).optional(),
  message_preview: z.string().max(200).optional(),
});

router.post("/notifications/send-event", sensitiveLimiter, requireAuth, async (req: Request, res: Response) => {
  const parsed = sendEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });

  const callerId = (req as AuthRequest).authUser!.id;
  const { event_type, resource_id, cancelled_reason, message_preview } = parsed.data;

  let targetUserId: string | null = null;
  let title = "";
  let body = "";
  let data: Record<string, unknown> = {};

  try {
    if (event_type === "lead_purchased") {
      const { data: lp } = await supabaseAdmin
        .from("lead_purchases")
        .select("client_id")
        .eq("lead_id", resource_id)
        .eq("user_id", callerId)
        .maybeSingle();
      if (!lp?.client_id) return res.status(403).json({ error: "Forbidden" });
      targetUserId = lp.client_id;
      title = "Novo interesse no seu pedido!";
      body = "Um profissional tem interesse no seu pedido. Acesse para ver.";
      data = { lead_id: resource_id, type: "new_interest" };

    } else if (event_type === "proposal_sent") {
      const { data: lp } = await supabaseAdmin
        .from("lead_purchases")
        .select("client_id, user_id")
        .eq("id", resource_id)
        .maybeSingle();
      if (!lp || lp.user_id !== callerId) return res.status(403).json({ error: "Forbidden" });
      targetUserId = lp.client_id;
      title = "Nova proposta recebida! 🎉";
      body = "Um profissional enviou um orçamento. Acesse Meus Pedidos para ver.";
      data = { type: "proposal_received", purchaseId: resource_id };

    } else if (event_type === "proposal_accepted") {
      const { data: lp } = await supabaseAdmin
        .from("lead_purchases")
        .select("client_id, professional_id")
        .eq("id", resource_id)
        .maybeSingle();
      if (!lp || lp.client_id !== callerId) return res.status(403).json({ error: "Forbidden" });
      const { data: prof } = await supabaseAdmin
        .from("professionals")
        .select("user_id")
        .eq("id", lp.professional_id)
        .maybeSingle();
      targetUserId = prof?.user_id ?? null;
      title = "Interesse confirmado! 🎉";
      body = "Um cliente aceitou sua proposta. Abra o chat para iniciar o serviço.";
      data = { type: "proposal_accepted", purchaseId: resource_id };

    } else if (event_type === "appointment_created") {
      const { data: appt } = await supabaseAdmin
        .from("appointments")
        .select("client_id, professional_id, scheduled_at")
        .eq("id", resource_id)
        .maybeSingle();
      if (!appt) return res.status(403).json({ error: "Forbidden" });
      const { data: prof } = await supabaseAdmin
        .from("professionals")
        .select("user_id")
        .eq("id", appt.professional_id)
        .maybeSingle();
      if (prof?.user_id !== callerId) return res.status(403).json({ error: "Forbidden" });
      targetUserId = appt.client_id;
      const dt = new Date(appt.scheduled_at as string);
      title = "Novo agendamento";
      body = `Visita agendada para ${dt.toLocaleDateString("pt-BR")} às ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      data = { appointment_id: resource_id, type: "appointment_created" };

    } else if (event_type === "appointment_updated" || event_type === "appointment_cancelled") {
      const { data: appt } = await supabaseAdmin
        .from("appointments")
        .select("client_id, professional_id, status, proposed_at, proposed_by")
        .eq("id", resource_id)
        .maybeSingle();
      if (!appt) return res.status(403).json({ error: "Forbidden" });
      const { data: prof } = await supabaseAdmin
        .from("professionals")
        .select("user_id")
        .eq("id", appt.professional_id)
        .maybeSingle();
      const profUserId = prof?.user_id;
      const isClient = callerId === appt.client_id;
      const isProfessional = callerId === profUserId;
      if (!isClient && !isProfessional) return res.status(403).json({ error: "Forbidden" });
      targetUserId = isClient ? (profUserId ?? null) : appt.client_id;
      const apptStatus = appt.status as string | undefined;
      if (apptStatus === "cancelled") {
        title = "Agendamento cancelado";
        body = cancelled_reason ? `Motivo: ${cancelled_reason}` : "O agendamento foi cancelado.";
      } else if (apptStatus === "confirmed" && appt.proposed_at) {
        const dt = new Date(appt.proposed_at as string);
        title = "Reagendamento aceito ✅";
        body = `Nova data confirmada: ${dt.toLocaleDateString("pt-BR")} às ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`;
      } else if (apptStatus === "confirmed") {
        title = "Agendamento confirmado ✅";
        body = "Status do agendamento foi atualizado.";
      } else if (apptStatus === "rescheduled" && appt.proposed_at) {
        const dt = new Date(appt.proposed_at as string);
        const who = (appt.proposed_by as string) === "professional" ? "O profissional" : "O cliente";
        title = "Proposta de reagendamento";
        body = `${who} propôs nova data: ${dt.toLocaleDateString("pt-BR")} às ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`;
      } else if (apptStatus === "completed") {
        title = "Atendimento concluído ✅";
        body = "O atendimento foi marcado como concluído.";
      } else {
        title = "Agendamento atualizado";
        body = "Status do agendamento foi atualizado.";
      }
      // url tells the SW which agenda to open — recipient is the opposite party of the caller
      const targetUrl = isClient ? "/profissional/agenda" : "/cliente/agenda";
      data = { appointment_id: resource_id, type: event_type, url: targetUrl };

    } else if (event_type === "message_sent") {
      if (process.env.NODE_ENV !== "production") {
        console.log("[send-event] message_sent caller:", callerId, "conv:", resource_id);
      }
      const { data: conv } = await supabaseAdmin
        .from("conversations")
        .select("client_id, professional_id")
        .eq("id", resource_id)
        .maybeSingle();
      if (!conv) return res.status(403).json({ error: "Forbidden" });
      const { data: prof } = await supabaseAdmin
        .from("professionals")
        .select("user_id")
        .eq("id", conv.professional_id)
        .maybeSingle();
      const profUserId = prof?.user_id;
      const isClient = callerId === conv.client_id;
      const isProfessional = callerId === profUserId;
      if (!isClient && !isProfessional) return res.status(403).json({ error: "Forbidden" });
      targetUserId = isClient ? (profUserId ?? null) : conv.client_id;
      title = "Nova Mensagem";
      body = message_preview ?? "Você recebeu uma nova mensagem";
      // Client goes to /cliente/mensagens; professional to /profissional/mensagens (see sw.ts)
      data = { conversationId: resource_id, type: isClient ? "message" : "message_client" };
    }

    if (targetUserId) {
      void supabaseAdmin.from("notifications").insert({
        user_id: targetUserId,
        title,
        body,
        data,
        is_read: false,
      }).then(({ error: notifErr }) => {
        if (notifErr) console.error("[send-event] notification insert error:", notifErr.message);
      });
      void sendPushToUser(targetUserId, { title, body, data });
    }
    return res.json({ ok: true });
  } catch (err: unknown) {
    console.error("[send-event] error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

const notifPushSchema = z.object({
  user_id: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
});

router.post("/notifications/push", sensitiveLimiter, requireAuth, async (req: Request, res: Response) => {
  const parsed = notifPushSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });

  try {
    const callerId = (req as AuthRequest).authUser!.id;
    const targetUserId = parsed.data.user_id;

    if (callerId !== targetUserId) {
      const { data: callerProfile } = await withTimeout(
        supabaseAdmin.from("profiles").select("role").eq("id", callerId).single()
      );
      if (callerProfile?.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    void sendPushToUser(targetUserId, {
      title: parsed.data.title,
      body: parsed.data.body,
      data: parsed.data.data as Record<string, unknown> | undefined,
    });
    return res.json({ ok: true });
  } catch (err: unknown) {
    console.error("[notifications/push] erro:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

router.post("/push/subscribe", sensitiveLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = pushSubscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });
  try {
    const { endpoint, keys } = parsed.data;
    const userId = req.authUser!.id;
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert({ user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "user_id,endpoint" });
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err: unknown) {
    console.error("[push] subscribe error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao salvar subscription." });
  }
});

router.delete("/push/unsubscribe", sensitiveLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: "endpoint obrigatório." });
    const userId = req.authUser!.id;
    await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", endpoint);
    return res.json({ ok: true });
  } catch (err: unknown) {
    console.error("[push] unsubscribe error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao remover subscription." });
  }
});

export default router;
