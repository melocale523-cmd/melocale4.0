import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import { AuthRequest, requireAuth, requireAdmin } from "../middleware/auth.js";
import { supabaseAdmin, coinPackagesCache, loadCoinPackages } from "../config.js";
import { runHealthCheck, estimateSystemLoadPct } from "../lib/systemHealthCheck.js";
import { withTimeout } from "../lib/timeout.js";
import { sendPushToUser } from "../lib/push.js";
import { HANDOFF_MESSAGE } from "../services/whatsappConversationService.js";
import { sendWhatsAppTemplate, normalizeBrazilianPhone, BROADCASTABLE_TEMPLATES } from "../services/whatsappService.js";
import { filterOptedIn } from "../lib/whatsappOptIn.js";
import { createSocialCampaignPlan, createSocialDraft, createSocialImage, fetchInstagramMediaMetrics, getSocialStrategyModel, publishApprovedInstagramImage, publishApprovedInstagramStory, type SocialContentRequest } from "../services/socialContentStudio.js";
import { runSocialContentAutopilotTask } from "../jobs/socialContentAutopilot.js";
import { DEFAULT_HIGHLIGHT_PACKS, MELOCALE_BRAND_KIT, highlightStoriesFor } from '../services/socialBrandKit.js';

const router = Router();
router.get("/automation-jobs", requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(200, Number(_req.query.limit ?? 100) || 100));
    const { data, error } = await supabaseAdmin
      .from("automation_job_runs")
      .select("id, job_name, status, started_at, finished_at, lease_expires_at, duration_ms, processed_count, error_message, metadata")
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (error.code === "42P01") return res.status(503).json({ error: "MigraÃ§Ã£o de histÃ³rico ainda nÃ£o aplicada." });
      throw error;
    }
    return res.json({ runs: data ?? [] });
  } catch (err) {
    console.error("/api/admin/automation-jobs error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao buscar histÃ³rico das automaÃ§Ãµes." });
  }
});

router.get("/automation-queue", requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin.from("automation_job_queue").select("id, job_name, status, attempts, max_attempts, available_at, completed_at, last_error, created_at").order("created_at", { ascending: false }).limit(200);
    if (error) return res.status(error.code === "42P01" ? 503 : 500).json({ error: error.code === "42P01" ? "Fila ainda nÃ£o aplicada." : "Erro ao consultar fila." });
    return res.json({ jobs: data ?? [] });
  } catch { return res.status(500).json({ error: "Erro ao consultar fila." }); }
});

router.post("/automation-queue", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { job_name, payload, max_attempts } = req.body as { job_name?: string; payload?: Record<string, unknown>; max_attempts?: number };
  const allowed = new Set(["appointment_reminders", "referral_bonus", "ai_chat_responder", "whatsapp_reengagement"]);
  if (!job_name || !allowed.has(job_name)) return res.status(400).json({ error: "Job nÃ£o permitido." });
  const { data, error } = await supabaseAdmin.rpc("enqueue_automation_job", { p_job_name: job_name, p_payload: payload ?? {}, p_max_attempts: Math.min(5, Math.max(1, max_attempts ?? 3)), p_available_at: new Date().toISOString() });
  if (error) return res.status(error.code === "42883" ? 503 : 500).json({ error: "Fila ainda nÃ£o aplicada ou indisponÃ­vel." });
  return res.status(201).json({ id: data });
});

router.post("/automation-queue/:id/requeue", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.rpc("requeue_automation_job", { p_id: req.params.id });
  if (error) return res.status(500).json({ error: "Erro ao reprocessar job." });
  return res.json({ job: data });
});
router.get("/active-users", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { data: prosData, error: prosError } = await supabaseAdmin
      .from("professionals")
      .select("user_id");
    if (prosError) throw prosError;
    const professionalIds = new Set((prosData ?? []).map((p) => p.user_id));

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let count = 0;
    let page = 1;
    while (true) {
      const { data, error } = await withTimeout(
        supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
      );
      if (error || !data?.users?.length) break;
      count += data.users.filter(
        (u) =>
          professionalIds.has(u.id) &&
          u.last_sign_in_at &&
          u.last_sign_in_at > cutoff
      ).length;
      if (data.users.length < 1000) break;
      page++;
    }
    return res.json({ count });
  } catch (err) {
    console.error("/api/admin/active-users error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao buscar usuÃ¡rios ativos." });
  }
});

router.patch("/professional-status", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, is_active } = req.body;
    if (!user_id || typeof is_active !== "boolean") {
      return res.status(400).json({ error: "user_id e is_active sÃ£o obrigatÃ³rios." });
    }
    const { error } = await withTimeout(
      supabaseAdmin.from("professionals").update({ is_active }).eq("user_id", user_id)
    );
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err: unknown) {
    console.error("/api/admin/professional-status error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.delete("/professionals/:userId", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { error: delErr } = await withTimeout(
      supabaseAdmin.from("professionals").delete().eq("user_id", userId)
    );
    if (delErr) throw delErr;
    const { error: roleErr } = await withTimeout(
      supabaseAdmin.from("profiles").update({ role: "client" }).eq("id", userId)
    );
    if (roleErr) throw roleErr;
    return res.json({ ok: true });
  } catch (err: unknown) {
    console.error("/api/admin/professionals DELETE error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

// PATCH /api/admin/fix-role/:userId
// Corrige inconsistÃªncia: seta profiles.role = 'professional' para usuÃ¡rio que tem row em professionals mas role errado
router.patch("/fix-role/:userId", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { error } = await withTimeout(
      supabaseAdmin.from("profiles").update({ role: "professional" }).eq("id", userId)
    );
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err: unknown) {
    console.error("/api/admin/fix-role PATCH error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.get("/user-emails", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ids = (req.query.ids as string || "").split(",").filter(Boolean).slice(0, 100);
    if (!ids.length) return res.json({ emails: {} });

    const emails: Record<string, string> = {};
    let page = 1;
    while (true) {
      const { data, error } = await withTimeout(
        supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
      );
      if (error || !data?.users?.length) break;
      data.users.forEach((u) => {
        if (ids.includes(u.id) && u.email) emails[u.id] = u.email;
      });
      if (data.users.length < 1000) break;
      page++;
    }
    return res.json({ emails });
  } catch (err) {
    console.error("/api/admin/user-emails error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.get("/users-enriched", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result: Array<{ id: string; email: string | null; last_sign_in_at: string | null }> = [];
    let page = 1;
    while (true) {
      const { data, error } = await withTimeout(
        supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
      );
      if (error || !data?.users?.length) break;
      data.users.forEach((u) => {
        result.push({
          id: u.id,
          email: u.email ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      });
      if (data.users.length < 1000) break;
      page++;
    }
    return res.json(result);
  } catch (err) {
    console.error("/api/admin/users-enriched error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao buscar dados de autenticaÃ§Ã£o." });
  }
});

router.post("/categories", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: "name e slug obrigatÃ³rios." });
    const { data, error } = await supabaseAdmin
      .from("categories")
      .insert({ name, slug, is_active: true })
      .select("*")
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (err: unknown) {
    console.error("/api/admin/categories POST error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.patch("/categories/:id", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    if (typeof is_active !== "boolean") return res.status(400).json({ error: "is_active obrigatÃ³rio." });
    const { data, error } = await supabaseAdmin
      .from("categories")
      .update({ is_active })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (err: unknown) {
    console.error("/api/admin/categories PATCH error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.get("/run-tests", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const results: Array<{
      id: string;
      name: string;
      status: "pass" | "fail" | "skip";
      message: string;
      duration: number;
    }> = [];

    const TEST_CLIENT_EMAIL    = process.env.E2E_CLIENT_EMAIL    ?? "";
    const TEST_CLIENT_PASSWORD = process.env.E2E_CLIENT_PASSWORD ?? "";
    const TEST_PROF_EMAIL      = process.env.E2E_PROF_EMAIL      ?? "";
    const TEST_PROF_PASSWORD   = process.env.E2E_PROF_PASSWORD   ?? "";

    const E2E_PREFIX = "[E2E-TEST]";
    const startedAt = new Date().toISOString();
    if (process.env.NODE_ENV !== 'production') console.log(`[e2e] run-tests iniciado: ${startedAt}`);

    let clientUserId: string | null = null;
    let profUserId: string | null = null;
    let createdLeadId: string | null = null;
    let createdChatId: string | null = null;

    async function runTest(id: string, name: string, fn: () => Promise<string>) {
      const start = Date.now();
      try {
        const message = await fn();
        results.push({ id, name, status: "pass", message, duration: Date.now() - start });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id, name, status: "fail", message: msg, duration: Date.now() - start });
      }
    }

    await runTest("t1", "Login cliente", async () => {
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: TEST_CLIENT_EMAIL,
      });
      if (linkErr) throw new Error(linkErr.message);

      const { data, error } = await supabaseAdmin.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: "magiclink",
      });
      if (error || !data.session || !data.user) throw new Error(error?.message ?? "Sem sessÃ£o");
      clientUserId = data.user.id;
      return `OK â€” user_id: ${clientUserId}`;
    });

    await runTest("t2", "Login profissional", async () => {
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: TEST_PROF_EMAIL,
      });
      if (linkErr) throw new Error(linkErr.message);

      const { data, error } = await supabaseAdmin.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: "magiclink",
      });
      if (error || !data.session || !data.user) throw new Error(error?.message ?? "Sem sessÃ£o");
      profUserId = data.user.id;
      return `OK â€” user_id: ${profUserId}`;
    });

    await runTest("t3", "Cliente cria pedido", async () => {
      if (!clientUserId) throw new Error("Depende do T1 â€” login cliente falhou");
      const { data: clientProfile } = await supabaseAdmin
        .from("clients")
        .select("id")
        .eq("id", clientUserId)
        .maybeSingle();
      if (!clientProfile) throw new Error("Perfil cliente nÃ£o encontrado");
      const { data, error } = await supabaseAdmin.rpc("e2e_insert_lead", {
        p_client_id: clientUserId,
        p_title: `${E2E_PREFIX} Pintura de sala`,
        p_description: `${E2E_PREFIX} Teste automatizado â€” pode ser deletado`,
        p_category: "Pintura",
        p_location: "SÃ£o Paulo, SP",
        p_budget_min: 100,
        p_budget_max: 500,
      });
      if (error) throw new Error(error.message);
      createdLeadId = data as string;
      return `OK â€” lead_id: ${createdLeadId}`;
    });

    await runTest("t4", "Profissional vÃª lead disponÃ­vel", async () => {
      if (!createdLeadId) throw new Error("Depende do T3 â€” lead nÃ£o criado");
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select("id, title, status")
        .eq("id", createdLeadId)
        .single();
      if (error) throw new Error(error.message);
      if (data.status !== "open") throw new Error(`Status inesperado: ${data.status}`);
      return `OK â€” "${data.title}" visÃ­vel e ativo`;
    });

    await runTest("t5", "Profissional compra lead", async () => {
      if (!createdLeadId || !profUserId) throw new Error("Depende do T2 e T3");
      const { data: prof } = await supabaseAdmin
        .from("professionals")
        .select("id")
        .eq("user_id", profUserId)
        .maybeSingle();
      if (!prof) throw new Error("Perfil profissional nÃ£o encontrado");
      const { data: chatId, error } = await supabaseAdmin.rpc("e2e_insert_lead_purchase", {
        p_lead_id: createdLeadId,
        p_professional_id: prof.id,
        p_professional_user_id: profUserId,
        p_client_id: clientUserId,
      });
      if (error) throw new Error(error.message);
      createdChatId = chatId;
      return `OK â€” chat_id: ${createdChatId}`;
    });

    await runTest("t6", "Chat aberto apÃ³s compra", async () => {
      if (!createdChatId) throw new Error("Depende do T5 â€” compra nÃ£o realizada");
      const { data, error } = await supabaseAdmin
        .from("conversations")
        .select("id, professional_id, client_id")
        .eq("id", createdChatId)
        .single();
      if (error) throw new Error(error.message);
      return `OK â€” conversa criada (id: ${data.id})`;
    });

    await runTest("t7", "Enviar mensagem no chat", async () => {
      if (!createdChatId) throw new Error("Depende do T6 â€” chat nÃ£o existe");
      const { data, error } = await supabaseAdmin
        .from("messages")
        .insert({
          conversation_id: createdChatId,
          body: `${E2E_PREFIX} OlÃ¡, mensagem automÃ¡tica de teste`,
          sender_type: "client",
          read_at: null,
          attachments: [],
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return `OK â€” message_id: ${data.id}`;
    });

    try {
      if (createdChatId) {
        await supabaseAdmin.from("messages")
          .delete()
          .eq("conversation_id", createdChatId)
          .like("body", `${E2E_PREFIX}%`);
        await supabaseAdmin.from("conversations").delete().eq("id", createdChatId);
        await supabaseAdmin.from("lead_purchases").delete().eq("lead_id", createdLeadId!);
      }
      if (createdLeadId) {
        await supabaseAdmin.from("leads").delete().eq("id", createdLeadId);
      }
      await supabaseAdmin.from("leads").delete().like("title", `${E2E_PREFIX}%`);
      if (process.env.NODE_ENV !== 'production') console.log("[e2e] cleanup concluÃ­do");
    } catch (cleanupErr) {
      console.error("[e2e] cleanup parcial:", cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr));
    }

    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const finishedAt = new Date().toISOString();
    if (process.env.NODE_ENV !== 'production') console.log(`[e2e] run-tests finalizado: ${finishedAt} â€” passed=${passed} failed=${failed}`);

    return res.json({
      summary: { total: results.length, passed, failed },
      results,
      ran_at: startedAt,
      finished_at: finishedAt,
    });
  } catch (err: unknown) {
    console.error("[admin/run-tests] erro:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.post("/reload-coin-packages", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await loadCoinPackages();
    return res.json({ reloaded: true, packages: Object.keys(coinPackagesCache).length });
  } catch (err: unknown) {
    console.error("/api/admin/reload-coin-packages error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.get("/reports/users", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { data: profiles, error } = await withTimeout(
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, role, created_at, city")
        .order("created_at", { ascending: false })
        .limit(5000)
    );
    if (error) throw error;

    const ids = (profiles ?? []).map((p) => p.id);

    const { data: clients } = ids.length
      ? await withTimeout(supabaseAdmin.from("clients").select("id, email, state").in("id", ids))
      : { data: [] };

    const { data: profs } = ids.length
      ? await withTimeout(supabaseAdmin.from("professionals").select("user_id, is_active, category").in("user_id", ids))
      : { data: [] };

    const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c]));
    const profMap   = Object.fromEntries((profs   ?? []).map((p) => [p.user_id, p]));

    const rows = (profiles ?? []).map((p) => ({
      id:         p.id,
      full_name:  p.full_name,
      email:      clientMap[p.id]?.email     ?? null,
      role:       p.role,
      created_at: p.created_at,
      city:       p.city,
      state:      clientMap[p.id]?.state     ?? null,
      is_active:  profMap[p.id]?.is_active   ?? null,
      category:   profMap[p.id]?.category    ?? null,
    }));
    return res.json(rows);
  } catch (err: unknown) {
    console.error("/api/admin/reports/users error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.get("/reports/leads", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("leads")
        .select("id, title, category, location, status, price_coins, budget_min, budget_max, purchases_count, created_at")
        .order("created_at", { ascending: false })
        .limit(5000)
    );
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err: unknown) {
    console.error("/api/admin/reports/leads error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.get("/reports/transactions", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { data: txs, error } = await withTimeout(
      supabaseAdmin
        .from("wallet_transactions")
        .select("id, user_id, kind, amount, reference, created_at")
        .order("created_at", { ascending: false })
        .limit(5000)
    );
    if (error) throw error;

    const userIds = [...new Set((txs ?? []).map((t) => t.user_id).filter(Boolean))];

    const { data: clients } = userIds.length
      ? await withTimeout(supabaseAdmin.from("clients").select("id, full_name, email").in("id", userIds))
      : { data: [] };

    const { data: profilesMap } = userIds.length
      ? await withTimeout(supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds))
      : { data: [] };

    const clientMap  = Object.fromEntries((clients     ?? []).map((c) => [c.id, c]));
    const profileMap = Object.fromEntries((profilesMap ?? []).map((p) => [p.id, p]));

    const rows = (txs ?? []).map((tx) => ({
      id:         tx.id,
      user_id:    tx.user_id,
      full_name:  clientMap[tx.user_id]?.full_name ?? profileMap[tx.user_id]?.full_name ?? null,
      email:      clientMap[tx.user_id]?.email     ?? null,
      kind:       tx.kind,
      amount:     tx.amount,
      reference:  tx.reference,
      created_at: tx.created_at,
    }));
    return res.json(rows);
  } catch (err: unknown) {
    console.error("/api/admin/reports/transactions error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

// â”€â”€ POST /api/admin/premiar-profissional â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post("/premiar-profissional", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, coins, motivo } = req.body as {
      user_id?: string;
      coins?: number;
      motivo?: string;
    };

    if (!user_id || typeof user_id !== "string") {
      return res.status(400).json({ error: "user_id obrigatÃ³rio" });
    }
    if (!coins || typeof coins !== "number" || coins < 1 || coins > 10_000) {
      return res.status(400).json({ error: "coins deve ser um nÃºmero entre 1 e 10000" });
    }

    // Fetch professional name for notifications/Telegram
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user_id)
      .single();

    const profName = profile?.full_name ?? "Profissional";

    // Call the existing RPC that credits coins atomically
    const now = Date.now();
    const { error: rpcError } = await supabaseAdmin.rpc("credit_professional_coins", {
      p_user_id: user_id,
      p_amount: coins,
      p_stripe_session_id: `admin_award_${now}`,
      p_stripe_event_id: `admin_award_${user_id}_${now}`,
    });

    if (rpcError) {
      console.error("[premiar-profissional] RPC error:", rpcError.message);
      return res.status(500).json({ error: "Falha ao creditar moedas" });
    }

    // In-app notification
    await supabaseAdmin.from("notifications").insert({
      user_id,
      title: "ðŸ† VocÃª foi premiado!",
      body: motivo
        ? `VocÃª recebeu ${coins} moedas: ${motivo}`
        : `VocÃª recebeu ${coins} moedas como prÃªmio do admin.`,
    });

    // Telegram alert (best-effort)
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      const text =
        `ðŸ† *PremiaÃ§Ã£o manual*\n` +
        `Profissional: *${profName}*\n` +
        `Moedas: *${coins}*` +
        (motivo ? `\nMotivo: ${motivo}` : "");
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
      }).catch(() => {});
    }

    return res.json({ success: true, coins_awarded: coins });
  } catch (err: unknown) {
    console.error("[premiar-profissional] error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

// â”€â”€ Garantia de primeira compra do profissional â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Aprovar credita as moedas via credit_professional_guarantee (RPC prÃ³pria,
// separada de credit_professional_coins que Ã© especÃ­fico de compra Stripe).
router.post("/guarantee-requests/:id/approve", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { note } = req.body as { note?: string };
  try {
    const { data: request, error: fetchErr } = await supabaseAdmin
      .from("professional_guarantee_requests")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !request) return res.status(404).json({ error: "SolicitaÃ§Ã£o nÃ£o encontrada." });
    if (request.status !== "pending") return res.status(400).json({ error: "SolicitaÃ§Ã£o nÃ£o estÃ¡ pendente." });

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc("credit_professional_guarantee", {
      p_user_id: request.professional_id,
      p_amount: request.coins_amount,
      p_reference: `guarantee_request:${id}`,
    });
    if (rpcError) {
      console.error("[admin/guarantee-requests] approve RPC error:", rpcError.message);
      return res.status(500).json({ error: "Falha ao creditar moedas." });
    }
    if (rpcResult && (rpcResult as { success?: boolean }).success === false) {
      return res.status(409).json({ error: (rpcResult as { error?: string }).error ?? "JÃ¡ creditado anteriormente." });
    }

    await supabaseAdmin
      .from("professional_guarantee_requests")
      .update({ status: "approved", admin_note: note ?? null, processed_at: new Date().toISOString() })
      .eq("id", id);

    return res.json({ success: true });
  } catch (err) {
    console.error("[admin/guarantee-requests] approve error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.post("/guarantee-requests/:id/reject", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { note } = req.body as { note?: string };
  try {
    const { data: request, error: fetchErr } = await supabaseAdmin
      .from("professional_guarantee_requests")
      .select("id, status")
      .eq("id", id)
      .single();
    if (fetchErr || !request) return res.status(404).json({ error: "SolicitaÃ§Ã£o nÃ£o encontrada." });
    if (request.status !== "pending") return res.status(400).json({ error: "SolicitaÃ§Ã£o nÃ£o estÃ¡ pendente." });

    await supabaseAdmin
      .from("professional_guarantee_requests")
      .update({ status: "rejected", admin_note: note ?? null, processed_at: new Date().toISOString() })
      .eq("id", id);

    return res.json({ success: true });
  } catch (err) {
    console.error("[admin/guarantee-requests] reject error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

// Push em massa â€” ferramenta reutilizÃ¡vel pra avisos gerais (nÃ£o sÃ³ o anÃºncio
// de indicaÃ§Ã£o), por isso fica genÃ©rica (title/body/url) em vez de hardcoded.
// Um envio por usuÃ¡rio Ãºnico, nÃ£o por subscription/dispositivo.
router.post("/broadcast-push", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { title, body, url, role } = req.body as { title?: string; body?: string; url?: string; role?: 'client' | 'professional' };
  if (!title || !body) return res.status(400).json({ error: "title e body sÃ£o obrigatÃ³rios" });

  try {
    const { data: subsData, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("user_id");
    if (error) throw error;

    let userIds = [...new Set((subsData ?? []).map((s) => s.user_id as string))];

    if (role) {
      const { data: profilesData } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", role)
        .in("id", userIds);
      const allowedIds = new Set((profilesData ?? []).map((p) => p.id as string));
      userIds = userIds.filter((id) => allowedIds.has(id));
    }

    let sent = 0;
    for (const userId of userIds) {
      const ok = await sendPushToUser(userId, {
        title,
        body,
        data: url ? { type: "broadcast", url } : { type: "broadcast" },
      });
      if (ok) sent++;
    }

    return res.json({ success: true, total_subscribers: userIds.length, sent });
  } catch (err) {
    console.error("[admin/broadcast-push] error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao enviar broadcast." });
  }
});

// Health check real pra pÃ¡gina de Observabilidade â€” diferente de /api/health (pÃºblico,
// trivial, usado por monitores externos). Mede latÃªncia real de Supabase e Stripe, uptime
// do processo, memÃ³ria, event loop lag, tamanho do banco, info de deploy (env vars
// automÃ¡ticas do Render), freshness do webhook de pagamentos e carga estimada do sistema.
// Se a requisiÃ§Ã£o chegou atÃ© aqui, o backend jÃ¡ estÃ¡ "up" por definiÃ§Ã£o.
router.get("/system-health", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const result = await runHealthCheck();
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10;
  const heapTotalMb = Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10;

  const { data: lastPayment } = await supabaseAdmin
    .from("payments")
    .select("paid_at")
    .eq("status", "paid")
    .not("paid_at", "is", null)
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const loadPct = estimateSystemLoadPct({
    heapUsedMb,
    heapTotalMb,
    eventLoopLagMs: result.eventLoopLagMs,
    dbLatencyMs: result.dbLatencyMs,
  });

  return res.json({
    backend: {
      status: "up",
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb: { heap_used: heapUsedMb, heap_total: heapTotalMb, rss: Math.round((mem.rss / 1024 / 1024) * 10) / 10 },
      event_loop_lag_ms: result.eventLoopLagMs,
      deploy: {
        commit: process.env.RENDER_GIT_COMMIT ? process.env.RENDER_GIT_COMMIT.slice(0, 7) : null,
        branch: process.env.RENDER_GIT_BRANCH ?? null,
      },
    },
    db: { status: result.dbStatus, latency_ms: result.dbLatencyMs, size_mb: result.dbSizeMb },
    stripe: { status: result.stripeStatus, latency_ms: result.stripeLatencyMs },
    anthropic: { status: result.anthropicStatus, latency_ms: result.anthropicLatencyMs },
    openai: { status: result.openaiStatus, latency_ms: result.openaiLatencyMs },
    load_pct: loadPct,
    last_payment_at: lastPayment?.paid_at ?? null,
    checked_at: new Date().toISOString(),
  });
});

// Checklist de configuraÃ§Ã£o â€” quais env vars crÃ­ticas estÃ£o presentes ou faltando, sem
// NUNCA expor valor (sÃ³ booleano). Resolve a pergunta "o que falta configurar" num lugar
// sÃ³, em vez de descobrir aos poucos pelos avisos espalhados pela pÃ¡gina.
router.get("/config-status", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const checks = [
    { key: "SUPABASE_URL", label: "Supabase URL", present: !!process.env.SUPABASE_URL, critical: true },
    { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase Service Role Key", present: !!process.env.SUPABASE_SERVICE_ROLE_KEY, critical: true },
    { key: "STRIPE_SECRET_KEY", label: "Stripe Secret Key", present: !!process.env.STRIPE_SECRET_KEY, critical: true },
    { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe Webhook Secret", present: !!process.env.STRIPE_WEBHOOK_SECRET, critical: true },
    { key: "ANTHROPIC_API_KEY", label: "Anthropic API Key (IA do chat)", present: !!process.env.ANTHROPIC_API_KEY, critical: true },
    { key: "SENTRY_DSN", label: "Sentry DSN (captura de erros)", present: !!process.env.SENTRY_DSN, critical: false },
    { key: "SENTRY_API_TOKEN", label: "Sentry API Token (timeline de issues)", present: !!process.env.SENTRY_API_TOKEN, critical: false },
    { key: "SENTRY_ORG_SLUG", label: "Sentry Org Slug", present: !!process.env.SENTRY_ORG_SLUG, critical: false },
    { key: "SENTRY_PROJECT_SLUGS", label: "Sentry Project Slugs", present: !!process.env.SENTRY_PROJECT_SLUGS, critical: false },
    { key: "TELEGRAM_BOT_TOKEN", label: "Telegram Bot Token (alertas auditoria Stripe)", present: !!process.env.TELEGRAM_BOT_TOKEN, critical: false },
    { key: "TELEGRAM_CHAT_ID", label: "Telegram Chat ID", present: !!process.env.TELEGRAM_CHAT_ID, critical: false },
    { key: "VAPID_PUBLIC_KEY", label: "VAPID Public Key (push notifications)", present: !!process.env.VAPID_PUBLIC_KEY, critical: false },
    { key: "VAPID_PRIVATE_KEY", label: "VAPID Private Key", present: !!process.env.VAPID_PRIVATE_KEY, critical: false },
  ];
  return res.json({ checks });
});

// HistÃ³rico das Ãºltimas 24h gravadas pelo cron healthCheck.ts (a cada 5min) â€” uptime% real
// por target + detecÃ§Ã£o de incidentes (transiÃ§Ãµes upâ†’down), sem depender do Sentry estar
// configurado. TambÃ©m devolve o resultado da Ãºltima auditoria Stripe (stripeAudit.ts),
// que antes sÃ³ ia pro Telegram e se perdia.
router.get("/health-history", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("system_health_checks")
      .select("backend_status, db_status, db_latency_ms, stripe_status, stripe_latency_ms, anthropic_status, anthropic_latency_ms, openai_status, openai_latency_ms, event_loop_lag_ms, db_size_mb, checked_at")
      .gte("checked_at", since)
      .order("checked_at", { ascending: true });

    if (error) throw error;

    const rows = data ?? [];

    const uptimePct = (field: "backend_status" | "db_status" | "stripe_status" | "anthropic_status" | "openai_status"): number | null => {
      if (rows.length === 0) return null;
      const upCount = rows.filter((r) => r[field] === "up").length;
      return Math.round((upCount / rows.length) * 1000) / 10;
    };

    type Target = "backend" | "db" | "stripe" | "anthropic" | "openai";
    const fieldsByTarget: Array<{ target: Target; field: "backend_status" | "db_status" | "stripe_status" | "anthropic_status" | "openai_status" }> = [
      { target: "backend", field: "backend_status" },
      { target: "db", field: "db_status" },
      { target: "stripe", field: "stripe_status" },
      { target: "anthropic", field: "anthropic_status" },
      { target: "openai", field: "openai_status" },
    ];

    const incidents: Array<{ target: Target; started_at: string }> = [];
    for (const { target, field } of fieldsByTarget) {
      for (let i = 1; i < rows.length; i++) {
        if (rows[i - 1][field] === "up" && rows[i][field] === "down") {
          incidents.push({ target, started_at: rows[i].checked_at as string });
        }
      }
    }
    incidents.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

    const { data: lastAudit } = await supabaseAdmin
      .from("stripe_audit_runs")
      .select("payments_checked, orphans_found, ran_at")
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return res.json({
      checks_count: rows.length,
      series: rows.map((r) => ({
        checked_at: r.checked_at,
        db_latency_ms: r.db_latency_ms,
        stripe_latency_ms: r.stripe_latency_ms,
        event_loop_lag_ms: r.event_loop_lag_ms,
      })),
      db_size_mb: rows.length > 0 ? rows[rows.length - 1].db_size_mb : null,
      uptime_24h: {
        backend: uptimePct("backend_status"),
        db: uptimePct("db_status"),
        stripe: uptimePct("stripe_status"),
        anthropic: uptimePct("anthropic_status"),
        openai: uptimePct("openai_status"),
      },
      incidents: incidents.slice(0, 10),
      last_stripe_audit: lastAudit ?? null,
    });
  } catch (err) {
    console.error("/api/admin/health-history error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao buscar histÃ³rico." });
  }
});

// Issues recentes do Sentry (backend + frontend) pra timeline de incidentes real.
// Sem SENTRY_API_TOKEN/SENTRY_ORG_SLUG/SENTRY_PROJECT_SLUGS configurados no Render,
// responde configured:false â€” front mostra aviso em vez de fingir que nÃ£o tem erro.
router.get("/sentry-issues", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const token = process.env.SENTRY_API_TOKEN;
  const org = process.env.SENTRY_ORG_SLUG;
  const projects = (process.env.SENTRY_PROJECT_SLUGS || "").split(",").map((p) => p.trim()).filter(Boolean);

  if (!token || !org || projects.length === 0) {
    return res.json({ configured: false, issues: [] });
  }

  const since = Date.now() - 24 * 60 * 60 * 1000;

  try {
    const results = await Promise.all(
      projects.map(async (project) => {
        // statsPeriod sÃ³ afeta o grÃ¡fico interno de cada issue, NÃƒO filtra quais issues
        // a API retorna â€” por isso o filtro real de 24h Ã© feito abaixo, em lastSeen.
        // limit maior (25, nÃ£o 10) pra ter candidatos suficientes depois do filtro.
        const r = await fetch(
          `https://sentry.io/api/0/projects/${org}/${project}/issues/?sort=date&query=is:unresolved&limit=25`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!r.ok) return [];
        const data = (await r.json()) as Array<{
          title: string; count: string; level: string; lastSeen: string; permalink: string;
        }>;
        return data
          .filter((i) => new Date(i.lastSeen).getTime() > since)
          .map((i) => ({
            title: i.title,
            count: Number(i.count),
            level: i.level,
            lastSeen: i.lastSeen,
            url: i.permalink,
            project,
          }));
      })
    );
    const issues = results
      .flat()
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
      .slice(0, 20);
    return res.json({ configured: true, issues });
  } catch (err) {
    console.error("/api/admin/sentry-issues error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao buscar issues do Sentry." });
  }
});

// Estimativas de custo â€” NÃƒO Ã© fatura real, Ã© aproximaÃ§Ã£o pra dar noÃ§Ã£o de
// ordem de grandeza. Haiku: ~input 2.500 tok (system prompt grande + histÃ³rico
// + contexto da plataforma) + ~200 tok de saÃ­da, no preÃ§o do Claude Haiku
// (~$1/MTok input, ~$5/MTok output) â‰ˆ R$0,015/chamada (cÃ¢mbio ~R$5,50).
// Whisper: mesma estimativa usada quando a transcriÃ§Ã£o foi implementada.
const HAIKU_COST_BRL_PER_CALL = 0.015;
const WHISPER_COST_BRL_PER_AUDIO = 0.02;

// Visibilidade real de uso do bot do WhatsApp â€” hoje nÃ£o existe nenhuma.
// Handoffs contados via whatsapp_messages (sender='system', body=HANDOFF_MESSAGE)
// em vez do snapshot atual de handoff_reason em whatsapp_conversations, porque
// esse snapshot muda com o tempo (handoffTimeout.ts zera handoff_reason depois
// de 24h) â€” a mensagem de handoff Ã© um evento carimbado, nÃ£o se perde.
//
// Breakdown de handoff por urgÃªncia FICOU DE FORA: urgency (decision.urgency
// em whatsappConversationService.ts) Ã© usado sÃ³ pra montar o tÃ­tulo do push
// no momento do handoff e nunca Ã© persistido em nenhuma coluna â€” nÃ£o dÃ¡ pra
// reconstruir depois dos fatos sem adicionar uma coluna nova (fora do escopo
// aqui). Top 5 perguntas/tÃ³picos tambÃ©m ficou de fora â€” exigiria alguma
// classificaÃ§Ã£o, e uma categorizaÃ§Ã£o frÃ¡gil aqui seria pior que nada.
router.get("/bot-stats", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const days = Math.max(1, Math.min(90, parseInt(String(req.query.days ?? "7"), 10) || 7));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: messages, error } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("conversation_id, direction, sender, body, created_at")
      .gte("created_at", since);
    if (error) throw error;

    const rows = messages ?? [];
    const inbound = rows.filter((m) => m.direction === "inbound");
    const audioTranscribed = inbound.filter((m) => (m.body ?? "").startsWith("(Ã¡udio)"));
    const handoffs = rows.filter((m) => m.sender === "system" && m.body === HANDOFF_MESSAGE);
    const activeConversationIds = new Set(rows.map((m) => m.conversation_id));

    const totalInbound = inbound.length;
    const totalConversations = activeConversationIds.size;
    const totalHandoffs = handoffs.length;
    const handoffRatePct = totalConversations > 0
      ? Math.round((totalHandoffs / totalConversations) * 1000) / 10
      : 0;

    const estimatedCostBrl = Math.round(
      (totalInbound * HAIKU_COST_BRL_PER_CALL + audioTranscribed.length * WHISPER_COST_BRL_PER_AUDIO) * 100
    ) / 100;

    // Mensagens recebidas por dia, pro grÃ¡fico simples do frontend.
    const perDay = new Map<string, number>();
    for (const m of inbound) {
      const day = (m.created_at as string).slice(0, 10);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    const messagesPerDay = [...perDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return res.json({
      period_days: days,
      total_inbound_messages: totalInbound,
      total_conversations: totalConversations,
      total_handoffs: totalHandoffs,
      handoff_rate_pct: handoffRatePct,
      audio_messages_transcribed: audioTranscribed.length,
      estimated_cost_brl: estimatedCostBrl,
      estimated_cost_note: "Estimativa aproximada, nÃ£o Ã© fatura real.",
      messages_per_day: messagesPerDay,
    });
  } catch (err) {
    console.error("/api/admin/bot-stats error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao buscar estatÃ­sticas do bot." });
  }
});

// SÃ³ expÃµe templates cuja env var de aprovaÃ§Ã£o jÃ¡ estÃ¡ "true" â€” a UI nunca
// mostra uma opÃ§Ã£o que sabidamente vai falhar (template nÃ£o aprovado pela Meta).
router.get("/whatsapp-broadcast/templates", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const templates = Object.entries(BROADCASTABLE_TEMPLATES)
    .filter(([, t]) => process.env[t.envGate] === "true")
    .map(([key, t]) => ({ key, label: t.label }));
  return res.json({ templates });
});

// Disparo em massa de template aprovado â€” mesmo espÃ­rito do /broadcast-push,
// mas via WhatsApp. Envio SEQUENCIAL (nÃ£o Promise.all) de propÃ³sito: volume
// atual da base (~40 pessoas) nÃ£o justifica risco de rate limit da Graph API
// disparando tudo em paralelo.
router.post("/whatsapp-broadcast", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { templateKey, role } = req.body as { templateKey?: string; role?: "client" | "professional" };
  const template = templateKey ? BROADCASTABLE_TEMPLATES[templateKey] : undefined;
  if (!template) return res.status(400).json({ error: "Template invÃ¡lido." });
  if (process.env[template.envGate] !== "true") {
    return res.status(400).json({ error: "Este template ainda nÃ£o foi aprovado pela Meta." });
  }

  try {
    let query = supabaseAdmin.from("profiles").select("id, full_name, phone").not("phone", "is", null);
    query = role ? query.eq("role", role) : query.in("role", ["client", "professional"]);
    const { data: profiles, error } = await query;
    if (error) throw error;

    const rows = (profiles ?? []) as { id: string; full_name: string | null; phone: string | null }[];
    const optedIn = await filterOptedIn(rows.map((p) => p.id));

    const recipients = rows
      .filter((p) => optedIn.has(p.id))
      .map((p) => ({ id: p.id, phone: normalizeBrazilianPhone(p.phone), firstName: p.full_name?.trim().split(/\s+/)[0] || "vocÃª" }))
      .filter((p): p is { id: string; phone: string; firstName: string } => !!p.phone);

    let sent = 0;
    let failed = 0;
    for (const recipient of recipients) {
      const result = await sendWhatsAppTemplate(recipient.phone, template.templateName, [recipient.firstName]);
      if (result.ok) sent++;
      else {
        failed++;
        console.error(`[admin/whatsapp-broadcast] falha ao enviar pra ${recipient.phone}:`, result.error);
      }
    }

    return res.json({ success: true, total_recipients: recipients.length, sent, failed });
  } catch (err) {
    console.error("[admin/whatsapp-broadcast] error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao enviar broadcast do WhatsApp." });
  }
});


// â”€â”€ Marketing IA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GeraÃ§Ã£o custa dinheiro e a publicaÃ§Ã£o social sempre exige aprovaÃ§Ã£o humana.
const socialStudioLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de geraÃ§Ãµes atingido. Tente novamente em uma hora.' },
});

type SocialContentRow = {
  id: string;
  title: string;
  objective: SocialContentRequest['objective'];
  audience: SocialContentRequest['audience'];
  city: string | null;
  service: string | null;
  format: SocialContentRequest['format'];
  status: 'draft' | 'approved' | 'rejected' | 'published';
  generation_status: 'pending' | 'generating' | 'ready' | 'failed';
  brief: Record<string, unknown>;
  content: Record<string, unknown>;
  research_sources: unknown[];
  visual_prompt: string | null;
  image_storage_path: string | null;
  strategy_model: string | null;
  visual_model: string | null;
  strategy_usage: Record<string, unknown>;
  visual_usage: Record<string, unknown>;
  estimated_cost_cents: number;
  safety_notes: string[];
  rejection_note: string | null;
  failure_code: string | null;
  failure_details: string | null;
  conversion_metrics: Record<string, unknown>;
  campaign_id: string | null;
  created_at: string;
  approved_at: string | null;
};

const socialFields = 'id, campaign_id, title, objective, audience, city, service, format, status, generation_status, brief, content, research_sources, visual_prompt, image_storage_path, strategy_model, visual_model, strategy_usage, visual_usage, estimated_cost_cents, safety_notes, rejection_note, instagram_media_id, publication_error, published_at, created_at, approved_at, scheduled_for, generated_by_autopilot, duplicate_key, channels, variants, performance, conversion_metrics, automation_note, failure_code, failure_details';

async function withSocialImageUrl(row: SocialContentRow): Promise<SocialContentRow & { image_url: string | null }> {
  if (!row.image_storage_path) return { ...row, image_url: null };
  const { data, error } = await supabaseAdmin.storage.from('social-content').createSignedUrl(row.image_storage_path, 900);
  if (error) {
    console.error('[social-content] signed URL:', error.message);
    return { ...row, image_url: null };
  }
  return { ...row, image_url: data.signedUrl };
}

function parseSocialRequest(body: unknown): SocialContentRequest | null {
  if (!body || typeof body !== 'object') return null;
  const value = body as Record<string, unknown>;
  const objectives = new Set<SocialContentRequest['objective']>(['reach', 'client_leads', 'professional_signup', 'trust', 'education']);
  const audiences = new Set<SocialContentRequest['audience']>(['client', 'professional', 'mixed']);
  const formats = new Set<SocialContentRequest['format']>(['reel', 'carousel', 'story', 'feed', 'article']);
  const text = (key: string, maximum: number) => typeof value[key] === 'string' && value[key].trim().length > 0 && value[key].trim().length <= maximum ? value[key].trim() : undefined;
  const objective = value.objective;
  const audience = value.audience;
  const format = value.format;
  const topic = text('topic', 240);
  if (typeof objective !== 'string' || !objectives.has(objective as SocialContentRequest['objective']) || typeof audience !== 'string' || !audiences.has(audience as SocialContentRequest['audience']) || typeof format !== 'string' || !formats.has(format as SocialContentRequest['format']) || !topic) return null;
  return { objective: objective as SocialContentRequest['objective'], audience: audience as SocialContentRequest['audience'], format: format as SocialContentRequest['format'], topic, city: text('city', 100), service: text('service', 100), research: value.research === true };
}

router.get('/social-content/overview', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const [items, campaigns, queue] = await Promise.all([
    supabaseAdmin.from('social_content_items').select('id, status, generation_status, estimated_cost_cents, city, service, channels, performance, conversion_metrics, created_at').order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('social_content_campaigns').select('id, status, auto_generate, budget_cents, spent_cents, city, service, last_autopilot_at').order('updated_at', { ascending: false }).limit(50),
    supabaseAdmin.from('automation_job_runs').select('id, status, processed_count, error_message, started_at, finished_at').eq('job_name', 'social_content_autopilot').order('started_at', { ascending: false }).limit(10),
  ]);
  if (items.error || campaigns.error) return res.status(500).json({ error: 'Erro ao carregar as metricas do Marketing IA.' });
  const rows = items.data ?? [];
  const metricValue = (row: any, key: string) => Number(row?.performance?.[key] ?? row?.conversion_metrics?.[key] ?? 0) || 0;
  const metricsAvailable = rows.some((row) => Object.keys(row.performance ?? {}).length > 0 || Object.keys(row.conversion_metrics ?? {}).length > 0);
  const performance = rows.reduce((totals, row) => ({
    likes: totals.likes + metricValue(row, 'likes'), comments: totals.comments + metricValue(row, 'comments'),
    reach: totals.reach + metricValue(row, 'reach'), clicks: totals.clicks + metricValue(row, 'clicks'),
    conversions: totals.conversions + metricValue(row, 'conversions'), leads: totals.leads + metricValue(row, 'leads'),
  }), { likes: 0, comments: 0, reach: 0, clicks: 0, conversions: 0, leads: 0 });
  return res.json({
    metrics_available: metricsAvailable,
    metrics: {
      total: rows.length,
      drafts: rows.filter((row) => row.status === 'draft').length,
      approved: rows.filter((row) => row.status === 'approved').length,
      published: rows.filter((row) => row.status === 'published').length,
      failed: rows.filter((row) => row.generation_status === 'failed').length,
      estimated_cost_cents: rows.reduce((sum, row) => sum + Number(row.estimated_cost_cents ?? 0), 0),
      ...performance,
    },
    campaigns: campaigns.data ?? [],
    runs: queue.data ?? [],
  });
});

router.post('/social-content/metrics/refresh', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const { data: items, error } = await supabaseAdmin.from('social_content_items').select('id, instagram_media_id, performance').eq('status', 'published').not('instagram_media_id', 'is', null).limit(100);
  if (error) return res.status(500).json({ error: 'Nao foi possivel carregar publicacoes para atualizar os insights.' });
  let updated = 0;
  const errors: string[] = [];
  for (const item of items ?? []) {
    try {
      const metrics = await fetchInstagramMediaMetrics(item.instagram_media_id as string);
      const { error: updateError } = await supabaseAdmin.from('social_content_items').update({ performance: { ...(item.performance ?? {}), ...metrics }, updated_at: new Date().toISOString() }).eq('id', item.id);
      if (updateError) throw updateError;
      updated += 1;
    } catch (error) {
      errors.push(`${item.id}: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500));
    }
  }
  return res.json({ updated, attempted: items?.length ?? 0, errors });
});

router.post('/social-content/autopilot/run', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const processed = await runSocialContentAutopilotTask();
    return res.json({ processed });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Falha ao executar o autopilot.' });
  }
});

router.patch('/social-content/batch-status', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown): id is string => typeof id === 'string').slice(0, 50) : [];
  const status = req.body?.status;
  if (!ids.length || !['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Selecione itens validos e um status.' });
  const update = status === 'approved'
    ? { status, approved_by: req.authUser!.id, approved_at: new Date().toISOString(), rejection_note: null, updated_at: new Date().toISOString() }
    : { status, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin.from('social_content_items').update(update).in('id', ids).eq('status', 'draft').select('id');
  if (error) return res.status(500).json({ error: 'Nao foi possivel atualizar os itens selecionados.' });
  return res.json({ updated: data?.length ?? 0 });
});
router.get('/social-content', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const limit = Math.max(1, Math.min(100, Number(_req.query.limit ?? 30) || 30));
  const campaignId = typeof _req.query.campaign_id === 'string' ? _req.query.campaign_id : null;
  const generationStatus = typeof _req.query.generation_status === 'string' ? _req.query.generation_status : null;
  let query = supabaseAdmin.from('social_content_items').select(socialFields).order('created_at', { ascending: false }).limit(limit);
  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (generationStatus && ['pending','generating','ready','failed'].includes(generationStatus)) query = query.eq('generation_status', generationStatus);
  const { data, error } = await query;
  if (error) return res.status(error.code === '42P01' ? 503 : 500).json({ error: error.code === '42P01' ? 'MigraÃ§Ã£o do Marketing IA ainda nÃ£o aplicada.' : 'Erro ao carregar conteÃºdos.' });
  const items = await Promise.all(((data ?? []) as SocialContentRow[]).map(withSocialImageUrl));
  return res.json({ items, visual_enabled: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.OPENAI_API_KEY), research_enabled: process.env.SOCIAL_RESEARCH_ENABLED === 'true' });
});

router.post('/social-content', requireAuth, requireAdmin, socialStudioLimiter, async (req: AuthRequest, res: Response) => {
  const input = parseSocialRequest(req.body);
  if (!input) return res.status(400).json({ error: 'Preencha objetivo, pÃºblico, formato e tema corretamente.' });

  const { data: pending, error: insertError } = await supabaseAdmin.from('social_content_items').insert({
    created_by: req.authUser!.id,
    title: `Gerando: ${input.topic}`,
    objective: input.objective,
    audience: input.audience,
    city: input.city ?? null,
    service: input.service ?? null,
    format: input.format,
    generation_status: 'generating',
    brief: input,
  }).select('id').single();
  if (insertError || !pending) return res.status(insertError?.code === '42P01' ? 503 : 500).json({ error: insertError?.code === '42P01' ? 'MigraÃ§Ã£o do Marketing IA ainda nÃ£o aplicada.' : 'NÃ£o foi possÃ­vel criar o rascunho.' });

  try {
    const generated = await createSocialDraft(input);
    const { data, error } = await supabaseAdmin.from('social_content_items').update({
      title: generated.draft.title,
      content: { hook: generated.draft.hook, caption: generated.draft.caption, cta: generated.draft.cta, slides: generated.draft.slides },
      visual_prompt: generated.draft.visualPrompt,
      safety_notes: generated.draft.safetyNotes,
      research_sources: generated.sources,
      strategy_model: getSocialStrategyModel(),
      strategy_usage: generated.usage,
      estimated_cost_cents: generated.estimatedCostCents,
      generation_status: 'ready',
      updated_at: new Date().toISOString(),
    }).eq('id', pending.id).select(socialFields).single();
    if (error || !data) throw new Error(error?.message ?? 'Rascunho nÃ£o encontrado apÃ³s geraÃ§Ã£o.');
    return res.status(201).json({ item: await withSocialImageUrl(data as SocialContentRow) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const schemaMismatch = /no object generated|schema|structured output|valid json/i.test(message);
    await supabaseAdmin.from('social_content_items').update({ generation_status: 'failed', failure_code: schemaMismatch ? 'generation_schema_mismatch' : 'generation_failed', failure_details: schemaMismatch ? `A IA nao retornou o formato esperado. O sistema tentara um formato JSON validado no proximo processamento. Detalhe: ${message}`.slice(0, 2000) : message.slice(0, 2000), safety_notes: [message], updated_at: new Date().toISOString() }).eq('id', pending.id);
    console.error('[social-content] generation:', message);
    return res.status(502).json({ error: message });
  }
});

router.post('/social-content/:id/image', requireAuth, requireAdmin, socialStudioLimiter, async (req: AuthRequest, res: Response) => {
  const { data: item, error } = await supabaseAdmin.from('social_content_items').select('id, visual_prompt, estimated_cost_cents').eq('id', req.params.id).single();
  if (error || !item) return res.status(404).json({ error: 'Rascunho nÃ£o encontrado.' });
  if (!item.visual_prompt) return res.status(400).json({ error: 'Este rascunho nÃ£o possui briefing visual.' });
  try {
    const image = await createSocialImage(item.id, item.visual_prompt);
    const { data: updated, error: updateError } = await supabaseAdmin.from('social_content_items').update({
      image_storage_path: image.storagePath,
      visual_model: image.model,
      visual_usage: image.usage,
      estimated_cost_cents: Number(item.estimated_cost_cents ?? 0) + image.estimatedCostCents,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id).select(socialFields).single();
    if (updateError || !updated) throw new Error(updateError?.message ?? 'NÃ£o foi possÃ­vel atualizar a imagem.');
    return res.json({ item: await withSocialImageUrl(updated as SocialContentRow) });
  } catch (generationError) {
    const message = generationError instanceof Error ? generationError.message : String(generationError);
    await supabaseAdmin.from('social_content_items').update({ failure_code: 'image_generation_failed', failure_details: message.slice(0, 2000), updated_at: new Date().toISOString() }).eq('id', item.id);
    console.error('[social-content] image:', message);
    return res.status(502).json({ error: message });
  }
});

router.patch('/social-content/:id/status', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const status = req.body?.status;
  if (status !== 'approved' && status !== 'rejected') return res.status(400).json({ error: 'Status invÃ¡lido.' });
  const update = status === 'approved'
    ? { status, approved_by: req.authUser!.id, approved_at: new Date().toISOString(), rejection_note: null, updated_at: new Date().toISOString() }
    : { status, rejection_note: typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : null, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin.from('social_content_items').update(update).eq('id', req.params.id).select(socialFields).single();
  if (error || !data) return res.status(404).json({ error: 'Rascunho nÃ£o encontrado.' });
  return res.json({ item: await withSocialImageUrl(data as SocialContentRow) });
});

router.post('/social-content/:id/publish-instagram-story', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { data: item, error: itemError } = await supabaseAdmin.from('social_content_items').select('id, format, status, generation_status, image_storage_path, content').eq('id', req.params.id).single();
    if (itemError || !item) return res.status(404).json({ error: 'Conte?do n?o encontrado.' });
    if (item.format !== 'story') return res.status(409).json({ error: 'Somente conte?dos no formato Story podem ser publicados como Story.' });
    if (item.status !== 'approved' || item.generation_status !== 'ready') return res.status(409).json({ error: 'Aprove o Story antes de publicar.' });
    if (!item.image_storage_path) return res.status(409).json({ error: 'Gere e revise uma arte antes de publicar o Story.' });
    const { data: signed, error: signedError } = await supabaseAdmin.storage.from('social-content').createSignedUrl(item.image_storage_path, 3_600);
    if (signedError || !signed?.signedUrl) throw new Error(signedError?.message ?? 'N?o foi poss?vel preparar a imagem do Story.');
    const published = await publishApprovedInstagramStory({ imageUrl: signed.signedUrl });
    const { data: updated, error: updateError } = await supabaseAdmin.from('social_content_items').update({ status: 'published', instagram_container_id: published.containerId, instagram_media_id: published.mediaId, published_at: new Date().toISOString(), publication_error: null, updated_at: new Date().toISOString() }).eq('id', item.id).select(socialFields).single();
    if (updateError || !updated) throw new Error(updateError?.message ?? 'N?o foi poss?vel salvar a publica??o do Story.');
    return res.json({ item: await withSocialImageUrl(updated), instagram_media_id: published.mediaId, highlight_action: 'Adicione este Story ao Destaque pelo aplicativo do Instagram.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabaseAdmin.from('social_content_items').update({ publication_error: message.slice(0, 2000), updated_at: new Date().toISOString() }).eq('id', req.params.id);
    return res.status(502).json({ error: message });
  }
});

router.post('/social-content/:id/publish-instagram', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { data: item, error } = await supabaseAdmin.from('social_content_items')
    .select('id, status, generation_status, image_storage_path, content')
    .eq('id', req.params.id).single();
  if (error || !item) return res.status(404).json({ error: 'Rascunho não encontrado.' });
  if (item.status !== 'approved' || item.generation_status !== 'ready') return res.status(409).json({ error: 'Aprovação humana é obrigatória antes de publicar.' });
  if (!item.image_storage_path) return res.status(409).json({ error: 'Gere e revise uma arte antes de publicar no Instagram.' });

  const content = (item.content ?? {}) as { caption?: unknown; cta?: unknown };
  const caption = [typeof content.caption === 'string' ? content.caption.trim() : '', typeof content.cta === 'string' ? content.cta.trim() : ''].filter(Boolean).join('\n\n');
  const { data: signed, error: signedError } = await supabaseAdmin.storage.from('social-content').createSignedUrl(item.image_storage_path, 3_600);
  if (signedError || !signed?.signedUrl) return res.status(502).json({ error: 'Não foi possível preparar a arte privada para publicação.' });

  try {
    const published = await publishApprovedInstagramImage({ imageUrl: signed.signedUrl, caption });
    const { data: updated, error: updateError } = await supabaseAdmin.from('social_content_items').update({
      status: 'published', published_at: new Date().toISOString(), published_by: req.authUser!.id,
      instagram_container_id: published.containerId, instagram_media_id: published.mediaId,
      publication_error: null, updated_at: new Date().toISOString(),
    }).eq('id', item.id).select(socialFields).single();
    if (updateError || !updated) throw new Error(updateError?.message ?? 'A publicação ocorreu, mas o histórico não pôde ser salvo.');
    return res.json({ item: await withSocialImageUrl(updated as SocialContentRow), instagram_media_id: published.mediaId });
  } catch (publishError) {
    const message = publishError instanceof Error ? publishError.message : String(publishError);
    await supabaseAdmin.from('social_content_items').update({ publication_error: message.slice(0, 1000), updated_at: new Date().toISOString() }).eq('id', item.id);
    console.error('[social-content] instagram publish:', message);
    return res.status(502).json({ error: message });
  }
});
router.get('/social-content/highlights', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('social_highlight_packs').select('id, slug, name, category, description, cover_color, cover_logo_url, stories, status, instagram_story_ids, last_published_at, last_error, created_at, updated_at').neq('status', 'archived').order('updated_at', { ascending: false });
  if (error) return res.status(error.code === '42P01' ? 503 : 500).json({ error: error.code === '42P01' ? 'Migracao dos pacotes de Destaques ainda nao aplicada.' : error.message });
  return res.json({ packs: data ?? [], brand_kit: MELOCALE_BRAND_KIT });
});

router.post('/social-content/highlights/bootstrap', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { data: existing, error: readError } = await supabaseAdmin.from('social_highlight_packs').select('slug').neq('status', 'archived');
    if (readError) {
      if (readError.code === '42P01') return res.status(503).json({ error: 'Migracao dos pacotes de Destaques ainda nao aplicada.' });
      throw readError;
    }
    const known = new Set((existing ?? []).map((row) => row.slug));
    const missing = DEFAULT_HIGHLIGHT_PACKS.filter((pack) => !known.has(pack.slug)).map((pack) => ({ created_by: req.authUser!.id, slug: pack.slug, name: pack.name, category: pack.category, description: pack.description, cover_color: pack.coverColor, cover_logo_url: MELOCALE_BRAND_KIT.logoUrl, stories: highlightStoriesFor(pack), status: 'ready' }));
    if (missing.length) {
      const { error } = await supabaseAdmin.from('social_highlight_packs').insert(missing);
      if (error) throw error;
    }
    const { data, error } = await supabaseAdmin.from('social_highlight_packs').select('id, slug, name, category, description, cover_color, cover_logo_url, stories, status, instagram_story_ids, last_published_at, last_error, created_at, updated_at').neq('status', 'archived').order('updated_at', { ascending: false });
    if (error) throw error;
    return res.json({ packs: data ?? [], created: missing.length });
  } catch (error) {
    return res.status(error instanceof Error ? 500 : 500).json({ error: error instanceof Error ? error.message : 'Nao foi possivel criar os Destaques.' });
  }
});

router.patch('/social-content/highlights/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const status = typeof body.status === 'string' ? body.status : undefined;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status !== undefined) {
    if (!['draft', 'ready', 'published', 'archived'].includes(status)) return res.status(400).json({ error: 'Status de Destaque invalido.' });
    update.status = status;
    if (status === 'archived') update.last_error = 'Arquivado pelo administrador.';
  }
  for (const field of ['name', 'description'] as const) if (typeof body[field] === 'string') update[field] = body[field].trim().slice(0, field === 'name' ? 80 : 500);
  if (typeof body.cover_color === 'string' && /^#[0-9a-f]{6}$/i.test(body.cover_color)) update.cover_color = body.cover_color;
  if (Object.keys(update).length === 1) return res.status(400).json({ error: 'Nenhuma alteracao valida informada.' });
  const { data, error } = await supabaseAdmin.from('social_highlight_packs').update(update).eq('id', req.params.id).select().single();
  if (error || !data) return res.status(error?.code === '42P01' ? 503 : 404).json({ error: error?.code === '42P01' ? 'Migracao dos pacotes de Destaques ainda nao aplicada.' : error?.message ?? 'Destaque nao encontrado.' });
  return res.json({ pack: data });
});

router.get('/social-content/campaigns', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('social_content_campaigns')
    .select('id, name, city, service, audience, objective, posts_per_week, status, auto_generate, research_enabled, weekly_generation_limit, plan, estimated_cost_cents, budget_cents, spent_cents, last_autopilot_at, archived_at, last_error, created_at, updated_at')
    .order('updated_at', { ascending: false }).limit(30);
  if (error) return res.status(error.code === '42P01' ? 503 : 500).json({ error: error.code === '42P01' ? 'Migração do piloto de campanhas ainda não aplicada.' : 'Erro ao carregar campanhas.' });
  return res.json({ campaigns: data ?? [], autopilot_enabled: process.env.SOCIAL_AUTOPILOT_ENABLED === 'true' });
});

router.post('/social-content/campaigns', requireAuth, requireAdmin, socialStudioLimiter, async (req: AuthRequest, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const city = typeof body.city === 'string' ? body.city.trim().slice(0, 100) : '';
  const service = typeof body.service === 'string' ? body.service.trim().slice(0, 100) : null;
  const postsPerWeek = Math.max(1, Math.min(7, Number(body.posts_per_week) || 3));
  const budgetCents = Math.max(0, Math.min(1000000, Number(body.budget_cents) || 0));
  const autoGenerateImages = body.auto_generate_images !== false;
  const trendRadarEnabled = body.trend_radar_enabled === true;
  const autoGenerate = body.auto_generate === true;
  const campaignStatus = autoGenerate ? 'active' : 'paused';
  const objective = body.objective as SocialContentRequest['objective'];
  const audience = body.audience as SocialContentRequest['audience'];
  if (budgetCents <= 0) return res.status(400).json({ error: 'Defina um orcamento total maior que zero para limitar o consumo das APIs de IA.' });
  const { data: duplicate } = await supabaseAdmin.from('social_content_campaigns').select('id, name').neq('status', 'archived').ilike('name', name).ilike('city', city).limit(1).maybeSingle();
  if (duplicate) return res.status(409).json({ error: 'Ja existe uma campanha ativa ou pausada com este nome e cidade. Arquive a duplicada antes de criar outra.' });
  if (name.length < 3 || city.length < 2 || !['reach','client_leads','professional_signup','trust','education'].includes(objective) || !['client','professional','mixed'].includes(audience)) return res.status(400).json({ error: 'Preencha os dados da campanha corretamente.' });
  try {
    const generated = await createSocialCampaignPlan({ name, city, service: service ?? undefined, postsPerWeek, objective, audience, research: body.research === true });
    const { data: campaign, error } = await supabaseAdmin.from('social_content_campaigns').insert({ created_by: req.authUser!.id, name, city, service, objective, audience, posts_per_week: postsPerWeek, status: campaignStatus, auto_generate: autoGenerate, research_enabled: body.research === true, weekly_generation_limit: postsPerWeek, budget_cents: budgetCents, auto_generate_images: autoGenerateImages, trend_radar_enabled: trendRadarEnabled, plan: generated.plan.items, plan_model: getSocialStrategyModel(), plan_usage: generated.usage, estimated_cost_cents: generated.estimatedCostCents, last_planned_at: new Date().toISOString() }).select().single();
    if (error || !campaign) throw new Error(error?.message ?? 'Não foi possível salvar a campanha.');
    const base = new Date();
    const planned = generated.plan.items.map((item, index) => ({ created_by: req.authUser!.id, campaign_id: campaign.id, title: `Planejado: ${item.topic}`, objective, audience, city, service, format: item.format, generation_status: 'pending', brief: { topic: item.topic, objective, audience, format: item.format, city, service, research: body.research === true, planned: true }, content_pillar: item.pillar, quality_score: item.qualityScore, planned_for: new Date(base.getTime() + index * Math.floor((7 / postsPerWeek) * 86400000)).toISOString() }));
    const { error: plannedError } = await supabaseAdmin.from('social_content_items').insert(planned);
    if (plannedError) throw new Error(plannedError.message);
    return res.status(201).json({ campaign, planned_count: planned.length });
  } catch (error) { const message = error instanceof Error ? error.message : String(error); console.error('[social-campaign] plan:', message); return res.status(502).json({ error: message }); }
});

router.post('/social-content/:id/retry', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('social_content_items').update({ generation_status: 'pending', failure_code: null, failure_details: null, safety_notes: [], updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('generation_status', 'failed').select(socialFields).single();
  if (error || !data) return res.status(404).json({ error: 'Falha nao encontrada ou item ja esta em processamento.' });
  return res.json({ item: await withSocialImageUrl(data as SocialContentRow) });
});

router.patch('/social-content/campaigns/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const status = req.body?.status;
  const autoGenerate = req.body?.auto_generate;
  if (!['active', 'paused', 'archived'].includes(status) || typeof autoGenerate !== 'boolean') return res.status(400).json({ error: 'Status ou automação inválidos.' });
  const { data, error } = await supabaseAdmin.from('social_content_campaigns').update({ status, auto_generate: status === 'active' ? autoGenerate : false, archived_at: status === 'archived' ? new Date().toISOString() : null, archive_reason: status === 'archived' ? (typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 300) : 'Arquivada pelo administrador') : null, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
  if (error || !data) return res.status(404).json({ error: 'Campanha não encontrada.' });
  return res.json({ campaign: data });
});
export default router;
