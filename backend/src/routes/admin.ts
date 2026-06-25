import { Router, Response } from "express";
import { AuthRequest, requireAuth, requireAdmin } from "../middleware/auth.js";
import { supabaseAdmin, coinPackagesCache, loadCoinPackages } from "../config.js";
import { withTimeout } from "../lib/timeout.js";

const router = Router();

router.get("/active-users", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let count = 0;
    let page = 1;
    while (true) {
      const { data, error } = await withTimeout(
        supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
      );
      if (error || !data?.users?.length) break;
      count += data.users.filter(
        (u) => u.last_sign_in_at && u.last_sign_in_at > cutoff
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
    console.log(`[e2e] run-tests iniciado: ${startedAt}`);

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
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: TEST_CLIENT_EMAIL,
        password: TEST_CLIENT_PASSWORD,
      });
      if (error || !data.session) throw new Error(error?.message ?? "Sem sessão");
      clientUserId = data.user.id;
      return `OK — user_id: ${clientUserId}`;
    });

    await runTest("t2", "Login profissional", async () => {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: TEST_PROF_EMAIL,
        password: TEST_PROF_PASSWORD,
      });
      if (error || !data.session) throw new Error(error?.message ?? "Sem sessão");
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
      console.log("[e2e] cleanup concluído");
    } catch (cleanupErr) {
      console.error("[e2e] cleanup parcial:", cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr));
    }

    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const finishedAt = new Date().toISOString();
    console.log(`[e2e] run-tests finalizado: ${finishedAt} — passed=${passed} failed=${failed}`);

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

// Health check real pra página de Observabilidade — diferente de /api/health (público,
// trivial, usado por monitores externos). Esse aqui mede latência real do Supabase.
// Se a requisição chegou até aqui, o backend já está "up" por definição.
router.get("/system-health", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const dbStart = Date.now();
  let dbStatus: "up" | "down" = "up";
  let dbLatencyMs: number | null = null;

  try {
    const { error } = await withTimeout(
      supabaseAdmin.from("profiles").select("id", { head: true, count: "exact" }).limit(1),
      3000
    );
    dbLatencyMs = Date.now() - dbStart;
    if (error) dbStatus = "down";
  } catch {
    dbStatus = "down";
    dbLatencyMs = Date.now() - dbStart;
  }

  return res.json({
    backend: { status: "up" },
    db: { status: dbStatus, latency_ms: dbLatencyMs },
    checked_at: new Date().toISOString(),
  });
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

  try {
    const results = await Promise.all(
      projects.map(async (project) => {
        const r = await fetch(
          `https://sentry.io/api/0/projects/${org}/${project}/issues/?statsPeriod=24h&query=is:unresolved&limit=10`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!r.ok) return [];
        const data = (await r.json()) as Array<{
          title: string; count: string; level: string; lastSeen: string; permalink: string;
        }>;
        return data.map((i) => ({
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

export default router;
