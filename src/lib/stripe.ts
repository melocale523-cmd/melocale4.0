import { loadStripe } from '@stripe/stripe-js';
import { supabase } from './supabase';

// Replace with your actual Stripe Publishable Key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

export const initiateCheckout = async (type: 'one_time' | 'subscription', id: string) => {
  const stripe = await stripePromise;
  
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

  const response = await fetch('/api/create-checkout-session', {
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
  const stripe = await stripePromise;
  const { data: { user } } = await supabase.auth.getUser();
  
  const response = await fetch('/api/create-service-payment', {
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
