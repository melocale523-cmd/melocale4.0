// Trigger Render redeploy 2026-04-28
import express, { Request, Response, NextFunction } from "express";

interface AuthRequest extends Request {
  authUser?: { id: string; email: string; role: string }
}
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import Anthropic from '@anthropic-ai/sdk';
import rateLimit from "express-rate-limit";
import cors from "cors";

// Proteção global contra crashes (uncaught e unhandled)
process.on("uncaughtException", (err) => {
  console.error(JSON.stringify({
    level: "error",
    event: "uncaughtException",
    message: "Ocorreu um erro crítico não tratado.",
    error: err.message,
    stack: err.stack
  }));
  process.exit(1); 
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(JSON.stringify({
    level: "error",
    event: "unhandledRejection",
    message: "Promessa rejeitada não tratada.",
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  }));
  process.exit(1);
});

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error("❌ ERRO CRÍTICO: STRIPE_SECRET_KEY está ausente nas variáveis de ambiente.");
}
const stripe = new Stripe(stripeSecretKey);

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
if (!STRIPE_WEBHOOK_SECRET) {
  throw new Error("❌ ERRO CRÍTICO: STRIPE_WEBHOOK_SECRET está ausente nas variáveis de ambiente.");
}

// Inicializa Supabase Admin (Bypass RLS)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("❌ ERRO CRÍTICO: SUPABASE_URL (ou VITE_SUPABASE_URL) está ausente nas variáveis de ambiente.");
}
if (!supabaseServiceKey) {
  throw new Error("❌ ERRO CRÍTICO: SUPABASE_SERVICE_ROLE_KEY está ausente nas variáveis de ambiente.");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('❌ ERRO CRÍTICO: ANTHROPIC_API_KEY não definida — servidor não pode subir');
}
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const chatRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de mensagens atingido. Tente novamente em 1 hora.' },
});

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Token inválido' });

  (req as AuthRequest).authUser = user as { id: string; email: string; role: string };
  next();
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  const EXTRA_ORIGINS = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const ALLOWED_ORIGINS_EXACT = new Set([
    'https://www.melocale.com.br',
    'http://localhost:5173',
    ...EXTRA_ORIGINS,
  ]);

  // Matches preview deployments of this project only (e.g. melocale4-0-<hash>.vercel.app)
  const VERCEL_PREVIEW_RE = /^https:\/\/melocale4-0-[^.]+\.vercel\.app$/i;

  const isOriginAllowed = (origin: string) =>
    ALLOWED_ORIGINS_EXACT.has(origin) || VERCEL_PREVIEW_RE.test(origin);

  const corsOptions: Parameters<typeof cors>[0] = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature', 'x-client-info', 'apikey'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
  app.use(cors(corsOptions));

  // Webhook deve usar express.raw
  app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET!);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }

    // Deduplicação persistente: verifica se este evento já foi processado no banco.
    // Cobre o caso crítico de double-crediting após restart do servidor.
    const { data: existingTx } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id')
      .eq('stripe_event_id', event.id)
      .maybeSingle();

    if (existingTx) {
      console.log(`[webhook] evento ${event.id} já processado — ignorando`);
      return res.json({ received: true });
    }

    const COIN_PACKAGES: Record<string, { coins: number; name: string }> = {
      'pack_starter': { coins: 60,  name: 'Básico'        },
      'pack_pro':     { coins: 200, name: 'Popular'       },
      'pack_premium': { coins: 560, name: 'Máximo'        },
    };

    const PLAN_WELCOME_COINS: Record<string, number> = {
      plan_basic:     30,
      plan_pro:       80,
      plan_business:  200,
    };

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId    = session.metadata?.user_id || session.metadata?.userId;
      const packageId = session.metadata?.package_id;
      const sessionType = session.metadata?.type;

      // --- Gravar assinatura ---
      if (sessionType === "subscription" && userId && packageId) {
        const stripeSubId = typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription as any)?.id ?? null;
        try {
          await supabaseAdmin.from("user_subscriptions").upsert({
            user_id: userId,
            stripe_subscription_id: stripeSubId,
            package_id: packageId,
            status: "active",
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        } catch (subErr) {
          console.error("Erro ao gravar user_subscription:", subErr);
        }
      }

      // --- Creditar moedas ---
      let coinsAmount = 0;
      let coinLabel = "avulso";
      if (sessionType === "subscription" && packageId) {
        coinsAmount = PLAN_WELCOME_COINS[packageId] ?? 0;
        coinLabel = `boas-vindas:${packageId}`;
      } else if (packageId && COIN_PACKAGES[packageId]) {
        coinsAmount = COIN_PACKAGES[packageId].coins;
        coinLabel = COIN_PACKAGES[packageId].name;
      } else {
        coinsAmount = parseInt(session.metadata?.coins || session.metadata?.coinsAmount || "0", 10);
      }

      if (userId && coinsAmount > 0) {
        const { error: rpcErr } = await supabaseAdmin.rpc("credit_wallet", {
          p_user_id: userId,
          p_amount: coinsAmount,
          p_stripe_session_id: session.id,
          p_stripe_event_id: event.id
        });
        if (rpcErr) {
          console.error("Erro no RPC credit_wallet:", rpcErr);
          return res.status(500).json({ error: "Falha ao creditar" });
        }

        const { error: txErr } = await supabaseAdmin.from("wallet_transactions").insert({
          user_id: userId,
          kind: sessionType === "subscription" ? "bonus" : "deposit",
          amount: coinsAmount,
          reference: `Stripe — ${coinLabel} — ${session.id}`,
          stripe_session_id: session.id,
          stripe_event_id: event.id,
          created_at: new Date().toISOString(),
        });
        if (txErr) {
          console.error("Erro ao inserir wallet_transaction:", txErr);
          return res.status(500).json({ error: "Falha ao creditar" });
        }
      }
    }

    // --- Sincronizar status de assinatura ---
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const newStatus = event.type === "customer.subscription.deleted" ? "canceled" : subscription.status;
      try {
        await supabaseAdmin.from("user_subscriptions")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscription.id);
      } catch (updErr) {
        console.error("Erro ao atualizar user_subscription:", updErr);
      }
    }

    res.json({ received: true });
  });

  app.use(express.json());

  app.use("/api/", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  }));

  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // API route for AI Chat
  app.post("/api/chat", chatRateLimit, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    const SUSPICIOUS_PATTERN = /ignore|system\s*prompt|assistant|jailbreak|prompt\s*injection/i;

    function sanitizeUserData(raw: Record<string, unknown>): {
      name: string;
      role: 'client' | 'professional' | null;
      category: string;
      coinBalance: unknown;
      activePlan: unknown;
      leadsBought: unknown;
      totalPedidos: unknown;
      openTickets: unknown;
      activeSubscriptions: unknown;
    } {
      const stripTags = (v: unknown, max: number): string => {
        if (typeof v !== 'string') return '';
        return v.replace(/<[^>]*>/g, '').replace(/\n|\r/g, ' ').trim().slice(0, max);
      };

      const name = stripTags(raw.name, 100);
      const category = stripTags(raw.category, 100);

      if (SUSPICIOUS_PATTERN.test(name) || SUSPICIOUS_PATTERN.test(category)) {
        throw Object.assign(new Error('Conteúdo inválido em userData'), { status: 400 });
      }

      const rawRole = raw.role;
      const role: 'client' | 'professional' | null =
        rawRole === 'client' || rawRole === 'professional' ? rawRole : null;

      if (rawRole !== undefined && rawRole !== null && role === null) {
        throw Object.assign(new Error('role inválido'), { status: 400 });
      }

      return {
        name,
        role,
        category,
        coinBalance: raw.coinBalance,
        activePlan: raw.activePlan,
        leadsBought: raw.leadsBought,
        totalPedidos: raw.totalPedidos,
        openTickets: raw.openTickets,
        activeSubscriptions: raw.activeSubscriptions,
      };
    }

    const buildSystemPrompt = (context: string, userData: Record<string, any>) => {
      const name = userData.name || 'usuário';

      const BASE = `Você é o Assistente MeloCalé — amigável, direto e focado em ajudar. Use linguagem simples. Respostas curtas (máx 3 parágrafos). Sempre termine com uma ação clara. Use no máximo 2 emojis por resposta. Nunca invente informações.`;

      const PLATFORM_KNOWLEDGE = `
SOBRE A MELOCALÉ: Conecta clientes que precisam de serviços domésticos a profissionais qualificados.
PLANOS: Starter R$37/mês (25% desc + 30 moedas) | PRO R$67/mês (40% desc + 80 moedas) ⭐ | Elite R$127/mês (55% desc + 200 moedas)
MOEDAS: Básico 60 por R$24,90 | Popular 200 por R$59,90 | Máximo 560 por R$119,90. Nunca expiram.
LEADS: custam 10-150 moedas dependendo de orçamento, urgência e categoria.`;

      if (context === 'professional') {
        const balance = userData.coinBalance ?? 0;
        const plan = userData.activePlan;
        const leads = userData.leadsBought ?? 0;
        const planNames: Record<string, string> = { plan_basic: 'Starter', plan_pro: 'PRO', plan_business: 'Elite' };

        return `${BASE}

CONTEXTO: Você está no painel PROFISSIONAL conversando com ${name}.
DADOS REAIS DO USUÁRIO:
- Saldo atual: ${balance} moedas${balance < 20 ? ' ⚠️ BAIXO' : ''}
- Plano ativo: ${plan ? planNames[plan] || plan : 'Nenhum (sem desconto)'}
- Leads comprados: ${leads}

${PLATFORM_KNOWLEDGE}

COMPORTAMENTO NESTE CONTEXTO:
- Se saldo < 20: mencione que está baixo e sugira recarregar
- Se sem plano: sugira o PRO como melhor custo-benefício
- Foque em estratégias para fechar mais serviços
- Ajude com dúvidas sobre leads, moedas, planos, perfil
- NUNCA fale sobre funcionalidades de cliente ou admin`;
      }

      if (context === 'client') {
        const pedidos = userData.totalPedidos ?? 0;

        return `${BASE}

CONTEXTO: Você está no painel CLIENTE conversando com ${name}.
DADOS REAIS DO USUÁRIO:
- Total de pedidos criados: ${pedidos}

${PLATFORM_KNOWLEDGE}

COMPORTAMENTO NESTE CONTEXTO:
- Ajude a criar pedidos, entender propostas, contratar profissionais
- Se pedidos = 0: incentive a criar o primeiro pedido (é grátis!)
- Explique como funciona o processo de contratação
- NUNCA fale sobre moedas, leads ou funcionalidades de profissional/admin`;
      }

      if (context === 'admin') {
        const tickets = userData.openTickets ?? 0;
        const subs = userData.activeSubscriptions ?? 0;

        return `${BASE}

CONTEXTO: Você está no painel ADMIN conversando com ${name}.
DADOS REAIS DO SISTEMA:
- Tickets de suporte abertos: ${tickets}
- Assinaturas ativas: ${subs}

COMPORTAMENTO NESTE CONTEXTO:
- Responda perguntas técnicas sobre o sistema
- Ajude a interpretar métricas e dados
- Sugira ações baseadas nos dados (ex: muitos tickets = verificar bug)
- Pode discutir estratégias de negócio e crescimento da plataforma
- Tom mais técnico e direto`;
      }

      // landing / default
      return `${BASE}

CONTEXTO: Você está na PÁGINA INICIAL — o usuário pode ser visitante, cliente ou profissional.

${PLATFORM_KNOWLEDGE}

COMPORTAMENTO NESTE CONTEXTO:
- Foco em CONVERSÃO: convença visitantes a se cadastrar
- Primeira pergunta: descubra se é cliente ou profissional
- Para clientes: é grátis, rápido, seguro
- Para profissionais: ROI dos leads, plano PRO se paga em 2-3 clientes
- NUNCA mencione funcionalidades de admin`;
    };

    try {
      const { messages, context = 'landing', userData: rawUserData = {} } = req.body;
      const userData = sanitizeUserData(rawUserData as Record<string, unknown>);
      const systemPrompt = buildSystemPrompt(context, userData);
      const mapped = (messages as { role: string; text: string }[])
        .map((m) => ({
          role: (m.role === 'model' || m.role === 'bot' || m.role === 'assistant')
            ? 'assistant' as const
            : 'user' as const,
          content: m.text,
        }))
        .filter((m, idx) => !(idx === 0 && m.role === 'assistant'));
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: mapped,
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      res.json({ response: text });
    } catch (error) {
      next(error);
    }
  });

  // Stripe routes...
  // (Assuming other Stripe routes are similar and use frontendUrl)

  // ============================================
  // Stripe Checkout Session - Compra de moedas e assinatura de planos
  // ============================================

  // Planos mensais hardcoded (não ficam na tabela coin_packages)
  const SUBSCRIPTION_PLANS: Record<string, { name: string; price: number; description: string }> = {
    plan_basic:    { name: "Starter",  price: 3700,  description: "Plano Starter MeloCale — 25% desconto em moedas" },
    plan_pro:      { name: "PRO",      price: 6700,  description: "Plano PRO MeloCale — 40% desconto em moedas" },
    plan_business: { name: "Elite",     price: 12700, description: "Plano Elite MeloCale — 55% desconto em moedas" },
  };

  app.post("/api/create-checkout-session", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      const { type, package_id, user_id } = req.body || {};

      if (!package_id || !user_id) {
        return res.status(400).json({ error: "package_id e user_id sao obrigatorios." });
      }

      if (user_id !== authUser.id) {
        return res.status(403).json({ error: "Não autorizado." });
      }

      const frontendUrl = (process.env.FRONTEND_URL || req.headers.origin || "https://www.melocale.com.br").replace(/\/$/, "");

      // --- Fluxo de assinatura mensal ---
      if (type === "subscription" || package_id in SUBSCRIPTION_PLANS) {
        const plan = SUBSCRIPTION_PLANS[package_id];
        if (!plan) {
          return res.status(404).json({ error: "Plano de assinatura nao encontrado." });
        }

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "brl",
                product_data: { name: plan.name, description: plan.description },
                unit_amount: plan.price,
                recurring: { interval: "month" },
              },
              quantity: 1,
            },
          ],
          metadata: {
            user_id: String(user_id),
            package_id: String(package_id),
            type: "subscription",
          },
          success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${frontendUrl}/checkout/cancel`,
        });

        return res.json({ id: session.id, url: session.url });
      }

      // --- Fluxo de compra de moedas ---
      const { data: pkg, error: pkgErr } = await supabaseAdmin
        .from("coin_packages")
        .select("id, name, coins, price, is_active")
        .eq("id", package_id)
        .eq("is_active", true)
        .single();

      if (pkgErr || !pkg) {
        console.error("Pacote nao encontrado:", package_id, pkgErr);
        return res.status(404).json({ error: "Pacote nao encontrado ou inativo." });
      }

      // Mapa de desconto por plano
      const PLAN_DISCOUNTS: Record<string, number> = {
        plan_basic:    0.25,
        plan_pro:      0.40,
        plan_business: 0.55,
      };

      // Busca plano ativo do usuário
      const { data: activeSub } = await supabaseAdmin
        .from("user_subscriptions")
        .select("package_id")
        .eq("user_id", user_id)
        .eq("status", "active")
        .maybeSingle();

      const discount = activeSub?.package_id
        ? (PLAN_DISCOUNTS[activeSub.package_id] ?? 0)
        : 0;

      const originalPrice = Math.round(Number(pkg.price) * 100);
      const finalPrice = Math.round(originalPrice * (1 - discount));

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: pkg.name,
                description: discount > 0
                  ? `${pkg.coins} moedas MeloCale — ${discount * 100}% OFF (plano ativo)`
                  : `${pkg.coins} moedas MeloCale`,
              },
              unit_amount: finalPrice,
            },
            quantity: 1,
          },
        ],
        metadata: {
          user_id: String(user_id),
          package_id: String(pkg.id),
          coins: String(pkg.coins),
          type: String(type || "one_time"),
        },
        success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/checkout/cancel`,
      });

      return res.json({ id: session.id, url: session.url });
    } catch (err: any) {
      console.error("Erro em /api/create-checkout-session:", err?.message || err);
      return res.status(500).json({ error: err?.message || "Erro interno ao criar sessao de checkout." });
    }
  });
  
  // ============================================
  // Stripe Checkout Session - Pagamento de serviço a profissional
  // ============================================
  app.post("/api/create-service-payment", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      const { amount, connectedAccountId, description, user_id } = req.body || {};

      if (!amount || !connectedAccountId || !user_id) {
        return res.status(400).json({ error: "amount, connectedAccountId e user_id são obrigatórios." });
      }

      if (user_id !== authUser.id) {
        return res.status(403).json({ error: "Não autorizado." });
      }

      const amountInCents = Math.round(Number(amount));
      if (isNaN(amountInCents) || amountInCents <= 0) {
        return res.status(400).json({ error: "amount deve ser um número positivo em centavos." });
      }

      const frontendUrl = (process.env.FRONTEND_URL || req.headers.origin || "https://www.melocale.com.br").replace(/\/$/, "");

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: description || "Pagamento de serviço",
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          transfer_data: {
            destination: connectedAccountId,
          },
        },
        metadata: {
          user_id: String(user_id),
          connected_account_id: String(connectedAccountId),
          type: "service_payment",
        },
        success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/checkout/cancel`,
      });

      return res.json({ id: session.id, url: session.url });
    } catch (err: any) {
      console.error("Erro em /api/create-service-payment:", err?.message || err);
      return res.status(500).json({ error: err?.message || "Erro interno ao criar sessão de pagamento." });
    }
  });

  // ============================================
  // GET /api/subscription-status?user_id=X
  // ============================================
  app.get("/api/subscription-status", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.authUser!.id;

      const { data: sub, error: subErr } = await supabaseAdmin
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subErr || !sub) return res.status(200).json({ status: 'none', plan: null });

      console.log("[subscription-status] user_id:", userId, "stripe_subscription_id:", sub.stripe_subscription_id ?? "null");

      if (!sub.stripe_subscription_id) {
        return res.json({
          status: sub.status,
          package_id: sub.package_id,
          started_at: sub.started_at,
          current_period_start: null,
          current_period_end: null,
          cancel_at_period_end: false,
        });
      }

      // cast to any: Stripe SDK v22 removed current_period_end from the TS type
      // but the Stripe API still returns it at runtime
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id) as any;
      console.log("[subscription-status] stripe current_period_end:", stripeSub.current_period_end, "status:", stripeSub.status);
      return res.json({
        status: stripeSub.status,
        package_id: sub.package_id,
        started_at: sub.started_at,
        current_period_start: stripeSub.current_period_start ?? null,
        current_period_end: stripeSub.current_period_end ?? null,
        cancel_at_period_end: stripeSub.cancel_at_period_end ?? false,
      });
    } catch (err: any) {
      console.error("Erro em /api/subscription-status:", err?.message || err);
      return res.status(500).json({ error: err?.message || "Erro ao buscar status da assinatura." });
    }
  });

  // ============================================
  // POST /api/cancel-subscription
  // ============================================
  app.post("/api/cancel-subscription", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      const { user_id } = req.body || {};
      if (!user_id) return res.status(400).json({ error: "user_id é obrigatório." });

      if (user_id !== authUser.id) {
        return res.status(403).json({ error: "Não autorizado." });
      }

      const { data: sub, error: subErr } = await supabaseAdmin
        .from("user_subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", String(user_id))
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subErr || !sub?.stripe_subscription_id) {
        return res.status(404).json({ error: "Assinatura ativa não encontrada." });
      }

      await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });

      await supabaseAdmin
        .from("user_subscriptions")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("user_id", String(user_id));

      return res.json({ success: true });
    } catch (err: any) {
      console.error("Erro em /api/cancel-subscription:", err?.message || err);
      return res.status(500).json({ error: err?.message || "Erro ao cancelar assinatura." });
    }
  });

  app.post("/api/support-ticket", requireAuth, async (req: Request, res: Response) => {
    try {
      const { user_id, email, conversation } = req.body;
      const { data, error } = await supabaseAdmin
        .from('support_tickets')
        .insert({ user_id: user_id || null, email: email || null, conversation, status: 'open' })
        .select('id')
        .single();
      if (error) throw error;
      return res.json({ ticket_id: data.id });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof err?.status === 'number' ? err.status : 500;
    res.status(status).json({ error: err?.message || 'Erro interno' });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor rodando em: ${PORT}`);
  });
}

startServer();
