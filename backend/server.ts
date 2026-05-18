// Trigger Render redeploy 2026-04-28
import helmet from "helmet";
import express, { Request, Response, NextFunction, RequestHandler } from "express";

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
  try {
    const { data, error } = await supabaseAdmin.from('coin_packages')
      .select('id, name, coins, price').eq('is_active', true);
    if (error) {
      console.error('[startup] loadCoinPackages error:', error.message);
      return;
    }
    if (data?.length) {
      coinPackagesCache = Object.fromEntries(data.map((p: { id: string; name: string; coins: number; price: number }) => [p.id, p]));
      console.log('[startup] coin packages loaded:', Object.keys(coinPackagesCache));
    }
  } catch (err) {
    console.error('[startup] loadCoinPackages exception:', err instanceof Error ? err.message : String(err));
    // manter cache anterior em memória; não propagar — servidor continua de pé
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

const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  try {
    const { data: { user }, error } = await withTimeout(
      supabaseAdmin.auth.getUser(token),
      8000
    );
    if (error || !user) return res.status(401).json({ error: 'Token inválido' });

    (req as AuthRequest).authUser = user as { id: string; email: string; role: string };
    next();
  } catch (err) {
    const isTimeout = err instanceof Error && err.message.startsWith('Request timeout');
    console.error('[requireAuth] erro:', err instanceof Error ? err.message : String(err));
    return res.status(isTimeout ? 503 : 500).json({
      error: isTimeout ? 'Serviço de autenticação indisponível. Tente novamente.' : 'Erro interno de autenticação.',
    });
  }
}

const requireAdmin: RequestHandler = async (req, res, next) => {
  try {
    const { data: profile } = await withTimeout(
      supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', (req as AuthRequest).authUser!.id)
        .single()
    );
    if (profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    next();
  } catch (err) {
    console.error('[requireAdmin] erro:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
};

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
      // INSERT ON CONFLICT DO NOTHING via unique partial index notifications_reminder_dedup.
      // Se outra instância já inseriu (race em scale-out), o erro 23505 é ignorado silenciosamente.
      const { error: clientNotifErr } = await withTimeout(
        supabaseAdmin.from('notifications').insert({
          user_id: apt.client_id,
          title: '⏰ Lembrete de agendamento',
          body: `Seu agendamento "${apt.title}" é amanhã. Confirme sua disponibilidade.`,
          data: { appointment_id: apt.id, type: 'reminder_24h' },
        })
      );
      if (!clientNotifErr) {
        void sendPushToUser(apt.client_id, {
          title: '⏰ Lembrete de agendamento',
          body: `Seu agendamento "${apt.title}" é amanhã. Confirme sua disponibilidade.`,
          data: { appointment_id: apt.id, type: 'reminder_24h' },
        });
      } else if ((clientNotifErr as { code?: string }).code !== '23505') {
        console.error('[job] lembrete24h client notif error:', clientNotifErr.message);
      }

      // --- Notificação para o profissional ---
      if (profUserId) {
        const { error: profNotifErr } = await withTimeout(
          supabaseAdmin.from('notifications').insert({
            user_id: profUserId,
            title: '⏰ Lembrete de agendamento',
            body: `Você tem o agendamento "${apt.title}" amanhã. Prepare-se!`,
            data: { appointment_id: apt.id, type: 'reminder_24h_prof' },
          })
        );
        if (!profNotifErr) {
          void sendPushToUser(profUserId, {
            title: '⏰ Lembrete de agendamento',
            body: `Você tem o agendamento "${apt.title}" amanhã. Prepare-se!`,
            data: { appointment_id: apt.id, type: 'reminder_24h_prof' },
          });
        } else if ((profNotifErr as { code?: string }).code !== '23505') {
          console.error('[job] lembrete24h prof notif error:', profNotifErr.message);
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
  app.use(helmet());

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
          console.error("Erro ao gravar user_subscription:", subErr instanceof Error ? subErr.message : String(subErr));
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
        // RPC único: credita saldo e registra wallet_transaction em transação atômica.
        // Idempotência garantida pelo RPC via stripe_event_id.
        const { error: rpcErr } = await supabaseAdmin.rpc("credit_professional_coins", {
          p_user_id: userId,
          p_amount: coinsAmount,
          p_stripe_session_id: session.id,
          p_stripe_event_id: event.id
        });
        if (rpcErr) {
          console.error("Erro no RPC credit_professional_coins:", rpcErr instanceof Error ? rpcErr.message : String(rpcErr));
          return res.status(500).json({ error: "Falha ao creditar" });
        }
        if (process.env.NODE_ENV !== 'production') console.log(`[webhook] coins creditados: userId=${userId} coins=${coinsAmount} sessionId=${session.id}`);
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
        console.error("Erro ao atualizar user_subscription:", updErr instanceof Error ? updErr.message : String(updErr));
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

  app.get("/api/admin/active-users", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
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

  // Rate limit por usuário autenticado — 10 sessões por hora.
  // Usa authUser.id como chave para não punir usuários atrás do mesmo IP.
  const checkoutRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => (req as AuthRequest).authUser?.id ?? req.ip ?? 'unknown',
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas de checkout. Aguarde 1 hora e tente novamente.' },
  });

  app.post("/api/create-checkout-session", requireAuth, checkoutRateLimit, async (req: AuthRequest, res: Response) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.' });

    try {
      const authUser = req.authUser!;
      const { type, package_id, user_id } = parsed.data;

      if (user_id !== authUser.id) {
        return res.status(403).json({ error: "Não autorizado." });
      }

      const ALLOWED_ORIGINS = [
        "https://www.melocale.com.br",
        "https://melocale.com.br",
        process.env.FRONTEND_URL,
      ].filter(Boolean) as string[];
      const requestOrigin = req.headers.origin ?? "";
      const frontendUrl = (
        ALLOWED_ORIGINS.includes(requestOrigin)
          ? requestOrigin
          : process.env.FRONTEND_URL ?? "https://www.melocale.com.br"
      ).replace(/\/$/, "");

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
      const { amount, description } = req.body || {};

      if (!amount) {
        return res.status(400).json({ error: "amount é obrigatório." });
      }

      const amountInCents = Math.round(Number(amount));
      if (isNaN(amountInCents) || amountInCents <= 0) {
        return res.status(400).json({ error: "amount deve ser um número positivo em centavos." });
      }

      // Buscar stripe_account_id do profissional autenticado — nunca aceitar do body.
      const { data: prof, error: profErr } = await supabaseAdmin
        .from('professionals')
        .select('stripe_account_id')
        .eq('user_id', authUser.id)
        .single();
      if (profErr || !prof?.stripe_account_id) {
        return res.status(400).json({ error: 'Conta Stripe não configurada para este profissional.' });
      }
      const connectedAccountId = prof.stripe_account_id;

      const ALLOWED_ORIGINS_SVC = [
        "https://www.melocale.com.br",
        "https://melocale.com.br",
        process.env.FRONTEND_URL,
      ].filter(Boolean) as string[];
      const requestOriginSvc = req.headers.origin ?? "";
      const frontendUrl = (
        ALLOWED_ORIGINS_SVC.includes(requestOriginSvc)
          ? requestOriginSvc
          : process.env.FRONTEND_URL ?? "https://www.melocale.com.br"
      ).replace(/\/$/, "");

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
          user_id: authUser.id,
          connected_account_id: connectedAccountId,
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
        .eq("user_id", String(user_id))
        .eq("stripe_subscription_id", sub.stripe_subscription_id);

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

  app.post("/api/support-ticket", sensitiveLimiter, requireAuth, async (req: Request, res: Response) => {
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
    cancelled_reason: z.string().max(500).optional(),
    message_preview: z.string().max(200).optional(),
  });

  app.post("/api/notifications/send-event", sensitiveLimiter, requireAuth, async (req: Request, res: Response) => {
    const parsed = sendEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.' });

    const callerId = (req as AuthRequest).authUser!.id;
    const { event_type, resource_id, cancelled_reason, message_preview } = parsed.data;

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
          .select('client_id, professional_id, status, proposed_at, proposed_by')
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
        const apptStatus = appt.status as string | undefined;
        if (apptStatus === 'cancelled') {
          title = 'Agendamento cancelado';
          body = cancelled_reason ? `Motivo: ${cancelled_reason}` : 'O agendamento foi cancelado.';
        } else if (apptStatus === 'confirmed' && appt.proposed_at) {
          const dt = new Date(appt.proposed_at as string);
          title = 'Reagendamento aceito ✅';
          body = `Nova data confirmada: ${dt.toLocaleDateString('pt-BR')} às ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`;
        } else if (apptStatus === 'confirmed') {
          title = 'Agendamento confirmado ✅';
          body = 'Status do agendamento foi atualizado.';
        } else if (apptStatus === 'rescheduled' && appt.proposed_at) {
          const dt = new Date(appt.proposed_at as string);
          const who = (appt.proposed_by as string) === 'professional' ? 'O profissional' : 'O cliente';
          title = 'Proposta de reagendamento';
          body = `${who} propôs nova data: ${dt.toLocaleDateString('pt-BR')} às ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`;
        } else if (apptStatus === 'completed') {
          title = 'Atendimento concluído ✅';
          body = 'O atendimento foi marcado como concluído.';
        } else {
          title = 'Agendamento atualizado';
          body = 'Status do agendamento foi atualizado.';
        }
        data = { appointment_id: resource_id, type: event_type };

      } else if (event_type === 'message_sent') {
        if (process.env.NODE_ENV !== 'production') console.log('[send-event] message_sent caller:', callerId, 'conv:', resource_id);
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
        body = message_preview ?? 'Você recebeu uma nova mensagem';
        // Roteamento diferenciado: cliente vai para /cliente/mensagens,
        // profissional vai para /profissional/mensagens (ver sw.ts)
        data = { conversationId: resource_id, type: isClient ? 'message' : 'message_client' };
      }

      if (targetUserId) {
        // Notification insert centralizado no backend — frontend não escreve mais em notifications
        void supabaseAdmin.from('notifications').insert({
          user_id: targetUserId,
          title,
          body,
          data,
          is_read: false,
        });
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

  app.post("/api/notifications/push", sensitiveLimiter, requireAuth, async (req: Request, res: Response) => {
    const parsed = notifPushSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.' });

    try {
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
    } catch (err: unknown) {
      console.error('[notifications/push] erro:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro interno.' });
    }
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

  app.post("/api/push/subscribe", sensitiveLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
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
  // POST /api/leads — criar lead com price_coins calculado no servidor
  // ============================================

  /** Calcula price_coins a partir do orçamento máximo declarado.
   *  Urgência 'hoje' aplica multiplicador de 1.5 (arredondado para cima). */
  function calcLeadPriceCoins(budgetMax: number, urgency: string): number {
    let base: number;
    if (budgetMax <= 500)        base = 10;
    else if (budgetMax <= 2000)  base = 20;
    else if (budgetMax <= 10000) base = 40;
    else                          base = 80;

    if (urgency === 'hoje') return Math.ceil(base * 1.5);
    return base;
  }

  const createLeadSchema = z.object({
    title:       z.string().min(1).max(200),
    category:    z.string().min(1).max(100),
    description: z.string().max(2000).optional().default(''),
    location:    z.string().min(1).max(200),
    budget_min:  z.number().min(0),
    budget_max:  z.number().min(0),
    images:      z.array(z.string().url()).max(10).optional().default([]),
    metadata:    z.record(z.string(), z.string()).optional().default({}),
  });

  app.post('/api/leads', sensitiveLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() });

    try {
      const userId = req.authUser!.id;
      const { title, category, description, location, budget_min, budget_max, images, metadata } = parsed.data;
      const urgency = metadata.urgency ?? 'sem_pressa';
      const price_coins = calcLeadPriceCoins(budget_max, urgency);

      const { data: categoryData } = await withTimeout(
        supabaseAdmin
          .from('categories')
          .select('id')
          .ilike('name', category)
          .single()
      );
      const categoryId = categoryData?.id ?? null;

      const { data, error } = await withTimeout(
        supabaseAdmin
          .from('leads')
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
            status:          'open',
            price_coins,
            max_purchases:   5,
            purchases_count: 0,
            visualizacoes:   0,
          })
          .select()
          .single()
      );

      if (error) throw error;
      if (process.env.NODE_ENV !== 'production') console.log(`[leads] criado: id=${data.id} price_coins=${price_coins} budget_max=${budget_max} urgency=${urgency}`);
      return res.status(201).json(data);
    } catch (err: unknown) {
      console.error('/api/leads POST error:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro interno ao criar pedido.' });
    }
  });

  // ============================================
  // PATCH /api/admin/professional-status
  // ============================================
  app.patch('/api/admin/professional-status', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { user_id, is_active } = req.body;
      if (!user_id || typeof is_active !== 'boolean') {
        return res.status(400).json({ error: 'user_id e is_active são obrigatórios.' });
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
  app.get('/api/admin/user-emails', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
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
  app.post('/api/admin/categories', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
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
  app.patch('/api/admin/categories/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
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
  app.get('/api/admin/run-tests', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
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

    const E2E_PREFIX = '[E2E-TEST]';
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
        p_title: `${E2E_PREFIX} Pintura de sala`,
        p_description: `${E2E_PREFIX} Teste automatizado — pode ser deletado`,
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
          body: `${E2E_PREFIX} Olá, mensagem automática de teste`,
          sender_type: 'client',
          read_at: null,
          attachments: [],
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return `OK — message_id: ${data.id}`;
    });

    // Cleanup robusto: apaga por prefixo [E2E-TEST], não apenas pelos IDs coletados.
    // Isso garante que orphans de execuções anteriores com crash também sejam removidos.
    try {
      // 1. Mensagens com prefixo em qualquer conversa do lead de teste
      if (createdChatId) {
        await supabaseAdmin.from('messages')
          .delete()
          .eq('conversation_id', createdChatId)
          .like('body', `${E2E_PREFIX}%`);
        await supabaseAdmin.from('conversations').delete().eq('id', createdChatId);
        await supabaseAdmin.from('lead_purchases').delete().eq('lead_id', createdLeadId!);
      }
      // 2. Lead pelo ID e por título com prefixo (catch de orphans)
      if (createdLeadId) {
        await supabaseAdmin.from('leads').delete().eq('id', createdLeadId);
      }
      // 3. Sweep de qualquer lead com prefixo que tenha ficado órfão
      await supabaseAdmin.from('leads').delete().like('title', `${E2E_PREFIX}%`);
      console.log('[e2e] cleanup concluído');
    } catch (cleanupErr) {
      console.error('[e2e] cleanup parcial:', cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr));
    }

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const finishedAt = new Date().toISOString();
    console.log(`[e2e] run-tests finalizado: ${finishedAt} — passed=${passed} failed=${failed}`);

    return res.json({
      summary: { total: results.length, passed, failed },
      results,
      ran_at: startedAt,
      finished_at: finishedAt,
    });
    } catch (err: unknown) {
      console.error('[admin/run-tests] erro:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro interno.' });
    }
  });

  // ============================================
  // POST /api/admin/reload-coin-packages — recarrega cache manualmente
  // ============================================
  app.post('/api/admin/reload-coin-packages', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      await loadCoinPackages();
      return res.json({ reloaded: true, packages: Object.keys(coinPackagesCache).length });
    } catch (err: unknown) {
      console.error('/api/admin/reload-coin-packages error:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro interno.' });
    }
  });

  // ============================================
  // GET /api/admin/reports/users
  // GET /api/admin/reports/leads
  // GET /api/admin/reports/transactions
  // ============================================
  app.get('/api/admin/reports/users', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {

      const { data: profiles, error } = await withTimeout(
        supabaseAdmin
          .from('profiles')
          .select('id, full_name, role, created_at, city')
          .order('created_at', { ascending: false })
          .limit(5000)
      );
      if (error) throw error;

      const ids = (profiles ?? []).map(p => p.id);

      const { data: clients } = ids.length
        ? await withTimeout(supabaseAdmin.from('clients').select('id, email, state').in('id', ids))
        : { data: [] };

      const { data: profs } = ids.length
        ? await withTimeout(supabaseAdmin.from('professionals').select('user_id, is_active, category').in('user_id', ids))
        : { data: [] };

      const clientMap = Object.fromEntries((clients ?? []).map(c => [c.id, c]));
      const profMap   = Object.fromEntries((profs   ?? []).map(p => [p.user_id, p]));

      const rows = (profiles ?? []).map(p => ({
        id:        p.id,
        full_name: p.full_name,
        email:     clientMap[p.id]?.email     ?? null,
        role:      p.role,
        created_at: p.created_at,
        city:      p.city,
        state:     clientMap[p.id]?.state     ?? null,
        is_active: profMap[p.id]?.is_active   ?? null,
        category:  profMap[p.id]?.category    ?? null,
      }));
      return res.json(rows);
    } catch (err: unknown) {
      console.error('/api/admin/reports/users error:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro interno.' });
    }
  });

  app.get('/api/admin/reports/leads', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { data, error } = await withTimeout(
        supabaseAdmin
          .from('leads')
          .select('id, title, category, location, status, price_coins, budget_min, budget_max, purchases_count, created_at')
          .order('created_at', { ascending: false })
          .limit(5000)
      );
      if (error) throw error;
      return res.json(data ?? []);
    } catch (err: unknown) {
      console.error('/api/admin/reports/leads error:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro interno.' });
    }
  });

  app.get('/api/admin/reports/transactions', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { data: txs, error } = await withTimeout(
        supabaseAdmin
          .from('wallet_transactions')
          .select('id, user_id, kind, amount, reference, created_at')
          .order('created_at', { ascending: false })
          .limit(5000)
      );
      if (error) throw error;

      const userIds = [...new Set((txs ?? []).map(t => t.user_id).filter(Boolean))];

      const { data: clients } = userIds.length
        ? await withTimeout(supabaseAdmin.from('clients').select('id, full_name, email').in('id', userIds))
        : { data: [] };

      const { data: profilesMap } = userIds.length
        ? await withTimeout(supabaseAdmin.from('profiles').select('id, full_name').in('id', userIds))
        : { data: [] };

      const clientMap  = Object.fromEntries((clients     ?? []).map(c => [c.id, c]));
      const profileMap = Object.fromEntries((profilesMap ?? []).map(p => [p.id, p]));

      const rows = (txs ?? []).map(tx => ({
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
      console.error('/api/admin/reports/transactions error:', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ error: 'Erro interno.' });
    }
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
  setInterval(loadCoinPackages, 60 * 60 * 1000);

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
