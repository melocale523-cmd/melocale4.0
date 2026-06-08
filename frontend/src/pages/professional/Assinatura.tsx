import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { walletService, subscriptionService, transactionService } from '../../services/dbServices';
import { useAuthStore } from '../../store/authStore';
import { initiateCheckout } from '../../lib/stripe';
import { apiFetch } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, X, Calendar, RefreshCw, Coins } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, { label: string; colorClass: string }> = {
  active:    { label: 'Ativo',                    colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  canceling: { label: 'Cancela no fim do período', colorClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20'  },
  canceled:  { label: 'Cancelado',                colorClass: 'bg-red-500/10 text-red-400 border-red-500/20'            },
  past_due:  { label: 'Pagamento Pendente',        colorClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'  },
  trialing:  { label: 'Em Teste',                 colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20'         },
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

const PLAN_DISCOUNT_FRACTION: Record<string, number> = {
  plan_basic:    0.25,
  plan_pro:      0.40,
  plan_business: 0.55,
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

// Design tokens — MeloCalé 4.0
const C = {
  page:   '#070f1c',
  card1:  '#0a1928',
  card2:  '#0d1e35',
  card3:  '#0e2038',
  border: 'rgba(255,255,255,.06)',
  emerald: '#10b981',
};
const FONT_SANS = "'DM Sans', sans-serif";
const FONT_MONO = "'DM Mono', monospace";

function LightLine({ color }: { color: string }) {
  return (
    <div
      aria-hidden
      className="absolute top-0 left-0 right-0 z-10"
      style={{ height: 1, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.7 }}
    />
  );
}

function Glow({ color, style }: { color: string; style: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      className="absolute rounded-full pointer-events-none"
      style={{ background: color, filter: 'blur(70px)', opacity: 0.5, ...style }}
    />
  );
}

const fmtBRL = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ProfessionalAssinatura() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const plansRef = useRef<HTMLDivElement>(null);
  const packagesRef = useRef<HTMLDivElement>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const professionalId = useAuthStore(state => state.user?.professionalId);

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['walletBalance'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: walletService.getBalance
  });

  const { data: currentSubscription, isLoading: isSubscriptionLoading } = useQuery({
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

  const { data: recentTransactions, isLoading: isTransactionsLoading } = useQuery({
    queryKey: ['recentTransactions', professionalId],
    enabled: !!professionalId,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: () => transactionService.getRecentTransactions(professionalId!, 5),
  });

  const { data: plansApiData } = useQuery<Array<{ id: string; name: string; coinDiscount: number; welcomeCoins: number }>>({
    queryKey: ['plans-config'],
    queryFn: () => apiFetch('/api/plans').then(r => r.json()),
    staleTime: Infinity,
  });

  const getPlanDiscount = (planId: string): number => {
    const found = plansApiData?.find(p => p.id === planId);
    return found ? Math.round(found.coinDiscount * 100) : 0;
  };

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
      if (import.meta.env.DEV) console.error('[Checkout]', error);
      toast.error("Houve um erro ao processar o seu pedido. Por favor, tente novamente.");
    } finally {
      setBuyingId(null);
    }
  };

  const scrollToPlans = () => {
    plansRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToPackages = () => {
    packagesRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao cancelar assinatura.' });
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

  // ---- Derived display values (presentation-only — no new business logic / API calls) ----
  const currentPlanId: string | undefined = currentSubscription ? currentSubscription.package_id : undefined;
  const currentPlanName = currentPlanId ? (PLAN_NAMES[currentPlanId] ?? currentPlanId) : null;
  const currentDiscountFraction = currentPlanId ? (PLAN_DISCOUNT_FRACTION[currentPlanId] ?? 0) : 0;
  const currentDiscountLabel = currentPlanId ? (PLAN_LEADS[currentPlanId] ?? '—') : '—';
  const proDiscountFraction = PLAN_DISCOUNT_FRACTION.plan_pro;

  // "pacote 200 moedas" (pack_pro = 180 + 20 bônus) como referência de custo médio por lead
  const referencePackage = CREDIT_PACKAGES.find(p => p.id === 'pack_pro')!;
  const referenceTotalCoins = referencePackage.coins + referencePackage.bonus;
  const baseCostPerCoin = referencePackage.priceNum / referenceTotalCoins;
  const costForPlan = (planId: string) => baseCostPerCoin * (1 - (PLAN_DISCOUNT_FRACTION[planId] ?? 0));

  const costPerCoinCurrent = baseCostPerCoin * (1 - currentDiscountFraction);
  const costPerCoinPro = baseCostPerCoin * (1 - proDiscountFraction);

  const balanceNum = typeof balance === 'number' ? balance : 0;
  const balanceWorth = balanceNum * baseCostPerCoin;
  const walletDifference = balanceNum * Math.max(0, costPerCoinCurrent - costPerCoinPro);

  const packageCostCurrent = costPerCoinCurrent * referenceTotalCoins;
  const packageCostPro = costPerCoinPro * referenceTotalCoins;
  const annualLossWithoutPro = Math.max(0, (packageCostCurrent - packageCostPro) * 12);

  const expiryDateLabel = subscriptionStatus?.current_period_end
    ? new Date(subscriptionStatus.current_period_end * 1000).toLocaleDateString('pt-BR')
    : '—';

  const periodEndMs = subscriptionStatus?.current_period_end ? subscriptionStatus.current_period_end * 1000 : null;
  const msRemaining = periodEndMs ? Math.max(0, periodEndMs - Date.now()) : 0;
  const countdownDays = Math.floor(msRemaining / 86_400_000);
  const countdownHours = Math.floor((msRemaining % 86_400_000) / 3_600_000);
  const countdownMinutes = Math.floor((msRemaining % 3_600_000) / 60_000);

  const comparisonRows: Array<{ label: string; starter: string; pro: string; elite: string }> = [
    { label: 'Preço mensal', starter: `R$ ${PLAN_PRICES.plan_basic}`, pro: `R$ ${PLAN_PRICES.plan_pro}`, elite: `R$ ${PLAN_PRICES.plan_business}` },
    { label: 'Desconto em moedas', starter: PLAN_LEADS.plan_basic, pro: PLAN_LEADS.plan_pro, elite: PLAN_LEADS.plan_business },
    { label: 'Visibilidade nas buscas', starter: 'Padrão', pro: '2× mais visível', elite: 'Topo absoluto' },
    { label: 'Expiração das moedas', starter: '90 dias', pro: 'Nunca expiram', elite: 'Nunca expiram' },
    { label: 'Badge de perfil', starter: '✅ Verificado', pro: '⚡ PRO em destaque', elite: '🏆 Elite dourado' },
    { label: 'Suporte', starter: 'Chat padrão', pro: 'Prioritário (2h)', elite: 'Gerente dedicado' },
    { label: 'Moedas de boas-vindas', starter: `${SUBSCRIPTION_PLANS[0].welcomeCoins}`, pro: `${SUBSCRIPTION_PLANS[1].welcomeCoins}`, elite: `${SUBSCRIPTION_PLANS[2].welcomeCoins}` },
    { label: 'Pacote de 200 moedas', starter: `R$ ${fmtBRL(costForPlan('plan_basic') * referenceTotalCoins)}`, pro: `R$ ${fmtBRL(costForPlan('plan_pro') * referenceTotalCoins)}`, elite: `R$ ${fmtBRL(costForPlan('plan_business') * referenceTotalCoins)}` },
  ];

  return (
    <div className="-mx-4 -my-3 md:-mx-32 px-4 py-3 md:px-32" style={{ background: C.page, fontFamily: FONT_SANS }}>
      <div className="w-full space-y-4 pb-6" style={{ maxWidth: 1320, margin: '0 auto' }}>

        {/* Status banner */}
        {statusMessage && (
          <div
            className="px-4 py-3 rounded-2xl border flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300"
            style={{
              background: statusMessage.type === 'success' ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)',
              borderColor: statusMessage.type === 'success' ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)',
              color: statusMessage.type === 'success' ? '#34d399' : '#f87171',
            }}
          >
            {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <p className="text-xs font-medium flex-1">{statusMessage.text}</p>
            <button onClick={() => setStatusMessage(null)} className="opacity-50 hover:opacity-100 transition-opacity">
              <X size={14} />
            </button>
          </div>
        )}

        {/* 1. Banner de Urgência */}
        {currentSubscription && showExpiryWarning && !subscriptionStatus?.cancel_at_period_end && (
          <div className="relative overflow-hidden rounded-2xl p-4 md:p-5" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,.12), rgba(249,115,22,.07))', border: '1px solid rgba(249,115,22,.22)' }}>
            <LightLine color="#f97316" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
              <div className="flex items-start gap-3">
                <span className="relative flex h-2.5 w-2.5 mt-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#ef4444' }} />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#ef4444', boxShadow: '0 0 12px 2px rgba(239,68,68,.7)' }} />
                </span>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#fca5a5' }}>
                    ⚠ Seu plano cancela em {daysUntilExpiry} dia{daysUntilExpiry !== 1 ? 's' : ''} — você cede espaço para concorrentes
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                    Após o vencimento você perde o badge de destaque, o desconto em moedas e a posição privilegiada nas buscas.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex gap-1.5">
                  {[{ value: countdownDays, label: 'dias' }, { value: countdownHours, label: 'hrs' }, { value: countdownMinutes, label: 'min' }].map((item) => (
                    <div key={item.label} className="rounded-lg px-2.5 py-1.5 text-center" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', minWidth: 52 }}>
                      <p className="text-base font-bold" style={{ fontFamily: FONT_MONO, color: '#fff' }}>{String(item.value).padStart(2, '0')}</p>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: '#94a3b8' }}>{item.label}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={scrollToPlans}
                  className="h-10 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)', color: '#fff', boxShadow: '0 8px 24px -8px rgba(239,68,68,.6)' }}
                >
                  ⬆ Upgrade agora
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 1b. Alerta de Cancelamento agendado */}
        {currentSubscription && subscriptionStatus?.cancel_at_period_end && (
          <div className="relative overflow-hidden rounded-2xl p-4 md:p-5" style={{ background: 'linear-gradient(135deg, rgba(249,115,22,.12), rgba(239,68,68,.06))', border: '1px solid rgba(249,115,22,.22)' }}>
            <LightLine color="#f97316" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
              <div className="flex items-start gap-3">
                <span className="relative flex h-2.5 w-2.5 mt-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#f97316' }} />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#f97316', boxShadow: '0 0 12px 2px rgba(249,115,22,.7)' }} />
                </span>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#fdba74' }}>
                    Seu plano {currentPlanName} foi marcado para cancelamento e encerra em {expiryDateLabel}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                    A partir dessa data você perde o desconto de {currentDiscountLabel} em moedas, o badge de destaque e a posição privilegiada nas buscas da sua região.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleCheckout('subscription', 'plan_pro')}
                disabled={!!buyingId}
                className="shrink-0 h-10 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)', color: '#fff', boxShadow: '0 8px 24px -8px rgba(239,68,68,.6)' }}
              >
                {buyingId === 'plan_pro' ? <Loader2 size={14} className="animate-spin inline" /> : 'Assinar PRO →'}
              </button>
            </div>
          </div>
        )}

        {/* 2. Barra de Prova Social */}
        <div className="rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" style={{ background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.12)' }}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {[
              { value: '128', label: 'profissionais ao vivo agora' },
              { value: '34', label: 'upgrades para PRO essa semana' },
              { value: 'R$ 2.840', label: 'faturamento médio dos PRO/mês' },
              { value: '12 min', label: 'atrás — última adesão ao PRO' },
            ].map((item) => (
              <div key={item.label} className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold" style={{ fontFamily: FONT_MONO, color: C.emerald }}>{item.value}</span>
                <span className="text-[11px]" style={{ color: '#7491ad' }}>{item.label}</span>
              </div>
            ))}
          </div>
          <button onClick={scrollToPlans} className="shrink-0 h-8 px-4 rounded-full text-xs font-bold transition-all" style={{ background: 'rgba(16,185,129,.14)', color: C.emerald, border: '1px solid rgba(16,185,129,.3)' }}>
            Ver planos →
          </button>
        </div>

        {/* 3. KPI Row */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            onClick={() => navigate('/profissional/carteira')}
            className="relative overflow-hidden rounded-[20px] p-4 cursor-pointer transition-all duration-[250ms] hover:-translate-y-0.5"
            style={{ background: C.card3, border: `1px solid ${C.border}` }}
          >
            <LightLine color="#fab144" />
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#7491ad' }}>Moedas</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: FONT_MONO, color: '#fff' }}>{balanceLoading ? '—' : balanceNum}</p>
            <div className="h-1 rounded-full mt-2 mb-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, balanceNum / 2)}%`, background: 'linear-gradient(90deg, #fab144, #f59e0b)' }} />
            </div>
            <p className="text-xs" style={{ color: '#94a3b8' }}>≈ R$ {fmtBRL(balanceWorth)} em leads</p>
            <p className="text-[10px] italic mt-1" style={{ color: '#5b7693' }}>clique para recarregar</p>
          </div>

          <div className="relative overflow-hidden rounded-[20px] p-4 transition-all duration-[250ms] hover:-translate-y-0.5" style={{ background: C.card3, border: `1px solid ${C.border}` }}>
            <LightLine color={C.emerald} />
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#7491ad' }}>Desconto Atual</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: FONT_MONO, color: '#fff' }}>{currentSubscription ? currentDiscountLabel : '—'}</p>
            <div className="h-1 rounded-full mt-2 mb-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
              <div className="h-full rounded-full" style={{ width: `${currentDiscountFraction * 100}%`, background: `linear-gradient(90deg, ${C.emerald}, #34d399)` }} />
            </div>
            <p className="text-xs" style={{ color: '#94a3b8' }}>
              {currentSubscription ? <>PRO oferece <span style={{ color: C.emerald }}>{PLAN_LEADS.plan_pro}</span> de desconto</> : 'Assine para ganhar desconto em moedas'}
            </p>
            <p className="text-[10px] italic mt-1" style={{ color: '#5b7693' }}>quanto maior o plano, maior o desconto</p>
          </div>

          <div className="relative overflow-hidden rounded-[20px] p-4 transition-all duration-[250ms] hover:-translate-y-0.5" style={{ background: C.card3, border: `1px solid ${C.border}` }}>
            <LightLine color="#ef4444" />
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#7491ad' }}>Dias Restantes</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: FONT_MONO, color: (currentSubscription && daysUntilExpiry !== null && daysUntilExpiry < 30) ? '#f87171' : '#fff' }}>
              {currentSubscription && daysUntilExpiry !== null ? daysUntilExpiry : '—'}
            </p>
            <div className="h-1 rounded-full mt-2 mb-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
              <div className="h-full rounded-full" style={{ width: `${cycleProgress}%`, background: 'linear-gradient(90deg, #ef4444, #f97316)' }} />
            </div>
            <p className="text-xs" style={{ color: '#94a3b8' }}>{currentSubscription ? `expira em ${expiryDateLabel}` : 'sem assinatura ativa'}</p>
            <p className="text-[10px] italic mt-1" style={{ color: '#5b7693' }}>renove para não perder o acesso</p>
          </div>

          <div className="relative overflow-hidden rounded-[20px] p-4 transition-all duration-[250ms] hover:-translate-y-0.5" style={{ background: C.card3, border: `1px solid ${C.border}` }}>
            <LightLine color="#3b82f6" />
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#7491ad' }}>Custo / Moeda</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: FONT_MONO, color: '#fff' }}>R$ {costPerCoinCurrent.toFixed(3)}</p>
            <div className="h-1 rounded-full mt-2 mb-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (costPerCoinCurrent / baseCostPerCoin) * 100)}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
            </div>
            <p className="text-xs" style={{ color: '#94a3b8' }}>com PRO: <span style={{ color: C.emerald }}>R$ {costPerCoinPro.toFixed(3)}</span></p>
            <p className="text-[10px] italic mt-1" style={{ color: '#5b7693' }}>quanto menor, mais leads você compra</p>
          </div>
        </div>

        {/* 4. Carteira + Plano Atual */}
        <div className="grid lg:grid-cols-2 gap-3">

          {/* Carteira */}
          <div className="relative overflow-hidden rounded-[22px] p-5 flex flex-col" style={{ background: 'linear-gradient(145deg, #0a1928, #0e2038, #110d2a)', border: '1px solid rgba(250,177,68,.2)' }}>
            <LightLine color="#fab144" />
            <Glow color="rgba(250,177,68,.18)" style={{ width: 220, height: 220, top: -90, left: -80 }} />
            <Glow color="rgba(16,185,129,.14)" style={{ width: 220, height: 220, bottom: -100, right: -70 }} />
            <Glow color="rgba(168,85,247,.10)" style={{ width: 200, height: 200, top: 70, right: -100 }} />

            <div className="relative z-10 flex flex-col flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Coins size={16} style={{ color: '#fab144' }} />
                <h3 className="text-xs uppercase tracking-wider font-bold" style={{ color: '#fab144' }}>Minha Carteira</h3>
              </div>

              {balanceLoading ? (
                <div className="flex items-center gap-2 my-4">
                  <Loader2 size={22} className="animate-spin" style={{ color: '#fab144' }} />
                  <span className="text-sm" style={{ color: '#94a3b8' }}>Calculando saldo...</span>
                </div>
              ) : (
                <h2
                  className="leading-none mt-1"
                  style={{
                    fontFamily: FONT_SANS, fontSize: 58, fontWeight: 900, letterSpacing: '-3px',
                    background: 'linear-gradient(135deg, #fab144, #f5d36b)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  }}
                >
                  {balanceNum}
                </h2>
              )}
              <span className="text-xs uppercase tracking-wide font-semibold mb-2" style={{ color: '#cbd5e1' }}>moedas disponíveis</span>

              <span className="inline-flex w-fit items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold mb-3" style={{ background: 'rgba(250,177,68,.12)', color: '#fbbf24', border: '1px solid rgba(250,177,68,.25)' }}>
                ≈ R$ {fmtBRL(balanceWorth)} em leads
              </span>

              {currentSubscription && currentPlanId === 'plan_basic' ? (
                <div className="rounded-[14px] p-3 mb-3 space-y-1.5" style={{ background: 'rgba(0,0,0,.3)', border: `1px solid ${C.border}` }}>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: '#94a3b8' }}>Starter (você agora) · {currentDiscountLabel} off</span>
                    <span className="font-semibold" style={{ fontFamily: FONT_MONO, color: C.emerald }}>R$ {costPerCoinCurrent.toFixed(3)}/moeda</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: '#94a3b8' }}>Com PRO — 40% off</span>
                    <span className="font-semibold" style={{ fontFamily: FONT_MONO, color: '#6ee7b7' }}>R$ {costPerCoinPro.toFixed(3)}/moeda</span>
                  </div>
                  <div className="h-px my-1" style={{ background: C.border }} />
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: '#fbbf24' }}>Diferença nas suas {balanceNum} moedas</span>
                    <span className="font-bold" style={{ fontFamily: FONT_MONO, color: '#fbbf24' }}>R$ {fmtBRL(walletDifference)}</span>
                  </div>
                </div>
              ) : currentSubscription ? (
                <div className="rounded-[14px] p-3 mb-3" style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.18)' }}>
                  <p className="text-xs" style={{ color: '#6ee7b7' }}>
                    Você já está no plano <strong>{currentPlanName}</strong>, com {currentDiscountLabel} de desconto — um dos melhores custos por moeda da plataforma.
                  </p>
                </div>
              ) : (
                <div className="rounded-[14px] p-3 mb-3 space-y-1.5" style={{ background: 'rgba(0,0,0,.3)', border: `1px solid ${C.border}` }}>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: '#94a3b8' }}>Sem plano — preço cheio</span>
                    <span className="font-semibold" style={{ fontFamily: FONT_MONO, color: '#cbd5e1' }}>R$ {baseCostPerCoin.toFixed(3)}/moeda</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: '#94a3b8' }}>Com PRO — 40% off</span>
                    <span className="font-semibold" style={{ fontFamily: FONT_MONO, color: '#6ee7b7' }}>R$ {costPerCoinPro.toFixed(3)}/moeda</span>
                  </div>
                </div>
              )}

              {currentSubscription && currentDiscountFraction < proDiscountFraction && balanceNum > 0 && (
                <div className="rounded-full px-3 py-1.5 mb-3 text-xs font-medium w-fit" style={{ background: 'rgba(16,185,129,.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,.25)' }}>
                  🚀 Com PRO você economizaria R$ {fmtBRL(walletDifference)} nas suas moedas atuais — e ainda mais em cada recarga futura.
                </div>
              )}

              <div className="mt-auto space-y-2 pt-2">
                <button
                  onClick={scrollToPackages}
                  className="w-full h-11 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #fab144, #f97316)', color: '#1a1206', boxShadow: '0 10px 28px -10px rgba(250,177,68,.55)' }}
                >
                  🪙 Comprar Moedas Agora
                </button>
                <button
                  onClick={() => navigate('/profissional/carteira')}
                  className="w-full h-10 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'transparent', color: '#fab144', border: '1px solid rgba(250,177,68,.35)' }}
                >
                  Ver histórico completo →
                </button>
              </div>

              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: '#7491ad' }}>Últimas transações</p>
                {isTransactionsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin" style={{ color: C.emerald }} /></div>
                ) : recentTransactions && recentTransactions.length > 0 ? (
                  <ul className="space-y-2">
                    {recentTransactions.slice(0, 4).map((tx) => (
                      <li key={tx.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                            style={{
                              background: tx.type === 'deposit' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
                              color: tx.type === 'deposit' ? '#34d399' : '#f87171',
                            }}
                          >
                            {tx.type === 'deposit' ? '+' : '−'}
                          </div>
                          <p className="text-xs truncate" style={{ color: '#cbd5e1' }}>{tx.description || (tx.type === 'deposit' ? 'Recarga de moedas' : 'Compra de contato')}</p>
                        </div>
                        <span className="text-xs font-semibold shrink-0" style={{ fontFamily: FONT_MONO, color: tx.type === 'deposit' ? '#34d399' : '#cbd5e1' }}>
                          {tx.type === 'deposit' ? '+' : '-'}{Math.abs(tx.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-center py-3" style={{ color: '#5b7693' }}>Nenhuma transação encontrada.</p>
                )}
              </div>
            </div>
          </div>

          {/* Plano Atual */}
          <div className="relative overflow-hidden rounded-[22px] p-5 flex flex-col" style={{ background: 'linear-gradient(160deg, #071e30, #0e2038)', border: '1px solid rgba(16,185,129,.22)' }}>
            <LightLine color={C.emerald} />
            <Glow color="rgba(16,185,129,.16)" style={{ width: 220, height: 220, top: -90, right: -80 }} />
            <Glow color="rgba(59,130,246,.10)" style={{ width: 200, height: 200, bottom: -90, left: -70 }} />

            <div className="relative z-10 flex flex-col flex-1">
              <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: '#7491ad' }}>Plano Atual</p>
                  <h2
                    style={{
                      fontFamily: FONT_SANS, fontSize: 26, fontWeight: 900,
                      background: 'linear-gradient(135deg, #34d399, #10b981)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                    }}
                  >
                    {currentSubscription ? (PLAN_NAMES[currentSubscription.package_id] ?? currentSubscription.package_id) : 'Sem plano ativo'}
                  </h2>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {currentSubscription && (
                    <span className={`text-xs px-2.5 py-1 font-semibold rounded-lg border ${(STATUS_LABELS[currentSubscription.status] ?? STATUS_LABELS['active']).colorClass}`}>
                      {(STATUS_LABELS[currentSubscription.status] ?? { label: currentSubscription.status }).label}
                    </span>
                  )}
                  {currentSubscription && subscriptionStatus?.cancel_at_period_end && (
                    <span className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: 'rgba(249,115,22,.12)', color: '#fb923c', border: '1px solid rgba(249,115,22,.25)' }}>
                      ⚠ Cancela {expiryDateLabel}
                    </span>
                  )}
                </div>
              </div>

              {isSubscriptionLoading ? (
                <div className="flex-1 flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin" style={{ color: C.emerald }} />
                </div>
              ) : currentSubscription ? (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,.22)', border: `1px solid ${C.border}` }}>
                      <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#7491ad' }}>Desconto moedas</p>
                      <p className="text-lg font-bold" style={{ color: C.emerald }}>{currentDiscountLabel}</p>
                    </div>
                    <div className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,.22)', border: `1px solid ${C.border}` }}>
                      <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#7491ad' }}>Valor mensal</p>
                      <p className="text-lg font-bold text-white">R$ {PLAN_PRICES[currentSubscription.package_id] ?? '—'}</p>
                    </div>
                    <div className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,.22)', border: `1px solid ${C.border}` }}>
                      <p className="text-[10px] uppercase tracking-wide mb-0.5 flex items-center gap-1" style={{ color: '#7491ad' }}><Calendar size={10} />Data início</p>
                      <p className="text-sm font-semibold text-white">{currentSubscription.started_at ? new Date(currentSubscription.started_at).toLocaleDateString('pt-BR') : '—'}</p>
                    </div>
                    <div className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,.22)', border: `1px solid ${C.border}` }}>
                      <p className="text-[10px] uppercase tracking-wide mb-0.5 flex items-center gap-1" style={{ color: '#7491ad' }}>
                        <RefreshCw size={10} />
                        {subscriptionStatus?.cancel_at_period_end ? 'Encerra em' : 'Próx. renovação'}
                      </p>
                      <p className="text-sm font-semibold" style={{ color: subscriptionStatus?.cancel_at_period_end ? '#fb923c' : '#fff' }}>{expiryDateLabel}</p>
                    </div>
                  </div>

                  {subscriptionStatus?.current_period_end && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: '#7491ad' }}>Ciclo atual</span>
                        <span style={{ color: daysUntilExpiry !== null && daysUntilExpiry < 30 ? '#f87171' : '#7491ad' }}>
                          {daysUntilExpiry !== null && daysUntilExpiry >= 0
                            ? `${daysUntilExpiry} dia${daysUntilExpiry !== 1 ? 's' : ''} restante${daysUntilExpiry !== 1 ? 's' : ''}`
                            : 'Expirado'}
                        </span>
                      </div>
                      <div className="w-full rounded-full h-[5px] overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${cycleProgress}%`, background: `linear-gradient(90deg, ${C.emerald}, #34d399)` }} />
                      </div>
                    </div>
                  )}

                  {annualLossWithoutPro > 1 && (
                    <div className="rounded-2xl p-3 mb-3" style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)' }}>
                      <p className="text-xs font-bold mb-1.5" style={{ color: '#fca5a5' }}>📊 Quanto você perde sem upgrade?</p>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span style={{ color: '#94a3b8' }}>Pacote de 200 moedas com {currentPlanName}</span>
                        <span style={{ fontFamily: FONT_MONO, color: '#cbd5e1' }}>R$ {fmtBRL(packageCostCurrent)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span style={{ color: '#94a3b8' }}>Mesmo pacote com PRO</span>
                        <span style={{ fontFamily: FONT_MONO, color: '#6ee7b7' }}>R$ {fmtBRL(packageCostPro)}</span>
                      </div>
                      <p className="font-bold text-center" style={{ fontFamily: FONT_MONO, fontSize: 22, color: '#f87171' }}>
                        R$ {fmtBRL(annualLossWithoutPro)}/ano a mais sem PRO
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.18)' }}>
                      <p className="text-xl font-black" style={{ fontFamily: FONT_MONO, color: '#60a5fa' }}>2×</p>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: '#7491ad' }}>mais visível com PRO</p>
                    </div>
                    <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(250,177,68,.08)', border: '1px solid rgba(250,177,68,.2)' }}>
                      <p className="text-xl font-black" style={{ fontFamily: FONT_MONO, color: '#fbbf24' }}>∞</p>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: '#7491ad' }}>moedas sem prazo no PRO</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,.04)' }}>
                    <Coins size={20} style={{ color: '#5b7693' }} />
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: '#94a3b8' }}>Nenhum plano ativo</p>
                  <p className="text-xs" style={{ color: '#5b7693' }}>Assine um plano para ganhar desconto, badge e mais visibilidade</p>
                </div>
              )}

              <div className="mt-auto space-y-2 pt-1">
                <button
                  disabled={!!buyingId}
                  onClick={() => handleCheckout('subscription', 'plan_pro')}
                  className="w-full h-11 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${C.emerald}, #059669)`, color: '#06281d', boxShadow: '0 10px 28px -10px rgba(16,185,129,.55)' }}
                >
                  {buyingId === 'plan_pro' ? <Loader2 size={14} className="animate-spin" /> : '⬆ Fazer Upgrade para PRO — R$67/mês'}
                </button>
                <button
                  disabled={!!buyingId}
                  onClick={() => handleCheckout('subscription', 'plan_basic')}
                  className="w-full h-10 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'transparent', color: C.emerald, border: '1px solid rgba(16,185,129,.3)' }}
                >
                  {buyingId === 'plan_basic' ? <Loader2 size={14} className="animate-spin" /> : '↺ Renovar Starter por R$37'}
                </button>
                <button
                  onClick={() => setShowChangePlanModal(true)}
                  className="w-full h-10 rounded-xl text-sm font-semibold transition-colors flex justify-center items-center gap-2"
                  style={{ background: 'rgba(255,255,255,.05)', color: '#cbd5e1', border: `1px solid ${C.border}` }}
                >
                  Mudar de Plano
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </button>

                {currentSubscription && !subscriptionStatus?.cancel_at_period_end && (
                  cancelConfirm ? (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}>
                      <p className="text-xs text-center mb-2" style={{ color: '#fca5a5' }}>Confirmar cancelamento da assinatura?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setCancelConfirm(false)} className="flex-1 h-8 rounded-lg text-xs font-semibold transition-colors" style={{ background: 'rgba(255,255,255,.05)', color: '#cbd5e1' }}>
                          Não
                        </button>
                        <button onClick={handleCancelSubscription} disabled={cancelLoading} className="flex-1 h-8 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: '#dc2626', color: '#fff' }}>
                          {cancelLoading ? <Loader2 size={13} className="animate-spin" /> : 'Sim, cancelar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setCancelConfirm(true)} className="w-full text-center text-xs underline transition-colors py-1" style={{ color: '#1e3a5f' }}>
                      Cancelar plano
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 5. Tabela Comparativa */}
        <div className="rounded-[18px] overflow-hidden" style={{ background: 'linear-gradient(180deg, #0a1928, #0d1e35)', border: `1px solid ${C.border}` }}>
          <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr', background: 'rgba(0,0,0,.25)' }}>
            <div className="px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: '#7491ad' }}>Benefício</div>
            <div className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-center" style={{ color: '#60a5fa' }}>Starter</div>
            <div className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-center" style={{ color: C.emerald }}>PRO</div>
            <div className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-center" style={{ color: '#c084fc' }}>Elite</div>
          </div>
          {comparisonRows.map((row) => (
            <div key={row.label} className="grid transition-colors hover:bg-white/[.015]" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr', borderTop: `1px solid ${C.border}` }}>
              <div className="px-4 py-2.5 text-xs" style={{ color: '#cbd5e1' }}>{row.label}</div>
              <div className="px-4 py-2.5 text-xs text-center" style={{ color: '#94a3b8' }}>{row.starter}</div>
              <div className="px-4 py-2.5 text-xs text-center font-semibold" style={{ color: '#6ee7b7', background: 'rgba(16,185,129,.03)' }}>{row.pro}</div>
              <div className="px-4 py-2.5 text-xs text-center" style={{ color: '#d8b4fe' }}>{row.elite}</div>
            </div>
          ))}
          <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr', borderTop: `1px solid ${C.border}`, background: 'rgba(16,185,129,.05)' }}>
            <div className="px-4 py-3 text-xs font-semibold flex items-center" style={{ color: '#cbd5e1' }}>Pronto para escolher?</div>
            <div className="px-3 py-2.5 flex items-center justify-center">
              <button disabled={!!buyingId} onClick={() => handleCheckout('subscription', 'plan_basic')} className="h-8 px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5" style={{ background: 'rgba(59,130,246,.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,.3)' }}>
                {buyingId === 'plan_basic' ? <Loader2 size={12} className="animate-spin" /> : 'Renovar'}
              </button>
            </div>
            <div className="px-3 py-2.5 flex items-center justify-center" style={{ background: 'rgba(16,185,129,.03)' }}>
              <button disabled={!!buyingId} onClick={() => handleCheckout('subscription', 'plan_pro')} className="h-8 px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5" style={{ background: C.emerald, color: '#06281d' }}>
                {buyingId === 'plan_pro' ? <Loader2 size={12} className="animate-spin" /> : '⚡ PRO'}
              </button>
            </div>
            <div className="px-3 py-2.5 flex items-center justify-center">
              <button disabled={!!buyingId} onClick={() => handleCheckout('subscription', 'plan_business')} className="h-8 px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5" style={{ background: 'rgba(168,85,247,.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,.3)' }}>
                {buyingId === 'plan_business' ? <Loader2 size={12} className="animate-spin" /> : '🏆 Elite'}
              </button>
            </div>
          </div>
        </div>

        {/* 6. Pacotes de Créditos Avulsos */}
        <div ref={packagesRef} className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-white">Pacotes de Créditos Avulsos</h2>
            <p className="text-xs uppercase tracking-wide" style={{ color: '#7491ad' }}>Recarregue sua carteira quando quiser — preço cheio, sem assinatura.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {CREDIT_PACKAGES.map((pkg) => {
              const totalCoins = pkg.coins + pkg.bonus;
              const costPerCoin = pkg.priceNum / totalCoins;
              const isPopular = 'popular' in pkg && pkg.popular;
              const accent = isPopular ? C.emerald : (pkg.id === 'pack_premium' ? '#a855f7' : '#3b82f6');
              const accentBorder = isPopular ? 'rgba(16,185,129,.32)' : (pkg.id === 'pack_premium' ? 'rgba(168,85,247,.28)' : 'rgba(59,130,246,.22)');
              const proCostPerCoin = costPerCoin * (1 - PLAN_DISCOUNT_FRACTION.plan_pro);
              const proSavings = (costPerCoin - proCostPerCoin) * totalCoins;
              const minLeads = Math.floor(totalCoins / 25);
              const maxLeads = Math.floor(totalCoins / 12);
              return (
                <div key={pkg.id} className="relative overflow-hidden rounded-[18px] p-4 flex flex-col transition-all duration-[250ms] hover:-translate-y-0.5" style={{ background: 'linear-gradient(145deg, #0a1928, #0d1e35)', border: `1px solid ${accentBorder}` }}>
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
                  {isPopular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-0.5 rounded-full whitespace-nowrap" style={{ background: `linear-gradient(135deg, ${C.emerald}, #34d399)`, color: '#06281d' }}>
                      ★ Melhor Custo-Benefício
                    </span>
                  )}
                  <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: accent }}>{pkg.name}</p>
                  <p className="text-xs mb-2" style={{ color: '#7491ad' }}>{pkg.description}</p>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-xs" style={{ color: '#7491ad' }}>R$</span>
                    <span className="text-white" style={{ fontFamily: FONT_SANS, fontSize: 24, fontWeight: 800 }}>{pkg.price}</span>
                  </div>
                  <span className="inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold mb-3" style={{ background: 'rgba(250,177,68,.12)', color: '#fbbf24', border: '1px solid rgba(250,177,68,.25)' }}>
                    🪙 {totalCoins} moedas{pkg.bonus > 0 ? ` (+${pkg.bonus} bônus)` : ''}
                  </span>
                  <p className="text-xs mb-3" style={{ color: '#94a3b8' }}>→ ~{minLeads} a {maxLeads} leads desbloqueados</p>

                  <div className="rounded-xl p-2.5 mb-3 space-y-1" style={{ background: 'rgba(0,0,0,.3)', border: `1px solid ${C.border}` }}>
                    <div className="flex justify-between text-xs"><span style={{ color: '#7491ad' }}>Sem plano</span><span style={{ fontFamily: FONT_MONO, color: '#cbd5e1' }}>R$ {costPerCoin.toFixed(3)}</span></div>
                    <div className="flex justify-between items-center text-xs">
                      <span style={{ color: '#7491ad' }} className="flex items-center gap-1">
                        Plano atual
                        {currentPlanId && <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,.15)', color: C.emerald, fontSize: 9 }}>você</span>}
                      </span>
                      <span style={{ fontFamily: FONT_MONO, color: '#cbd5e1' }}>R$ {(costPerCoin * (1 - currentDiscountFraction)).toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between text-xs"><span style={{ color: '#7491ad' }}>PRO</span><span style={{ fontFamily: FONT_MONO, color: '#6ee7b7' }}>R$ {proCostPerCoin.toFixed(3)}</span></div>
                    <div className="flex justify-between text-xs"><span style={{ color: '#7491ad' }}>Elite</span><span style={{ fontFamily: FONT_MONO, color: '#d8b4fe' }}>R$ {(costPerCoin * (1 - PLAN_DISCOUNT_FRACTION.plan_business)).toFixed(3)}</span></div>
                  </div>

                  <p className="text-xs mb-3" style={{ color: '#6ee7b7' }}>💡 Com PRO economiza R$ {fmtBRL(proSavings)} aqui</p>

                  <button
                    disabled={!!buyingId}
                    onClick={() => handleCheckout('one_time', pkg.id)}
                    className="mt-auto w-full h-11 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={isPopular
                      ? { background: `linear-gradient(135deg, ${C.emerald}, #059669)`, color: '#06281d', boxShadow: '0 10px 26px -10px rgba(16,185,129,.5)' }
                      : { background: 'transparent', color: accent, border: `1px solid ${accentBorder}` }}
                  >
                    {buyingId === pkg.id ? <><Loader2 size={14} className="animate-spin" /><span>Processando...</span></> : 'Comprar'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7. Banner Economia */}
        <div className="relative overflow-hidden rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-3" style={{ background: 'linear-gradient(120deg, rgba(16,185,129,.1), rgba(16,185,129,.03))', border: '1px solid rgba(16,185,129,.18)' }}>
          <LightLine color={C.emerald} />
          <p className="text-sm relative z-10" style={{ color: '#cbd5e1' }}>
            Você paga <span className="font-bold" style={{ fontFamily: FONT_MONO, color: '#fff' }}>R$ {costPerCoinCurrent.toFixed(3)}</span>/moeda hoje → com PRO seria{' '}
            <span className="font-bold" style={{ fontFamily: FONT_MONO, color: C.emerald }}>R$ {costPerCoinPro.toFixed(3)}</span>/moeda —{' '}
            <span className="font-semibold" style={{ color: '#6ee7b7' }}>o plano se paga já na primeira compra</span>.
          </p>
          <button onClick={scrollToPlans} className="shrink-0 h-10 px-5 rounded-full text-sm font-bold whitespace-nowrap transition-all relative z-10" style={{ background: `linear-gradient(135deg, ${C.emerald}, #34d399)`, color: '#06281d', boxShadow: '0 10px 24px -10px rgba(16,185,129,.5)' }}>
            Assinar PRO agora →
          </button>
        </div>

        {/* 8. Planos Recorrentes */}
        <div ref={plansRef} className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-white">Planos de Pagamento Recorrente</h2>
            <p className="text-xs uppercase tracking-wide" style={{ color: '#7491ad' }}>Desconto automático em toda compra de moedas enquanto o plano estiver ativo.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 items-end">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const accent = plan.popular ? C.emerald : plan.color === 'blue' ? '#3b82f6' : '#a855f7';
              const accentBorder = plan.popular ? 'rgba(16,185,129,.35)' : plan.color === 'blue' ? 'rgba(59,130,246,.18)' : 'rgba(168,85,247,.28)';
              const bg = plan.popular ? 'linear-gradient(160deg, #07261d, #0e2038)' : plan.color === 'blue' ? 'linear-gradient(160deg, #0a1928, #0e2038)' : 'linear-gradient(160deg, #1a0e2e, #0e2038)';
              const planCostPerCoin = costForPlan(plan.id);
              const packageCostWithPlan = planCostPerCoin * referenceTotalCoins;
              return (
                <div key={plan.id} className="flex flex-col">
                  {plan.popular && (
                    <div className="text-center text-xs font-bold mb-2 py-1.5 rounded-full" style={{ background: 'rgba(16,185,129,.14)', color: C.emerald, border: '1px solid rgba(16,185,129,.3)' }}>
                      🔥 Mais Popular — Melhor ROI
                    </div>
                  )}
                  <div className="relative overflow-hidden rounded-[20px] p-4 flex flex-col flex-1 transition-all duration-[250ms] hover:-translate-y-[3px]" style={{ background: bg, border: `1px solid ${accentBorder}` }}>
                    <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
                    <Glow color={`${accent}26`} style={{ width: 180, height: 180, top: -70, right: -60 }} />
                    <div className="relative z-10 flex flex-col flex-1">
                      <span className="inline-block w-fit px-2 py-0.5 rounded-md text-xs font-bold mb-2" style={{ background: `${accent}22`, color: accent }}>{plan.discount} OFF</span>
                      <h3 className="mb-0.5" style={{
                        fontFamily: FONT_SANS, fontSize: 20, fontWeight: 900,
                        background: `linear-gradient(135deg, #fff, ${accent})`,
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                      }}>{plan.name}</h3>
                      <p className="text-xs mb-2" style={{ color: '#7491ad' }}>{plan.description}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs" style={{ color: '#7491ad' }}>R$</span>
                        <span className="text-white" style={{ fontFamily: FONT_SANS, fontSize: 36, fontWeight: 900 }}>{plan.price}</span>
                        <span className="text-xs" style={{ color: '#5b7693' }}>/mês</span>
                      </div>
                      <p className="text-xs mb-3" style={{ color: '#5b7693' }}>= R$ {(Number(plan.price) / 30).toFixed(2).replace('.', ',')}/dia</p>

                      <ul className="space-y-1.5 mb-3 flex-1">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex gap-1.5 text-xs items-start" style={{ color: '#cbd5e1' }}>
                            <CheckCircle2 size={13} className="shrink-0 mt-0.5" style={{ color: accent }} />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      <div className="rounded-xl p-2.5 mb-3" style={{ background: 'rgba(0,0,0,.3)' }}>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>
                          Pacote de 200 moedas custa <span style={{ fontFamily: FONT_MONO, color: accent }}>R$ {fmtBRL(packageCostWithPlan)}</span>
                        </p>
                        <p className="text-[10px] mt-0.5 italic" style={{ color: '#5b7693' }}>{plan.savings} — o plano se paga sozinho</p>
                      </div>

                      <button
                        disabled={!!buyingId}
                        onClick={() => handleCheckout('subscription', plan.id)}
                        className="w-full h-11 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{
                          background: `linear-gradient(135deg, ${accent}, ${plan.popular ? '#059669' : plan.color === 'blue' ? '#2563eb' : '#9333ea'})`,
                          color: plan.popular || plan.color === 'yellow' ? '#1a1206' : '#fff',
                          boxShadow: `0 10px 26px -10px ${accent}88`,
                        }}
                      >
                        {buyingId === plan.id
                          ? <><Loader2 size={14} className="animate-spin" /><span>Processando...</span></>
                          : plan.popular ? 'Quero crescer com o PRO →' : plan.color === 'blue' ? 'Quero começar agora →' : 'Quero dominar minha região →'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 9. Depoimentos */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white">O que dizem os profissionais PRO</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { name: 'Carlos Mendes', city: 'Eletricista · Campinas/SP', text: 'Em duas semanas no PRO já fechei mais clientes do que no mês inteiro do plano grátis. O badge de destaque realmente chama atenção.', result: '+18 clientes em 30 dias' },
              { name: 'Renata Souza', city: 'Diarista · Belo Horizonte/MG', text: 'O desconto nas moedas compensa demais. Comprei o pacote popular e rendeu muito mais leads pelo mesmo valor de antes.', result: 'R$ 2.140 faturados no mês' },
              { name: 'Diego Almeida', city: 'Encanador · Curitiba/PR', text: 'Virei prioridade nas buscas da minha região. O suporte responde rápido e o investimento voltou já na primeira semana.', result: 'ROI em 6 dias' },
            ].map((t) => (
              <div key={t.name} className="relative overflow-hidden rounded-[18px] p-4 flex flex-col transition-all duration-[250ms] hover:-translate-y-0.5" style={{ background: 'linear-gradient(180deg, #0a1928, #0d1e35)', border: `1px solid ${C.border}` }}>
                <p className="mb-2" style={{ color: '#fbbf24', letterSpacing: 3 }}>★★★★★</p>
                <p className="text-xs italic mb-3 flex-1" style={{ color: '#9fb3c8', lineHeight: 1.6 }}>"{t.text}"</p>
                <p className="text-xs font-semibold mb-3" style={{ fontFamily: FONT_MONO, color: C.emerald }}>{t.result}</p>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full" style={{ background: C.emerald }} />
                  <div>
                    <p className="text-xs font-semibold text-white">{t.name}</p>
                    <p className="text-[10px]" style={{ color: '#304F70' }}>{t.city}</p>
                  </div>
                </div>
                <button onClick={scrollToPlans} className="w-full h-9 rounded-lg text-xs font-semibold transition-all" style={{ background: 'transparent', color: C.emerald, border: '1px solid rgba(16,185,129,.25)' }}>
                  Quero resultados assim →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 10. Garantia */}
        <div className="relative overflow-hidden rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center gap-4" style={{ background: 'linear-gradient(120deg, rgba(250,177,68,.08), rgba(250,177,68,.02))', border: '1px solid rgba(250,177,68,.2)' }}>
          <LightLine color="#fab144" />
          <span style={{ fontSize: 30 }}>🛡️</span>
          <div className="flex-1 relative z-10">
            <p className="text-sm font-bold mb-0.5" style={{ color: '#fbbf24' }}>Garantia de 7 dias — dinheiro de volta sem perguntas</p>
            <p className="text-xs" style={{ color: '#304F70' }}>Assine qualquer plano e, se não gostar dos resultados na primeira semana, devolvemos 100% do valor pago.</p>
          </div>
          <button onClick={scrollToPlans} className="shrink-0 h-10 px-5 rounded-xl text-sm font-bold whitespace-nowrap transition-all relative z-10" style={{ background: 'linear-gradient(135deg, #fab144, #f97316)', color: '#1a1206', boxShadow: '0 10px 24px -10px rgba(250,177,68,.5)' }}>
            Assinar com garantia →
          </button>
        </div>

        {/* 11. FAQ */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white">Perguntas Frequentes</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { q: 'Como funciona a cobrança da assinatura?', a: 'A cobrança é mensal e recorrente, feita via Stripe no cartão cadastrado. Você recebe o desconto em moedas e o badge automaticamente assim que o pagamento é confirmado.' },
              { q: 'Posso mudar de plano depois?', a: 'Sim. Use o botão "Mudar de Plano" a qualquer momento — o plano atual é cancelado automaticamente e o novo passa a valer no próximo ciclo.' },
              { q: 'As moedas expiram?', a: 'Nos planos Starter e sem assinatura, as moedas expiram em 90 dias. Nos planos PRO e Elite, as moedas compradas nunca expiram.' },
              { q: 'Como cancelo minha assinatura?', a: 'Use o link "Cancelar plano" na sua área de assinatura. O acesso aos benefícios continua até o fim do período já pago — sem multa ou taxas.' },
              { q: 'Existe taxa de adesão?', a: 'Não. Você paga apenas a mensalidade do plano escolhido. Não cobramos taxa de adesão, ativação ou cancelamento.' },
              { q: 'O plano realmente aumenta minha visibilidade?', a: 'Sim. Profissionais PRO aparecem em destaque e até 2× mais nas buscas da sua região, e os Elite ocupam o topo absoluto dos resultados.' },
            ].map((item) => (
              <div key={item.q} className="rounded-[14px] p-3.5" style={{ background: '#0a1928', border: '1px solid rgba(255,255,255,.05)' }}>
                <p className="text-xs font-bold mb-1.5" style={{ color: '#8aafcf' }}>{item.q}</p>
                <p className="text-[11px]" style={{ color: '#304F70', lineHeight: 1.65 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 12. Trust bar */}
        <div className="flex flex-wrap justify-center items-center gap-7 py-4" style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
          {[
            { icon: '🔒', label: 'Pagamento seguro via Stripe' },
            { icon: '↺', label: 'Cancele quando quiser' },
            { icon: '🛡️', label: 'Garantia de 7 dias' },
            { icon: '💳', label: 'Sem taxa de adesão' },
            { icon: '∞', label: 'Moedas sem prazo no PRO' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-sm" style={{ color: '#5b7693' }}>{item.icon}</span>
              <span className="text-xs" style={{ color: '#5b7693' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 13. Sticky bar */}
      <div
        className="sticky bottom-0 left-0 right-0 z-20 -mx-4 md:-mx-32 px-4 md:px-32 py-3 flex flex-col sm:flex-row items-center justify-between gap-3"
        style={{ background: 'rgba(7,15,28,.96)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${C.border}`, boxShadow: `inset 0 1px 0 0 rgba(16,185,129,.25)` }}
      >
        <p className="text-xs" style={{ color: '#94a3b8' }}>
          <span className="font-bold" style={{ fontFamily: FONT_MONO, color: '#fff' }}>{balanceNum} moedas</span>
          {currentSubscription && <> · {currentPlanName}</>}
          {currentSubscription && daysUntilExpiry !== null && <> · {daysUntilExpiry} dias restantes</>}
          {!currentSubscription && <> · sem plano ativo</>}
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={scrollToPackages} className="flex-1 sm:flex-none h-9 px-4 rounded-lg text-xs font-bold transition-all" style={{ background: 'transparent', color: '#fab144', border: '1px solid rgba(250,177,68,.3)' }}>
            🪙 Comprar moedas
          </button>
          <button disabled={!!buyingId} onClick={() => handleCheckout('subscription', 'plan_basic')} className="flex-1 sm:flex-none h-9 px-4 rounded-lg text-xs font-bold transition-all disabled:opacity-50" style={{ background: 'transparent', color: C.emerald, border: '1px solid rgba(16,185,129,.3)' }}>
            ↺ Renovar Starter
          </button>
          <button disabled={!!buyingId} onClick={() => handleCheckout('subscription', 'plan_pro')} className="flex-1 sm:flex-none h-9 px-4 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5" style={{ background: `linear-gradient(135deg, ${C.emerald}, #34d399)`, color: '#06281d' }}>
            {buyingId === 'plan_pro' ? <Loader2 size={12} className="animate-spin" /> : <>⚡ Upgrade PRO →</>}
          </button>
        </div>
      </div>

      {/* Modal Mudar de Plano */}
      {showChangePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="rounded-2xl p-4 max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ background: C.card2, border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-bold text-lg">Mudar de Plano</h2>
              <button onClick={() => setShowChangePlanModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-lg px-3 py-2 mb-3 flex items-start gap-2" style={{ background: 'rgba(234,179,8,.08)', border: '1px solid rgba(234,179,8,.2)' }}>
              <AlertCircle size={13} className="text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-yellow-300 text-xs">Ao mudar de plano, o plano atual será cancelado automaticamente.</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const accent = plan.popular ? C.emerald : plan.color === 'blue' ? '#3b82f6' : '#a855f7';
                return (
                  <div key={plan.id} className="rounded-xl p-3 flex flex-col" style={{ background: C.card3, border: `1px solid ${accent}33` }}>
                    <span className="inline-block w-fit px-2 py-0.5 rounded-md text-xs font-semibold mb-1.5" style={{ background: `${accent}22`, color: accent }}>{plan.discount} OFF</span>
                    <h3 className="text-white font-bold text-sm mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-0.5 mb-1">
                      <span className="text-slate-400 text-xs">R$</span>
                      <span className="text-2xl font-bold text-white">{plan.price}</span>
                      <span className="text-slate-500 text-xs ml-0.5">/mês</span>
                    </div>
                    <p className="text-slate-400 text-xs mb-3 flex-1">{plan.description}</p>
                    <button
                      disabled={!!buyingId}
                      onClick={() => { setShowChangePlanModal(false); handleCheckout('subscription', plan.id); }}
                      className="w-full h-10 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: accent, color: plan.popular || plan.color === 'yellow' ? '#06281d' : '#fff' }}
                    >
                      {buyingId === plan.id ? <Loader2 size={14} className="animate-spin" /> : 'Assinar'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
