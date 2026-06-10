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
import { useIsMobile } from '../../hooks/useIsMobile';

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
  const isMobile = useIsMobile();
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
    <>
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
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:12 }}>
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
      <div style={{ marginTop:'1.5rem' }}>
        <div style={{ marginBottom:'1rem' }}>
          <h2 style={{ fontSize:18, fontWeight:900, color:'white', display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            🪙 Pacotes de Créditos Avulsos
          </h2>
          <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580' }}>
            Recarregue sua carteira conforme a necessidade. {hasActivePlan ? `Com seu plano, você paga ${planDiscount}% menos.` : 'Preço cheio, sem plano.'}
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap:12 }}>
          {CREDIT_PACKAGES.map((pkg) => {
            const totalCoins = pkg.coins + pkg.bonus;
            const costPerCoinPkg = (pkg.priceNum / totalCoins).toFixed(3);
            const isPopular = 'popular' in pkg && pkg.popular;
            const discountMultiplier = hasActivePlan ? (1 - planDiscount / 100) : 1;
            const yourPrice = (pkg.priceNum * discountMultiplier).toFixed(2);
            const borderColor = isPopular ? 'rgba(16,185,129,.35)' : 'rgba(55,138,221,.18)';
            const topColor = isPopular ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#378ADD,#1d6fa8)';
            return (
              <div key={pkg.id} style={{ background:'linear-gradient(145deg,#0a1928,#0d1e35)', border:`1px solid ${borderColor}`, borderRadius:18, overflow:'hidden', display:'flex', flexDirection:'column', position:'relative', transition:'transform .25s' }}
                onMouseEnter={e => (e.currentTarget.style.transform='translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform='translateY(0)')}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:topColor }} />
                {isPopular && (
                  <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,#10b981,#059669)', color:'white', fontSize:10, fontWeight:700, padding:'3px 12px', borderRadius:20, whiteSpace:'nowrap' }}>
                    ★ Melhor Custo-Benefício
                  </div>
                )}
                <div style={{ padding:'1.25rem 1.25rem .75rem', paddingTop: isPopular ? '1.75rem' : '1.25rem' }}>
                  <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:6 }}>{pkg.name}</p>
                  <p style={{ fontSize:11, color:'#4A6580', marginBottom:10 }}>{pkg.description}</p>
                  <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:8 }}>
                    <span style={{ fontSize:12, color:'#94a3b8' }}>R$</span>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:28, fontWeight:900, color:'white', lineHeight:1 }}>{pkg.price}</span>
                    {hasActivePlan && <span style={{ fontSize:11, color:'#34d399', fontWeight:700 }}>→ R${yourPrice} c/ plano</span>}
                  </div>
                  <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                    <span style={{ background:'rgba(250,177,68,.12)', color:'#fbbf24', border:'1px solid rgba(250,177,68,.2)', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>⭐ {totalCoins} moedas</span>
                    {pkg.bonus > 0 && <span style={{ background:'rgba(16,185,129,.1)', color:'#34d399', border:'1px solid rgba(16,185,129,.2)', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>+{pkg.bonus} bônus</span>}
                  </div>
                  <div style={{ background:'rgba(0,0,0,.3)', border:'1px solid rgba(255,255,255,.05)', borderRadius:10, padding:'10px 12px', marginBottom:12 }}>
                    <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#4A6580', marginBottom:6 }}>Custo por moeda</p>
                    {[
                      { label:'Sem plano', cost: (pkg.priceNum / totalCoins), color: hasActivePlan ? '#4A6580' : '#f87171', tag: !hasActivePlan ? 'você' : null },
                      { label:'Starter (25% off)', cost: (pkg.priceNum * 0.75 / totalCoins), color:'#60a5fa', tag: hasActivePlan && planDiscount === 25 ? 'você' : null },
                      { label:'PRO (40% off)', cost: (pkg.priceNum * 0.60 / totalCoins), color:'#34d399', tag: hasActivePlan && planDiscount === 40 ? 'você' : null },
                      { label:'Elite (55% off)', cost: (pkg.priceNum * 0.45 / totalCoins), color:'#fbbf24', tag: hasActivePlan && planDiscount === 55 ? 'você' : null },
                    ].map((row, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'3px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,.03)' : 'none' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <span style={{ fontSize:11, color: row.tag ? 'white' : '#4A6580' }}>{row.label}</span>
                          {row.tag && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:20, background:'rgba(16,185,129,.12)', color:'#34d399', border:'1px solid rgba(16,185,129,.2)' }}>você</span>}
                        </div>
                        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color: row.color }}>R${row.cost.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding:'0 1.25rem 1.25rem', marginTop:'auto' }}>
                  <button
                    disabled={!!buyingId}
                    onClick={() => handleCheckout('one_time', pkg.id)}
                    style={{ width:'100%', height:40, background: isPopular ? 'linear-gradient(135deg,#10b981,#059669)' : 'rgba(255,255,255,.05)', border: isPopular ? 'none' : '1px solid rgba(255,255,255,.1)', borderRadius:12, color:'white', fontWeight:700, fontSize:13, cursor:'pointer', boxShadow: isPopular ? '0 4px 16px rgba(16,185,129,.25)' : 'none', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity: buyingId ? .5 : 1 }}
                  >
                    {buyingId === pkg.id ? <Loader2 size={14} className="animate-spin" /> : `🪙 Comprar`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA Assinatura */}
      <div style={{ background:'linear-gradient(135deg,rgba(16,185,129,.08),rgba(5,150,105,.05))', border:'1px solid rgba(16,185,129,.2)', borderRadius:18, padding:'1.25rem 1.5rem', position:'relative', overflow:'hidden', marginTop:'1.5rem' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#10b981,#059669)' }} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
          <div>
            <span style={{ background:'rgba(16,185,129,.12)', color:'#34d399', border:'1px solid rgba(16,185,129,.2)', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, display:'inline-block', marginBottom:6 }}>Economia Inteligente</span>
            <p style={{ fontSize:15, fontWeight:900, color:'white', marginBottom:4 }}>Assinar é muito mais barato do que moedas avulsas!</p>
            <p style={{ fontSize:12, color:'#6b7280' }}>Com plano PRO, cada compra de moedas custa <span style={{ color:'#34d399', fontWeight:700 }}>40% menos</span>. O plano se paga na primeira recarga.</p>
          </div>
          <button onClick={scrollToPlans} style={{ height:40, padding:'0 20px', background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:12, color:'white', fontWeight:700, fontSize:13, cursor:'pointer', boxShadow:'0 4px 16px rgba(16,185,129,.25)', whiteSpace:'nowrap' }}>
            Ver Planos Mensais →
          </button>
        </div>
      </div>

      {/* Planos de Assinatura */}
      <div ref={plansRef} style={{ marginTop:'2rem' }}>
        <div style={{ marginBottom:'1rem' }}>
          <h2 style={{ fontSize:18, fontWeight:900, color:'white', display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            ✨ Planos de Pagamento Recorrente
          </h2>
          <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580' }}>
            Desconto automático em todas as compras de moedas enquanto o plano estiver ativo.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap:12, alignItems:'start' }}>
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isPopular = plan.popular;
            const borderColor = isPopular ? 'rgba(16,185,129,.35)' : plan.color === 'blue' ? 'rgba(55,138,221,.18)' : 'rgba(250,177,68,.2)';
            const topGradient = isPopular ? 'linear-gradient(90deg,#10b981,#059669)' : plan.color === 'blue' ? 'linear-gradient(90deg,#378ADD,#1d6fa8)' : 'linear-gradient(90deg,#f59e0b,#d97706)';
            const btnBg = isPopular ? 'linear-gradient(135deg,#10b981,#059669)' : plan.color === 'blue' ? 'linear-gradient(135deg,#378ADD,#1d6fa8)' : 'linear-gradient(135deg,#f59e0b,#d97706)';
            const btnShadow = isPopular ? '0 4px 20px rgba(16,185,129,.3)' : plan.color === 'blue' ? '0 4px 20px rgba(55,138,221,.2)' : '0 4px 20px rgba(245,158,11,.2)';
            const accentColor = isPopular ? '#34d399' : plan.color === 'blue' ? '#60a5fa' : '#fbbf24';
            const bgGradient = isPopular ? 'linear-gradient(145deg,#071e30,#0a2a1a)' : plan.color === 'blue' ? 'linear-gradient(145deg,#071e30,#0a1e35)' : 'linear-gradient(145deg,#1a1200,#0e2038)';
            const glowColor = isPopular ? 'rgba(16,185,129,.06)' : plan.color === 'blue' ? 'rgba(55,138,221,.06)' : 'rgba(245,158,11,.06)';
            const pack200cost = plan.id === 'plan_basic' ? '44,93' : plan.id === 'plan_pro' ? '35,94' : '26,96';
            return (
              <div key={plan.id} style={{ background:bgGradient, border:`1px solid ${borderColor}`, borderRadius:18, overflow:'hidden', display:'flex', flexDirection:'column', position:'relative', transition:'transform .25s', marginTop: isMobile ? 0 : isPopular ? 0 : 16 }}
                onMouseEnter={e => (e.currentTarget.style.transform='translateY(-3px)')}
                onMouseLeave={e => (e.currentTarget.style.transform='translateY(0)')}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:topGradient }} />
                <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, background:`radial-gradient(circle,${glowColor},transparent 70%)`, pointerEvents:'none' }} />
                {isPopular && (
                  <div style={{ position:'absolute', top:-1, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,#10b981,#059669)', color:'white', fontSize:10, fontWeight:700, padding:'3px 14px', borderRadius:'0 0 10px 10px', whiteSpace:'nowrap', zIndex:1 }}>
                    🔥 Mais Popular — Melhor ROI
                  </div>
                )}
                <div style={{ padding:'1.5rem', paddingTop: isPopular ? '2rem' : '1.5rem' }}>
                  <div style={{ display:'inline-block', background:`rgba(${isPopular ? '16,185,129' : plan.color === 'blue' ? '55,138,221' : '245,158,11'},.12)`, color:accentColor, border:`1px solid ${borderColor}`, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700, marginBottom:8 }}>
                    {plan.discount} OFF
                  </div>
                  <p style={{ fontSize:20, fontWeight:900, color:'white', marginBottom:2 }}>{plan.name}</p>
                  <p style={{ fontSize:11, color:'#4A6580', marginBottom:12 }}>{plan.description}</p>
                  <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:4 }}>
                    <span style={{ fontSize:13, color:'#94a3b8' }}>R$</span>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:36, fontWeight:900, color:'white', lineHeight:1 }}>{plan.price}</span>
                    <span style={{ fontSize:12, color:'#4A6580' }}>/mês</span>
                  </div>
                  <p style={{ fontSize:12, color:accentColor, marginBottom:4 }}>= R$ {(parseFloat(plan.price) / 30).toFixed(2)}/dia</p>
                  <div style={{ marginBottom:14 }}>
                    <span style={{ background:'rgba(250,177,68,.1)', color:'#fbbf24', border:'1px solid rgba(250,177,68,.2)', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                      🎁 {plan.welcomeCoins} moedas de boas-vindas
                    </span>
                  </div>
                  <button
                    disabled={!!buyingId}
                    onClick={() => handleCheckout('subscription', plan.id)}
                    style={{ width:'100%', height:44, background:btnBg, border:'none', borderRadius:12, color: plan.color === 'yellow' ? '#000' : 'white', fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:btnShadow, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity: buyingId ? .5 : 1 }}
                  >
                    {buyingId === plan.id ? <Loader2 size={14} className="animate-spin" /> :
                      isPopular ? 'Quero receber clientes agora →' :
                      plan.color === 'blue' ? 'Quero começar agora →' :
                      'Quero dominar minha região →'}
                  </button>
                  <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                    {plan.features.map((feature, idx) => (
                      <li key={idx} style={{ display:'flex', alignItems:'flex-start', gap:6, fontSize:12, color:'#94a3b8' }}>
                        <span style={{ color:accentColor, flexShrink:0, marginTop:1 }}>✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div style={{ background:'rgba(0,0,0,.3)', border:`1px solid ${borderColor}`, borderRadius:10, padding:'10px 12px' }}>
                    <p style={{ fontSize:11, color:'#4A6580', marginBottom:2 }}>Pac. 200 moedas com este plano:</p>
                    <p style={{ fontFamily:"'DM Mono',monospace", fontSize:14, fontWeight:700, color:accentColor }}>R$ {pack200cost} <span style={{ fontSize:10, color:'#4A6580', fontWeight:400 }}>vs. R$59,90 sem plano</span></p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ROI box */}
      <div style={{ background:'rgba(16,185,129,.05)', border:'1px solid rgba(16,185,129,.15)', borderRadius:14, padding:'1rem 1.5rem', textAlign:'center', marginTop:'1rem' }}>
        <p style={{ color:'white', fontWeight:700, fontSize:14, marginBottom:4 }}>
          💡 1 cliente de R$ 500 já paga o plano PRO por <span style={{ color:'#34d399' }}>7 meses</span>
        </p>
        <p style={{ color:'#4A6580', fontSize:12 }}>E com 40% de desconto em moedas, você acessa muito mais pelo mesmo preço.</p>
      </div>

      {/* Footer Stripe */}
      <div className="flex justify-center pb-2">
        <p className="text-slate-500 text-xs flex gap-2 items-center">
          <span className="font-bold opacity-80">stripe</span>
          <span className="w-px h-3 bg-slate-700" />
          <span>Pagamento seguro via Stripe. Não armazenamos dados de cartão.</span>
        </p>
      </div>

      {/* Tabela Comparativa */}
      <div style={{ background:'linear-gradient(145deg,#0a1928,#0d1e35)', border:'1px solid rgba(255,255,255,.06)', borderRadius:18, overflow:'hidden', marginTop:'1.5rem' }}>
        <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
          <p style={{ fontSize:16, fontWeight:900, color:'white', marginBottom:2 }}>📊 Comparativo de Planos</p>
          <p style={{ fontSize:11, color:'#4A6580' }}>Veja exatamente o que você ganha em cada plano</p>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'rgba(0,0,0,.25)' }}>
                <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#4A6580', textTransform:'uppercase', letterSpacing:'.06em' }}>Benefício</th>
                {[
                  { name:'Sem plano', color:'#f87171' },
                  { name:'Starter', color:'#60a5fa' },
                  { name:'PRO', color:'#34d399' },
                  { name:'Elite', color:'#fbbf24' },
                ].map((col, i) => (
                  <th key={i} style={{ padding:'10px 16px', textAlign:'center', fontSize:12, fontWeight:700, color: col.color, background: col.name === 'PRO' ? 'rgba(16,185,129,.03)' : 'transparent' }}>{col.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label:'Preço', vals:['Grátis','R$37/mês','R$67/mês','R$127/mês'] },
                { label:'Desconto moedas', vals:['0%','25%','40%','55%'] },
                { label:'Pac. 200 moedas', vals:['R$59,90','R$44,93','R$35,94','R$26,96'] },
                { label:'Visibilidade buscas', vals:['Padrão','Normal','2× mais','Topo absoluto'] },
                { label:'Moedas expiram', vals:['90 dias','90 dias','Nunca','Nunca'] },
                { label:'Badge no perfil', vals:['Nenhum','✅ Verificado','⚡ PRO','🏆 Elite'] },
                { label:'Moedas boas-vindas', vals:['—','30','80','200'] },
                { label:'Suporte', vals:['—','Chat','Prioritário 2h','Gerente dedicado'] },
              ].map((row, ri) => (
                <tr key={ri} style={{ borderBottom:'1px solid rgba(255,255,255,.03)', cursor:'default' }}
                  onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,.015)')}
                  onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                  <td style={{ padding:'10px 16px', fontSize:12, color:'#94a3b8', fontWeight:500 }}>{row.label}</td>
                  {row.vals.map((val, vi) => (
                    <td key={vi} style={{ padding:'10px 16px', textAlign:'center', fontSize:12, fontWeight:500, background: vi === 2 ? 'rgba(16,185,129,.03)' : 'transparent', color: vi === 0 ? '#4A6580' : vi === 1 ? '#60a5fa' : vi === 2 ? '#34d399' : '#fbbf24' }}>{val}</td>
                  ))}
                </tr>
              ))}
              <tr style={{ background:'rgba(16,185,129,.03)', borderTop:'1px solid rgba(16,185,129,.1)' }}>
                <td style={{ padding:'12px 16px', fontSize:12, color:'#4A6580' }}>Assinar</td>
                <td style={{ padding:'12px 16px', textAlign:'center' }}><span style={{ color:'#4A6580', fontSize:12 }}>—</span></td>
                {SUBSCRIPTION_PLANS.map((plan) => (
                  <td key={plan.id} style={{ padding:'12px 16px', textAlign:'center', background: plan.popular ? 'rgba(16,185,129,.03)' : 'transparent' }}>
                    <button disabled={!!buyingId} onClick={() => handleCheckout('subscription', plan.id)}
                      style={{ padding:'5px 12px', background: plan.popular ? 'linear-gradient(135deg,#10b981,#059669)' : plan.color === 'blue' ? 'linear-gradient(135deg,#378ADD,#1d6fa8)' : 'linear-gradient(135deg,#f59e0b,#d97706)', border:'none', borderRadius:20, color: plan.color === 'yellow' ? '#000' : 'white', fontSize:11, fontWeight:700, cursor:'pointer', opacity: buyingId ? .5 : 1 }}>
                      {plan.popular ? '⚡ PRO' : plan.color === 'blue' ? 'Starter' : '🏆 Elite'}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Depoimentos */}
      <div style={{ marginTop:'2rem' }}>
        <p style={{ fontSize:16, fontWeight:900, color:'white', marginBottom:4 }}>⭐ O que dizem os profissionais</p>
        <p style={{ fontSize:11, color:'#4A6580', marginBottom:'1rem' }}>Resultados reais de quem assinou</p>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap:12 }}>
          {[
            { name:'Carlos E.', city:'Jacobina - BA', role:'Eletricista', text:'"Assine o PRO e na primeira semana fechei 3 clientes. O plano se pagou em 2 dias."', result:'R$1.800 em 1 semana', stars:5 },
            { name:'Marcos S.', city:'Feira de Santana - BA', role:'Encanador', text:'"Antes pagava R$59 pelo pacote. Com PRO pago R$35. Economizei mais de R$280 em 4 meses."', result:'-R$280 em moedas', stars:5 },
            { name:'Ana P.', city:'Irecê - BA', role:'Pintora', text:'"Meu perfil aparece no topo agora. Recebi 2x mais pedidos no mês que assine."', result:'2× mais contatos', stars:5 },
          ].map((t, i) => (
            <div key={i} style={{ background:'linear-gradient(145deg,#0a1928,#0d1e35)', border:'1px solid rgba(255,255,255,.06)', borderRadius:18, padding:'1.25rem', display:'flex', flexDirection:'column', transition:'transform .25s' }}
              onMouseEnter={e => (e.currentTarget.style.transform='translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform='translateY(0)')}>
              <p style={{ color:'#f59e0b', letterSpacing:4, fontSize:12, marginBottom:10 }}>{'★'.repeat(t.stars)}</p>
              <p style={{ fontSize:13, color:'#cbd5e1', fontStyle:'italic', lineHeight:1.6, flex:1, marginBottom:12 }}>{t.text}</p>
              <p style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700, color:'#34d399', marginBottom:12 }}>{t.result}</p>
              <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:12, borderTop:'1px solid rgba(255,255,255,.05)' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(16,185,129,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#34d399', flexShrink:0 }}>
                  {t.name[0]}
                </div>
                <div>
                  <p style={{ fontSize:12, fontWeight:700, color:'#94a3b8' }}>{t.name} · <span style={{ fontWeight:400 }}>{t.role}</span></p>
                  <p style={{ fontSize:11, color:'#304F70' }}>{t.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Garantia */}
      <div style={{ background:'linear-gradient(135deg,rgba(250,177,68,.06),rgba(217,119,6,.04))', border:'1px solid rgba(250,177,68,.2)', borderRadius:18, padding:'1.25rem 1.5rem', marginTop:'1.5rem', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#f59e0b,#d97706)' }} />
        <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <span style={{ fontSize:32 }}>🛡️</span>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:15, fontWeight:900, color:'#fbbf24', marginBottom:4 }}>Garantia de 7 dias — dinheiro de volta</p>
            <p style={{ fontSize:12, color:'#4A6580' }}>Se não estiver satisfeito nos primeiros 7 dias, devolvemos 100% do valor sem perguntas. Sem risco.</p>
          </div>
          <button onClick={scrollToPlans} style={{ height:40, padding:'0 20px', background:'linear-gradient(135deg,#f59e0b,#d97706)', border:'none', borderRadius:12, color:'black', fontWeight:700, fontSize:13, cursor:'pointer', boxShadow:'0 4px 16px rgba(245,158,11,.25)', whiteSpace:'nowrap' }}>
            Assinar com garantia →
          </button>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ marginTop:'2rem' }}>
        <p style={{ fontSize:16, fontWeight:900, color:'white', marginBottom:'1rem' }}>❓ Perguntas Frequentes</p>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:10 }}>
          {[
            { q:'Quando sou cobrado?', a:'Na assinatura e todo mês na mesma data. Você pode cancelar a qualquer momento.' },
            { q:'Posso mudar de plano?', a:'Sim. Você pode fazer upgrade ou downgrade a qualquer momento pelo painel.' },
            { q:'As moedas expiram?', a:'No plano Starter expiram em 90 dias. No PRO e Elite as moedas nunca expiram.' },
            { q:'Posso cancelar quando quiser?', a:'Sim. Cancele pelo painel sem burocracia. O acesso continua até o fim do período pago.' },
            { q:'Tem taxa de adesão?', a:'Não. Pelo contrário — ao assinar você recebe moedas de boas-vindas grátis.' },
            { q:'Como fico mais visível?', a:'Com PRO você aparece 2× mais nas buscas. Com Elite você vai ao topo absoluto da sua região.' },
          ].map((item, i) => (
            <div key={i} style={{ background:'linear-gradient(145deg,#0a1928,#0d1e35)', border:'1px solid rgba(255,255,255,.05)', borderRadius:14, padding:'14px 16px' }}>
              <p style={{ fontSize:12, fontWeight:700, color:'#8aafcf', marginBottom:6 }}>{item.q}</p>
              <p style={{ fontSize:11, color:'#304F70', lineHeight:1.65 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trust Bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:28, paddingTop:'1.5rem', borderTop:'1px solid rgba(255,255,255,.04)', flexWrap:'wrap', marginTop:'1rem' }}>
        {[
          { icon:'🔒', text:'Stripe seguro' },
          { icon:'↩', text:'Cancele quando quiser' },
          { icon:'🛡️', text:'Garantia 7 dias' },
          { icon:'✅', text:'Sem taxa de adesão' },
          { icon:'∞', text:'Moedas sem prazo no PRO' },
        ].map((item, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#304F70' }}>
            <span style={{ fontSize:14 }}>{item.icon}</span>
            {item.text}
          </div>
        ))}
      </div>

      {/* Grid Plano Atual + Saldo */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16, paddingTop:'1.5rem', borderTop:'1px solid rgba(255,255,255,.06)' }}>

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

    {/* Sticky Bar */}
    <div style={{ position:'sticky', bottom:0, left:0, right:0, background:'rgba(7,15,28,.96)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderTop:'1px solid rgba(255,255,255,.06)', padding: isMobile ? '10px 1rem' : '10px 1.5rem', display:'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent:'space-between', gap: isMobile ? 8 : 12, zIndex:50, flexWrap:'wrap' }}>
      <div style={{ fontSize: isMobile ? 13 : 12, color:'#4A6580' }}>
        <span style={{ color:'white', fontWeight:700 }}>{balanceNum} moedas</span>
        {' · '}
        <span>{hasActivePlan ? `Plano ${PLAN_NAMES[currentSubscription!.package_id]} · ${daysUntilExpiry ?? '—'} dias restantes` : 'Sem plano ativo · preço cheio'}</span>
      </div>
      <div style={{ display:'flex', gap:8, flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : undefined }}>
        <button onClick={() => handleCheckout('one_time', 'pack_pro')} style={{ height:36, padding:'0 16px', background:'transparent', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'white', fontSize:12, fontWeight:600, cursor:'pointer', width: isMobile ? '100%' : undefined, justifyContent: isMobile ? 'center' : undefined, display: isMobile ? 'flex' : undefined, alignItems: isMobile ? 'center' : undefined }}>
          🪙 Comprar moedas
        </button>
        {hasActivePlan ? (
          <button onClick={() => setShowChangePlanModal(true)} style={{ height:36, padding:'0 16px', background:'transparent', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'white', fontSize:12, fontWeight:600, cursor:'pointer', width: isMobile ? '100%' : undefined, justifyContent: isMobile ? 'center' : undefined, display: isMobile ? 'flex' : undefined, alignItems: isMobile ? 'center' : undefined }}>
            ↺ Mudar plano
          </button>
        ) : null}
        <button onClick={() => handleCheckout('subscription', 'plan_pro')} disabled={!!buyingId} style={{ height:36, padding:'0 16px', background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:10, color:'white', fontSize:12, fontWeight:700, cursor:'pointer', boxShadow:'0 2px 12px rgba(16,185,129,.25)', opacity: buyingId ? .5 : 1, width: isMobile ? '100%' : undefined, justifyContent: isMobile ? 'center' : undefined, display: isMobile ? 'flex' : undefined, alignItems: isMobile ? 'center' : undefined }}>
          {buyingId === 'plan_pro' ? '...' : '⚡ Upgrade PRO →'}
        </button>
      </div>
    </div>
    </>
  );
}
