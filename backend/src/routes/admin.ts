import { Router, Response } from "express";
import { AuthRequest, requireAuth, requireAdmin } from "../middleware/auth.js";
import { supabaseAdmin, coinPackagesCache, loadCoinPackages } from "../config.js";
import { runHealthCheck, estimateSystemLoadPct } from "../lib/systemHealthCheck.js";
import { withTimeout } from "../lib/timeout.js";
import { sendPushToUser } from "../lib/push.js";
import { HANDOFF_MESSAGE } from "../services/whatsappConversationService.js";

const router = Router();

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
    return res.status(500).json({ error: "Erro ao buscar usuários ativos." });
  }
});

router.patch("/professional-status", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, is_active } = req.body;
    if (!user_id || typeof is_active !== "boolean") {
      return res.status(400).json({ error: "user_id e is_active são obrigatórios." });
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
// Corrige inconsistência: seta profiles.role = 'professional' para usuário que tem row em professionals mas role errado
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
    return res.status(500).json({ error: "Erro ao buscar dados de autenticação." });
  }
});

router.post("/categories", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: "name e slug obrigatórios." });
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
    if (typeof is_active !== "boolean") return res.status(400).json({ error: "is_active obrigatório." });
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
      if (error || !data.session || !data.user) throw new Error(error?.message ?? "Sem sessão");
      clientUserId = data.user.id;
      return `OK — user_id: ${clientUserId}`;
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
      if (error || !data.session || !data.user) throw new Error(error?.message ?? "Sem sessão");
      profUserId = data.user.id;
      return `OK — user_id: ${profUserId}`;
    });

    await runTest("t3", "Cliente cria pedido", async () => {
      if (!clientUserId) throw new Error("Depende do T1 — login cliente falhou");
      const { data: clientProfile } = await supabaseAdmin
        .from("clients")
        .select("id")
        .eq("id", clientUserId)
        .maybeSingle();
      if (!clientProfile) throw new Error("Perfil cliente não encontrado");
      const { data, error } = await supabaseAdmin.rpc("e2e_insert_lead", {
        p_client_id: clientUserId,
        p_title: `${E2E_PREFIX} Pintura de sala`,
        p_description: `${E2E_PREFIX} Teste automatizado — pode ser deletado`,
        p_category: "Pintura",
        p_location: "São Paulo, SP",
        p_budget_min: 100,
        p_budget_max: 500,
      });
      if (error) throw new Error(error.message);
      createdLeadId = data as string;
      return `OK — lead_id: ${createdLeadId}`;
    });

    await runTest("t4", "Profissional vê lead disponível", async () => {
      if (!createdLeadId) throw new Error("Depende do T3 — lead não criado");
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select("id, title, status")
        .eq("id", createdLeadId)
        .single();
      if (error) throw new Error(error.message);
      if (data.status !== "open") throw new Error(`Status inesperado: ${data.status}`);
      return `OK — "${data.title}" visível e ativo`;
    });

    await runTest("t5", "Profissional compra lead", async () => {
      if (!createdLeadId || !profUserId) throw new Error("Depende do T2 e T3");
      const { data: prof } = await supabaseAdmin
        .from("professionals")
        .select("id")
        .eq("user_id", profUserId)
        .maybeSingle();
      if (!prof) throw new Error("Perfil profissional não encontrado");
      const { data: chatId, error } = await supabaseAdmin.rpc("e2e_insert_lead_purchase", {
        p_lead_id: createdLeadId,
        p_professional_id: prof.id,
        p_professional_user_id: profUserId,
        p_client_id: clientUserId,
      });
      if (error) throw new Error(error.message);
      createdChatId = chatId;
      return `OK — chat_id: ${createdChatId}`;
    });

    await runTest("t6", "Chat aberto após compra", async () => {
      if (!createdChatId) throw new Error("Depende do T5 — compra não realizada");
      const { data, error } = await supabaseAdmin
        .from("conversations")
        .select("id, professional_id, client_id")
        .eq("id", createdChatId)
        .single();
      if (error) throw new Error(error.message);
      return `OK — conversa criada (id: ${data.id})`;
    });

    await runTest("t7", "Enviar mensagem no chat", async () => {
      if (!createdChatId) throw new Error("Depende do T6 — chat não existe");
      const { data, error } = await supabaseAdmin
        .from("messages")
        .insert({
          conversation_id: createdChatId,
          body: `${E2E_PREFIX} Olá, mensagem automática de teste`,
          sender_type: "client",
          read_at: null,
          attachments: [],
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return `OK — message_id: ${data.id}`;
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
      if (process.env.NODE_ENV !== 'production') console.log("[e2e] cleanup concluído");
    } catch (cleanupErr) {
      console.error("[e2e] cleanup parcial:", cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr));
    }

    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const finishedAt = new Date().toISOString();
    if (process.env.NODE_ENV !== 'production') console.log(`[e2e] run-tests finalizado: ${finishedAt} — passed=${passed} failed=${failed}`);

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

// ── POST /api/admin/premiar-profissional ──────────────────────────────────────
router.post("/premiar-profissional", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, coins, motivo } = req.body as {
      user_id?: string;
      coins?: number;
      motivo?: string;
    };

    if (!user_id || typeof user_id !== "string") {
      return res.status(400).json({ error: "user_id obrigatório" });
    }
    if (!coins || typeof coins !== "number" || coins < 1 || coins > 10_000) {
      return res.status(400).json({ error: "coins deve ser um número entre 1 e 10000" });
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
      title: "🏆 Você foi premiado!",
      body: motivo
        ? `Você recebeu ${coins} moedas: ${motivo}`
        : `Você recebeu ${coins} moedas como prêmio do admin.`,
    });

    // Telegram alert (best-effort)
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      const text =
        `🏆 *Premiação manual*\n` +
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

// ── Garantia de primeira compra do profissional ─────────────────────────────
// Aprovar credita as moedas via credit_professional_guarantee (RPC própria,
// separada de credit_professional_coins que é específico de compra Stripe).
router.post("/guarantee-requests/:id/approve", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { note } = req.body as { note?: string };
  try {
    const { data: request, error: fetchErr } = await supabaseAdmin
      .from("professional_guarantee_requests")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !request) return res.status(404).json({ error: "Solicitação não encontrada." });
    if (request.status !== "pending") return res.status(400).json({ error: "Solicitação não está pendente." });

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
      return res.status(409).json({ error: (rpcResult as { error?: string }).error ?? "Já creditado anteriormente." });
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
    if (fetchErr || !request) return res.status(404).json({ error: "Solicitação não encontrada." });
    if (request.status !== "pending") return res.status(400).json({ error: "Solicitação não está pendente." });

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

// Push em massa — ferramenta reutilizável pra avisos gerais (não só o anúncio
// de indicação), por isso fica genérica (title/body/url) em vez de hardcoded.
// Um envio por usuário único, não por subscription/dispositivo.
router.post("/broadcast-push", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { title, body, url, role } = req.body as { title?: string; body?: string; url?: string; role?: 'client' | 'professional' };
  if (!title || !body) return res.status(400).json({ error: "title e body são obrigatórios" });

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

// Health check real pra página de Observabilidade — diferente de /api/health (público,
// trivial, usado por monitores externos). Mede latência real de Supabase e Stripe, uptime
// do processo, memória, event loop lag, tamanho do banco, info de deploy (env vars
// automáticas do Render), freshness do webhook de pagamentos e carga estimada do sistema.
// Se a requisição chegou até aqui, o backend já está "up" por definição.
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

// Checklist de configuração — quais env vars críticas estão presentes ou faltando, sem
// NUNCA expor valor (só booleano). Resolve a pergunta "o que falta configurar" num lugar
// só, em vez de descobrir aos poucos pelos avisos espalhados pela página.
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

// Histórico das últimas 24h gravadas pelo cron healthCheck.ts (a cada 5min) — uptime% real
// por target + detecção de incidentes (transições up→down), sem depender do Sentry estar
// configurado. Também devolve o resultado da última auditoria Stripe (stripeAudit.ts),
// que antes só ia pro Telegram e se perdia.
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
    return res.status(500).json({ error: "Erro ao buscar histórico." });
  }
});

// Issues recentes do Sentry (backend + frontend) pra timeline de incidentes real.
// Sem SENTRY_API_TOKEN/SENTRY_ORG_SLUG/SENTRY_PROJECT_SLUGS configurados no Render,
// responde configured:false — front mostra aviso em vez de fingir que não tem erro.
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
        // statsPeriod só afeta o gráfico interno de cada issue, NÃO filtra quais issues
        // a API retorna — por isso o filtro real de 24h é feito abaixo, em lastSeen.
        // limit maior (25, não 10) pra ter candidatos suficientes depois do filtro.
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

// Estimativas de custo — NÃO é fatura real, é aproximação pra dar noção de
// ordem de grandeza. Haiku: ~input 2.500 tok (system prompt grande + histórico
// + contexto da plataforma) + ~200 tok de saída, no preço do Claude Haiku
// (~$1/MTok input, ~$5/MTok output) ≈ R$0,015/chamada (câmbio ~R$5,50).
// Whisper: mesma estimativa usada quando a transcrição foi implementada.
const HAIKU_COST_BRL_PER_CALL = 0.015;
const WHISPER_COST_BRL_PER_AUDIO = 0.02;

// Visibilidade real de uso do bot do WhatsApp — hoje não existe nenhuma.
// Handoffs contados via whatsapp_messages (sender='system', body=HANDOFF_MESSAGE)
// em vez do snapshot atual de handoff_reason em whatsapp_conversations, porque
// esse snapshot muda com o tempo (handoffTimeout.ts zera handoff_reason depois
// de 24h) — a mensagem de handoff é um evento carimbado, não se perde.
//
// Breakdown de handoff por urgência FICOU DE FORA: urgency (decision.urgency
// em whatsappConversationService.ts) é usado só pra montar o título do push
// no momento do handoff e nunca é persistido em nenhuma coluna — não dá pra
// reconstruir depois dos fatos sem adicionar uma coluna nova (fora do escopo
// aqui). Top 5 perguntas/tópicos também ficou de fora — exigiria alguma
// classificação, e uma categorização frágil aqui seria pior que nada.
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
    const audioTranscribed = inbound.filter((m) => (m.body ?? "").startsWith("(áudio)"));
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

    // Mensagens recebidas por dia, pro gráfico simples do frontend.
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
      estimated_cost_note: "Estimativa aproximada, não é fatura real.",
      messages_per_day: messagesPerDay,
    });
  } catch (err) {
    console.error("/api/admin/bot-stats error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao buscar estatísticas do bot." });
  }
});

export default router;
