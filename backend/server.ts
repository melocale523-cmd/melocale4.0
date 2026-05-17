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
import { z } from "zod";
import webpush from "web-push";

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

// Inicializa web-push com VAPID
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL;
if (vapidPublicKey && vapidPrivateKey && vapidEmail) {
  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey);
  console.log('[startup] web-push VAPID configurado');
} else {
  console.warn('[startup] VAPID keys ausentes — web push desativado');
}

async function sendPushToUser(userId: string, payload: { title: string; body: string; data?: Record<string, unknown> }) {
  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) return;
  try {
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);
    if (!subs?.length) return;

    const payloadStr = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payloadStr
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            await supabaseAdmin
              .from('push_subscriptions')
              .delete()
              .eq('user_id', userId)
              .eq('endpoint', sub.endpoint);
          } else {
            console.error('[push] sendNotification error:', err instanceof Error ? err.message : String(err));
          }
        }
      })
    );
  } catch (err) {
    console.error('[push] sendPushToUser error:', err instanceof Error ? err.message : String(err));
  }
}

let coinPackagesCache: Record<string, { coins: number; name: string; price: number }> = {};

const PLANS: Record<string, {
  name: string;
  price: number;
  welcomeCoins: number;
  coinDiscount: number;
}> = {
  plan_basic:    { name: 'Starter', price: 3700,  welcomeCoins: 30,  coinDiscount: 0.25 },
  plan_pro:      { name: 'PRO',     price: 6700,  welcomeCoins: 80,  coinDiscount: 0.40 },
  plan_business: { name: 'Elite',   price: 12700, welcomeCoins: 200, coinDiscount: 0.55 },
};

async function loadCoinPackages() {
  const { data } = await supabaseAdmin.from('coin_packages')
    .select('id, name, coins, price').eq('is_active', true);
  if (data?.length) {
    coinPackagesCache = Object.fromEntries(data.map((p: { id: string; name: string; coins: number; price: number }) => [p.id, p]));
    console.log('[startup] coin packages loaded:', Object.keys(coinPackagesCache));
  }
}

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

function withTimeout<T>(promise: PromiseLike<T>, ms = 8000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms)
    ),
  ]);
}

async function jobLembrete24h() {
  try {
    const { data: appointments, error } = await withTimeout(
      supabaseAdmin
        .from('appointments')
        .select('id, title, scheduled_at, client_id, professional_id')
        .in('status', ['confirmed', 'scheduled'])
        .gte('scheduled_at', new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString())
        .lte('scheduled_at', new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString())
    );

    if (error) {
      console.error('[job] lembrete24h query error:', error.message);
      return;
    }

    for (const apt of appointments ?? []) {
      // Resolve professional user_id
      const { data: prof } = await withTimeout(
        supabaseAdmin
          .from('professionals')
          .select('user_id')
          .eq('id', apt.professional_id)
          .maybeSingle()
      );

      const profUserId = prof?.user_id;

      // --- Notificação para o cliente ---
      const { data: existsClient } = await withTimeout(
        supabaseAdmin
          .from('notifications')
          .select('id')
          .eq('user_id', apt.client_id)
          .eq('data->>appointment_id', apt.id)
          .eq('data->>type', 'reminder_24h')
          .maybeSingle()
      );

      if (!existsClient) {
        await withTimeout(
          supabaseAdmin.from('notifications').insert({
            user_id: apt.client_id,
            title: '⏰ Lembrete de agendamento',
            body: `Seu agendamento "${apt.title}" é amanhã. Confirme sua disponibilidade.`,
            data: { appointment_id: apt.id, type: 'reminder_24h' },
          })
        );
        void sendPushToUser(apt.client_id, {
          title: '⏰ Lembrete de agendamento',
          body: `Seu agendamento "${apt.title}" é amanhã. Confirme sua disponibilidade.`,
          data: { appointment_id: apt.id, type: 'reminder_24h' },
        });
      }

      // --- Notificação para o profissional ---
      if (profUserId) {
        const { data: existsProf } = await withTimeout(
          supabaseAdmin
            .from('notifications')
            .select('id')
            .eq('user_id', profUserId)
            .eq('data->>appointment_id', apt.id)
            .eq('data->>type', 'reminder_24h_prof')
            .maybeSingle()
        );

        if (!existsProf) {
          await withTimeout(
            supabaseAdmin.from('notifications').insert({
              user_id: profUserId,
              title: '⏰ Lembrete de agendamento',
              body: `Você tem o agendamento "${apt.title}" amanhã. Prepare-se!`,
              data: { appointment_id: apt.id, type: 'reminder_24h_prof' },
            })
          );
          void sendPushToUser(profUserId, {
            title: '⏰ Lembrete de agendamento',
            body: `Você tem o agendamento "${apt.title}" amanhã. Prepare-se!`,
            data: { appointment_id: apt.id, type: 'reminder_24h_prof' },
          });
        }
      }
    }
  } catch (err) {
    console.error('[job] lembrete24h error:', err instanceof Error ? err.message : String(err));
  }
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  const EXTRA_ORIGINS = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const ALLOWED_ORIGINS = new Set([
    'https://www.melocale.com.br',
    'https://melocale.com.br',
    'http://localhost:5173',
    'http://localhost:4173',
    ...EXTRA_ORIGINS,
  ]);

  const isOriginAllowed = (origin: string) => ALLOWED_ORIGINS.has(origin);

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
        coinsAmount = PLANS[packageId]?.welcomeCoins ?? 0;
        coinLabel = `boas-vindas:${packageId}`;
      } else if (packageId && coinPackagesCache[packageId]) {
        coinsAmount = coinPackagesCache[packageId].coins;
        coinLabel = coinPackagesCache[packageId].name;
      } else {
        coinsAmount = parseInt(session.metadata?.coins || session.metadata?.coinsAmount || "0", 10);
      }

      if (userId && coinsAmount > 0) {
        // Passo 1: creditar professional_coins com lock (RPC SECURITY DEFINER).
        // O RPC não insere em wallet_transactions — essa responsabilidade é exclusiva
        // do Passo 2, que usa o schema correto com user_id, kind e reference.
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

        // Passo 2: registrar a transação (única inserção em wallet_transactions).
        // Em caso de reentrada do webhook (Stripe retenta eventos), o unique constraint
        // em stripe_event_id retorna 23505 — tratamos como idempotência esperada.
        const txKind = sessionType === "subscription" ? "bonus" : "deposit";
        const { error: txErr } = await supabaseAdmin.from("wallet_transactions").insert({
          user_id: userId,
          kind: txKind,
          amount: coinsAmount,
          reference: `Stripe — ${coinLabel} — ${session.id}`,
          stripe_session_id: session.id,
          stripe_event_id: event.id,
          created_at: new Date().toISOString(),
        });
        if (txErr) {
          if ((txErr as { code?: string }).code === '23505') {
            console.log(`[webhook] evento ${event.id} já processado (idempotência) — ignorando`);
            return res.json({ received: true });
          }
          console.error("Erro ao inserir wallet_transaction:", txErr);
          return res.status(500).json({ error: "Falha ao creditar" });
        }

        console.log(`[webhook] wallet_transaction registrada: userId=${userId} coins=${coinsAmount} kind=${txKind} sessionId=${session.id}`);
      }
    }

    // --- Sincronizar status de assinatura ---
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      let newStatus: string;
      if (event.type === "customer.subscription.deleted") {
        newStatus = "canceled";
      } else if (subscription.cancel_at_period_end) {
        // Stripe keeps status="active" while scheduled for cancellation;
        // we use "canceling" so the frontend can distinguish the two states.
        newStatus = "canceling";
      } else {
        newStatus = subscription.status;
      }
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

  app.get("/api/health", async (_req: Request, res: Response) => {
    let db: 'connected' | 'error' = 'error';
    try {
      await Promise.race([
        supabaseAdmin.from('profiles').select('id').limit(1),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
      db = 'connected';
    } catch {
      db = 'error';
    }
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? '0.0.0',
      db,
    });
  });

  app.get("/api/admin/active-users", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.authUser!.id;
      const { data: profile } = await withTimeout(
        supabaseAdmin.from('profiles').select('role').eq('id', userId).single()
      );
      if (profile?.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso não autorizado.' });
      }

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
      console.error('/api/admin/active-users error:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro ao buscar usuários ativos.' });
    }
  });

  const chatSchema = z.object({
    messages: z.array(z.object({ role: z.string(), text: z.string() })).min(1),
    context: z.string().optional(),
    userData: z.record(z.string(), z.unknown()).optional(),
  });

  // API route for AI Chat
  app.post("/api/chat", chatRateLimit, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: 'Dados inválidos.' });
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
        return v
          .replace(/<[^>]*>/g, '')
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
          .replace(/\r/g, '')
          .replace(/\n/g, ' ')
          .trim()
          .slice(0, max);
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

    const buildSystemPrompt = (context: string, userData: Record<string, unknown>) => {
      const name = userData.name || 'usuário';

      const BASE = `Você é o Assistente MeloCalé — amigável, direto e focado em ajudar. Use linguagem simples. Respostas curtas (máx 3 parágrafos). Sempre termine com uma ação clara. Use no máximo 2 emojis por resposta. Nunca invente informações.`;

      const PLATFORM_KNOWLEDGE = `
SOBRE A MELOCALÉ: Conecta clientes que precisam de serviços domésticos a profissionais qualificados.
PLANOS: Starter R$37/mês (25% desc + 30 moedas) | PRO R$67/mês (40% desc + 80 moedas) ⭐ | Elite R$127/mês (55% desc + 200 moedas)
MOEDAS: Básico 60 por R$24,90 | Popular 200 por R$59,90 | Máximo 560 por R$119,90. Nunca expiram.
LEADS: custam 10-150 moedas dependendo de orçamento, urgência e categoria.`;

      if (context === 'professional') {
        const balance = Number(userData.coinBalance ?? 0);
        const plan = typeof userData.activePlan === 'string' ? userData.activePlan : null;
        const leads = Number(userData.leadsBought ?? 0);
        return `${BASE}

CONTEXTO: Você está no painel PROFISSIONAL conversando com ${name}.
DADOS REAIS DO USUÁRIO:
- Saldo atual: ${balance} moedas${balance < 20 ? ' ⚠️ BAIXO' : ''}
- Plano ativo: ${plan ? PLANS[plan]?.name ?? plan : 'Nenhum (sem desconto)'}
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
          content: typeof m.text === 'string'
            ? m.text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\r/g, '').slice(0, 4000)
            : '',
        }))
        .filter((m, idx) => !(idx === 0 && m.role === 'assistant'));
      const response = await withTimeout(
        anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages: mapped,
        }),
        15000
      );
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
  const SUBSCRIPTION_PLANS: Record<string, { name: string; price: number; description: string }> = Object.fromEntries(
    Object.entries(PLANS).map(([k, v]) => [k, {
      name: v.name,
      price: v.price,
      description: `Plano ${v.name} MeloCale`,
    }])
  );

  const checkoutSchema = z.object({
    type: z.enum(['coins', 'plan', 'one_time', 'subscription']).optional(),
    package_id: z.string().min(1),
    user_id: z.string().uuid(),
  });

  app.post("/api/create-checkout-session", requireAuth, async (req: AuthRequest, res: Response) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.' });

    try {
      const authUser = req.authUser!;
      const { type, package_id, user_id } = parsed.data;

      if (user_id !== authUser.id) {
        return res.status(403).json({ error: "Não autorizado." });
      }

      const frontendUrl = (process.env.FRONTEND_URL || req.headers.origin || "https://www.melocale.com.br").replace(/\/$/,  "");

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
      const { data: pkg, error: pkgErr } = await withTimeout(
        supabaseAdmin
          .from("coin_packages")
          .select("id, name, coins, price, is_active")
          .eq("id", package_id)
          .eq("is_active", true)
          .single()
      );

      if (pkgErr || !pkg) {
        console.error("Pacote nao encontrado:", package_id, pkgErr);
        return res.status(404).json({ error: "Pacote nao encontrado ou inativo." });
      }

      // Busca plano ativo do usuário
      const { data: activeSub } = await supabaseAdmin
        .from("user_subscriptions")
        .select("package_id")
        .eq("user_id", user_id)
        .in("status", ["active", "canceling"])
        .maybeSingle();

      const discount = activeSub?.package_id
        ? (PLANS[activeSub.package_id]?.coinDiscount ?? 0)
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
    } catch (err: unknown) {
      console.error("Erro em /api/create-checkout-session:", err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: "Erro interno do servidor. Tente novamente." });
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
    } catch (err: unknown) {
      console.error("Erro em /api/create-service-payment:", err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: "Erro interno do servidor. Tente novamente." });
    }
  });

  // ============================================
  // GET /api/subscription-status?user_id=X
  // ============================================
  app.get("/api/subscription-status", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.authUser!.id;

      const { data: sub, error: subErr } = await withTimeout(
        supabaseAdmin
          .from("user_subscriptions")
          .select("*")
          .eq("user_id", userId)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      );

      if (subErr || !sub) return res.status(200).json({ status: 'none', plan: null });

      if (process.env.NODE_ENV !== 'production') console.log("[subscription-status] user_id:", userId, "stripe_subscription_id:", sub.stripe_subscription_id ?? "null");

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
      if (process.env.NODE_ENV !== 'production') console.log("[subscription-status] stripe current_period_end:", stripeSub.current_period_end, "status:", stripeSub.status);
      return res.json({
        status: stripeSub.status,
        package_id: sub.package_id,
        started_at: sub.started_at,
        current_period_start: stripeSub.current_period_start ?? null,
        current_period_end: stripeSub.current_period_end ?? null,
        cancel_at_period_end: stripeSub.cancel_at_period_end ?? false,
      });
    } catch (err: unknown) {
      console.error("Erro em /api/subscription-status:", err instanceof Error ? err.message : String(err));
      return res.status(200).json({ status: 'none', plan: null });
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
        .in("status", ["active", "canceling"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subErr || !sub?.stripe_subscription_id) {
        return res.status(404).json({ error: "Assinatura ativa não encontrada." });
      }

      await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });

      await supabaseAdmin
        .from("user_subscriptions")
        .update({ status: "canceling", updated_at: new Date().toISOString() })
        .eq("user_id", String(user_id));

      return res.json({ success: true });
    } catch (err: unknown) {
      console.error("Erro em /api/cancel-subscription:", err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: "Erro interno do servidor. Tente novamente." });
    }
  });

  const supportTicketSchema = z.object({
    email: z.string().email().optional(),
    conversation: z.string().min(1),
  });

  app.post("/api/support-ticket", requireAuth, async (req: Request, res: Response) => {
    const parsed = supportTicketSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.' });
    try {
      const { email, conversation } = parsed.data;
      const user_id = (req as AuthRequest).authUser!.id;
      const { data, error } = await supabaseAdmin
        .from('support_tickets')
        .insert({ user_id, email: email || null, conversation, status: 'open' })
        .select('id')
        .single();
      if (error) throw error;
      return res.json({ ticket_id: data.id });
    } catch (err: unknown) {
      console.error("Erro em /api/support-ticket:", err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: "Erro interno do servidor. Tente novamente." });
    }
  });

  // ============================================
  // POST /api/notifications/send-event
  // ============================================
  const sendEventSchema = z.object({
    event_type: z.enum([
      'lead_purchased', 'proposal_sent', 'proposal_accepted',
      'appointment_created', 'appointment_updated',
      'appointment_cancelled', 'message_sent',
    ]),
    resource_id: z.string().uuid(),
  });

  app.post("/api/notifications/send-event", requireAuth, async (req: Request, res: Response) => {
    const parsed = sendEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.' });

    const callerId = (req as AuthRequest).authUser!.id;
    const { event_type, resource_id } = parsed.data;

    let targetUserId: string | null = null;
    let title = '';
    let body = '';
    let data: Record<string, unknown> = {};

    try {
      if (event_type === 'lead_purchased') {
        // Caller must be the professional who purchased this lead.
        const { data: lp } = await supabaseAdmin
          .from('lead_purchases')
          .select('client_id')
          .eq('lead_id', resource_id)
          .eq('user_id', callerId)
          .maybeSingle();
        if (!lp?.client_id) return res.status(403).json({ error: 'Forbidden' });
        targetUserId = lp.client_id;
        title = 'Novo interesse no seu pedido!';
        body = 'Um profissional tem interesse no seu pedido. Acesse para ver.';
        data = { lead_id: resource_id, type: 'new_interest' };

      } else if (event_type === 'proposal_sent') {
        // Caller must be the professional (user_id on lead_purchases).
        const { data: lp } = await supabaseAdmin
          .from('lead_purchases')
          .select('client_id, user_id')
          .eq('id', resource_id)
          .maybeSingle();
        if (!lp || lp.user_id !== callerId) return res.status(403).json({ error: 'Forbidden' });
        targetUserId = lp.client_id;
        title = 'Nova proposta recebida! 🎉';
        body = 'Um profissional enviou um orçamento. Acesse Meus Pedidos para ver.';
        data = { type: 'proposal_received', purchaseId: resource_id };

      } else if (event_type === 'proposal_accepted') {
        // Caller must be the client who accepted.
        const { data: lp } = await supabaseAdmin
          .from('lead_purchases')
          .select('client_id, professional_id')
          .eq('id', resource_id)
          .maybeSingle();
        if (!lp || lp.client_id !== callerId) return res.status(403).json({ error: 'Forbidden' });
        const { data: prof } = await supabaseAdmin
          .from('professionals')
          .select('user_id')
          .eq('id', lp.professional_id)
          .maybeSingle();
        targetUserId = prof?.user_id ?? null;
        title = 'Interesse confirmado! 🎉';
        body = 'Um cliente aceitou sua proposta. Abra o chat para iniciar o serviço.';
        data = { type: 'proposal_accepted', purchaseId: resource_id };

      } else if (event_type === 'appointment_created') {
        // Caller must be the professional who created the appointment.
        const { data: appt } = await supabaseAdmin
          .from('appointments')
          .select('client_id, professional_id, scheduled_at')
          .eq('id', resource_id)
          .maybeSingle();
        if (!appt) return res.status(403).json({ error: 'Forbidden' });
        const { data: prof } = await supabaseAdmin
          .from('professionals')
          .select('user_id')
          .eq('id', appt.professional_id)
          .maybeSingle();
        if (prof?.user_id !== callerId) return res.status(403).json({ error: 'Forbidden' });
        targetUserId = appt.client_id;
        const dt = new Date(appt.scheduled_at as string);
        title = 'Novo agendamento';
        body = `Visita agendada para ${dt.toLocaleDateString('pt-BR')} às ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        data = { appointment_id: resource_id, type: 'appointment_created' };

      } else if (event_type === 'appointment_updated' || event_type === 'appointment_cancelled') {
        // Caller must be either the client or professional — notify the other side.
        const { data: appt } = await supabaseAdmin
          .from('appointments')
          .select('client_id, professional_id')
          .eq('id', resource_id)
          .maybeSingle();
        if (!appt) return res.status(403).json({ error: 'Forbidden' });
        const { data: prof } = await supabaseAdmin
          .from('professionals')
          .select('user_id')
          .eq('id', appt.professional_id)
          .maybeSingle();
        const profUserId = prof?.user_id;
        const isClient = callerId === appt.client_id;
        const isProfessional = callerId === profUserId;
        if (!isClient && !isProfessional) return res.status(403).json({ error: 'Forbidden' });
        targetUserId = isClient ? (profUserId ?? null) : appt.client_id;
        title = event_type === 'appointment_cancelled' ? 'Agendamento cancelado' : 'Agendamento atualizado';
        body = 'Status do agendamento foi atualizado';
        data = { appointment_id: resource_id, type: event_type };

      } else if (event_type === 'message_sent') {
        // Caller must be a participant — notify the other side.
        const { data: conv } = await supabaseAdmin
          .from('conversations')
          .select('client_id, professional_id')
          .eq('id', resource_id)
          .maybeSingle();
        if (!conv) return res.status(403).json({ error: 'Forbidden' });
        const { data: prof } = await supabaseAdmin
          .from('professionals')
          .select('user_id')
          .eq('id', conv.professional_id)
          .maybeSingle();
        const profUserId = prof?.user_id;
        const isClient = callerId === conv.client_id;
        const isProfessional = callerId === profUserId;
        if (!isClient && !isProfessional) return res.status(403).json({ error: 'Forbidden' });
        targetUserId = isClient ? (profUserId ?? null) : conv.client_id;
        title = 'Nova Mensagem';
        body = 'Você recebeu uma nova mensagem';
        data = { conversationId: resource_id, type: 'message' };
      }

      if (targetUserId) {
        void sendPushToUser(targetUserId, { title, body, data });
      }
      return res.json({ ok: true });
    } catch (err: unknown) {
      console.error('[send-event] error:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro interno.' });
    }
  });

  // ============================================
  // POST /api/notifications/push
  // ============================================
  const notifPushSchema = z.object({
    user_id: z.string().uuid(),
    title: z.string().min(1),
    body: z.string().min(1),
    data: z.record(z.string(), z.unknown()).optional(),
  });

  app.post("/api/notifications/push", requireAuth, async (req: Request, res: Response) => {
    const parsed = notifPushSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.' });

    const callerId = (req as AuthRequest).authUser!.id;
    const targetUserId = parsed.data.user_id;

    if (callerId !== targetUserId) {
      // authUser.role vem do JWT Postgres role ("authenticated"), não do app role.
      // Para checar se o caller é admin, consultamos a tabela profiles — igual
      // ao padrão usado em todas as outras rotas admin do servidor.
      const { data: callerProfile } = await withTimeout(
        supabaseAdmin.from('profiles').select('role').eq('id', callerId).single()
      );
      if (callerProfile?.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    void sendPushToUser(targetUserId, {
      title: parsed.data.title,
      body: parsed.data.body,
      data: parsed.data.data as Record<string, unknown> | undefined,
    });
    return res.json({ ok: true });
  });

  // ============================================
  // POST /api/push/subscribe
  // ============================================
  const pushSubscribeSchema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  });

  app.post("/api/push/subscribe", requireAuth, async (req: AuthRequest, res: Response) => {
    const parsed = pushSubscribeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.' });
    try {
      const { endpoint, keys } = parsed.data;
      const userId = req.authUser!.id;
      const { error } = await supabaseAdmin
        .from('push_subscriptions')
        .upsert({ user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: 'user_id,endpoint' });
      if (error) throw error;
      return res.json({ ok: true });
    } catch (err: unknown) {
      console.error('[push] subscribe error:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro ao salvar subscription.' });
    }
  });

  // ============================================
  // DELETE /api/push/unsubscribe
  // ============================================
  app.delete("/api/push/unsubscribe", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { endpoint } = req.body || {};
      if (!endpoint) return res.status(400).json({ error: 'endpoint obrigatório.' });
      const userId = req.authUser!.id;
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);
      return res.json({ ok: true });
    } catch (err: unknown) {
      console.error('[push] unsubscribe error:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro ao remover subscription.' });
    }
  });

  // ============================================
  // PATCH /api/admin/professional-status
  // ============================================
  app.patch('/api/admin/professional-status', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { user_id, is_active } = req.body;
      if (!user_id || typeof is_active !== 'boolean') {
        return res.status(400).json({ error: 'user_id e is_active são obrigatórios.' });
      }

      const { data: profile } = await withTimeout(
        supabaseAdmin.from('profiles').select('role').eq('id', req.authUser!.id).single()
      );
      if (profile?.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado.' });
      }

      const { error } = await withTimeout(
        supabaseAdmin.from('professionals').update({ is_active }).eq('user_id', user_id)
      );
      if (error) throw error;
      return res.json({ ok: true });
    } catch (err: unknown) {
      console.error('/api/admin/professional-status error:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro interno.' });
    }
  });

  // ============================================
  // GET /api/admin/user-emails?ids=uuid1,uuid2,...
  // ============================================
  app.get('/api/admin/user-emails', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { data: profile } = await withTimeout(
        supabaseAdmin.from('profiles').select('role').eq('id', req.authUser!.id).single()
      );
      if (profile?.role !== 'admin') return res.status(403).json({ error: 'Acesso negado.' });

      const ids = (req.query.ids as string || '').split(',').filter(Boolean).slice(0, 100);
      if (!ids.length) return res.json({ emails: {} });

      const emails: Record<string, string> = {};
      let page = 1;
      while (true) {
        const { data, error } = await withTimeout(
          supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
        );
        if (error || !data?.users?.length) break;
        data.users.forEach(u => {
          if (ids.includes(u.id) && u.email) emails[u.id] = u.email;
        });
        if (data.users.length < 1000) break;
        page++;
      }

      return res.json({ emails });
    } catch (err) {
      console.error('/api/admin/user-emails error:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro interno.' });
    }
  });

  // ============================================
  // POST /api/admin/categories — inserir nova categoria
  // ============================================
  app.post('/api/admin/categories', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('role').eq('id', req.authUser!.id).single();
      if (profile?.role !== 'admin') return res.status(403).json({ error: 'Acesso negado.' });

      const { name, slug } = req.body;
      if (!name || !slug) return res.status(400).json({ error: 'name e slug obrigatórios.' });

      const { data, error } = await supabaseAdmin
        .from('categories')
        .insert({ name, slug, is_active: true })
        .select('*')
        .single();
      if (error) throw error;
      return res.json(data);
    } catch (err: unknown) {
      console.error('/api/admin/categories POST error:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro interno.' });
    }
  });

  // ============================================
  // PATCH /api/admin/categories/:id — toggle is_active
  // ============================================
  app.patch('/api/admin/categories/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('role').eq('id', req.authUser!.id).single();
      if (profile?.role !== 'admin') return res.status(403).json({ error: 'Acesso negado.' });

      const { id } = req.params;
      const { is_active } = req.body;
      if (typeof is_active !== 'boolean') return res.status(400).json({ error: 'is_active obrigatório.' });

      const { data, error } = await supabaseAdmin
        .from('categories')
        .update({ is_active })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return res.json(data);
    } catch (err: unknown) {
      console.error('/api/admin/categories PATCH error:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro interno.' });
    }
  });

  // ============================================
  // GET /api/admin/run-tests — E2E test runner
  // ============================================
  app.get('/api/admin/run-tests', requireAuth, async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token!);
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single();
    if (profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const results: Array<{
      id: string;
      name: string;
      status: 'pass' | 'fail' | 'skip';
      message: string;
      duration: number;
    }> = [];

    const TEST_CLIENT_EMAIL    = process.env.E2E_CLIENT_EMAIL    ?? '';
    const TEST_CLIENT_PASSWORD = process.env.E2E_CLIENT_PASSWORD ?? '';
    const TEST_PROF_EMAIL      = process.env.E2E_PROF_EMAIL      ?? '';
    const TEST_PROF_PASSWORD   = process.env.E2E_PROF_PASSWORD   ?? '';

    let clientUserId: string | null = null;
    let profUserId: string | null = null;
    let createdLeadId: string | null = null;
    let createdChatId: string | null = null;

    async function runTest(id: string, name: string, fn: () => Promise<string>) {
      const start = Date.now();
      try {
        const message = await fn();
        results.push({ id, name, status: 'pass', message, duration: Date.now() - start });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id, name, status: 'fail', message: msg, duration: Date.now() - start });
      }
    }

    await runTest('t1', 'Login cliente', async () => {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: TEST_CLIENT_EMAIL,
        password: TEST_CLIENT_PASSWORD,
      });
      if (error || !data.session) throw new Error(error?.message ?? 'Sem sessão');
      clientUserId = data.user.id;
      return `OK — user_id: ${clientUserId}`;
    });

    await runTest('t2', 'Login profissional', async () => {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: TEST_PROF_EMAIL,
        password: TEST_PROF_PASSWORD,
      });
      if (error || !data.session) throw new Error(error?.message ?? 'Sem sessão');
      profUserId = data.user.id;
      return `OK — user_id: ${profUserId}`;
    });

    await runTest('t3', 'Cliente cria pedido', async () => {
      if (!clientUserId) throw new Error('Depende do T1 — login cliente falhou');
      const { data: clientProfile } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('id', clientUserId)
        .maybeSingle();
      if (!clientProfile) throw new Error('Perfil cliente não encontrado');
      const { data, error } = await supabaseAdmin.rpc('e2e_insert_lead', {
        p_client_id: clientUserId,
        p_title: '[TESTE E2E] Pintura de sala',
        p_description: 'Teste automatizado — pode ser deletado',
        p_category: 'Pintura',
        p_location: 'São Paulo, SP',
        p_budget_min: 100,
        p_budget_max: 500,
      });
      if (error) throw new Error(error.message);
      createdLeadId = data as string;
      return `OK — lead_id: ${createdLeadId}`;
    });

    await runTest('t4', 'Profissional vê lead disponível', async () => {
      if (!createdLeadId) throw new Error('Depende do T3 — lead não criado');
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('id, title, status')
        .eq('id', createdLeadId)
        .single();
      if (error) throw new Error(error.message);
      if (data.status !== 'open') throw new Error(`Status inesperado: ${data.status}`);
      return `OK — "${data.title}" visível e ativo`;
    });

    await runTest('t5', 'Profissional compra lead', async () => {
      if (!createdLeadId || !profUserId) throw new Error('Depende do T2 e T3');
      const { data: prof } = await supabaseAdmin
        .from('professionals')
        .select('id')
        .eq('user_id', profUserId)
        .maybeSingle();
      if (!prof) throw new Error('Perfil profissional não encontrado');

      const { data: chatId, error } = await supabaseAdmin
        .rpc('e2e_insert_lead_purchase', {
          p_lead_id: createdLeadId,
          p_professional_id: prof.id,
          p_professional_user_id: profUserId,
          p_client_id: clientUserId,
        });
      if (error) throw new Error(error.message);
      createdChatId = chatId;
      return `OK — chat_id: ${createdChatId}`;
    });

    await runTest('t6', 'Chat aberto após compra', async () => {
      if (!createdChatId) throw new Error('Depende do T5 — compra não realizada');
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('id, professional_id, client_id')
        .eq('id', createdChatId)
        .single();
      if (error) throw new Error(error.message);
      return `OK — conversa criada (id: ${data.id})`;
    });

    await runTest('t7', 'Enviar mensagem no chat', async () => {
      if (!createdChatId) throw new Error('Depende do T6 — chat não existe');
      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: createdChatId,
          body: '[TESTE E2E] Olá, mensagem automática de teste',
          sender_type: 'client',
          read_at: null,
          attachments: [],
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return `OK — message_id: ${data.id}`;
    });

    try {
      if (createdChatId) {
        await supabaseAdmin.from('messages')
          .delete()
          .eq('conversation_id', createdChatId)
          .like('body', '[TESTE E2E]%');
        await supabaseAdmin.from('conversations').delete().eq('id', createdChatId);
        await supabaseAdmin.from('lead_purchases').delete().eq('lead_id', createdLeadId!);
      }
      if (createdLeadId) {
        await supabaseAdmin.from('leads').delete().eq('id', createdLeadId);
      }
    } catch (cleanupErr) {
      console.error('Cleanup parcial:', cleanupErr);
    }

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;

    return res.json({
      summary: { total: results.length, passed, failed },
      results,
      ran_at: new Date().toISOString(),
    });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : 500;
    const message = err instanceof Error ? err.message : 'Erro interno';
    res.status(status).json({ error: message });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  await loadCoinPackages();

  setInterval(jobLembrete24h, 60 * 60 * 1000);
  void jobLembrete24h();
  console.log('[job] lembrete24h iniciado');

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor rodando em: ${PORT}`);
  });
}

if (!process.env.VITEST) {
  startServer();
}
