import { Router, Response } from "express";
import { z } from "zod";
import { AuthRequest, requireAuth } from "../middleware/auth.js";
import { supabaseAdmin, sensitiveLimiter } from "../config.js";
import { withTimeout } from "../lib/timeout.js";
import { sendPushToUser } from "../lib/push.js";
import { sendMetaEvent } from "../lib/metaPixel.js";

const router = Router();

function calcLeadPriceCoins(budgetMax: number, urgency: string): number {
  let base: number;
  if (budgetMax <= 500)        base = 10;
  else if (budgetMax <= 2000)  base = 20;
  else if (budgetMax <= 10000) base = 40;
  else                          base = 80;

  if (urgency === "hoje") return Math.ceil(base * 1.5);
  return base;
}

const createLeadSchema = z.object({
  title:       z.string().min(1).max(200),
  category:    z.string().min(1).max(100),
  description: z.string().max(2000).optional().default(""),
  location:    z.string().min(1).max(200),
  budget_min:  z.number().min(0),
  budget_max:  z.number().min(0),
  images:      z.array(z.string().url()).max(10).optional().default([]),
  metadata:    z.record(z.string(), z.string()).optional().default({}),
});

router.post("/leads", sensitiveLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = createLeadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });

  try {
    const userId = req.authUser!.id;
    const { title, category, description, location, budget_min, budget_max, images, metadata } = parsed.data;
    const urgency = metadata.urgency ?? "sem_pressa";
    const price_coins = calcLeadPriceCoins(budget_max, urgency);

    const { data: categoryData } = await withTimeout(
      supabaseAdmin
        .from("categories")
        .select("id")
        .ilike("name", category)
        .single()
    );
    const categoryId = categoryData?.id ?? null;

    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("leads")
        .insert({
          title,
          category,
          category_id:     categoryId,
          description,
          location,
          budget_min,
          budget_max,
          images,
          metadata,
          client_id:       userId,
          status:          "open",
          price_coins,
          max_purchases:   5,
          purchases_count: 0,
          visualizacoes:   0,
        })
        .select()
        .single()
    );

    if (error) throw error;
    if (process.env.NODE_ENV !== "production") {
      console.log(`[leads] criado: id=${data.id} price_coins=${price_coins} budget_max=${budget_max} urgency=${urgency}`);
    }

    console.log('[leads] disparando Lead para:', req.authUser!.email);
    void sendMetaEvent({
      eventName: "Lead",
      eventSourceUrl: "https://www.melocale.com.br/dashboard",
      userEmail: req.authUser!.email,
      customData: { content_category: category ?? "geral" },
    });

    return res.status(201).json(data);
  } catch (err: unknown) {
    console.error('/api/leads POST error:', JSON.stringify(err) , err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno ao criar pedido." });
  }
});

const updateLeadSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  images:      z.array(z.string().url()).max(10).optional(),
  metadata:    z.record(z.string(), z.string()).optional(),
});

router.patch("/leads/:id", sensitiveLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = updateLeadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });

  try {
    const userId = req.authUser!.id;
    const leadId = req.params.id;

    const { data: existing, error: fetchErr } = await withTimeout(
      supabaseAdmin.from("leads").select("client_id").eq("id", leadId).maybeSingle()
    );
    if (fetchErr || !existing) return res.status(404).json({ error: "Pedido não encontrado." });
    if (existing.client_id !== userId) return res.status(403).json({ error: "Não autorizado." });

    const updates = parsed.data;
    const { error } = await withTimeout(
      supabaseAdmin.from("leads").update(updates).eq("id", leadId)
    );
    if (error) throw error;

    return res.json({ ok: true });
  } catch (err: unknown) {
    console.error("/api/leads PATCH error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno ao atualizar pedido." });
  }
});

const solicitarOrcamentoSchema = z.object({
  professional_id:      z.string().uuid(),
  professional_name:    z.string().max(100).optional().default(""),
  title:       z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  category:    z.string().min(1).max(100),
  city:        z.string().max(200).optional().default(""),
  budget_min:  z.number().min(0).nullable().optional(),
  budget_max:  z.number().min(0).nullable().optional(),
  lead_id:     z.string().uuid().optional(),
});

router.post("/leads/solicitar-orcamento", sensitiveLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = solicitarOrcamentoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });

  try {
    const clientId = req.authUser!.id;
    const {
      professional_id, professional_name,
      title, description, category, city,
      budget_min, budget_max,
      lead_id: existingLeadId,
    } = parsed.data;

    const { data: prof, error: profError } = await supabaseAdmin
      .from('professionals')
      .select('user_id')
      .eq('id', professional_id)
      .single()
    if (profError || !prof) return res.status(400).json({ error: 'Profissional não encontrado' })
    const professionalUserId = prof.user_id as string

    // Check for existing conversation (matches the partial unique index columns)
    if (existingLeadId) {
      const { data: existingConv } = await withTimeout(
        supabaseAdmin
          .from("conversations")
          .select("id")
          .eq("professional_id", professional_id)
          .eq("client_id", clientId)
          .eq("lead_id", existingLeadId)
          .maybeSingle()
      );
      if (existingConv) {
        return res.json({ lead_id: existingLeadId, conversation_id: existingConv.id, already_exists: true, avg_response_hours: null });
      }
    }

    // Create lead if not reusing one
    let leadId = existingLeadId;
    if (!leadId) {
      const location = city || "Não informado";
      const { data: newLead, error: leadErr } = await withTimeout(
        supabaseAdmin
          .from("leads")
          .insert({
            title,
            category,
            description,
            location,
            budget_min:      budget_min ?? 0,
            budget_max:      budget_max ?? 0,
            images:          [],
            metadata:        {},
            client_id:       clientId,
            status:          "open",
            price_coins:     0,
            max_purchases:   1,
            purchases_count: 0,
            visualizacoes:   0,
          })
          .select("id")
          .single()
      );
      if (leadErr || !newLead) throw leadErr ?? new Error("Falha ao criar pedido.");
      leadId = newLead.id as string;
    }

    // Check for existing conversation against the real partial unique index
    // (professional_id, client_id, lead_id) WHERE lead_id IS NOT NULL
    const { data: existingConv2 } = await withTimeout(
      supabaseAdmin
        .from("conversations")
        .select("id")
        .eq("professional_id", professional_id)
        .eq("client_id", clientId)
        .eq("lead_id", leadId)
        .maybeSingle()
    );

    let conversationId: string;

    if (existingConv2) {
      conversationId = existingConv2.id as string;
    } else {
      const { data: conv, error: convErr } = await withTimeout(
        supabaseAdmin
          .from("conversations")
          .insert({ professional_id, client_id: clientId, lead_id: leadId })
          .select("id")
          .single()
      );
      if (convErr || !conv) throw convErr ?? new Error("Falha ao criar conversa.");
      conversationId = conv.id as string;
    }

    // Insert auto message from client (conversion-optimised copy)
    const budgetLine = budget_max
      ? `💰 *Orçamento:* R$ ${budget_min ?? 0} – R$ ${budget_max}`
      : budget_min
      ? `💰 *Orçamento:* a partir de R$ ${budget_min}`
      : "";
    const profFirstName = professional_name ? professional_name.split(" ")[0] : "";
    const greeting = profFirstName ? `Olá, ${profFirstName}! 👋` : "Olá! 👋";
    const messageBody = [
      greeting,
      "",
      "Vi seu perfil e gostei do seu trabalho! Preciso de um orçamento para:",
      "",
      `🔧 *${title}*`,
      `📝 ${description}`,
      city ? `📍 *Local:* ${city}` : "",
      budgetLine,
      "",
      "Quando teria disponibilidade? Aguardo seu retorno! 😊",
    ].filter(Boolean).join("\n");

    await withTimeout(
      supabaseAdmin.from("messages").insert({
        conversation_id: conversationId,
        body: messageBody,
        sender_type: "client",
        attachments: [],
      })
    );
    await withTimeout(
      supabaseAdmin
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId)
    );

    // Push + DB notification for professional
    const budgetText = budget_max
      ? `R$ ${budget_min ?? 0}–${budget_max}`
      : budget_min
      ? `A partir de R$ ${budget_min}`
      : "Orçamento a combinar";

    void sendPushToUser(professionalUserId, {
      title: `💼 Novo orçamento — ${category}`,
      body: `${title}${city ? ` · ${city}` : ""} · ${budgetText}. Toque para responder!`,
      data: {
        type: "new_lead_conversation",
        conversation_id: conversationId,
        url: `/profissional/mensagens?chatId=${conversationId}`,
      },
    });

    void withTimeout(
      supabaseAdmin.from("notifications").insert({
        user_id:  professionalUserId,
        title:    `💼 Novo orçamento — ${category}`,
        body:     `${title}${city ? ` em ${city}` : ""}. Toque para ver.`,
        data:     { type: "new_lead_conversation", conversation_id: conversationId },
        is_read:  false,
      })
    );

    // Avg response time (best-effort, non-blocking)
    let avg_response_hours: number | null = null;
    try {
      const { data: recentConvs } = await withTimeout(
        supabaseAdmin
          .from("conversations")
          .select("id")
          .eq("professional_id", professional_id)
          .order("created_at", { ascending: false })
          .limit(20)
      );
      if (recentConvs?.length) {
        type MsgRow = { conversation_id: string; created_at: string };
        const convIds = (recentConvs as { id: string }[]).map(c => c.id);
        const [{ data: clientMsgs }, { data: profMsgs }] = await Promise.all([
          supabaseAdmin.from("messages").select("conversation_id, created_at").in("conversation_id", convIds).eq("sender_type", "client").order("created_at", { ascending: true }),
          supabaseAdmin.from("messages").select("conversation_id, created_at").in("conversation_id", convIds).eq("sender_type", "professional").order("created_at", { ascending: true }),
        ]);
        const firstClient: Record<string, Date> = {};
        for (const m of (clientMsgs ?? []) as MsgRow[]) {
          if (!firstClient[m.conversation_id]) firstClient[m.conversation_id] = new Date(m.created_at);
        }
        const firstProf: Record<string, Date> = {};
        for (const m of (profMsgs ?? []) as MsgRow[]) {
          if (!firstProf[m.conversation_id]) firstProf[m.conversation_id] = new Date(m.created_at);
        }
        const diffs: number[] = [];
        for (const cid of convIds) {
          if (firstClient[cid] && firstProf[cid]) {
            const diff = (firstProf[cid].getTime() - firstClient[cid].getTime()) / 3_600_000;
            if (diff > 0 && diff < 720) diffs.push(diff);
          }
        }
        if (diffs.length > 0) {
          avg_response_hours = Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10;
        }
      }
    } catch {
      // non-critical — return null
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[leads] solicitar-orcamento: lead=${leadId} conv=${conversationId} client=${clientId} avg_h=${avg_response_hours}`);
    }
    return res.status(201).json({ lead_id: leadId, conversation_id: conversationId, already_exists: false, avg_response_hours });
  } catch (err: unknown) {
    console.error("/api/leads/solicitar-orcamento POST error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno ao solicitar orçamento." });
  }
});

export default router;
