import { Router, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  stripe,
  STRIPE_WEBHOOK_SECRET,
  supabaseAdmin,
  PLANS,
  SUBSCRIPTION_PLANS,
  coinPackagesCache,
} from "../config.js";
import { AuthRequest, requireAuth } from "../middleware/auth.js";
import { withTimeout } from "../lib/timeout.js";

const router = Router();

// CRITICAL: registered with express.raw() — must be mounted BEFORE express.json() in routes/index.ts
router.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
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

    if (sessionType === "subscription" && userId && packageId) {
      const stripeSubId = typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as { id?: string } | null)?.id ?? null;
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
    void coinLabel;

    if (userId && coinsAmount > 0) {
      const { error: rpcErr } = await supabaseAdmin.rpc("credit_professional_coins", {
        p_user_id: userId,
        p_amount: coinsAmount,
        p_stripe_session_id: session.id,
        p_stripe_event_id: event.id,
      });
      if (rpcErr) {
        console.error("Erro no RPC credit_professional_coins:", rpcErr instanceof Error ? rpcErr.message : String(rpcErr));
        return res.status(500).json({ error: "Falha ao creditar" });
      }
      if (process.env.NODE_ENV !== "production") {
        console.log(`[webhook] coins creditados: userId=${userId} coins=${coinsAmount} sessionId=${session.id}`);
      }
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    let newStatus: string;
    if (event.type === "customer.subscription.deleted") {
      newStatus = "canceled";
    } else if (subscription.cancel_at_period_end) {
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

// Rate limit por usuário autenticado — 10 sessões por hora.
const checkoutRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req as AuthRequest).authUser?.id ?? req.ip ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de checkout. Aguarde 1 hora e tente novamente." },
});

const checkoutSchema = z.object({
  type: z.enum(["coins", "plan", "one_time", "subscription"]).optional(),
  package_id: z.string().min(1),
  user_id: z.string().uuid(),
});

router.post("/create-checkout-session", requireAuth, checkoutRateLimit, async (req: AuthRequest, res: Response) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });

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

router.post("/create-connected-account", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const authUser = req.authUser!;
    const { email } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email é obrigatório." });
    }

    const account = await stripe.accounts.create({
      type: "express",
      country: "BR",
      email,
      capabilities: { transfers: { requested: true } },
    });

    await withTimeout(
      supabaseAdmin.from("professionals")
        .update({ stripe_account_id: account.id })
        .eq("user_id", authUser.id)
    );

    return res.json({ accountId: account.id });
  } catch (err: unknown) {
    console.error("[stripe-connect] create-connected-account error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao criar conta Stripe. Tente novamente." });
  }
});

router.post("/create-account-link", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const authUser = req.authUser!;

    const { data: prof, error: profErr } = await withTimeout(
      supabaseAdmin.from("professionals")
        .select("stripe_account_id")
        .eq("user_id", authUser.id)
        .single()
    );
    if (profErr || !prof?.stripe_account_id) {
      return res.status(400).json({ error: "Conta Stripe não encontrada. Crie uma conta primeiro." });
    }

    const ALLOWED_ORIGINS_CONNECT = [
      "https://www.melocale.com.br",
      "https://melocale.com.br",
      process.env.FRONTEND_URL,
    ].filter(Boolean) as string[];
    const requestOriginConnect = req.headers.origin ?? "";
    const frontendUrl = (
      ALLOWED_ORIGINS_CONNECT.includes(requestOriginConnect)
        ? requestOriginConnect
        : process.env.FRONTEND_URL ?? "https://www.melocale.com.br"
    ).replace(/\/$/, "");

    const accountLink = await stripe.accountLinks.create({
      account: prof.stripe_account_id,
      refresh_url: `${frontendUrl}/profissional/perfil`,
      return_url: `${frontendUrl}/profissional/perfil`,
      type: "account_onboarding",
    });

    return res.json({ url: accountLink.url });
  } catch (err: unknown) {
    console.error("[stripe-connect] create-account-link error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao gerar link de onboarding. Tente novamente." });
  }
});

router.post("/create-service-payment", requireAuth, async (req: AuthRequest, res: Response) => {
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

    const { data: prof, error: profErr } = await supabaseAdmin
      .from("professionals")
      .select("stripe_account_id")
      .eq("user_id", authUser.id)
      .single();
    if (profErr || !prof?.stripe_account_id) {
      return res.status(400).json({ error: "Conta Stripe não configurada para este profissional." });
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

router.get("/subscription-status", requireAuth, async (req: AuthRequest, res: Response) => {
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

    if (subErr || !sub) return res.status(200).json({ status: "none", plan: null });

    if (process.env.NODE_ENV !== "production") {
      console.log("[subscription-status] user_id:", userId, "stripe_subscription_id:", sub.stripe_subscription_id ?? "null");
    }

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

    // cast to any: Stripe SDK v22 removed current_period_end from the TS type but the API still returns it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id) as any;
    if (process.env.NODE_ENV !== "production") {
      console.log("[subscription-status] stripe current_period_end:", stripeSub.current_period_end, "status:", stripeSub.status);
    }
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
    return res.status(200).json({ status: "none", plan: null });
  }
});

router.post("/cancel-subscription", requireAuth, async (req: AuthRequest, res: Response) => {
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

export default router;
