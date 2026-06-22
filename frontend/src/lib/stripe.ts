import { loadStripe, Stripe } from '@stripe/stripe-js';
import { supabase } from './supabase';
import { apiFetch } from './api';

function requireEnvVar(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`❌ ERRO CRÍTICO: Variável de ambiente '${name}' não encontrada. Verifique as env vars do Vercel/Render.`);
  }
  return value;
}

let stripePromise: Promise<Stripe | null> | null = null;
export const getStripe = () => {
  if (!stripePromise) {
    const publicKey = requireEnvVar('VITE_STRIPE_PUBLIC_KEY');
    if (!publicKey.startsWith('pk_')) {
      throw new Error("❌ VITE_STRIPE_PUBLIC_KEY inválida: deve começar com 'pk_'");
    }
    stripePromise = loadStripe(publicKey);
  }
  return stripePromise;
};

export const initiateCheckout = async (type: 'one_time' | 'subscription', id: string, returnTo?: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado. Faça login para continuar.");

  const VALID_IDS = ["pack_starter", "pack_pro", "pack_premium", "plan_basic", "plan_pro", "plan_business"];
  if (!VALID_IDS.includes(id)) {
    throw new Error("ID inválido no frontend: " + id);
  }

  const payload = {
    type,
    package_id: id,
    user_id: user.id,
    return_to: returnTo ?? window.location.pathname,
  };

  const response = await apiFetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao iniciar o Checkout.');
  }

  const session = await response.json();

  if (session.error) throw new Error(session.error);
  if (!session.url) throw new Error("Erro ao iniciar o Checkout.");

  window.location.href = session.url;
};

export const payProfessional = async (amount: number, professional_id: string, description: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado. Faça login para continuar.");

  const response = await apiFetch('/api/create-service-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, professional_id, description }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao processar o pagamento.');
  }

  const session = await response.json();

  if (session.error) throw new Error(session.error);
  if (!session.url) throw new Error("Erro ao processar o pagamento.");

  window.location.href = session.url;
};
