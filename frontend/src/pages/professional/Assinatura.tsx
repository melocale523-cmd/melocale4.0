import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { walletService, subscriptionService, transactionService } from '../../services/dbServices';
import { useAuthStore } from '../../store/authStore';
import { initiateCheckout } from '../../lib/stripe';
import { apiFetch } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '../../hooks/useIsMobile';
import { PLAN_NAMES, PLAN_LEADS } from './assinatura/constants';
import CoinPackageSection from './assinatura/CoinPackageSection';
import SubscriptionPlansSection from './assinatura/SubscriptionPlansSection';
import PlanComparisonTable from './assinatura/PlanComparisonTable';
import ChangePlanModal from './assinatura/ChangePlanModal';
import CurrentPlanCard from './assinatura/CurrentPlanCard';
import CoinBalanceCard from './assinatura/CoinBalanceCard';
import MarketingContent from './assinatura/MarketingContent';

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
    queryFn: walletService.getBalance,
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
        <div style={{ background: 'linear-gradient(135deg,rgba(239,68,68,.08),rgba(234,88,12,.06))', border: '1px solid rgba(239,68,68,.25)', borderRadius: 18, padding: '1.25rem 1.5rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#ef4444,#ea580c)' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'pulse 2s infinite', flexShrink: 0 }} />
              <span style={{ color: '#f87171', fontWeight: 700, fontSize: 13 }}>⚠ Seu plano cancela em {daysUntilExpiry} dias — você cede espaço para concorrentes</span>
            </div>
            <button disabled={!!buyingId} onClick={() => handleCheckout('subscription', 'plan_pro')} style={{ height: 38, padding: '0 20px', background: 'linear-gradient(135deg,#ea580c,#ef4444)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 16px rgba(239,68,68,.3)', whiteSpace: 'nowrap' }}>
              {buyingId === 'plan_pro' ? '...' : '⬆ Upgrade agora'}
            </button>
          </div>
          <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>Após o vencimento: perda do badge, desconto e destaque nas buscas.</p>
        </div>
      ) : !hasActivePlan ? (
        <div style={{ background: 'linear-gradient(135deg,rgba(16,185,129,.08),rgba(5,150,105,.06))', border: '1px solid rgba(16,185,129,.25)', borderRadius: 18, padding: '1.25rem 1.5rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#10b981,#059669)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: '#34d399', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🚀 Comece a receber mais clientes hoje mesmo</p>
              <p style={{ color: '#6b7280', fontSize: 12 }}>Profissionais com plano aparecem 2× mais e pagam até 55% menos por moeda.</p>
            </div>
            <button onClick={scrollToPlans} style={{ height: 38, padding: '0 20px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,.3)', whiteSpace: 'nowrap' }}>
              Ver planos e assinar →
            </button>
          </div>
        </div>
      ) : null}

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginTop: '1.5rem' }}>
        <div style={{ background: '#0e2038', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 16, position: 'relative', overflow: 'hidden', cursor: 'pointer' }} onClick={() => navigate('/profissional/carteira')}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#f59e0b,#d97706)' }} />
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4A6580', marginBottom: 8 }}>Moedas</p>
          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 26, fontWeight: 500, color: '#fbbf24', lineHeight: 1, marginBottom: 4 }}>{balanceNum}</p>
          <p style={{ fontSize: 11, color: '#4A6580' }}>≈ R$ {(balanceNum * costPerCoin).toFixed(2)} em leads</p>
          <p style={{ fontSize: 10, color: '#374151', fontStyle: 'italic', marginTop: 4 }}>clique para recarregar</p>
        </div>
        <div style={{ background: '#0e2038', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#10b981,#059669)' }} />
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4A6580', marginBottom: 8 }}>Desconto atual</p>
          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 26, fontWeight: 500, color: hasActivePlan ? '#34d399' : '#f87171', lineHeight: 1, marginBottom: 4 }}>{hasActivePlan ? `${planDiscount}%` : '0%'}</p>
          <p style={{ fontSize: 11, color: '#4A6580' }}>{hasActivePlan ? `Plano ${PLAN_NAMES[currentSubscription!.package_id]}` : 'Sem plano ativo'}</p>
        </div>
        <div style={{ background: '#0e2038', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: daysUntilExpiry !== null && daysUntilExpiry <= 30 ? 'linear-gradient(90deg,#ef4444,#dc2626)' : 'linear-gradient(90deg,#378ADD,#1d6fa8)' }} />
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4A6580', marginBottom: 8 }}>Dias restantes</p>
          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 26, fontWeight: 500, color: daysUntilExpiry !== null && daysUntilExpiry <= 30 ? '#f87171' : '#60a5fa', lineHeight: 1, marginBottom: 4 }}>{daysUntilExpiry ?? '—'}</p>
          <p style={{ fontSize: 11, color: '#4A6580' }}>{subscriptionStatus?.current_period_end ? new Date(subscriptionStatus.current_period_end * 1000).toLocaleDateString('pt-BR') : 'Sem assinatura'}</p>
        </div>
        <div style={{ background: '#0e2038', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#378ADD,#1d6fa8)' }} />
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4A6580', marginBottom: 8 }}>Custo/moeda</p>
          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 500, color: hasActivePlan ? '#34d399' : '#f87171', lineHeight: 1, marginBottom: 4 }}>R${costPerCoin.toFixed(3)}</p>
          <p style={{ fontSize: 11, color: '#4A6580' }}>{hasActivePlan ? 'com seu plano' : 'preço cheio'}</p>
          {!hasActivePlan && <p style={{ fontSize: 10, color: '#374151', marginTop: 4 }}>PRO = R$0,249/moeda</p>}
        </div>
      </div>

      <CoinPackageSection
        hasActivePlan={hasActivePlan}
        planDiscount={planDiscount}
        buyingId={buyingId}
        onBuy={(id) => handleCheckout('one_time', id)}
        isMobile={isMobile}
      />

      <MarketingContent onScrollToPlans={scrollToPlans} isMobile={isMobile} />

      <SubscriptionPlansSection
        ref={plansRef}
        buyingId={buyingId}
        onSubscribe={(id) => handleCheckout('subscription', id)}
        isMobile={isMobile}
      />

      <PlanComparisonTable
        buyingId={buyingId}
        onSubscribe={(id) => handleCheckout('subscription', id)}
      />

      {/* Grid Plano Atual + Saldo */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <CurrentPlanCard
          currentSubscription={currentSubscription}
          subscriptionStatus={subscriptionStatus}
          isSubscriptionLoading={isSubscriptionLoading}
          hasActivePlan={hasActivePlan}
          daysUntilExpiry={daysUntilExpiry}
          showExpiryWarning={showExpiryWarning}
          cycleProgress={cycleProgress}
          cancelConfirm={cancelConfirm}
          onCancelConfirmChange={setCancelConfirm}
          cancelLoading={cancelLoading}
          onCancelSubscription={handleCancelSubscription}
          onOpenChangePlanModal={() => setShowChangePlanModal(true)}
        />
        <CoinBalanceCard
          balanceNum={balanceNum}
          balanceLoading={balanceLoading}
          costPerCoin={costPerCoin}
          hasActivePlan={hasActivePlan}
          currentSubscriptionPackageId={currentSubscription?.package_id}
          recentTransactions={recentTransactions}
          isTransactionsLoading={isTransactionsLoading}
          onNavigateToCarteira={() => navigate('/profissional/carteira')}
        />
      </div>

      <ChangePlanModal
        open={showChangePlanModal}
        onClose={() => setShowChangePlanModal(false)}
        buyingId={buyingId}
        onSelectPlan={(id) => handleCheckout('subscription', id)}
      />

    </div>

    {/* Sticky Bar */}
    <div style={{ position: 'sticky', bottom: 0, left: 0, right: 0, background: 'rgba(7,15,28,.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,.06)', padding: isMobile ? '10px 1rem' : '10px 1.5rem', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? 8 : 12, zIndex: 50, flexWrap: 'wrap' }}>
      <div style={{ fontSize: isMobile ? 13 : 12, color: '#4A6580' }}>
        <span style={{ color: 'white', fontWeight: 700 }}>{balanceNum} moedas</span>
        {' · '}
        <span>{hasActivePlan ? `Plano ${PLAN_NAMES[currentSubscription!.package_id]} · ${daysUntilExpiry ?? '—'} dias restantes` : 'Sem plano ativo · preço cheio'}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : undefined }}>
        <button onClick={() => handleCheckout('one_time', 'pack_pro')} style={{ height: 36, padding: '0 16px', background: 'transparent', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: isMobile ? '100%' : undefined, justifyContent: isMobile ? 'center' : undefined, display: isMobile ? 'flex' : undefined, alignItems: isMobile ? 'center' : undefined }}>
          🪙 Comprar moedas
        </button>
        {hasActivePlan ? (
          <button onClick={() => setShowChangePlanModal(true)} style={{ height: 36, padding: '0 16px', background: 'transparent', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: isMobile ? '100%' : undefined, justifyContent: isMobile ? 'center' : undefined, display: isMobile ? 'flex' : undefined, alignItems: isMobile ? 'center' : undefined }}>
            ↺ Mudar plano
          </button>
        ) : null}
        <button onClick={() => handleCheckout('subscription', 'plan_pro')} disabled={!!buyingId} style={{ height: 36, padding: '0 16px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 10, color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 12px rgba(16,185,129,.25)', opacity: buyingId ? .5 : 1, width: isMobile ? '100%' : undefined, justifyContent: isMobile ? 'center' : undefined, display: isMobile ? 'flex' : undefined, alignItems: isMobile ? 'center' : undefined }}>
          {buyingId === 'plan_pro' ? <Loader2 size={14} className="animate-spin" /> : '⚡ Upgrade PRO →'}
        </button>
      </div>
    </div>
    </>
  );
}
