import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from '@google/genai';

// Validação explícita e logs de debug
console.log("=== INICIANDO VALIDACAO DE VARIAVEIS DE AMBIENTE ===");
console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`- SUPABASE_URL presente? ${!!process.env.SUPABASE_URL}`);
console.log(`- VITE_SUPABASE_URL presente? ${!!process.env.VITE_SUPABASE_URL}`);
console.log(`- SUPABASE_SERVICE_ROLE_KEY presente? ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
console.log(`- STRIPE_SECRET_KEY presente? ${!!process.env.STRIPE_SECRET_KEY}`);
console.log("=====================================================");

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

// Em ambientes ESM ou TS, cria o cliente com as credenciais validadas
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Inicializa Google GenAI
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  console.warn("⚠️ AVISO: GEMINI_API_KEY está ausente. Algumas funcionalidades de IA podem falhar.");
}
const ai = new GoogleGenAI({ apiKey: geminiApiKey || "missing_key" });

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Webhook deve usar express.raw ANTES do express.json()
  app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;

    let event: any;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("⚠️ Webhook signature verification failed.", (err as Error).message);
      return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }

    // Processa eventos de sucesso de checkout
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      
      const userId = session.metadata?.userId;
      const coinsAmount = parseInt(session.metadata?.coinsAmount || '0', 10);
      
      if (userId && coinsAmount > 0) {
        try {
          console.log(`Buscando creditar ${coinsAmount} moedas para o usuário ${userId}`);
          
          // Chama a função RPC segura com a chave de admin (service role)
          const { error } = await supabaseAdmin.rpc("credit_wallet", {
            p_user_id: userId,
            p_amount: coinsAmount,
            p_stripe_session_id: session.id,
            p_stripe_event_id: event.id
          });

          if (error) {
            console.error("❌ Falha crítica ao atualizar carteira (RPC credit_wallet):", error);
            // Mesmo com erro, não retornar 500 caso seja restrição de idempotência (UNIQUE constraint).
            // Retorna 200 de qualquer forma para o Stripe parar de tentar se a recarga já ocorreu.
            if (!error.message.includes("duplicate key value violates unique constraint")) {
               throw error; 
            } else {
               console.log("ℹ️ Evento Stripe duplicado perfeitamente ignorado.");
            }
          } else {
            console.log(`✅ ${coinsAmount} moedas creditadas com sucesso via Webhook!`);
          }
        } catch (dbError) {
          console.error("Erro interno processando o Webhook:", dbError);
          // O Stripe tentará novamente caso ocorra erro (timeout/500), mas como não foi retornado 500 acima, deixamos passar se o evento é idempotente.
          return res.status(500).json({ error: 'Erro no servidor' });
        }
      }
    }

    res.json({ received: true });
  });

  // Habilita JSON body parser para as próximas rotas
  app.use(express.json());

  // API endpoint for Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API route for AI Chat
  app.post("/api/chat", async (req, res, next) => {
    try {
      const { messages } = req.body;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages.map((m: any) => ({ 
          role: m.role, 
          parts: [{ text: m.text }] 
        })),
        config: {
          systemInstruction: "Você é o Assistente MeloCalé, uma plataforma que conecta profissionais de serviços (pedreiros, eletricistas, pintores, etc) a clientes. Seu objetivo é ajudar usuários com dúvidas sobre a plataforma. Se for um cliente, ele pode solicitar orçamentos. Se for profissional, ele pode comprar leads e gerenciar serviços. Use um tom profissional, amigável e direto. Responda em Português do Brasil.",
        },
      });

      res.json({ response: response.text });
    } catch (error) {
      next(error);
    }
  });

  // API route for Stripe Checkout (Unified for One-time and Subscriptions)
  app.post("/api/create-checkout-session", async (req, res, next) => {
    try {
      const { type, id, amount, name, userId, coinsAmount } = req.body;
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: "O 'userId' é obrigatório e deve ser texto." });
      }
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ error: "O 'amount' é obrigatório e deve ser um número positivo." });
      }

      const mode = type === 'subscription' ? 'subscription' : 'payment';
      
      const sessionParams: any = {
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: { name: name || "Compra MeloCalé" },
              unit_amount: Math.round(Number(amount) * 100),
              ...(type === 'subscription' && {
                recurring: { interval: 'month' }
              })
            },
            quantity: 1,
          },
        ],
        mode: mode,
        // METADATA é o ponto de veracidade para o nosso backend Webhook!
        metadata: {
          userId: userId,
          planId: id || '',
          coinsAmount: coinsAmount ? coinsAmount.toString() : '0' 
        },
        success_url: `${req.headers.origin}/profissional/assinatura?success=true`,
        cancel_url: `${req.headers.origin}/profissional/assinatura?canceled=true`,
      };

      const session = await stripe.checkout.sessions.create(sessionParams);
      res.json({ id: session.id, url: session.url });
    } catch (error) {
      next(error);
    }
  });

  // API route for Stripe Connect Onboarding
  app.post("/api/create-connected-account", async (req, res, next) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: "O campo 'email' é obrigatório e deve ser texto válido." });
      }

      const account = await stripe.accounts.create({
        type: 'express',
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      res.json({ accountId: account.id });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/create-account-link", async (req, res, next) => {
    try {
      const { accountId } = req.body;
      if (!accountId || typeof accountId !== 'string') {
        return res.status(400).json({ error: "O campo 'accountId' é obrigatório." });
      }

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${req.headers.origin}/dashboard`,
        return_url: `${req.headers.origin}/dashboard?onboarding=success`,
        type: 'account_onboarding',
      });
      res.json({ url: accountLink.url });
    } catch (error) {
      next(error);
    }
  });

  // API route for Service Payment (Client to Professional) with Platform Fee
  app.post("/api/create-service-payment", async (req, res, next) => {
    try {
      const { amount, connectedAccountId, description, clientId } = req.body;
      
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ error: "O 'amount' é obrigatório e deve ser um número positivo." });
      }
      if (!connectedAccountId || typeof connectedAccountId !== 'string') {
        return res.status(400).json({ error: "O 'connectedAccountId' é obrigatório." });
      }

      const platformFeePercent = 0.10;
      const applicationFeeAmount = Math.round(Number(amount) * 100 * platformFeePercent);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: { name: description || "Pagamento de Serviço" },
              unit_amount: Math.round(Number(amount) * 100),
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          transfer_data: {
            destination: connectedAccountId,
          },
        },
        mode: "payment",
        metadata: {
          clientId: clientId || '',
          connectedAccountId
        },
        success_url: `${req.headers.origin}/cliente/pedidos?success=true`,
        cancel_url: `${req.headers.origin}/cliente/pedidos?canceled=true`,
      });
      res.json({ id: session.id, url: session.url });
    } catch (error) {
      next(error);
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Tratamento seguro para fallback do SPA sem usar widcards do Express
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: "Endpoint da API não encontrado" });
      }
      if (req.method === 'GET') {
        return res.sendFile(path.join(distPath, 'index.html'));
      }
      next();
    });
  }

  // Middleware global de tratamento de erros
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("🔥 Erro Global Capturado:", err);
    res.status(err.status || 500).json({
      error: "Erro Interno do Servidor",
      details: process.env.NODE_ENV === "development" ? err.message : undefined
    });
  });

  const HOST = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor rodando em: ${HOST}`);
  });
}

startServer();
