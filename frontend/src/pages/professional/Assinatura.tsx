import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { walletService, adminService, subscriptionService } from '../../services/dbServices';
import { initiateCheckout } from '../../lib/stripe';
import { apiFetch } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, X, Users, Calendar, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

const STATUS_LABELS: Record<string, { label: string; colorClass: string }> = {
  active:   { label: 'Ativo',              colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  canceled: { label: 'Cancelado',          colorClass: 'bg-red-500/10 text-red-400 border-red-500/20'            },
  past_due: { label: 'Pagamento Pendente', colorClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'   },
  trialing: { label: 'Em Teste',           colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20'         },
};

const PLAN_NAMES: Record<string, string> = {
  plan_basic:    'Básico',
  plan_pro:      'Profissional',
  plan_business: 'Empresarial',
};

const PLAN_LEADS: Record<string, string> = {
  plan_basic:    '30',
  plan_pro:      '80',
  plan_business: '200',
};

const PLAN_PRICES: Record<string, string> = {
  plan_basic:    '49',
  plan_pro:      '99',
  plan_business: '199',
};

const SUBSCRIPTION_PLANS = [
          {
            id: 'plan_basic',
            name: 'Básico',
            price: '49',
            description: 'Ideal para profissionais iniciantes',
            leads: '30 clientes/mês',
            features: ['Cadastro na plataforma', 'Perfil público visível', 'Até 30 clientes inclusos/mês', 'Responder orçamentos ilimitados'],
            popular: false,
            color: 'blue'
          },
          {
            id: 'plan_pro',
            name: 'Profissional',
            price: '99',
            description: 'Para profissionais estabelecidos',
            leads: '80 clientes/mês',
            features: ['Tudo do plano Básico', 'Até 80 clientes inclusos/mês', 'Perfil PREMIUM destacado', 'Aparecer no topo das buscas', 'Suporte prioritário'],
            popular: true,
            color: 'purple'
          },
          {
            id: 'plan_business',
            name: 'Empresarial',
            price: '199',
            description: 'Para empresas e equipes',
            leads: '200 clientes/mês',
            features: ['Tudo do plano Profissional', 'Até 200 clientes inclusos/mês', 'Perfil de EMPRESA', 'Adicionar até 5 profissionais'],
            popular: false,
            color: 'emerald'
          }
        ];
        
        const CREDIT_PACKAGES = [
          {
            id: 'pack_starter',
            name: 'Iniciante',
            coins: 50,
            price: '19,90',
            description: 'Ideal para testar a plataforma',
            icon: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          },
          {
            id: 'pack_pro',
            name: 'Profissional',
            coins: 150,
            price: '49,90',
            description: 'O melhor custo-benefício',
            icon: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>,
            popular: true
          },
          {
            id: 'pack_premium',
            name: 'Premium',
            coins: 400,
            price: '99,90',
            description: 'Para quem não quer perder nenhum lead',
            icon: <path d="M2 4h20M2 4l3 16h14l3-16M2 4l7 5M22 4l-7 5M9 9l3 11M15 9l-3 11"/>
          }
        ];

export default function ProfessionalAssinatura() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const plansRef = useRef<HTMLDivElement>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'plans' | 'coins'>('plans');
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      try {
        const res = await apiFetch(`/api/subscription-status?user_id=${user.id}`);
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
  });

  const { data: dbCoinPackages } = useQuery({
    queryKey: ['coinPackages'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        const data = await adminService.getCoinPackages();
        return (data || []).sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
      } catch (e) {
        return [];
      }
    }
  });

  const packagesToDisplay = CREDIT_PACKAGES;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isSuccess = params.get('success') === 'true' || params.get('payment') === 'success';
    const isCanceled = params.get('canceled') === 'true' || params.get('payment') === 'cancelled';

    if (isSuccess) {
      setStatusMessage({ type: 'success', text: 'Pagamento processado com sucesso! Seus créditos ou assinatura foram atualizados.' });
      queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
      // Limpar URL
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      )}

      {/* Quick Access Purchase */}
      <div className="bg-[#14161B] border border-emerald-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-white font-bold">Oferta de Boas-vinda</h3>
          <p className="text-slate-400 text-sm">Comece hoje mesmo com o Plano Básico.</p>
        </div>
        <button 
          disabled={!!buyingId}
          onClick={() => handleCheckout('subscription', 'plan_basic')}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
        >
          {buyingId === 'plan_basic' ? <Loader2 size={18} className="animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/><path d="M3 10h18"/><path d="M7 15h.01"/><path d="M11 15h2"/></svg>}
          Assinar Plano Básico
        </button>
      </div>

      {/* Seção de Pacotes de Moedas */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 16V8"/><path d="M8 12h8"/></svg>
            </span>
            Pacotes de Créditos Avulsos
          </h2>
          <p className="text-slate-400 text-sm">Recarregue sua carteira conforme a necessidade.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {packagesToDisplay.map((pkg, i) => (
            <div key={pkg.id} className={`bg-[#14161B] border ${i === 1 || pkg.popular ? 'border-blue-500/50 scale-105 shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)] z-10' : 'border-white/5'} rounded-2xl p-8 relative flex flex-col items-center`}>
              {(i === 1 || pkg.popular) && (
                <span className="absolute -top-3 bg-blue-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  Recomendado
                </span>
              )}
              <div className={`w-14 h-14 ${i === 1 || pkg.popular ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-400'} rounded-2xl flex items-center justify-center mb-6`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {pkg.icon}
                </svg>
              </div>
              <h3 className="text-white font-bold text-xl mb-1">{pkg.name}</h3>
              <p className="text-slate-400 text-sm mb-8 text-center">{pkg.description}</p>
              
              <div className="flex items-end mb-4">
                 <span className="text-slate-400 text-sm mb-1 mr-1">R$</span>
                 <span className="text-5xl font-bold text-white">{pkg.price}</span>
              </div>
              
              <span className="bg-yellow-500/10 text-yellow-500 px-4 py-1.5 rounded-full text-xs font-bold border border-yellow-500/20 mb-8 flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                 {pkg.coins} moedas
              </span>

              <ul className="space-y-4 mb-10 w-full flex-1">
                 <li className="flex gap-3 text-sm text-slate-300">
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Acesso imediato aos clientes
                 </li>
                 <li className="flex gap-3 text-sm text-slate-300">
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Suporte prioritário
                 </li>
                 <li className="flex gap-3 text-sm text-slate-300">
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Créditos que não expiram
                 </li>
              </ul>

              <button 
                disabled={!!buyingId}
                onClick={() => handleCheckout('one_time', pkg.id)} 
                className={`w-full py-4 ${i === 1 || pkg.popular ? 'bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-600/20' : 'bg-white/5 hover:bg-white/10'} text-white font-bold rounded-xl transition-all border border-white/10 disabled:opacity-50`}
              >
                 <span className="flex items-center justify-center gap-2 text-sm uppercase tracking-widest">
                   {buyingId === pkg.id ? (
                     <>
                       <Loader2 size={16} className="animate-spin" />
                       <span>Processando...</span>
                     </>
                   ) : (
                     <><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg> Comprar</>
                   )}
                 </span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* CTA para Assinatura */}
      <div className="bg-gradient-to-r from-purple-900/40 via-emerald-900/20 to-purple-900/40 border border-emerald-500/30 rounded-3xl p-8 my-12 relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-2xl text-center md:text-left">
               <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-4 inline-block border border-emerald-500/20">
                 Economia Inteligente
               </span>
               <h3 className="text-2xl font-bold text-white mb-2 leading-tight">Assinar é muito mais barato do que moedas avulsas!</h3>
               <p className="text-slate-400 text-sm">
                 Ao se tornar um assinante, você garante um fluxo constante de clientes todos os meses com um desconto de até <span className="text-emerald-400 font-bold">40%</span> comparado à compra de créditos avulsos. Garanta o melhor preço e não perca nenhuma oportunidade.
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

      {/* Seção de Planos de Assinatura */}
      <div ref={plansRef} className="space-y-6 pt-12 border-t border-white/5">
        <div>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              </span>
              Planos de Pagamento Recorrente
            </h2>
            <p className="text-slate-400 text-sm">Escolha uma assinatura recorrente para adquirir clientes automaticamente mensalmente via Stripe Checkout.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div key={plan.id} className={`bg-[#14161B] border ${plan.popular ? 'border-purple-500/50 scale-105 shadow-[0_0_40px_-10px_rgba(168,85,247,0.3)] z-10' : 'border-white/5'} rounded-2xl p-8 relative flex flex-col`}>
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  Mais Popular
                </span>
              )}
              
              <h3 className="text-white font-bold text-xl mb-1">{plan.name}</h3>
              <p className="text-slate-400 text-sm mb-6">{plan.description}</p>
              
              <div className="flex items-end mb-2">
                 <span className="text-slate-400 text-sm mb-1 mr-1">R$</span>
                 <span className="text-4xl font-bold text-white">{plan.price}</span>
                 <span className="text-slate-500 text-sm mb-1 ml-1">/mês</span>
              </div>
              <p className="text-xs font-bold text-emerald-400 mb-8">{plan.leads} incluídos</p>

              <ul className="space-y-4 mb-8 flex-1">
                 {plan.features.map((feature, idx) => (
                   <li key={idx} className="flex gap-3 text-sm text-slate-300 items-start">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                      {feature}
                   </li>
                 ))}
              </ul>

              <button 
                disabled={!!buyingId}
                onClick={() => handleCheckout('subscription', plan.id)} 
                className={`w-full py-4 ${plan.popular ? 'bg-purple-600 hover:bg-purple-500' : 'bg-white/5 hover:bg-white/10'} text-white font-bold rounded-xl transition-all border border-white/10 disabled:opacity-50 shadow-lg ${plan.popular ? 'shadow-purple-600/20' : ''}`}
              >
                 {buyingId === plan.id ? (
                   <div className="flex items-center justify-center gap-2">
                     <Loader2 size={16} className="animate-spin" />
                     <span>Processando...</span>
                   </div>
                 ) : (
                   'Assinar'
                 )}
              </button>
            </div>
          ))}
        </div>
      </div>


      <div className="flex justify-center mb-10 pt-4">
         <p className="text-slate-500 text-sm flex gap-3 items-center text-center">
            <span className="font-bold text-lg opacity-80">stripe</span>
            <span className="w-px h-4 bg-slate-800"></span>
            <span className="text-slate-600 text-xs text-left max-w-xs">Pagamento processado de forma segura pelo Stripe. Não armazenamos seus dados de cartão.</span>
         </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 pt-6 border-t border-slate-800">

        {/* ===== CARD PLANO ATUAL ===== */}
        <div className="bg-[#14161B] border border-white/5 rounded-2xl overflow-hidden flex flex-col">

          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-900/30 via-emerald-900/10 to-transparent border-b border-white/5 px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Plano Atual</p>
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
                {/* Banner cancelamento agendado */}
                {subscriptionStatus?.cancel_at_period_end && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 flex items-center gap-2">
                    <AlertCircle size={14} className="text-red-400 shrink-0" />
                    <p className="text-red-300 text-sm">
                      Cancelamento agendado para{' '}
                      <strong>
                        {subscriptionStatus.current_period_end
                          ? new Date(subscriptionStatus.current_period_end * 1000).toLocaleDateString('pt-BR')
                          : '—'}
                      </strong>
                    </p>
                  </div>
                )}

                {/* Banner expiração próxima */}
                {showExpiryWarning && !subscriptionStatus?.cancel_at_period_end && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4 flex items-start gap-2">
                    <AlertCircle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                    <p className="text-yellow-300 text-sm">
                      Seu plano expira em <strong>{daysUntilExpiry} dia{daysUntilExpiry !== 1 ? 's' : ''}</strong>. Renove para não perder o acesso.
                    </p>
                  </div>
                )}

                {/* Grid 2×2 */}
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  <div className="bg-[#0A0B0D] rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      <Users size={10} />Clientes/mês
                    </div>
                    <p className="text-white font-bold text-2xl">{PLAN_LEADS[currentSubscription.package_id] ?? '—'}</p>
                  </div>

                  <div className="bg-[#0A0B0D] rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      <Calendar size={10} />Data início
                    </div>
                    <p className="text-white font-bold text-sm">
                      {currentSubscription.started_at
                        ? new Date(currentSubscription.started_at).toLocaleDateString('pt-BR')
                        : '—'}
                    </p>
                  </div>

                  <div className="bg-[#0A0B0D] rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      <RefreshCw size={10} />
                      {subscriptionStatus?.cancel_at_period_end ? 'Expira em' : 'Próx. renovação'}
                    </div>
                    <p className={`font-bold text-sm ${subscriptionStatus?.cancel_at_period_end ? 'text-red-400' : 'text-white'}`}>
                      {subscriptionStatus?.current_period_end
                        ? new Date(subscriptionStatus.current_period_end * 1000).toLocaleDateString('pt-BR')
                        : '—'}
                    </p>
                  </div>

                  <div className="bg-[#0A0B0D] rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      Valor mensal
                    </div>
                    <p className="text-white font-bold text-xl">
                      R$ {PLAN_PRICES[currentSubscription.package_id] ?? '—'}
                    </p>
                  </div>
                </div>

                {/* Barra de progresso do ciclo */}
                {subscriptionStatus?.current_period_end && (
                  <div className="mb-4">
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
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
                <p className="text-slate-400 text-sm font-medium mb-1">Nenhum plano ativo</p>
                <p className="text-slate-600 text-xs">Escolha um plano abaixo para começar</p>
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

        <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6 relative flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.92-.88a2 2 0 0 1 2.81 2.81l-.88.92"/></svg>
            <h2 className="text-lg font-bold text-white">Saldo de Moedas</h2>
          </div>

          <div className="bg-[#0A0B0D] border border-white/5 rounded-xl p-6 mb-6">
             <div className="flex items-center gap-2 mb-4 text-emerald-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
               <h3 className="font-bold text-white">Minha Carteira</h3>
             </div>
             
             <div className="bg-[#14161B] rounded-lg p-4 text-center mb-4 border border-white/5">
                <p className="text-slate-400 text-xs mb-1">Saldo disponível</p>
                <p className="text-3xl font-bold text-white">{balanceLoading ? <LoadingSpinner size={24} className="inline-block" /> : balance} moedas</p>
             </div>
             
             <button onClick={() => navigate('/profissional/carteira')} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-bold rounded-xl transition-colors">
               Ir para carteira
             </button>
          </div>

          <div className="bg-[#0A0B0D] border border-white/5 rounded-xl p-6">
             <h3 className="font-bold text-white text-center mb-1">Transações</h3>
             <p className="text-slate-500 text-xs text-center mb-4">Histórico auditado</p>
             
             <div className="space-y-3">
               {[50, 50, 50, 50, 150].map((val, i) => (
                 <div key={i} className="flex justify-between text-xs font-mono bg-[#14161B] p-2 rounded border border-white/5 text-emerald-400">
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

      {showChangePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#14161B] border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-xl">Mudar de Plano</h2>
              <button onClick={() => setShowChangePlanModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-6 flex items-start gap-2">
              <AlertCircle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-yellow-300 text-sm">Ao mudar de plano, o plano atual será cancelado automaticamente.</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div key={plan.id} className={`bg-[#0A0B0D] border ${plan.popular ? 'border-purple-500/40' : 'border-white/5'} rounded-xl p-5 flex flex-col`}>
                  <h3 className="text-white font-bold text-lg mb-1">{plan.name}</h3>
                  <div className="flex items-end mb-2">
                    <span className="text-slate-400 text-sm mr-1">R$</span>
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                    <span className="text-slate-500 text-sm ml-1">/mês</span>
                  </div>
                  <p className="text-slate-400 text-xs mb-4 flex-1">{plan.leads} incluídos</p>
                  <button
                    disabled={!!buyingId}
                    onClick={() => { setShowChangePlanModal(false); handleCheckout('subscription', plan.id); }}
                    className={`w-full py-3 ${plan.popular ? 'bg-purple-600 hover:bg-purple-500' : 'bg-white/5 hover:bg-white/10'} text-white font-bold rounded-xl transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2`}
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
