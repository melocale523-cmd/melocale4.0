// Trigger Render redeploy 2026-04-28
import express from "express";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from '@google/genai';
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

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

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

// Inicializa Google GenAI
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  console.warn("⚠️ AVISO: GEMINI_API_KEY está ausente. Algumas funcionalidades de IA podem falhar.");
}
const ai = new GoogleGenAI({ apiKey: geminiApiKey || "missing_key" });

const processedWebhookEvents = new Set<string>();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  const frontendUrl = process.env.FRONTEND_URL || 'https://melocale4-0.vercel.app';
  
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature', 'x-client-info', 'apikey'],
  }));

  // Webhook deve usar express.raw
  app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }

    if (processedWebhookEvents.has(event.id)) {
      return res.json({ received: true });
    }
    processedWebhookEvents.add(event.id);

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
        try {
          await supabaseAdmin.rpc("credit_wallet", {
            p_user_id: userId,
            p_amount: coinsAmount,
            p_stripe_session_id: session.id,
            p_stripe_event_id: event.id
          });
        } catch (rpcErr) {
          console.error("Erro no RPC credit_wallet:", rpcErr);
        }

        try {
          await supabaseAdmin.from("wallet_transactions").insert({
            user_id: userId,
            kind: sessionType === "subscription" ? "bonus" : "deposit",
            amount: coinsAmount,
            reference: `Stripe — ${coinLabel} — ${session.id}`,
            stripe_session_id: session.id,
            created_at: new Date().toISOString(),
          });
        } catch (txErr) {
          console.error("Erro ao inserir wallet_transaction:", txErr);
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

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API route for AI Chat
  app.post("/api/chat", async (req, res, next) => {
    const SYSTEM_PROMPT = `Você é o Assistente MeloCalé! 😊 Um assistente amigável, confiante e simples — qualquer pessoa entende você, do técnico ao leigo total.

Seu objetivo: ajudar clientes e profissionais a tirar dúvidas, e convencer visitantes a se cadastrar. Seja humano, caloroso e direto. Nunca use linguagem complicada.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ O QUE É A MELOCALÉ?
━━━━━━━━━━━━━━━━━━━━━━━━━━━
A MeloCalé conecta quem precisa de um serviço em casa com profissionais qualificados da região. Eletricista, pintor, encanador, diarista, marceneiro... tudo em um lugar só!

- Para quem precisa de serviço → é 100% GRÁTIS
- Para profissionais → é a forma mais fácil de conseguir clientes novos todo dia

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 SOU CLIENTE — COMO FUNCIONA?
━━━━━━━━━━━━━━━━━━━━━━━━━━━
É simples e gratuito:
1. Crie sua conta em melocale.com.br (leva 2 minutinhos)
2. Descreva o serviço que você precisa
3. Adicione fotos se quiser (ajuda muito!)
4. Profissionais da sua cidade entram em contato pelo WhatsApp
5. Você compara e escolhe o melhor — sem pressão!

Não tem custo nenhum. Você só fala com quem quiser.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 SOU PROFISSIONAL — COMO FUNCIONA?
━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Crie sua conta como Profissional
2. Complete seu perfil (foto + bio = muito mais resultado!)
3. Compre moedas ou assine um plano com desconto
4. Veja os clientes disponíveis na sua região
5. Compre o lead → receba nome e WhatsApp do cliente na hora
6. Entre em contato e feche o serviço! 💰

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 PLANOS PARA PROFISSIONAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Os planos dão desconto em todas as compras de moedas + moedas de presente pra começar:

🥉 Starter — R$37/mês
   → 25% de desconto + 30 moedas de boas-vindas

🥇 PRO — R$67/mês ⭐ MAIS POPULAR
   → 40% de desconto + 80 moedas de boas-vindas
   → Com PRO, o pacote de 200 moedas sai R$35,94 em vez de R$59,90!

👑 Elite — R$127/mês
   → 55% de desconto + 200 moedas de boas-vindas
   → Ideal pra quem quer dominar a região

💡 Dica: O plano PRO se paga em 2 ou 3 clientes. Vale muito a pena!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🪙 PACOTES DE MOEDAS (SEM PLANO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Básico: 60 moedas — R$24,90
- Popular: 200 moedas — R$59,90 ⭐ mais vantagem
- Máximo: 560 moedas — R$119,90

As moedas NUNCA expiram. Compre quando quiser!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 QUANTO CUSTA CADA CLIENTE?
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Entre 10 e 150 moedas por lead. Depende de:
- Orçamento do serviço (quanto maior, mais moedas)
- Urgência (precisa rápido = vale mais)
- Tipo de serviço (elétrica e hidráulica valem um pouco mais)

Exemplo: um serviço de pintura simples pode custar só 15 moedas. Uma reforma urgente de R$5.000 pode custar 100 moedas — mas o retorno é muito maior!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 DICAS PARA TER MAIS RESULTADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para profissionais:
→ Responda rápido! Quem chega primeiro tem 3x mais chance de fechar
→ Perfil completo com foto gera muito mais confiança
→ Foque em leads com fotos — cliente mais sério
→ Leads com orçamento alto têm melhor retorno mesmo custando mais

Para clientes:
→ Coloque fotos do que precisa — profissionais adoram
→ Seja específico na descrição para receber propostas certas
→ Compare pelo menos 3 profissionais antes de decidir

━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ DÚVIDAS COMUNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
É grátis para clientes? → SIM, sempre!
As moedas vencem? → NÃO, ficam para sempre na carteira
Posso cancelar o plano? → Sim, quando quiser. Acesso vai até o fim do período
O pagamento é seguro? → Sim! Usamos o Stripe, líder mundial em pagamentos
Quantos profissionais me contactam? → Geralmente até 10 por pedido
Como recebo os dados do cliente? → Na hora, assim que comprar o lead!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 COMO SE COMPORTAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Seja sempre simpático e acolhedor
- Use linguagem simples — como se explicasse para um amigo
- Respostas curtas e diretas (no máximo 3 parágrafos)
- Sempre termine com uma ação clara: "Crie sua conta agora!", "Assine o PRO hoje!", "Faça seu primeiro pedido!"
- Use emojis com moderação (1-2 por resposta)
- Se não souber algo, diga: "Deixa eu verificar isso pra você!"
- Fale sempre em português brasileiro
- Nunca invente informações sobre preços ou funcionalidades`;

    try {
      const { messages } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages.map((m: { role: string; text: string }) => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction: SYSTEM_PROMPT,
        },
      });

      res.json({ response: response.text });
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

  app.post("/api/create-checkout-session", async (req: any, res: any) => {
    try {
      const { type, package_id, user_id } = req.body || {};

      if (!package_id || !user_id) {
        return res.status(400).json({ error: "package_id e user_id sao obrigatorios." });
      }

      const frontendUrl = (process.env.FRONTEND_URL || req.headers.origin || "https://melocale4-0.vercel.app").replace(/\/$/, "");

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
  app.post("/api/create-service-payment", async (req: any, res: any) => {
    try {
      const { amount, connectedAccountId, description, user_id } = req.body || {};

      if (!amount || !connectedAccountId || !user_id) {
        return res.status(400).json({ error: "amount, connectedAccountId e user_id são obrigatórios." });
      }

      const amountInCents = Math.round(Number(amount));
      if (isNaN(amountInCents) || amountInCents <= 0) {
        return res.status(400).json({ error: "amount deve ser um número positivo em centavos." });
      }

      const frontendUrl = (process.env.FRONTEND_URL || req.headers.origin || "https://melocale4-0.vercel.app").replace(/\/$/, "");

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
  app.get("/api/subscription-status", async (req: any, res: any) => {
    try {
      const userId = req.query.user_id as string | undefined;
      if (!userId) return res.status(400).json({ error: "user_id é obrigatório." });

      const { data: sub, error: subErr } = await supabaseAdmin
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subErr || !sub) return res.status(404).json({ error: "Assinatura não encontrada." });

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
  app.post("/api/cancel-subscription", async (req: any, res: any) => {
    try {
      const { user_id } = req.body || {};
      if (!user_id) return res.status(400).json({ error: "user_id é obrigatório." });

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor rodando em: ${PORT}`);
  });
}

startServer();
