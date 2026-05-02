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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const userId = session.metadata?.user_id || session.metadata?.userId;
      const packageId = session.metadata?.package_id;
      
      const PACKAGES: Record<string, { price: number; name: string; coins?: number; type?: 'subscription' | 'payment' }> = {
        'plan_basic': { price: 4900, name: 'Plano Básico', type: 'subscription' },
        'plan_pro': { price: 9900, name: 'Plano Profissional', type: 'subscription' },
        'plan_business': { price: 19900, name: 'Plano Empresarial', type: 'subscription' },
        'pack_starter': { price: 1990, coins: 50, name: 'Starter', type: 'payment' },
        'pack_pro': { price: 4990, coins: 150, name: 'Pro', type: 'payment' },
        'pack_premium': { price: 9990, coins: 400, name: 'Premium', type: 'payment' }
      };

      let coinsAmount = 0;
      if (packageId && PACKAGES[packageId]) {
        coinsAmount = PACKAGES[packageId].coins || 0;
      } else {
        coinsAmount = parseInt(session.metadata?.coinsAmount || '0', 10);
      }
      
      if (userId && coinsAmount > 0) {
        try {
          await supabaseAdmin.rpc("credit_wallet", {
            p_user_id: userId,
            p_amount: coinsAmount,
            p_stripe_session_id: session.id,
            p_stripe_event_id: event.id
          });
        } catch (err) {
          return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
        }
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
    try {
      const { messages } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages.map((m: { role: string; text: string }) => ({ 
          role: m.role, 
          parts: [{ text: m.text }] 
        })),
        config: {
          systemInstruction: "Seu objetivo é ajudar usuários com dúvidas sobre a plataforma.",
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
    plan_basic:    { name: "Plano Básico",         price: 4900,  description: "Plano Básico MeloCale" },
    plan_pro:      { name: "Plano Profissional",   price: 9900,  description: "Plano Profissional MeloCale" },
    plan_business: { name: "Plano Empresarial",    price: 19900, description: "Plano Empresarial MeloCale" },
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

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: { name: pkg.name, description: `${pkg.coins} moedas MeloCale` },
              unit_amount: Math.round(Number(pkg.price) * 100),
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor rodando em: ${PORT}`);
  });
}

startServer();
