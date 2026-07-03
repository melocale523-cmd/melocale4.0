import { Router, Request, Response } from "express";
import Stripe from "stripe";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import {
  stripe,
  STRIPE_WEBHOOK_SECRET,
  supabaseAdmin,
  PLANS,
  SUBSCRIPTION_PLANS,
  STRIPE_PRICE_IDS,
  getPackagePriceId,
  coinPackagesCache,
  resolveFrontendUrl,
} from "../config.js";
import { AuthRequest, requireAuth } from "../middleware/auth.js";
import { withTimeout } from "../lib/timeout.js";
import { sendMetaEvent } from "../lib/metaPixel.js";
import { REFERRAL_COINS_PROFESSIONAL, REFERRAL_BASE_COINS_CLIENT, REFERRAL_CLIENT_ORDER_COINS } from "../config/referralConstants.js";

const router = Router();

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${(err as Error).message}`); return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId    = session.metadata?.user_id || session.metadata?.userId;
    const packageId = session.metadata?.package_id;
    const sessionType = session.metadata?.type;

    if (sessionType === "featured_spotlight" && userId) {
      // Idempotência: verificar se este evento já foi processado antes de atualizar.
      const { data: alreadyDone } = await withTimeout(
        supabaseAdmin
          .from("stripe_processed_events")
          .select("event_id")
          .eq("event_id", event.id)
          .maybeSingle()
      );
      if (alreadyDone) {
        if (process.env.NODE_ENV !== "production") {
          console.log(`[webhook] featured_spotlight ${event.id} já processado — ignorando retry`);
        }
        res.json({ received: true }); return;
      }

      const { error: featErr } = await withTimeout(
        supabaseAdmin.from("professionals")
          .update({ featured_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
          .eq("user_id", userId)
      );
      if (featErr) {
        console.error("[webhook] falha ao ativar destaque:", featErr.message);
        res.status(500).json({ error: "featured_update_failed" }); return;
      }

      // Registrar como processado APÓS o UPDATE bem-sucedido para garantir idempotência correta.
      // Se o UPDATE falhar acima, não inserimos — o Stripe pode retentar com segurança.
      const { error: idempotErr } = await withTimeout(
        supabaseAdmin
          .from("stripe_processed_events")
          .insert({ event_id: event.id, event_type: event.type })
      );
      if (idempotErr) {
        // Conflito de chave primária significa que outro worker já processou — seguro ignorar.
        if (idempotErr.code === "23505") {
          res.json({ received: true }); return;
        }
        console.error("[webhook] falha ao registrar idempotência:", idempotErr.message);
        // Não retornar erro aqui: o UPDATE já foi feito com sucesso
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(`[webhook] destaque ativado: userId=${userId}`);
      }
    }

    if (sessionType === "subscription" && userId && packageId) {
      const stripeSubId = typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as { id?: string } | null)?.id ?? null;

      const { error: subErr } = await supabaseAdmin.from("user_subscriptions").upsert({
        user_id: userId,
        stripe_subscription_id: stripeSubId,
        package_id: packageId,
        status: "active",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (subErr) {
        console.error('[webhook] CRÍTICO: falha ao gravar user_subscription', {
          session_id: session.id,
          user_id: userId,
          package_id: packageId,
          error: subErr.message,
          timestamp: new Date().toISOString(),
        });
        res.status(500).json({ error: "subscription_write_failed" }); return;
      }

      const userEmail = session.customer_details?.email ?? undefined;
      const planPrice = PLANS[packageId]?.price;
      void sendMetaEvent({
        eventName: "Purchase",
        eventSourceUrl: "https://www.melocale.com.br/planos",
        userEmail,
        customData: {
          value: planPrice != null ? planPrice / 100 : undefined,
          currency: "BRL",
        },
      });

      if (userId) {
        try {
          const { data: referral } = await supabaseAdmin
            .from('referrals')
            .select('id, status, referrer_role, referrer_id')
            .eq('referred_id', userId)
            .in('status', ['registered', 'converted'])
            .single()
          if (referral && referral.status !== 'credited') {
            // Apply bonus multiplier from referral_config
            let baseCoins = referral.referrer_role === 'professional' ? REFERRAL_COINS_PROFESSIONAL : REFERRAL_BASE_COINS_CLIENT
            try {
              const { data: cfg } = await supabaseAdmin
                .from('referral_config').select('multiplier, expires_at').eq('id', 1).single()
              if (cfg && cfg.multiplier > 1) {
                const expired = cfg.expires_at && new Date(cfg.expires_at) < new Date()
                if (!expired) baseCoins = baseCoins * cfg.multiplier
              }
            } catch { /* use base coins */ }

            const rewardCoins = baseCoins
            const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc('credit_referral_reward', {
              p_referral_id: referral.id,
              p_reward_coins: rewardCoins,
            })
            if (!rpcErr && !rpcResult?.error) {
              await supabaseAdmin.from('notifications').insert({
                user_id: referral.referrer_id,
                title: '🎉 Indicação recompensada!',
                body: `Seu indicado ativou a conta. Você ganhou ${rewardCoins} moedas!`,
                data: { type: 'referral_reward', referral_id: referral.id, coins: rewardCoins },
              })
            }
            // Creditar 200 moedas client_coins ao referrer quando indicado faz primeiro pedido
            // O query builder é um thenable preguiçoso: sem await a RPC nunca era executada.
            if (referral.referrer_role === 'client') {
              const { error: orderCoinsErr } = await supabaseAdmin.rpc('credit_client_coins', {
                p_user_id: referral.referrer_id,
                p_amount: REFERRAL_CLIENT_ORDER_COINS,
                p_kind: 'referral_order',
                p_reference: `referral_order_${referral.id}`,
                p_metadata: { referred_id: userId, referral_id: referral.id },
              })
              if (orderCoinsErr) console.error('[webhook] credit_client_coins referral_order error:', orderCoinsErr.message)
            }
          }
        } catch {
          // silencioso — não deixar falha de indicação quebrar o webhook
        }
      }
    }

    let coinsAmount = 0;
    if (sessionType === "subscription" && packageId) {
      coinsAmount = PLANS[packageId]?.welcomeCoins ?? 0;
    } else if (packageId && coinPackagesCache[packageId]) {
      coinsAmount = coinPackagesCache[packageId].coins;
    } else {
      coinsAmount = parseInt(session.metadata?.coins || session.metadata?.coinsAmount || "0", 10);
    }

    if (userId && coinsAmount > 0) {
      const { error: rpcErr } = await supabaseAdmin.rpc("credit_professional_coins", {
        p_user_id: userId,
        p_amount: coinsAmount,
        p_stripe_session_id: session.id,
        p_stripe_event_id: event.id,
      });
      if (rpcErr) {
        // Log estruturado para facilitar debugging
        console.error('[webhook] CRÍTICO: falha ao creditar moedas', {
          session_id: session.id,
          user_id: userId,
          package_id: packageId,
          error: rpcErr.message,
          timestamp: new Date().toISOString(),
        });
        // Retornar 500 faz o Stripe retentar o webhook automaticamente (por até 3 dias)
        res.status(500).json({ error: "credit_failed" }); return;
      }
      if (process.env.NODE_ENV !== "production") {
        console.log(`[webhook] coins creditados: userId=${userId} coins=${coinsAmount} sessionId=${session.id}`);
      }

      // Registrar auditoria de pagamento — idempotente via UNIQUE(stripe_session_id)
      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;
      const { error: paymentAuditErr } = await supabaseAdmin.from("payments").upsert({
        user_id: userId,
        stripe_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        amount: session.amount_total ?? 0,
        currency: (session.currency ?? "brl").toUpperCase(),
        coins: coinsAmount,
        status: "paid",
        package_id: packageId ?? null,
        paid_at: new Date().toISOString(),
      }, { onConflict: "stripe_session_id", ignoreDuplicates: true });
      if (paymentAuditErr) {
        // Não-crítico: moedas já foram creditadas com sucesso — apenas logar para diagnóstico
        console.error('[webhook] falha ao gravar auditoria em payments:', {
          session_id: session.id,
          user_id: userId,
          error: paymentAuditErr.message,
        });
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
    const { error: updErr } = await supabaseAdmin.from("user_subscriptions")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("stripe_subscription_id", subscription.id);

    if (updErr) {
      console.error('[webhook] CRÍTICO: falha ao atualizar status de user_subscription', {
        subscription_id: subscription.id,
        new_status: newStatus,
        error: updErr.message,
        timestamp: new Date().toISOString(),
      });
      res.status(500).json({ error: "subscription_update_failed" }); return;
    }
  }

  res.json({ received: true });
}

// Rate limit por usuário autenticado — 10 sessões por hora.
const checkoutRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req as AuthRequest).authUser?.id ?? ipKeyGenerator(req.ip ?? "unknown"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de checkout. Aguarde 1 hora e tente novamente." },
});

function sanitizeReturnTo(value: unknown): string {
  const fallback = '/profissional/dashboard';
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('://')) return fallback;
  return value;
}

const checkoutSchema = z.object({
  type: z.enum(["coins", "plan", "one_time", "subscription"]).optional(),
  package_id: z.string().min(1),
  user_id: z.string().uuid(),
  return_to: z.string().optional(),
});

router.post("/create-checkout-session", requireAuth, checkoutRateLimit, async (req: AuthRequest, res: Response) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });

  try {
    const authUser = req.authUser!;
    const { type, package_id, user_id, return_to } = parsed.data;

    if (user_id !== authUser.id) {
      return res.status(403).json({ error: "Não autorizado." });
    }

    const frontendUrl = resolveFrontendUrl(req.headers.origin);

    if (type === "subscription" || package_id in SUBSCRIPTION_PLANS) {
      const plan = SUBSCRIPTION_PLANS[package_id];
      if (!plan) {
        return res.status(404).json({ error: "Plano de assinatura nao encontrado." });
      }

      const priceId = STRIPE_PRICE_IDS[package_id];
      if (!priceId) {
        console.error(`[checkout] price_id não configurado para plano: ${package_id}`);
        return res.status(400).json({ error: "invalid_plan" });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: {
          user_id: String(user_id),
          package_id: String(package_id),
          type: "subscription",
        },
        success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/checkout/cancel?return_to=${encodeURIComponent(sanitizeReturnTo(return_to))}&package_id=${encodeURIComponent(package_id)}&type=${encodeURIComponent(type ?? 'subscription')}`,
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

    // Verificar plano ativo para selecionar price_id com desconto quando disponível
    const { data: activeSub } = await supabaseAdmin
      .from("user_subscriptions")
      .select("package_id")
      .eq("user_id", user_id)
      .in("status", ["active", "canceling"])
      .maybeSingle();

    const priceId = getPackagePriceId(package_id, activeSub?.package_id);
    if (!priceId) {
      console.error(`[checkout] price_id não encontrado para pacote: ${package_id}, plano: ${activeSub?.package_id}`);
      return res.status(400).json({ error: "invalid_package" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        user_id: String(user_id),
        package_id: String(pkg.id),
        coins: String(pkg.coins),
        type: String(type || "one_time"),
      },
      success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/checkout/cancel?return_to=${encodeURIComponent(sanitizeReturnTo(return_to))}&package_id=${encodeURIComponent(package_id)}&type=${encodeURIComponent(type ?? 'one_time')}`,
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
    const email = authUser.email;
    if (!email) {
      return res.status(400).json({ error: "Email não encontrado na sessão." });
    }

    const { data: existing } = await withTimeout(
      supabaseAdmin.from("professionals")
        .select("stripe_account_id")
        .eq("user_id", authUser.id)
        .single()
    );

    if (existing?.stripe_account_id) {
      return res.json({ accountId: existing.stripe_account_id });
    }

    const account = await stripe.accounts.create({
      type: "express",
      country: "BR",
      email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    });

    await withTimeout(
      supabaseAdmin.from("professionals")
        .update({ stripe_account_id: account.id, stripe_connect_status: "pending" })
        .eq("user_id", authUser.id)
    );

    return res.json({ accountId: account.id });
  } catch (err: unknown) {
    console.error("[stripe-connect] create-connected-account error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao criar conta Stripe. Tente novamente." });
  }
});

router.get("/connect-status", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const authUser = req.authUser!;

    const { data: prof, error: profErr } = await withTimeout(
      supabaseAdmin.from("professionals")
        .select("stripe_account_id, stripe_connect_status")
        .eq("user_id", authUser.id)
        .single()
    );

    if (profErr || !prof) {
      return res.json({ accountId: null, status: "not_connected" });
    }

    if (!prof.stripe_account_id) {
      return res.json({ accountId: null, status: prof.stripe_connect_status ?? "not_connected" });
    }

    const account = await stripe.accounts.retrieve(prof.stripe_account_id as string);

    if (account.charges_enabled) {
      await withTimeout(
        supabaseAdmin.from("professionals")
          .update({ stripe_connect_status: "active" })
          .eq("user_id", authUser.id)
      );
      return res.json({ accountId: prof.stripe_account_id, status: "active" });
    }

    return res.json({ accountId: prof.stripe_account_id, status: prof.stripe_connect_status ?? "pending" });
  } catch (err: unknown) {
    console.error("[stripe-connect] connect-status error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao verificar status da conta Stripe." });
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

    const frontendUrl = resolveFrontendUrl(req.headers.origin);

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
    const { amount, description, professional_id } = req.body || {};

    if (typeof professional_id !== "string" || !/^[0-9a-f-]{36}$/i.test(professional_id)) {
      return res.status(400).json({ error: "professional_id inválido." });
    }

    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      return res.status(400).json({ error: "amount deve ser um número." });
    }
    const amountInCents = Math.round(amount);
    if (amountInCents < 100 || amountInCents > 10_000_00) {
      return res.status(400).json({ error: "Valor inválido. Mínimo R$1,00, máximo R$10.000,00." });
    }

    if (typeof description !== "string" || description.trim().length < 1 || description.trim().length > 200) {
      return res.status(400).json({ error: "Descrição inválida (entre 1 e 200 caracteres)." });
    }
    const safeDescription = description.trim();

    const { data: prof, error: profErr } = await supabaseAdmin
      .from("professionals")
      .select("stripe_account_id, user_id")
      .eq("id", professional_id)
      .single();
    if (profErr || !prof?.stripe_account_id) {
      return res.status(400).json({ error: "Conta Stripe não configurada para este profissional." });
    }
    if (prof.user_id === authUser.id) {
      return res.status(400).json({ error: "Profissional não pode pagar a si mesmo." });
    }
    const connectedAccountId = prof.stripe_account_id;

    const frontendUrl = resolveFrontendUrl(req.headers.origin);

    const idempotencyKey = `service-payment-${authUser.id}-${amountInCents}-${Math.floor(Date.now() / 60000)}`
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: safeDescription,
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
    }, { idempotencyKey });

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

    // cast to any: Stripe SDK v22 removed current_period_end from the TS type but the API still returns it.
    // In API version 2024-09-30+, the field moved to subscription items; read from both locations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id) as any;

    const currentPeriodEnd: number | null =
      stripeSub.current_period_end
      ?? stripeSub.items?.data?.[0]?.current_period_end
      ?? null;
    const cancelAtPeriodEnd: boolean = stripeSub.cancel_at_period_end ?? false;

    return res.json({
      status: stripeSub.status,
      package_id: sub.package_id,
      started_at: sub.started_at,
      current_period_start: stripeSub.current_period_start ?? stripeSub.items?.data?.[0]?.current_period_start ?? null,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
    });
  } catch (err: unknown) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      console.error("[subscription-status] Stripe error: code=%s message=%s", err.code, err.message);
      return res.status(200).json({ status: "none", plan: null, _debug: err.code });
    }
    console.error("[subscription-status] unexpected error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno do servidor." });
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
      .select("stripe_subscription_id, status")
      .eq("user_id", String(user_id))
      .in("status", ["active", "canceling"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr || !sub?.stripe_subscription_id) {
      return res.status(404).json({ error: "Assinatura ativa não encontrada." });
    }

    // Idempotent: skip Stripe call if already scheduled to cancel.
    if (sub.status !== "canceling") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true } as any);
      } catch (stripeErr: unknown) {
        if (stripeErr instanceof Stripe.errors.StripeInvalidRequestError) {
          console.error("[cancel-subscription] Stripe error:", stripeErr.code, stripeErr.message);
          return res.status(422).json({ error: stripeErr.message });
        }
        throw stripeErr;
      }
    }

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

router.post("/create-featured-checkout", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const authUser = req.authUser!;

    const { data: prof, error: profErr } = await withTimeout(
      supabaseAdmin
        .from("professionals")
        .select("id")
        .eq("user_id", authUser.id)
        .single()
    );
    if (profErr || !prof) {
      return res.status(403).json({ error: "Apenas profissionais podem adquirir destaque." });
    }

    const frontendUrl = resolveFrontendUrl(req.headers.origin);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: { name: "Destaque Pontual 7 dias" },
            unit_amount: 1900,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "featured_spotlight",
        user_id: authUser.id,
      },
      success_url: `${frontendUrl}/profissional/dashboard?featured=success`,
      cancel_url: `${frontendUrl}/profissional/dashboard`,
    });

    return res.json({ url: session.url });
  } catch (err: unknown) {
    console.error("[stripe] create-featured-checkout error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro ao criar sessão de destaque. Tente novamente." });
  }
});

export default router;
