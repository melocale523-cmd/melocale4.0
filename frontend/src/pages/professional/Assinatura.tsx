import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { walletService, adminService, subscriptionService } from '../../services/dbServices';
import { initiateCheckout } from '../../lib/stripe';
import { apiFetch } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, X, Calendar, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

const STATUS_LABELS: Record<string, { label: string; colorClass: string }> = {
  active:   { label: 'Ativo',              colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  canceled: { label: 'Cancelado',          colorClass: 'bg-red-500/10 text-red-400 border-red-500/20'            },
  past_due: { label: 'Pagamento Pendente', colorClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'   },
  trialing: { label: 'Em Teste',           colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20'         },
};

const PLAN_NAMES: Record<string, string> = {
  plan_basic:    'Starter',
  plan_pro:      'PRO',
  plan_business: 'Elite',
};

const PLAN_LEADS: Record<string, string> = {
  plan_basic:    '25%',
  plan_pro:      '40%',
  plan_business: '55%',
};

const PLAN_PRICES: Record<string, string> = {
  plan_basic:    '37',
  plan_pro:      '67',
  plan_business: '127',
};

const PLAN_DISCOUNTS: Record<string, number> = {
  plan_basic:    25,
  plan_pro:      40,
  plan_business: 55,
};

const SUBSCRIPTION_PLANS = [
  {
    id: 'plan_basic',
    name: 'Starter',
    price: '37',
    description: 'Comece a receber clientes',
    discount: '25%',
    color: 'blue',
    popular: false,
    welcomeCoins: 30,
    features: [
      '25% desconto em moedas avulsas',
      'Badge ✅ VERIFICADO',
      'Perfil público visível',
      'Suporte por chat',
    ],
    savings: 'Pacote R$59,90 → R$44,93',
  },
  {
    id: 'plan_pro',
    name: 'PRO',
    price: '67',
    description: 'Para quem quer crescer de verdade',
    discount: '40%',
    color: 'emerald',
    popular: true,
    welcomeCoins: 80,
    features: [
      '40% desconto em moedas avulsas',
      'Badge ⚡ PRO em destaque',
      '2x mais visível nas buscas',
      'Moedas nunca expiram',
      'Suporte prioritário (2h)',
    ],
    savings: 'Pacote R$59,90 → R$35,94 — plano se paga em 1 compra',
  },
  {
    id: 'plan_business',
    name: 'Elite',
    price: '127',
    description: 'Seja o líder da sua região',
    discount: '55%',
    color: 'yellow',
    popular: false,
    welcomeCoins: 200,
    features: [
      '55% desconto em moedas avulsas',
      'Badge 🏆 ELITE dourado',
      'Topo absoluto das buscas',
      'Até 3 profissionais na conta',
      'Gerente de conta dedicado',
    ],
    savings: 'Pacote R$119,90 → R$53,96',
  },
];

const CREDIT_PACKAGES = [
  {
    id: 'pack_starter',
    name: 'Básico',
    coins: 60,
    price: '24,90',
    priceNum: 24.90,
    description: 'Para o primeiro cliente',
    bonus: 0,
  },
  {
    id: 'pack_pro',
    name: 'Popular',
    coins: 180,
    price: '59,90',
    priceNum: 59.90,
    description: 'Melhor custo por moeda',
    bonus: 20,
    popular: true,
  },
  {
    id: 'pack_premium',
    name: 'Máximo',
    coins: 480,
    price: '119,90',
    priceNum: 119.90,
    description: 'Para não perder nenhum lead',
    bonus: 80,
  },
];

export default function ProfessionalAssinatura() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const plansRef = useRef<HTMLDivElement>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['walletBalance'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: walletService.getBalance
  });

  const { data: currentSubscription } = useQuery({
    queryKey: ['currentSubscription'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: subscriptionService.getCurrentSubscription,
  });

  const { data: subscriptionStatus } = useQuery({
    queryKey: ['subscriptionStatus'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        const res = await apiFetch('/api/subscription-status');
        if (res.status === 404 || res.status === 401) return null;
        if (!res.ok) throw new Error('Erro ao buscar assinatura');
        return res.json();
      } catch {
        return null;
      }
    },
  });

  useQuery({
    queryKey: ['coinPackages'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        const data = await adminService.getCoinPackages();
        return (data || []).sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
      } catch {
        return [];
      }
    }
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isSuccess = params.get('success') === 'true' || params.get('payment') === 'success';
    const isCanceled = params.get('canceled') === 'true' || params.get('payment') === 'cancelled';

    if (isSuccess) {
      setStatusMessage({ type: 'success', text: 'Pagamento processado com sucesso! Seus créditos ou assinatura foram atualizados.' });
      queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (isCanceled) {
      setStatusMessage({ type: 'error', text: 'O processo de compra foi cancelado.' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [queryClient]);

  const handleCheckout = async (type: 'one_time' | 'subscription', id: string) => {
    try {
      setBuyingId(id);
      await initiateCheckout(type, id);
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Houve um erro ao processar o seu pedido. Por favor, tente novamente.");
    } finally {
      setBuyingId(null);
    }
  };

  const scrollToPlans = () => {
    plansRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const res = await apiFetch('/api/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStatusMessage({ type: 'success', text: 'Assinatura cancelada. Seu acesso continua até o fim do período atual.' });
      setCancelConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['currentSubscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptionStatus'] });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Erro ao cancelar assinatura.' });
    } finally {
      setCancelLoading(false);
    }
  };

  const daysUntilExpiry = subscriptionStatus?.current_period_end
    ? Math.ceil((subscriptionStatus.current_period_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const showExpiryWarning = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7;

  const cycleProgress = (() => {
    if (!subscriptionStatus?.current_period_end) return 0;
    const endMs = subscriptionStatus.current_period_end * 1000;
    const startMs = subscriptionStatus.current_period_start
      ? subscriptionStatus.current_period_start * 1000
      : endMs - 30 * 24 * 60 * 60 * 1000;
    const total = endMs - startMs;
    const elapsed = Date.now() - startMs;
    return total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
  })();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
          statusMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <p className="font-medium text-sm">{statusMessage.text}</p>
          <button onClick={() => setStatusMessage(null)} className="ml-auto opacity-50 hover:opacity-100 transition-opacity">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Banner Oferta de Boas-vinda */}
      <div className="bg-gradient-to-r from-emerald-900/30 to-[#1C3454] border border-emerald-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-emerald-400 font-black">🔥 Oferta especial</span>
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded-full border border-red-500/20">
              Tempo limitado
            </span>
          </div>
          <h3 className="text-white font-bold">Comece com o Plano Starter por R$37/mês</h3>
          <p className="text-[#94A3B8] text-sm">25% de desconto em moedas. Cancele quando quiser.</p>
        </div>
        <button
          disabled={!!buyingId}
          onClick={() => handleCheckout('subscription', 'plan_basic')}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 whitespace-nowrap"
        >
          {buyingId === 'plan_basic' ? <Loader2 size={18} className="animate-spin" /> : null}
          Começar agora — sem risco →
        </button>
      </div>

      {/* Garantia badge */}
      <div className="flex justify-center">
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-6 py-3">
          <span className="text-emerald-400 text-xl">🛡️</span>
          <span className="text-emerald-400 font-bold text-sm">Garantia de 7 dias — dinheiro de volta sem perguntas</span>
        </div>
      </div>

      {/* Pacotes de Créditos Avulsos */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 16V8"/><path d="M8 12h8"/></svg>
            </span>
            Pacotes de Créditos Avulsos
          </h2>
          <p className="text-[#94A3B8] text-sm">Recarregue sua carteira conforme a necessidade. Preço cheio, sem plano.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {CREDIT_PACKAGES.map((pkg) => {
            const totalCoins = pkg.coins + pkg.bonus;
            const costPerCoin = (pkg.priceNum / totalCoins).toFixed(3);
            const isPopular = 'popular' in pkg && pkg.popular;
            return (
              <div key={pkg.id} className={`bg-[#1C3454] border ${isPopular ? 'border-blue-500/50 scale-105 shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)] z-10' : 'border-[#1C3050]'} rounded-2xl p-8 relative flex flex-col`}>
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap">
                    Recomendado
                  </span>
                )}

                <h3 className="text-white font-bold text-xl mb-1">{pkg.name}</h3>
                <p className="text-[#94A3B8] text-sm mb-6">{pkg.description}</p>

                <div className="flex items-end mb-2">
                  <span className="text-[#94A3B8] text-sm mb-1 mr-1">R$</span>
                  <span className="text-5xl font-bold text-white">{pkg.price}</span>
                </div>

                <div className="flex items-center gap-2 mb-6">
                  <span className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full text-xs font-bold border border-yellow-500/20 flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    {totalCoins} moedas
                  </span>
                  {pkg.bonus > 0 && (
                    <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full text-[10px] font-bold border border-emerald-500/20">
                      +{pkg.bonus} bônus
                    </span>
                  )}
                </div>

                <div className="bg-[#0E1C32] border border-[#1C3050] rounded-xl p-3 mb-6 space-y-1">
                  <p className="text-[10px] text-[#4A6580] font-bold uppercase tracking-widest mb-1.5">Custo por moeda</p>
                  <p className="text-[#94A3B8] text-xs">Sem plano: <span className="text-white font-bold">R$ {costPerCoin}</span>/moeda</p>
                  <p className="text-blue-300 text-xs">Com Starter (25% off): <span className="font-bold">R$ {(pkg.priceNum * 0.75 / totalCoins).toFixed(3)}</span>/moeda</p>
                  <p className="text-emerald-300 text-xs font-bold">Com PRO (40% off): <span>R$ {(pkg.priceNum * 0.60 / totalCoins).toFixed(3)}</span>/moeda</p>
                  <p className="text-yellow-300 text-xs">Com Elite (55% off): <span className="font-bold">R$ {(pkg.priceNum * 0.45 / totalCoins).toFixed(3)}</span>/moeda</p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex gap-3 text-sm text-slate-300">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" /> Acesso imediato aos clientes
                  </li>
                  <li className="flex gap-3 text-sm text-slate-300">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" /> Créditos que não expiram
                  </li>
                </ul>

                <button
                  disabled={!!buyingId}
                  onClick={() => handleCheckout('one_time', pkg.id)}
                  className={`w-full py-4 ${isPopular ? 'bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-600/20' : 'bg-white/5 hover:bg-white/10'} text-white font-bold rounded-xl transition-all border border-[#243F6A] disabled:opacity-50`}
                >
                  <span className="flex items-center justify-center gap-2 text-sm uppercase tracking-widest">
                    {buyingId === pkg.id ? (
                      <><Loader2 size={16} className="animate-spin" /><span>Processando...</span></>
                    ) : (
                      <><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg> Comprar</>
                    )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA Assinatura */}
      <div className="bg-gradient-to-r from-purple-900/40 via-emerald-900/20 to-purple-900/40 border border-emerald-500/30 rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl text-center md:text-left">
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-4 inline-block border border-emerald-500/20">
              Economia Inteligente
            </span>
            <h3 className="text-2xl font-bold text-white mb-2 leading-tight">Assinar é muito mais barato do que moedas avulsas!</h3>
            <p className="text-[#94A3B8] text-sm">
              Com plano PRO, cada compra de moedas custa <span className="text-emerald-400 font-bold">40% menos</span>. O plano se paga sozinho na primeira recarga.
            </p>
          </div>
          <button
            onClick={scrollToPlans}
            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 whitespace-nowrap active:scale-95"
          >
            Ver Planos Mensais
          </button>
        </div>
      </div>

      {/* Planos de Assinatura */}
      <div ref={plansRef} className="space-y-6 pt-12 border-t border-[#1C3050]">
        <div>
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            </span>
            Planos de Pagamento Recorrente
          </h2>
          <p className="text-[#94A3B8] text-sm">Desconto automático em todas as compras de moedas enquanto o plano estiver ativo.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const borderClass = plan.popular
              ? 'border-emerald-500 border-2'
              : plan.color === 'blue'
              ? 'border-blue-500/30'
              : 'border-yellow-500/30';
            const btnClass = plan.popular
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-xl shadow-emerald-500/30'
              : plan.color === 'blue'
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
              : 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-500/20';
            const discountColor = plan.popular
              ? 'text-emerald-400'
              : plan.color === 'blue'
              ? 'text-blue-400'
              : 'text-yellow-400';
            const savingsClass = plan.popular
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : plan.color === 'blue'
              ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
              : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300';

            return (
              <div key={plan.id} className={`bg-[#1C3454] border ${borderClass} rounded-2xl p-8 relative flex flex-col ${plan.popular ? 'transform scale-105 z-10 shadow-[0_0_50px_-10px_rgba(16,185,129,0.3)]' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-black px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase whitespace-nowrap">
                    ⚡ Mais Popular
                  </div>
                )}

                <div className="mb-6">
                  <div className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full mb-3 ${
                    plan.popular ? 'bg-emerald-500/20 text-emerald-400' : plan.color === 'blue' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {plan.discount} OFF
                  </div>
                  <h3 className="text-white font-bold text-2xl mb-1">{plan.name}</h3>
                  <p className="text-[#94A3B8] text-sm mb-3">{plan.description}</p>
                  <div className="flex items-end">
                    <span className="text-[#94A3B8] text-sm mb-1 mr-1">R$</span>
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-[#4A6580] text-sm mb-1 ml-1">/mês</span>
                  </div>
                  <p className={`text-xs font-bold mt-1 ${discountColor}`}>{plan.discount} desconto em todas as moedas</p>
                  <div className="flex items-center gap-2 mt-2 mb-3">
                    <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                      🎁 {plan.welcomeCoins} moedas de boas-vindas
                    </span>
                  </div>
                </div>

                <button
                  disabled={!!buyingId}
                  onClick={() => handleCheckout('subscription', plan.id)}
                  className={`w-full py-4 ${btnClass} font-black rounded-xl transition-all disabled:opacity-50 mb-6`}
                >
                  {buyingId === plan.id ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      <span>Processando...</span>
                    </div>
                  ) : plan.popular ? (
                    'Quero receber clientes agora →'
                  ) : plan.color === 'blue' ? (
                    'Quero começar agora →'
                  ) : (
                    'Quero dominar minha região →'
                  )}
                </button>

                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex gap-2 text-sm text-slate-300 items-start">
                      <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${discountColor}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className={`border rounded-xl p-3 ${savingsClass}`}>
                  <p className="text-xs text-center">{plan.savings}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ROI box */}
      <div className="max-w-2xl mx-auto bg-[#1C3454] border border-[#1C3050] rounded-2xl p-6 text-center">
        <p className="text-white font-bold text-lg mb-1">
          💡 1 cliente de R$ 500 já paga o plano PRO por <span className="text-emerald-400">7 meses</span>
        </p>
        <p className="text-[#4A6580] text-sm">E com 40% de desconto em moedas, você acessa muito mais pelo mesmo preço.</p>
      </div>

      {/* Footer Stripe */}
      <div className="flex justify-center pb-4">
        <p className="text-[#4A6580] text-sm flex gap-3 items-center text-center">
          <span className="font-bold text-lg opacity-80">stripe</span>
          <span className="w-px h-4 bg-slate-800"></span>
          <span className="text-slate-600 text-xs text-left max-w-xs">Pagamento processado de forma segura pelo Stripe. Não armazenamos seus dados de cartão.</span>
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 pt-6 border-t border-slate-800">

        {/* ===== CARD PLANO ATUAL ===== */}
        <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl overflow-hidden flex flex-col">

          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-900/30 via-emerald-900/10 to-transparent border-b border-[#1C3050] px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div>
                <p className="text-[#4A6580] text-[10px] font-bold uppercase tracking-widest">Plano Atual</p>
                <h2 className="text-white font-bold text-base leading-tight">
                  {currentSubscription
                    ? `Plano ${PLAN_NAMES[currentSubscription.package_id] ?? currentSubscription.package_id}`
                    : 'Sem plano ativo'}
                </h2>
              </div>
            </div>
            {currentSubscription && (
              <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg border shrink-0 ${(STATUS_LABELS[currentSubscription.status] ?? STATUS_LABELS['active']).colorClass}`}>
                {(STATUS_LABELS[currentSubscription.status] ?? { label: currentSubscription.status }).label}
              </span>
            )}
          </div>

          {/* Body */}
          <div className="p-5 flex-1 flex flex-col">
            {currentSubscription ? (
              <>
                {subscriptionStatus?.cancel_at_period_end && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 flex items-center gap-2">
                    <AlertCircle size={14} className="text-red-400 shrink-0" />
                    <p className="text-red-300 text-sm">
                      Cancelamento agendado para{' '}
                      <strong>
                        {subscriptionStatus.current_period_end
                          ? new Date(subscriptionStatus.current_period_end * 1000).toLocaleDateString('pt-BR')
                          : currentSubscription?.started_at
                            ? new Date(new Date(currentSubscription.started_at).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')
                            : '—'}
                      </strong>
                    </p>
                  </div>
                )}

                {showExpiryWarning && !subscriptionStatus?.cancel_at_period_end && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4 flex items-start gap-2">
                    <AlertCircle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                    <p className="text-yellow-300 text-sm">
                      Seu plano expira em <strong>{daysUntilExpiry} dia{daysUntilExpiry !== 1 ? 's' : ''}</strong>. Renove para não perder o acesso.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  <div className="bg-[#0E1C32] rounded-xl p-3 border border-[#1C3050]">
                    <div className="flex items-center gap-1.5 text-[#4A6580] text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      Desconto moedas
                    </div>
                    <p className="text-white font-bold text-2xl">{PLAN_LEADS[currentSubscription.package_id] ?? '—'}</p>
                  </div>

                  <div className="bg-[#0E1C32] rounded-xl p-3 border border-[#1C3050]">
                    <div className="flex items-center gap-1.5 text-[#4A6580] text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      <Calendar size={10} />Data início
                    </div>
                    <p className="text-white font-bold text-sm">
                      {currentSubscription.started_at
                        ? new Date(currentSubscription.started_at).toLocaleDateString('pt-BR')
                        : '—'}
                    </p>
                  </div>

                  <div className="bg-[#0E1C32] rounded-xl p-3 border border-[#1C3050]">
                    <div className="flex items-center gap-1.5 text-[#4A6580] text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      <RefreshCw size={10} />
                      {subscriptionStatus?.cancel_at_period_end ? 'Expira em' : 'Próx. renovação'}
                    </div>
                    <p className={`font-bold text-sm ${subscriptionStatus?.cancel_at_period_end ? 'text-red-400' : 'text-white'}`}>
                      {subscriptionStatus?.current_period_end
                        ? new Date(subscriptionStatus.current_period_end * 1000).toLocaleDateString('pt-BR')
                        : currentSubscription?.started_at
                          ? new Date(new Date(currentSubscription.started_at).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')
                          : '—'}
                    </p>
                  </div>

                  <div className="bg-[#0E1C32] rounded-xl p-3 border border-[#1C3050]">
                    <div className="flex items-center gap-1.5 text-[#4A6580] text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      Valor mensal
                    </div>
                    <p className="text-white font-bold text-xl">
                      R$ {PLAN_PRICES[currentSubscription.package_id] ?? '—'}
                    </p>
                  </div>
                </div>

                {subscriptionStatus?.current_period_end && (
                  <div className="mb-4">
                    <div className="flex justify-between text-[11px] text-[#4A6580] mb-1.5">
                      <span>Ciclo atual</span>
                      <span>
                        {daysUntilExpiry !== null && daysUntilExpiry >= 0
                          ? `${daysUntilExpiry} dia${daysUntilExpiry !== 1 ? 's' : ''} restante${daysUntilExpiry !== 1 ? 's' : ''}`
                          : 'Expirado'}
                      </span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${cycleProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
                <p className="text-[#94A3B8] text-sm font-medium mb-1">Nenhum plano ativo</p>
                <p className="text-slate-600 text-xs">Escolha um plano acima para começar</p>
              </div>
            )}
          </div>

          {/* Footer — botões */}
          <div className="px-5 pb-5 space-y-2">
            <button
              onClick={() => setShowChangePlanModal(true)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2"
            >
              Mudar de Plano
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>

            {currentSubscription && !subscriptionStatus?.cancel_at_period_end && (
              cancelConfirm ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-red-300 text-sm text-center mb-3">Confirmar cancelamento da assinatura?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCancelConfirm(false)}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold rounded-lg transition-colors"
                    >
                      Não
                    </button>
                    <button
                      onClick={handleCancelSubscription}
                      disabled={cancelLoading}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {cancelLoading ? <Loader2 size={14} className="animate-spin" /> : 'Sim, cancelar'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setCancelConfirm(true)}
                  className="w-full py-2.5 bg-transparent hover:bg-red-500/10 text-red-500 text-sm font-semibold rounded-xl transition-colors border border-red-500/20 hover:border-red-500/40"
                >
                  Cancelar Assinatura
                </button>
              )
            )}
          </div>
        </div>

        {/* Saldo de Moedas */}
        <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-6 relative flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.92-.88a2 2 0 0 1 2.81 2.81l-.88.92"/></svg>
            <h2 className="text-lg font-bold text-white">Saldo de Moedas</h2>
          </div>

          <div className="bg-[#0E1C32] border border-[#1C3050] rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4 text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              <h3 className="font-bold text-white">Minha Carteira</h3>
            </div>

            <div className="bg-[#1C3454] rounded-lg p-4 text-center mb-4 border border-[#1C3050]">
              <p className="text-[#94A3B8] text-xs mb-1">Saldo disponível</p>
              <p className="text-3xl font-bold text-white">
                {balanceLoading ? <LoadingSpinner size={24} className="inline-block" /> : balance} moedas
              </p>
            </div>

            <button onClick={() => navigate('/profissional/carteira')} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-bold rounded-xl transition-colors">
              Ir para carteira
            </button>
          </div>

          <div className="bg-[#0E1C32] border border-[#1C3050] rounded-xl p-6">
            <h3 className="font-bold text-white text-center mb-1">Transações</h3>
            <p className="text-[#4A6580] text-xs text-center mb-4">Histórico auditado</p>

            <div className="space-y-3">
              {[60, 200, 60, 560, 180].map((val, i) => (
                <div key={i} className="flex justify-between text-xs font-mono bg-[#1C3454] p-2 rounded border border-[#1C3050] text-emerald-400">
                  <div className="flex items-center gap-2 truncate">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                    <span className="truncate">stripe:cs_test_a1{Math.random().toString(36).substr(2, 6).toUpperCase()}...</span>
                  </div>
                  <span className="flex-shrink-0 ml-2">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Mudar de Plano */}
      {showChangePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1C3454] border border-[#243F6A] rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-xl">Mudar de Plano</h2>
              <button onClick={() => setShowChangePlanModal(false)} className="text-[#94A3B8] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-6 flex items-start gap-2">
              <AlertCircle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-yellow-300 text-sm">Ao mudar de plano, o plano atual será cancelado automaticamente.</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div key={plan.id} className={`bg-[#0E1C32] border ${plan.popular ? 'border-emerald-500/40' : plan.color === 'blue' ? 'border-blue-500/20' : 'border-yellow-500/20'} rounded-xl p-5 flex flex-col`}>
                  <div className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full mb-2 ${
                    plan.popular ? 'bg-emerald-500/20 text-emerald-400' : plan.color === 'blue' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {plan.discount} OFF
                  </div>
                  <h3 className="text-white font-bold text-lg mb-1">{plan.name}</h3>
                  <div className="flex items-end mb-2">
                    <span className="text-[#94A3B8] text-sm mr-1">R$</span>
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                    <span className="text-[#4A6580] text-sm ml-1">/mês</span>
                  </div>
                  <p className="text-[#94A3B8] text-xs mb-4 flex-1">{plan.description}</p>
                  <button
                    disabled={!!buyingId}
                    onClick={() => { setShowChangePlanModal(false); handleCheckout('subscription', plan.id); }}
                    className={`w-full py-3 ${
                      plan.popular ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : plan.color === 'blue' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-yellow-500 hover:bg-yellow-400 text-black'
                    } font-bold rounded-xl transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2`}
                  >
                    {buyingId === plan.id ? <Loader2 size={16} className="animate-spin" /> : 'Assinar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
