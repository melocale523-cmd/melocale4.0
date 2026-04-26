import { loadStripe, Stripe } from '@stripe/stripe-js';
import { supabase } from './supabase';
import { apiFetch } from './api';

/**
 * Utilitário seguro para carregar variáveis de ambiente no frontend (Vite).
 * Retorna log apropriado e previne silent failures.
 * Suporta fallback para window.APP_CONFIG injetado pelo Render/Backend
 */
function requireEnvVar(name: string): string {
  // 1. Tenta pegar do import.meta.env (injentado no build time)
  let value = import.meta.env[name];
  
  // 2. Se falhar, tenta pegar do window.APP_CONFIG (injetado via runtime no backend)
  if (!value && typeof window !== 'undefined' && (window as any).APP_CONFIG) {
    value = (window as any).APP_CONFIG[name];
  }
  
  if (!value) {
    // 3. Fallback manual seguro se for STRIPE_PUBLIC_KEY 
    // Em alguns casos pode ser útil, mas por enquanto lançamos o erro.
    if (name === 'VITE_STRIPE_PUBLIC_KEY') {
      // Como o VITE_STRIPE_PUBLIC_KEY já é público, em último caso usamos ele explícito
      value = 'pk_test_51SRlmgCx1uHAwHhQj51ZFGzqwne1m4lHhycuZ1dlayZ6c7IYVSotIIuy9V3oyhI0bOA4Ka4BrEHPV5PqJO2529NH00L02bnqDh';
      console.warn(`⚠️ Aviso: Variável '${name}' não encontrada. Usando fallback hardcoded para testes.`);
      return value;
    }
    
    const errorMsg = `❌ ERRO CRÍTICO: Variável de ambiente '${name}' não encontrada. Verifique seu arquivo .env e processo de build no Render.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  return value;
}

// Factory lazy-loaded para acessar o Stripe. 
// Evita crash no bootstrap da aplicação caso a variável não exista temporariamente.
let stripePromise: Promise<Stripe | null> | null = null;
export const getStripe = () => {
  if (!stripePromise) {
    const publicKey = requireEnvVar('VITE_STRIPE_PUBLIC_KEY');
    console.log(`✅ [Stripe] Inicializando com chave pública: ${publicKey.substring(0, 8)}...`);
    stripePromise = loadStripe(publicKey);
  }
  return stripePromise;
};

export const initiateCheckout = async (type: 'one_time' | 'subscription', id: string) => {
  const stripe = await getStripe();

  
  // Pegar usuário atual para vínculo no Stripe
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado. Faça login para continuar.");

  // Define metadata based on which plan/package is selected
  let amount = 0;
  let name = "";
  let coinsAmount = 0;

  if (type === 'subscription') {
    const plans = {
      'plan_basic': { amount: 49, name: 'Plano Básico', coins: 300 }, // exemplo
      'plan_pro': { amount: 99, name: 'Plano Profissional', coins: 800 },
      'plan_business': { amount: 199, name: 'Plano Empresarial', coins: 2000 }
    };
    const plan = plans[id as keyof typeof plans];
    amount = plan?.amount || 49;
    name = plan?.name || 'Assinatura';
    coinsAmount = plan?.coins || 0;
  } else {
    // This is for coin packages - matching ids from ProfessionalAssinatura.tsx
    const packages = {
      'pack_starter': { amount: 19.90, name: 'Pacote Iniciante', coins: 50 },
      'pack_pro': { amount: 49.90, name: 'Pacote Profissional', coins: 150 },
      'pack_premium': { amount: 99.90, name: 'Pacote Premium', coins: 400 }
    };
    const pkg = packages[id as keyof typeof packages];
    amount = pkg?.amount || 19.90;
    name = pkg?.name || 'Créditos';
    coinsAmount = pkg?.coins || 0;
  }

  const response = await apiFetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      type, 
      id, 
      amount, 
      name,
      userId: user.id,
      coinsAmount 
    }),
  });
  
  const session = await response.json();
  
  if (session.error) {
    throw new Error(session.error);
  }

  if (session.url) {
    window.location.assign(session.url);
  } else if (stripe && session.id) {
    await (stripe as any).redirectToCheckout({ sessionId: session.id });
  } else {
    throw new Error("Erro ao iniciar o Checkout.");
  }
};

export const payProfessional = async (amount: number, connectedAccountId: string, description: string) => {
  const stripe = await getStripe();
  const { data: { user } } = await supabase.auth.getUser();
  
  const response = await apiFetch('/api/create-service-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      amount, 
      connectedAccountId, 
      description,
      clientId: user?.id 
    }),
  });
  
  const session = await response.json();
  
  if (session.error) {
    throw new Error(session.error);
  }

  if (session.url) {
    window.location.href = session.url;
  } else if (stripe && session.id) {
    await (stripe as any).redirectToCheckout({ sessionId: session.id });
  }
};
