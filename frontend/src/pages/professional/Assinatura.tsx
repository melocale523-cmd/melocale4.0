import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { walletService, subscriptionService, transactionService } from '../../services/dbServices';
import { useAuthStore } from '../../store/authStore';
import { initiateCheckout } from '../../lib/stripe';
import { apiFetch } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, X, Calendar, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
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

  const hasActivePlan = !!(currentSubscription && ['active', 'canceling'].includes(currentSubscription.status));
  const balanceNum = typeof balance === 'number' ? Math.floor(balance) : 0;
  const planDiscount = currentSubscription ? (getPlanDiscount(currentSubscription.package_id) || parseInt(PLAN_LEADS[currentSubscription.package_id] ?? '0')) : 0;
  const costPerCoin = hasActivePlan ? (planDiscount === 40 ? 0.249 : planDiscount === 55 ? 0.187 : 0.311) : 0.415;
  const costPerCoinPro = 0.249;
  const economyVsPro = hasActivePlan ? 0 : (0.415 - 0.249) * balanceNum;

  return (
    <div className="w-full space-y-5" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* Status banner */}
      {statusMessage && (
        <div className={`px-3 py-2 rounded-xl border flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 ${
          statusMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <p className="text-xs font-medium flex-1">{statusMessage.text}</p>
          <button onClick={() => setStatusMessage(null)} className="opacity-50 hover:opacity-100 transition-opacity">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Banner de urgência / boas-vindas */}
      {hasActivePlan && daysUntilExpiry !== null && daysUntilExpiry <= 30 ? (
        <div style={{ background:'linear-gradient(135deg,rgba(239,68,68,.08),rgba(234,88,12,.06))', border:'1px solid rgba(239,68,68,.25)', borderRadius:18, padding:'1.25rem 1.5rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#ef4444,#ea580c)' }} />
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', boxShadow:'0 0 8px #ef4444', animation:'pulse 2s infinite', flexShrink:0 }} />
              <span style={{ color:'#f87171', fontWeight:700, fontSize:13 }}>⚠ Seu plano cancela em {daysUntilExpiry} dias — você cede espaço para concorrentes</span>
            </div>
            <button disabled={!!buyingId} onClick={() => handleCheckout('subscription', 'plan_pro')} style={{ height:38, padding:'0 20px', background:'linear-gradient(135deg,#ea580c,#ef4444)', border:'none', borderRadius:10, color:'white', fontWeight:700, fontSize:13, cursor:'pointer', boxShadow:'0 4px 16px rgba(239,68,68,.3)', whiteSpace:'nowrap' }}>
              {buyingId === 'plan_pro' ? '...' : '⬆ Upgrade agora'}
            </button>
          </div>
          <p style={{ color:'#9ca3af', fontSize:12, marginTop:4 }}>Após o vencimento: perda do badge, desconto e destaque nas buscas.</p>
        </div>
      ) : !hasActivePlan ? (
        <div style={{ background:'linear-gradient(135deg,rgba(16,185,129,.08),rgba(5,150,105,.06))', border:'1px solid rgba(16,185,129,.25)', borderRadius:18, padding:'1.25rem 1.5rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#10b981,#059669)' }} />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
            <div>
              <p style={{ color:'#34d399', fontWeight:700, fontSize:15, marginBottom:4 }}>🚀 Comece a receber mais clientes hoje mesmo</p>
              <p style={{ color:'#6b7280', fontSize:12 }}>Profissionais com plano aparecem 2× mais e pagam até 55% menos por moeda.</p>
            </div>
            <button onClick={scrollToPlans} style={{ height:38, padding:'0 20px', background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:10, color:'white', fontWeight:700, fontSize:13, cursor:'pointer', boxShadow:'0 4px 16px rgba(16,185,129,.3)', whiteSpace:'nowrap' }}>
              Ver planos e assinar →
            </button>
          </div>
        </div>
      ) : null}

      {/* KPI Row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {/* Moedas */}
        <div style={{ background:'#0e2038', border:'1px solid rgba(255,255,255,.06)', borderRadius:16, padding:16, position:'relative', overflow:'hidden', cursor:'pointer' }} onClick={() => navigate('/profissional/carteira')}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#f59e0b,#d97706)' }} />
          <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:8 }}>Moedas</p>
          <p style={{ fontFamily:"'DM Mono',monospace", fontSize:26, fontWeight:500, color:'#fbbf24', lineHeight:1, marginBottom:4 }}>{balanceNum}</p>
          <p style={{ fontSize:11, color:'#4A6580' }}>≈ R$ {(balanceNum * costPerCoin).toFixed(2)} em leads</p>
          <p style={{ fontSize:10, color:'#374151', fontStyle:'italic', marginTop:4 }}>clique para recarregar</p>
        </div>
        {/* Desconto */}
        <div style={{ background:'#0e2038', border:'1px solid rgba(255,255,255,.06)', borderRadius:16, padding:16, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#10b981,#059669)' }} />
          <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:8 }}>Desconto atual</p>
          <p style={{ fontFamily:"'DM Mono',monospace", fontSize:26, fontWeight:500, color: hasActivePlan ? '#34d399' : '#f87171', lineHeight:1, marginBottom:4 }}>{hasActivePlan ? `${planDiscount}%` : '0%'}</p>
          <p style={{ fontSize:11, color:'#4A6580' }}>{hasActivePlan ? `Plano ${PLAN_NAMES[currentSubscription!.package_id]}` : 'Sem plano ativo'}</p>
        </div>
        {/* Dias restantes */}
        <div style={{ background:'#0e2038', border:'1px solid rgba(255,255,255,.06)', borderRadius:16, padding:16, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background: daysUntilExpiry !== null && daysUntilExpiry <= 30 ? 'linear-gradient(90deg,#ef4444,#dc2626)' : 'linear-gradient(90deg,#378ADD,#1d6fa8)' }} />
          <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:8 }}>Dias restantes</p>
          <p style={{ fontFamily:"'DM Mono',monospace", fontSize:26, fontWeight:500, color: daysUntilExpiry !== null && daysUntilExpiry <= 30 ? '#f87171' : '#60a5fa', lineHeight:1, marginBottom:4 }}>{daysUntilExpiry ?? '—'}</p>
          <p style={{ fontSize:11, color:'#4A6580' }}>{subscriptionStatus?.current_period_end ? new Date(subscriptionStatus.current_period_end * 1000).toLocaleDateString('pt-BR') : 'Sem assinatura'}</p>
        </div>
        {/* Custo/moeda */}
        <div style={{ background:'#0e2038', border:'1px solid rgba(255,255,255,.06)', borderRadius:16, padding:16, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#378ADD,#1d6fa8)' }} />
          <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:8 }}>Custo/moeda</p>
          <p style={{ fontFamily:"'DM Mono',monospace", fontSize:22, fontWeight:500, color: hasActivePlan ? '#34d399' : '#f87171', lineHeight:1, marginBottom:4 }}>R${costPerCoin.toFixed(3)}</p>
          <p style={{ fontSize:11, color:'#4A6580' }}>{hasActivePlan ? 'com seu plano' : 'preço cheio'}</p>
          {!hasActivePlan && <p style={{ fontSize:10, color:'#374151', marginTop:4 }}>PRO = R$0,249/moeda</p>}
        </div>
      </div>

      {/* Pacotes de Créditos Avulsos */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 16V8"/><path d="M8 12h8"/></svg>
            </span>
            Pacotes de Créditos Avulsos
          </h2>
          <p className="text-xs uppercase tracking-wide text-slate-400">Recarregue sua carteira conforme a necessidade. Preço cheio, sem plano.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {CREDIT_PACKAGES.map((pkg) => {
            const totalCoins = pkg.coins + pkg.bonus;
            const costPerCoin = (pkg.priceNum / totalCoins).toFixed(3);
            const isPopular = 'popular' in pkg && pkg.popular;
            return (
              <div key={pkg.id} className={`bg-[#1C3454] border ${isPopular ? 'border-blue-500/50 shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]' : 'border-[#1C3050]'} rounded-xl p-3 relative flex flex-col`}>
                {isPopular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-semibold px-3 py-0.5 rounded-full whitespace-nowrap">
                    Recomendado
                  </span>
                )}

                <h3 className="text-white font-bold text-sm mb-0.5">{pkg.name}</h3>
                <p className="text-slate-400 text-xs mb-2">{pkg.description}</p>

                <div className="flex items-baseline gap-0.5 mb-2">
                  <span className="text-slate-400 text-xs">R$</span>
                  <span className="text-2xl font-bold text-white">{pkg.price}</span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-md text-xs font-semibold border border-yellow-500/20 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    {totalCoins} moedas
                  </span>
                  {pkg.bonus > 0 && (
                    <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md text-xs font-semibold border border-emerald-500/20">
                      +{pkg.bonus} bônus
                    </span>
                  )}
                </div>

                <div className="bg-[#0E1C32] border border-[#1C3050] rounded-lg p-2 mb-2 space-y-1">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Custo por moeda</p>
                  <p className="text-slate-400 text-xs">Sem plano: <span className="text-white font-semibold">R$ {costPerCoin}</span>/moeda</p>
                  <p className="text-blue-300 text-xs">Com Starter (25% off): <span className="font-semibold">R$ {(pkg.priceNum * 0.75 / totalCoins).toFixed(3)}</span>/moeda</p>
                  <p className="text-emerald-300 text-xs font-semibold">Com PRO (40% off): <span>R$ {(pkg.priceNum * 0.60 / totalCoins).toFixed(3)}</span>/moeda</p>
                  <p className="text-yellow-300 text-xs">Com Elite (55% off): <span className="font-semibold">R$ {(pkg.priceNum * 0.45 / totalCoins).toFixed(3)}</span>/moeda</p>
                </div>

                <ul className="space-y-1.5 mb-3 flex-1">
                  <li className="flex gap-1.5 text-xs text-slate-300 items-start">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" /> Acesso imediato aos clientes
                  </li>
                  <li className="flex gap-1.5 text-xs text-slate-300 items-start">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" /> Créditos que não expiram
                  </li>
                </ul>

                <button
                  disabled={!!buyingId}
                  onClick={() => handleCheckout('one_time', pkg.id)}
                  className={`w-full h-10 ${isPopular ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20' : 'bg-white/5 hover:bg-white/10'} text-white text-sm font-bold rounded-lg transition-all border border-[#243F6A] disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {buyingId === pkg.id ? (
                    <><Loader2 size={14} className="animate-spin" /><span>Processando...</span></>
                  ) : (
                    <><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg> Comprar</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA Assinatura */}
      <div className="bg-gradient-to-r from-purple-900/40 via-emerald-900/20 to-purple-900/40 border border-emerald-500/30 rounded-xl p-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -mr-24 -mt-24" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-3">
          <div>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-md border border-emerald-500/20 mb-2 inline-block">
              Economia Inteligente
            </span>
            <h3 className="text-white font-bold text-sm mb-1">Assinar é muito mais barato do que moedas avulsas!</h3>
            <p className="text-slate-400 text-xs">
              Com plano PRO, cada compra de moedas custa <span className="text-emerald-400 font-semibold">40% menos</span>. O plano se paga sozinho na primeira recarga.
            </p>
          </div>
          <button
            onClick={scrollToPlans}
            className="h-10 px-6 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-lg transition-all whitespace-nowrap"
          >
            Ver Planos Mensais
          </button>
        </div>
      </div>

      {/* Planos de Assinatura */}
      <div ref={plansRef} className="space-y-3 pt-3 border-t border-[#1C3050]">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            </span>
            Planos de Pagamento Recorrente
          </h2>
          <p className="text-xs uppercase tracking-wide text-slate-400">Desconto automático em todas as compras de moedas enquanto o plano estiver ativo.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const borderClass = plan.popular
              ? 'border-emerald-500/50 border-2'
              : plan.color === 'blue'
              ? 'border-blue-500/30'
              : 'border-yellow-500/30';
            const btnClass = plan.popular
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/30'
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
              <div key={plan.id} className={`bg-[#1C3454] border ${borderClass} rounded-xl p-3 relative flex flex-col`}>
                {plan.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-black px-3 py-0.5 rounded-full text-xs font-bold whitespace-nowrap">
                    ⚡ Mais Popular
                  </div>
                )}

                <div className="mb-2">
                  <div className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-md mb-1.5 ${
                    plan.popular ? 'bg-emerald-500/20 text-emerald-400' : plan.color === 'blue' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {plan.discount} OFF
                  </div>
                  <h3 className="text-white font-bold text-sm mb-0.5">{plan.name}</h3>
                  <p className="text-slate-400 text-xs mb-2">{plan.description}</p>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-slate-400 text-xs">R$</span>
                    <span className="text-2xl font-bold text-white">{plan.price}</span>
                    <span className="text-slate-500 text-xs ml-0.5">/mês</span>
                  </div>
                  <p className={`text-xs mt-0.5 ${discountColor}`}>{plan.discount} desconto em todas as moedas</p>
                  <div className="mt-2 mb-2">
                    <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-md text-xs font-semibold">
                      🎁 {plan.welcomeCoins} moedas de boas-vindas
                    </span>
                  </div>
                </div>

                <button
                  disabled={!!buyingId}
                  onClick={() => handleCheckout('subscription', plan.id)}
                  className={`w-full h-10 ${btnClass} text-sm font-bold rounded-lg transition-all disabled:opacity-50 mb-2 flex items-center justify-center gap-2`}
                >
                  {buyingId === plan.id ? (
                    <><Loader2 size={14} className="animate-spin" /><span>Processando...</span></>
                  ) : plan.popular ? (
                    'Quero receber clientes agora →'
                  ) : plan.color === 'blue' ? (
                    'Quero começar agora →'
                  ) : (
                    'Quero dominar minha região →'
                  )}
                </button>

                <ul className="space-y-1.5 flex-1 mb-2">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex gap-1.5 text-xs text-slate-300 items-start">
                      <CheckCircle2 size={13} className={`shrink-0 mt-0.5 ${discountColor}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className={`border rounded-lg p-2 ${savingsClass}`}>
                  <p className="text-xs text-center">{plan.savings}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ROI box */}
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-3 text-center">
        <p className="text-white font-bold text-sm mb-1">
          💡 1 cliente de R$ 500 já paga o plano PRO por <span className="text-emerald-400">7 meses</span>
        </p>
        <p className="text-slate-500 text-xs">E com 40% de desconto em moedas, você acessa muito mais pelo mesmo preço.</p>
      </div>

      {/* Footer Stripe */}
      <div className="flex justify-center pb-2">
        <p className="text-slate-500 text-xs flex gap-2 items-center">
          <span className="font-bold opacity-80">stripe</span>
          <span className="w-px h-3 bg-slate-700" />
          <span>Pagamento seguro via Stripe. Não armazenamos dados de cartão.</span>
        </p>
      </div>

      {/* Grid Plano Atual + Saldo */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, paddingTop:'1.5rem', borderTop:'1px solid rgba(255,255,255,.06)' }}>

        {/* Card Plano Atual */}
        <div style={{ background:'linear-gradient(145deg,#071e30,#0e2038)', border:`1px solid ${hasActivePlan ? 'rgba(16,185,129,.22)' : 'rgba(55,138,221,.22)'}`, borderRadius:18, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background: hasActivePlan ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#378ADD,#1d6fa8)', borderRadius:'18px 18px 0 0' }} />
          <div style={{ position:'relative', padding:'1.25rem 1.5rem', borderBottom:'1px solid rgba(255,255,255,.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:4 }}>Plano Atual</p>
              <p style={{ fontSize:18, fontWeight:900, color:'white' }}>
                {currentSubscription ? `Plano ${PLAN_NAMES[currentSubscription.package_id] ?? currentSubscription.package_id}` : 'Sem plano ativo'}
              </p>
            </div>
            {currentSubscription && (
              <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, border:`1px solid`, ...(STATUS_LABELS[currentSubscription.status] ? {
                background: currentSubscription.status === 'active' ? 'rgba(16,185,129,.12)' : currentSubscription.status === 'canceling' ? 'rgba(249,115,22,.12)' : 'rgba(239,68,68,.12)',
                color: currentSubscription.status === 'active' ? '#34d399' : currentSubscription.status === 'canceling' ? '#fb923c' : '#f87171',
                borderColor: currentSubscription.status === 'active' ? 'rgba(16,185,129,.3)' : currentSubscription.status === 'canceling' ? 'rgba(249,115,22,.3)' : 'rgba(239,68,68,.3)',
              } : {}) }}>
                {(STATUS_LABELS[currentSubscription.status] ?? { label: currentSubscription.status }).label}
              </span>
            )}
          </div>

          <div style={{ padding:'1.25rem 1.5rem', flex:1, display:'flex', flexDirection:'column', gap:12 }}>
            {isSubscriptionLoading ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem 0' }}>
                <Loader2 size={20} className="animate-spin text-emerald-500" />
              </div>
            ) : currentSubscription ? (
              <>
                {subscriptionStatus?.cancel_at_period_end && (
                  <div style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:8 }}>
                    <AlertCircle size={13} style={{ color:'#f87171', flexShrink:0 }} />
                    <p style={{ color:'#fca5a5', fontSize:12 }}>
                      Cancelamento agendado para <strong>{subscriptionStatus.current_period_end ? new Date(subscriptionStatus.current_period_end * 1000).toLocaleDateString('pt-BR') : '—'}</strong>
                    </p>
                  </div>
                )}
                {showExpiryWarning && !subscriptionStatus?.cancel_at_period_end && (
                  <div style={{ background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.2)', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'flex-start', gap:8 }}>
                    <AlertCircle size={13} style={{ color:'#fbbf24', flexShrink:0, marginTop:1 }} />
                    <p style={{ color:'#fde68a', fontSize:12 }}>
                      Seu plano expira em <strong>{daysUntilExpiry} dia{daysUntilExpiry !== 1 ? 's' : ''}</strong>. Renove para não perder o acesso.
                    </p>
                  </div>
                )}

                {/* Meta grid 2x2 */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { label:'Desconto moedas', value: PLAN_LEADS[currentSubscription.package_id] ?? '—', color:'#34d399' },
                    { label:'Valor mensal', value: `R$ ${PLAN_PRICES[currentSubscription.package_id] ?? '—'}`, color:'white' },
                    { label:'Data início', value: currentSubscription.started_at ? new Date(currentSubscription.started_at).toLocaleDateString('pt-BR') : '—', color:'white' },
                    { label: subscriptionStatus?.cancel_at_period_end ? 'Encerra em' : 'Próx. renovação', value: subscriptionStatus?.current_period_end ? new Date(subscriptionStatus.current_period_end * 1000).toLocaleDateString('pt-BR') : '—', color: subscriptionStatus?.cancel_at_period_end ? '#fb923c' : 'white' },
                  ].map((item, i) => (
                    <div key={i} style={{ background:'rgba(0,0,0,.25)', border:'1px solid rgba(255,255,255,.06)', borderRadius:10, padding:'10px 12px' }}>
                      <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#4A6580', marginBottom:4 }}>{item.label}</p>
                      <p style={{ fontFamily:"'DM Mono',monospace", fontSize:16, fontWeight:500, color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                {subscriptionStatus?.current_period_end && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#4A6580', marginBottom:6 }}>
                      <span>Ciclo atual</span>
                      <span style={{ color: daysUntilExpiry !== null && daysUntilExpiry <= 7 ? '#f87171' : '#4A6580' }}>
                        {daysUntilExpiry !== null && daysUntilExpiry >= 0 ? `${daysUntilExpiry} dia${daysUntilExpiry !== 1 ? 's' : ''} restante${daysUntilExpiry !== 1 ? 's' : ''}` : 'Expirado'}
                      </span>
                    </div>
                    <div style={{ height:5, background:'rgba(255,255,255,.06)', borderRadius:5, overflow:'hidden' }}>
                      <div style={{ height:'100%', background:'linear-gradient(90deg,#10b981,#059669)', borderRadius:5, width:`${cycleProgress}%`, transition:'width .5s' }} />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem 0', textAlign:'center', gap:8 }}>
                <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>📋</div>
                <p style={{ color:'white', fontWeight:700, fontSize:16 }}>Você não tem plano ativo</p>
                <p style={{ color:'#4A6580', fontSize:12, lineHeight:1.5 }}>Sem plano você paga preço cheio e aparece menos nas buscas.</p>
              </div>
            )}
          </div>

          <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid rgba(255,255,255,.06)', display:'flex', flexDirection:'column', gap:8 }}>
            <button onClick={() => setShowChangePlanModal(true)} style={{ width:'100%', height:42, background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:12, color:'white', fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'0 4px 16px rgba(16,185,129,.25)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {hasActivePlan ? 'Mudar de Plano →' : '⚡ Assinar PRO — R$67/mês'}
            </button>
            {currentSubscription && !subscriptionStatus?.cancel_at_period_end && (
              cancelConfirm ? (
                <div style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)', borderRadius:10, padding:'10px 12px' }}>
                  <p style={{ color:'#fca5a5', fontSize:12, textAlign:'center', marginBottom:8 }}>Confirmar cancelamento?</p>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => setCancelConfirm(false)} style={{ flex:1, height:34, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#94a3b8', fontSize:12, fontWeight:600, cursor:'pointer' }}>Não</button>
                    <button onClick={handleCancelSubscription} disabled={cancelLoading} style={{ flex:1, height:34, background:'#dc2626', border:'none', borderRadius:8, color:'white', fontSize:12, fontWeight:600, cursor:'pointer', opacity: cancelLoading ? .5 : 1, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                      {cancelLoading ? <Loader2 size={13} className="animate-spin" /> : 'Sim, cancelar'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setCancelConfirm(true)} style={{ width:'100%', height:32, background:'transparent', border:'1px solid rgba(239,68,68,.2)', borderRadius:8, color:'#f87171', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  Cancelar Assinatura
                </button>
              )
            )}
          </div>
        </div>

        {/* Card Saldo de Moedas */}
        <div style={{ background:'linear-gradient(145deg,#0a1928,#0e2038,#110d2a)', border:'1px solid rgba(250,177,68,.2)', borderRadius:18, overflow:'hidden', display:'flex', flexDirection:'column', position:'relative' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#f59e0b,#d97706)', borderRadius:'18px 18px 0 0' }} />
          <div style={{ position:'absolute', top:-40, left:-40, width:160, height:160, background:'radial-gradient(circle,rgba(250,177,68,.08),transparent 70%)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:-40, right:-40, width:160, height:160, background:'radial-gradient(circle,rgba(16,185,129,.06),transparent 70%)', pointerEvents:'none' }} />

          <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid rgba(255,255,255,.06)', position:'relative' }}>
            <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:4 }}>Saldo de Moedas</p>
            <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
              <p style={{ fontFamily:"'DM Mono',monospace", fontSize:48, fontWeight:900, lineHeight:1, letterSpacing:'-2px', background:'linear-gradient(135deg,#fbbf24,#f59e0b,#d97706)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                {balanceLoading ? '...' : balanceNum}
              </p>
              <span style={{ fontSize:14, color:'#f59e0b', fontWeight:700 }}>moedas</span>
            </div>
            <p style={{ fontSize:12, color:'#4A6580', marginTop:4 }}>≈ R$ {(balanceNum * costPerCoin).toFixed(2)} em leads com seu plano atual</p>
          </div>

          {/* Comparação de custos */}
          <div style={{ padding:'1rem 1.5rem', flex:1, display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ background:'rgba(0,0,0,.3)', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:'12px 14px' }}>
              <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:8 }}>Custo por moeda nas suas {balanceNum} moedas</p>
              {[
                { label: hasActivePlan ? `${PLAN_NAMES[currentSubscription!.package_id]} (você)` : 'Sem plano (você)', cost: costPerCoin, color: hasActivePlan ? '#34d399' : '#f87171', tag: 'você' },
                { label: 'Com PRO — 40% off', cost: 0.249, color: '#6ee7b7', tag: null },
              ].map((item, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom: i === 0 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:12, color:'#94a3b8' }}>{item.label}</span>
                    {item.tag && <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:20, background:'rgba(16,185,129,.12)', color:'#34d399', border:'1px solid rgba(16,185,129,.2)' }}>você</span>}
                  </div>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:500, color: item.color }}>R${item.cost.toFixed(3)}/moeda</span>
                </div>
              ))}
              {!hasActivePlan && balanceNum > 0 && (
                <div style={{ marginTop:8, padding:'6px 8px', background:'rgba(251,191,36,.08)', borderRadius:8, border:'1px solid rgba(251,191,36,.15)' }}>
                  <p style={{ fontSize:11, color:'#fbbf24' }}>💡 Com PRO você economizaria R$ {((0.415 - 0.249) * balanceNum).toFixed(2)} nas suas moedas atuais</p>
                </div>
              )}
            </div>

            {/* Últimas transações */}
            <div style={{ background:'rgba(0,0,0,.2)', border:'1px solid rgba(255,255,255,.05)', borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,.05)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <p style={{ fontSize:12, fontWeight:700, color:'white' }}>Últimas Transações</p>
                <a href="/profissional/carteira" style={{ fontSize:11, color:'#4A6580', textDecoration:'none' }}>Ver tudo →</a>
              </div>
              {isTransactionsLoading ? (
                <div style={{ display:'flex', justifyContent:'center', padding:'1rem' }}>
                  <Loader2 size={18} className="animate-spin text-emerald-500" />
                </div>
              ) : recentTransactions && recentTransactions.length > 0 ? (
                <ul style={{ listStyle:'none' }}>
                  {recentTransactions.map((tx) => (
                    <li key={tx.id} style={{ padding:'8px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, borderBottom:'1px solid rgba(255,255,255,.03)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                        <div style={{ width:26, height:26, borderRadius:'50%', background: tx.type === 'deposit' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {tx.type === 'deposit' ? <ArrowUpRight size={13} style={{ color:'#34d399' }} /> : <ArrowDownRight size={13} style={{ color:'#f87171' }} />}
                        </div>
                        <div style={{ minWidth:0 }}>
                          <p style={{ fontSize:12, color:'#e2e8f0', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tx.description}</p>
                          <p style={{ fontSize:11, color:'#4A6580' }}>{new Date(tx.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:500, color: tx.type === 'deposit' ? '#34d399' : '#94a3b8', flexShrink:0 }}>
                        {tx.type === 'deposit' ? '+' : '-'}{Math.abs(tx.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ textAlign:'center', color:'#4A6580', fontSize:12, padding:'1rem' }}>Nenhuma transação encontrada.</p>
              )}
            </div>
          </div>

          <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid rgba(255,255,255,.06)' }}>
            <button onClick={() => navigate('/profissional/carteira')} style={{ width:'100%', height:42, background:'linear-gradient(135deg,rgba(250,177,68,.15),rgba(217,119,6,.1))', border:'1px solid rgba(250,177,68,.25)', borderRadius:12, color:'#fbbf24', fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              🪙 Comprar Moedas Agora
            </button>
            <a href="/profissional/carteira" style={{ display:'block', textAlign:'center', marginTop:8, fontSize:12, color:'#4A6580', textDecoration:'none' }}>Ver histórico completo →</a>
          </div>
        </div>

      </div>

      {/* Modal Mudar de Plano */}
      {showChangePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1C3454] border border-[#243F6A] rounded-xl p-4 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-bold text-lg">Mudar de Plano</h2>
              <button onClick={() => setShowChangePlanModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
              <AlertCircle size={13} className="text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-yellow-300 text-xs">Ao mudar de plano, o plano atual será cancelado automaticamente.</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div key={plan.id} className={`bg-[#0E1C32] border ${plan.popular ? 'border-emerald-500/40' : plan.color === 'blue' ? 'border-blue-500/20' : 'border-yellow-500/20'} rounded-xl p-3 flex flex-col`}>
                  <div className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-md mb-1.5 ${
                    plan.popular ? 'bg-emerald-500/20 text-emerald-400' : plan.color === 'blue' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {plan.discount} OFF
                  </div>
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
                    className={`w-full h-10 ${
                      plan.popular ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : plan.color === 'blue' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-yellow-500 hover:bg-yellow-400 text-black'
                    } text-sm font-bold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                  >
                    {buyingId === plan.id ? <Loader2 size={14} className="animate-spin" /> : 'Assinar'}
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
