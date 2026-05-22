import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import rateLimit from "express-rate-limit";

// --- Stripe ---
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) throw new Error("❌ ERRO CRÍTICO: STRIPE_SECRET_KEY está ausente nas variáveis de ambiente.");
export const stripe = new Stripe(stripeSecretKey);

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
if (!STRIPE_WEBHOOK_SECRET) throw new Error("❌ ERRO CRÍTICO: STRIPE_WEBHOOK_SECRET está ausente nas variáveis de ambiente.");

// --- Supabase Admin (Bypass RLS) ---
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl) throw new Error("❌ ERRO CRÍTICO: SUPABASE_URL (ou VITE_SUPABASE_URL) está ausente nas variáveis de ambiente.");
if (!supabaseServiceKey) throw new Error("❌ ERRO CRÍTICO: SUPABASE_SERVICE_ROLE_KEY está ausente nas variáveis de ambiente.");
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// --- VAPID ---
export const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
export const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
export const vapidEmail = process.env.VAPID_EMAIL;

// --- Anthropic ---
if (!process.env.ANTHROPIC_API_KEY) throw new Error("❌ ERRO CRÍTICO: ANTHROPIC_API_KEY não definida — servidor não pode subir");
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --- Plans ---
export const PLANS: Record<string, {
  name: string;
  price: number;
  welcomeCoins: number;
  coinDiscount: number;
}> = {
  plan_basic:    { name: "Starter", price: 3700,  welcomeCoins: 30,  coinDiscount: 0.25 },
  plan_pro:      { name: "PRO",     price: 6700,  welcomeCoins: 80,  coinDiscount: 0.40 },
  plan_business: { name: "Elite",   price: 12700, welcomeCoins: 200, coinDiscount: 0.55 },
};

// Mapa de package_id → Stripe price_id
// Para pacotes de moedas avulsas, existe um price_id por combinação de pacote + plano ativo
export const STRIPE_PRICE_IDS: Record<string, string> = {
  // Planos mensais recorrentes
  plan_basic:    process.env.STRIPE_PRICE_STARTER ?? '',
  plan_pro:      process.env.STRIPE_PRICE_PRO     ?? '',
  plan_business: process.env.STRIPE_PRICE_ELITE   ?? '',

  // Pacotes de moedas — preço cheio (sem plano ativo)
  pack_starter:  process.env.STRIPE_PRICE_PACK_BASIC   ?? '',
  pack_pro:      process.env.STRIPE_PRICE_PACK_POPULAR ?? '',
  pack_premium:  process.env.STRIPE_PRICE_PACK_MAX     ?? '',

  // Pacotes de moedas — Básico (60 moedas) com desconto
  pack_starter_plan_basic:    process.env.STRIPE_PRICE_PACK_BASIC_STARTER ?? '',
  pack_starter_plan_pro:      process.env.STRIPE_PRICE_PACK_BASIC_PRO     ?? '',
  pack_starter_plan_business: process.env.STRIPE_PRICE_PACK_BASIC_ELITE   ?? '',

  // Pacotes de moedas — Popular (200 moedas) com desconto
  pack_pro_plan_basic:    process.env.STRIPE_PRICE_PACK_POPULAR_STARTER ?? '',
  pack_pro_plan_pro:      process.env.STRIPE_PRICE_PACK_POPULAR_PRO     ?? '',
  pack_pro_plan_business: process.env.STRIPE_PRICE_PACK_POPULAR_ELITE   ?? '',

  // Pacotes de moedas — Máximo (560 moedas) com desconto
  pack_premium_plan_basic:    process.env.STRIPE_PRICE_PACK_MAX_STARTER ?? '',
  pack_premium_plan_pro:      process.env.STRIPE_PRICE_PACK_MAX_PRO     ?? '',
  pack_premium_plan_business: process.env.STRIPE_PRICE_PACK_MAX_ELITE   ?? '',
};

// Retorna o price_id correto para um pacote, considerando o plano ativo do usuário
export function getPackagePriceId(packageId: string, activePlanId?: string | null): string {
  if (activePlanId) {
    const discountKey = `${packageId}_${activePlanId}`;
    const discountedPrice = STRIPE_PRICE_IDS[discountKey];
    if (discountedPrice) return discountedPrice;
  }
  // Fallback: preço cheio
  return STRIPE_PRICE_IDS[packageId] ?? '';
}

// Validar que os price IDs obrigatórios estão configurados em produção
if (process.env.NODE_ENV === 'production') {
  const required = ['plan_basic', 'plan_pro', 'plan_business', 'pack_starter', 'pack_pro', 'pack_premium'];
  const missing = required.filter(k => !STRIPE_PRICE_IDS[k]);
  if (missing.length > 0) {
    console.error('[stripe] ERRO: price IDs obrigatórios faltando para:', missing);
  }
}

export const SUBSCRIPTION_PLANS: Record<string, { name: string; price: number; description: string }> = Object.fromEntries(
  Object.entries(PLANS).map(([k, v]) => [k, {
    name: v.name,
    price: v.price,
    description: `Plano ${v.name} MeloCale`,
  }])
);

// --- Coin Packages Cache (live binding — reassigned by loadCoinPackages) ---
export let coinPackagesCache: Record<string, { coins: number; name: string; price: number }> = {};

export async function loadCoinPackages() {
  try {
    const { data, error } = await supabaseAdmin
      .from("coin_packages")
      .select("id, name, coins, price")
      .eq("is_active", true);
    if (error) {
      console.error("[startup] loadCoinPackages error:", error.message);
      return;
    }
    if (data?.length) {
      coinPackagesCache = Object.fromEntries(
        data.map((p: { id: string; name: string; coins: number; price: number }) => [p.id, p])
      );
      console.log("[startup] coin packages loaded:", Object.keys(coinPackagesCache));
    }
  } catch (err) {
    console.error("[startup] loadCoinPackages exception:", err instanceof Error ? err.message : String(err));
  }
}

// --- Rate Limiters ---
export const chatRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite de mensagens atingido. Tente novamente em 1 hora." },
});

export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." },
});
