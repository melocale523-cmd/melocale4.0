import {
  Target, Wallet, ArrowRight, Briefcase, Rocket, CheckCircle2, ChevronRight,
  TrendingUp, Users, Activity, Star, Loader2, Zap, Crown, Check, CalendarPlus, X, Coins,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useDashboardData } from '../../hooks/useDashboardData';
import { leadService, reviewService, subscriptionService } from '../../services/dbServices';
import { useTheme } from '../../hooks/useTheme';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

const PLANS = [
  {
    id: 'basico',
    name: 'Básico',
    price: 29,
    highlight: false,
    features: ['10 leads por mês', 'Suporte por e-mail', 'Perfil verificado'],
  },
  {
    id: 'pro',
    name: 'PRO',
    price: 59,
    highlight: true,
    features: ['30 leads por mês', 'Suporte prioritário', 'Selo PRO no perfil', 'Destaque nas buscas'],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 99,
    highlight: false,
    features: ['Leads ilimitados', 'Suporte via WhatsApp', 'Selo Premium', 'Destaque permanente'],
  },
];

export default function ProfessionalDashboard() {
  const navigate = useNavigate();
  const {
    user,
    profile,
    isLoading,
    balanceCoins,
    purchaseCount,
    completion,
    steps,
    doneCount,
    checklistPct,
  } = useDashboardData();

  const { data: stats } = useQuery({
    queryKey: ['professionalStats', '30d'],
    queryFn: () => leadService.getProfessionalStats('30d'),
    staleTime: 1000 * 60 * 5,
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', 'professional', profile?.professionalId],
    queryFn: () => reviewService.getReviewsByProfessional(profile!.professionalId),
    enabled: !!profile?.professionalId,
    staleTime: 60_000,
  });

  const { data: nextAppointment } = useQuery({
    queryKey: ['nextAppointment', profile?.professionalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, title, scheduled_at')
        .eq('professional_id', profile!.professionalId)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.professionalId,
    staleTime: 60_000,
  });

  const { data: currentSubscription } = useQuery({
    queryKey: ['currentSubscription'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: subscriptionService.getCurrentSubscription,
  });

  const { data: percentileData } = useQuery({
    queryKey: ['coinPercentile', profile?.professionalId],
    queryFn: async () => {
      const res = await apiFetch('/api/professionals/coin-percentile');
      if (!res.ok) return { percentile: null };
      return res.json() as Promise<{ percentile: number | null }>;
    },
    enabled: !!profile?.professionalId,
    staleTime: 300_000,
  });

  const { data: pendingCount } = useQuery({
    queryKey: ['pendingLeadsForMe', profile?.category, profile?.city],
    queryFn: async () => {
      if (!profile?.category || !profile?.city) return 0;
      const cityFilter = profile.city.split(' - ')[0].trim();
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
        .ilike('category', profile.category)
        .ilike('location', `%${cityFilter}%`);
      return count ?? 0;
    },
    enabled: !!profile?.category && !!profile?.city,
    staleTime: 60_000,
  });

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [featuredBusy, setFeaturedBusy] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('featured') === 'success') {
      toast.success('Destaque ativado! Você aparecerá no topo por 7 dias.');
      window.history.replaceState({}, '', '/profissional/dashboard');
    }
  }, []);

  const handleActivateFeatured = async () => {
    setFeaturedBusy(true);
    try {
      const res = await apiFetch('/api/create-featured-checkout', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch (e) {
      if (import.meta.env.DEV) console.error('[featured-checkout]', e);
      toast.error(e instanceof Error ? e.message : 'Erro ao ativar destaque.');
    } finally {
      setFeaturedBusy(false);
    }
  };

  const featuredUntil = profile?.featuredUntil ? new Date(profile.featuredUntil) : null;
  const isFeaturedActive = featuredUntil !== null && featuredUntil > new Date();

  const conversionRate = stats && stats.totalProposals > 0
    ? Math.round((stats.acceptedProposalsCount / stats.totalProposals) * 100)
    : 0;

  const avgRating = reviewsData?.average ?? 0;
  const hasSubscription = !!currentSubscription;
  const cityFirstName = profile?.city ? profile.city.split(' - ')[0] : '';

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size={40} label="Carregando seu painel..." />
      </div>
    );
  }

  // Banner de pedido pendente — reutilizado nos dois estados, sempre com número real
  const pendingBanner = (
    <div className="bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl px-5 py-4 flex items-center gap-4">
      <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
        <Activity size={16} className="text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        {pendingCount === undefined ? (
          <p className="text-white text-sm font-bold truncate">Verificando pedidos na sua região...</p>
        ) : pendingCount > 0 ? (
          <>
            <p className="text-white text-sm font-bold truncate">
              {pendingCount} cliente{pendingCount > 1 ? 's' : ''} esperando na sua categoria!
            </p>
            <p className="text-slate-400 text-xs">
              Pedidos abertos {cityFirstName ? `em ${cityFirstName}` : 'na sua cidade'} agora.
            </p>
          </>
        ) : (
          <>
            <p className="text-white text-sm font-bold truncate">Nenhum pedido pendente na sua categoria agora</p>
            <p className="text-slate-400 text-xs">
              Você será avisado assim que um novo cliente aparecer {cityFirstName ? `em ${cityFirstName}` : 'na sua cidade'}.
            </p>
          </>
        )}
      </div>
      <Link
        to="/profissional/leads"
        className="text-emerald-400 hover:text-emerald-300 text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
      >
        Ver agora <ArrowRight size={12} />
      </Link>
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6" style={{ padding: '0 1.5rem' }}>

      {/* HEADER — sempre visível */}
      <div className="flex flex-col sm:flex-row items-baseline justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white">
              Olá, {profile?.full_name?.split(' ')[0] || 'Profissional'}
            </h1>
            {isFeaturedActive && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-md">
                <Star size={10} className="fill-yellow-400" /> PRO
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs">
            {purchaseCount > 0
              ? `Você já é um profissional ativo — ${purchaseCount} cliente${purchaseCount > 1 ? 's' : ''} comprado${purchaseCount > 1 ? 's' : ''}.`
              : `Você é ${profile?.category || 'profissional'}. ${cityFirstName || 'Sua cidade'} precisa de gente como você.`}
          </p>
        </div>
        <button
          onClick={() => navigate('/profissional/leads')}
          className="h-10 px-6 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          <Zap size={16} /> Ver clientes disponíveis
        </button>
      </div>

      {purchaseCount === 0 ? (
        balanceCoins > 0 ? (
          <>
            {/* HERO — tem moeda, nunca comprou cliente */}
            <div style={{ background: '#132236', border: '1px solid rgba(16,185,129,.35)', borderRadius: 16, padding: '36px 24px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 15, background: 'rgba(16,185,129,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <Briefcase size={26} color="#10b981" />
              </div>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: '0 0 10px', lineHeight: 1.3 }}>
                Suas {balanceCoins} moedas estão paradas
              </p>
              <p style={{ fontSize: 14, color: '#a8c2d9', margin: '0 0 22px', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
                Você já tem saldo suficiente pra comprar clientes. Não precisa carregar mais nada
                {cityFirstName ? ` — só escolher quem contatar em ${cityFirstName}.` : ' — só escolher quem contatar.'}
              </p>
              <button
                onClick={() => navigate('/profissional/leads')}
                className="cta-pulse"
                style={{ height: 46, padding: '0 30px', background: '#10b981', color: '#000', fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Zap size={18} /> Ver clientes disponíveis
              </button>
            </div>

            {pendingBanner}

            {/* Stats mínimas */}
            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs uppercase tracking-wide text-slate-400">Avaliação</h3>
                  <Star size={14} className="text-purple-400 fill-purple-400/30" />
                </div>
                <p className="text-white text-sm font-medium">
                  {avgRating > 0 ? avgRating.toFixed(1) : 'Ainda sem avaliações — seu primeiro cliente pode mudar isso.'}
                </p>
              </div>
              <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs uppercase tracking-wide text-slate-400">Categoria</h3>
                  <Briefcase size={14} className="text-pink-400" />
                </div>
                <p className="text-white text-sm font-medium break-words">{profile?.category || 'Não definida'}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* HERO — estado zero */}
            <div style={{ background: '#132236', border: '1px solid rgba(16,185,129,.35)', borderRadius: 16, padding: '36px 24px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(16,185,129,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Rocket size={24} color="#10b981" />
              </div>
              <p style={{ fontSize: 19, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px', lineHeight: 1.3 }}>
                Transforme seu ofício em renda hoje
              </p>
              <p style={{ fontSize: 14, color: '#7a9ebf', margin: '0 0 20px', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                {cityFirstName
                  ? `${cityFirstName} tem clientes esperando por um ${profile?.category || 'profissional'} como você.`
                  : 'Sua cidade tem clientes esperando por você.'} Cada cliente custa entre 10 e 80 moedas — você escolhe quem contatar.
              </p>

              {percentileData?.percentile != null && percentileData.percentile > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24, background: 'rgba(16,185,129,.08)', borderRadius: 100, padding: '10px 20px' }}>
                  <TrendingUp size={16} color="#10b981" />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>
                    Você já está à frente de {percentileData.percentile}% dos profissionais assim que carregar moedas
                  </span>
                </div>
              )}

              <div>
                <button
                  onClick={() => navigate('/profissional/carteira')}
                  className="cta-pulse"
                  style={{ height: 42, padding: '0 26px', background: '#10b981', color: '#000', fontSize: 14, fontWeight: 800, border: 'none', borderRadius: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Wallet size={16} /> Quero meu primeiro cliente
                </button>
              </div>
            </div>

            {pendingBanner}

            {/* Stats mínimas */}
            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs uppercase tracking-wide text-slate-400">Avaliação</h3>
                  <Star size={14} className="text-purple-400 fill-purple-400/30" />
                </div>
                <p className="text-white text-sm font-medium">
                  {avgRating > 0 ? avgRating.toFixed(1) : 'Ainda sem avaliações — seu primeiro cliente pode mudar isso.'}
                </p>
              </div>
              <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs uppercase tracking-wide text-slate-400">Categoria</h3>
                  <Briefcase size={14} className="text-pink-400" />
                </div>
                <p className="text-white text-sm font-medium break-words">{profile?.category || 'Não definida'}</p>
              </div>
            </div>
          </>
        )
      ) : (
        <>
          {/* Moedas + Ranking percentual */}
          <div className="grid grid-cols-2 gap-6 w-full">
            <div
              className="rounded-xl p-5 min-h-[140px] flex flex-col justify-between dark:bg-[#1C3454] dark:border dark:border-[#1C3050]"
              style={!isDark ? {
                background: 'linear-gradient(180deg, rgba(0,40,30,0.92) 0%, rgba(0,80,60,0.75) 100%)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '0.5px solid rgba(52,211,153,0.35)',
              } : undefined}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wide text-slate-400">Moedas</h3>
                <Wallet size={14} className="text-[#6EE7B7] dark:text-emerald-500" />
              </div>
              <p className="text-3xl font-bold text-white mt-3">{balanceCoins}</p>
              <div className="h-px bg-white/5 mt-4 mb-3" />
              <Link to="/profissional/carteira" className="text-[#A7F3D0] hover:text-[#6EE7B7] dark:text-emerald-500 dark:hover:text-emerald-400 text-xs font-medium flex items-center gap-1 transition-colors">
                Recarregar <ArrowRight size={11} />
              </Link>
            </div>

            <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-5 min-h-[140px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wide text-slate-400">Ranking de Moedas</h3>
                <TrendingUp size={14} className="text-emerald-400" />
              </div>
              <p className="text-3xl font-bold text-white mt-3">
                {percentileData?.percentile != null ? `${percentileData.percentile}%` : '—'}
              </p>
              <div className="h-px bg-white/5 mt-4 mb-3" />
              <span className="text-slate-400 text-xs">
                {percentileData?.percentile != null
                  ? `Você está à frente de ${percentileData.percentile}% dos profissionais`
                  : 'Calculando seu ranking...'}
              </span>
            </div>
          </div>

          {/* Comprar mais clientes */}
          <Link
            to="/profissional/carteira"
            className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-xl p-5 flex items-center justify-between gap-4 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-black/10 flex items-center justify-center shrink-0">
                <Coins size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Comprar mais clientes</p>
                <p className="text-emerald-950 text-xs opacity-70">Recarregue moedas e feche mais negócios</p>
              </div>
            </div>
            <ArrowRight size={18} className="text-white shrink-0" />
          </Link>

          {/* Comparação com assinatura */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
              <Crown size={16} className="text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold">Moeda avulsa sai R$5-11 por cliente.</p>
              <p className="text-slate-400 text-xs">Na assinatura PRO, R$1,97 por cliente.</p>
            </div>
            <button
              onClick={() => setShowPlansModal(true)}
              className="text-purple-400 hover:text-purple-300 text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
            >
              Ver planos <ArrowRight size={12} />
            </button>
          </div>

          {pendingBanner}

          {/* Grid 4 stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full">
            <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-5 min-h-[140px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wide text-slate-400">Clientes Comprados</h3>
                <Target size={14} className="text-blue-500" />
              </div>
              <p className="text-3xl font-bold text-white mt-3">{purchaseCount}</p>
              <div className="h-px bg-white/5 mt-4 mb-3" />
              <Link to="/profissional/meus-leads" className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors">
                Ver contatos <ArrowRight size={11} />
              </Link>
            </div>

            <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-5 min-h-[140px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wide text-slate-400">Avaliação</h3>
                <Star size={14} className="text-purple-400 fill-purple-400/30" />
              </div>
              <p className="text-3xl font-bold text-white mt-3">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</p>
              <div className="h-px bg-white/5 mt-4 mb-3" />
              <Link to="/profissional/perfil" className="text-purple-400 hover:text-purple-300 text-xs font-medium flex items-center gap-1 transition-colors">
                Ver avaliações <ArrowRight size={11} />
              </Link>
            </div>

            <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-5 min-h-[140px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wide text-slate-400">Categoria</h3>
                <Briefcase size={14} className="text-pink-400" />
              </div>
              <p className="text-lg font-bold text-white mt-3 leading-tight break-words">
                {profile?.category || 'Não definida'}
              </p>
              <div className="h-px bg-white/5 mt-4 mb-3" />
              <Link to="/profissional/perfil" className="text-pink-400 hover:text-pink-300 text-xs font-medium flex items-center gap-1 transition-colors">
                {profile?.category ? 'Alterar' : 'Definir agora'} <ArrowRight size={11} />
              </Link>
            </div>

            <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-5 min-h-[140px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wide text-slate-400">Próximo Agendamento</h3>
                <CalendarPlus size={14} className="text-blue-400" />
              </div>
              {nextAppointment ? (
                <p className="text-sm font-bold text-white mt-3 leading-tight">
                  {new Date(nextAppointment.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              ) : (
                <p className="text-sm text-slate-500 mt-3">Nenhum marcado</p>
              )}
              <div className="h-px bg-white/5 mt-4 mb-3" />
              <Link to="/profissional/agenda" className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors">
                Ver agenda <ArrowRight size={11} />
              </Link>
            </div>
          </div>

          {/* Completar perfil */}
          {completion.pct < 100 && (
            <div className="bg-gradient-to-r from-[#1C1613] to-[#1C3454] border border-orange-500/20 rounded-xl p-5 min-h-[100px]">
              <div className="flex items-center gap-5">
                <div className="relative w-12 h-12 rounded-full border-4 border-orange-500/20 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 36 36" className="absolute inset-0 w-12 h-12 -rotate-90">
                    <path
                      className="text-orange-500/20"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="currentColor" strokeWidth="3.5"
                    />
                    <path
                      className="text-orange-500"
                      strokeDasharray={`${completion.pct}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
                    />
                  </svg>
                  <span className="text-white font-bold text-xs">{completion.pct}%</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-bold text-base mb-1">Melhore seu Perfil</h4>
                  <p className="text-slate-400 text-sm truncate">
                    Faltam: <span className="text-orange-400 font-medium">{completion.missing.join(', ')}</span>
                  </p>
                </div>
              </div>
              <Link
                to="/profissional/perfil"
                className="mt-5 h-11 px-4 text-sm font-bold bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center rounded-lg transition-all gap-2 shadow-lg shadow-orange-500/20 w-full"
              >
                Completar agora <ArrowRight size={14} />
              </Link>
            </div>
          )}

          {/* Destaque Pontual — reestilizado, discreto, última posição */}
          <div className="bg-gradient-to-r from-[#1C1613] to-[#1C2A3A] border border-yellow-500/20 rounded-xl p-5" style={{ opacity: 0.85 }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                <Star size={18} className="text-yellow-400 fill-yellow-400/30" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold text-sm">Destaque Pontual</h4>
                <p className="text-slate-400 text-sm">Apareça no topo das buscas por 7 dias</p>
              </div>
            </div>
            <div className="mt-4">
              {isFeaturedActive && featuredUntil ? (
                <span className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <CheckCircle2 size={12} />
                  Ativo até {featuredUntil.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
              ) : (
                <button
                  onClick={() => void handleActivateFeatured()}
                  disabled={featuredBusy}
                  className="h-10 px-4 text-xs font-semibold border border-yellow-500/40 hover:bg-yellow-500/10 disabled:opacity-50 disabled:cursor-wait text-yellow-400 rounded-lg transition-all flex items-center justify-center gap-1.5 w-full"
                >
                  {featuredBusy ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
                  Ativar por R$19
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Primeiros Passos — only while steps remain */}
      {doneCount < steps.length && (
        <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Rocket size={16} className="text-orange-400" />
              <h2 className="text-lg font-bold text-white">Primeiros Passos para Faturar</h2>
            </div>
            <span className="text-orange-400 text-xs font-bold">{doneCount}/{steps.length} concluídos</span>
          </div>

          <div className="w-full bg-slate-800/50 rounded-full h-1.5 mb-4 border border-[#1C3050]">
            <div
              className="bg-orange-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${checklistPct}%` }}
            />
          </div>

          <div className="space-y-2.5">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-4 p-4 rounded-xl transition-colors ${
                  step.done
                    ? 'bg-emerald-500/5 border border-emerald-500/20 cursor-default'
                    : 'bg-[#0E1C32] border border-[#1C3050] hover:border-[#243F6A] cursor-pointer group'
                }`}
                onClick={() => !step.done && step.path && navigate(step.path)}
              >
                {step.done ? (
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-700 group-hover:border-slate-500 transition-colors shrink-0" />
                )}
                <span className={`text-xs font-medium flex-1 ${step.done ? 'text-white' : 'text-slate-300'}`}>
                  {step.label}
                </span>
                {step.done ? (
                  <CheckCircle2 size={14} className="text-emerald-500/50" />
                ) : (
                  <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance do Mês */}
      {stats && stats.totalRevenue > 0 && (
        <div className="space-y-2" style={{ marginTop: '1rem' }}>
          <h2 className="text-lg font-bold text-white">Performance do Mês</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
            <Link
              to="/profissional/carteira"
              className="bg-[#1C3454] border border-[#1C3050] hover:border-emerald-500/30 rounded-xl p-5 transition-colors group"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] uppercase tracking-wide text-slate-400 leading-tight break-words min-w-0">Faturamento Est.</h3>
                <TrendingUp size={14} className="text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-white mb-2">
                R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-end gap-1 h-8 mb-3">
                {[40, 60, 50, 80, 65, 100].map((h, i) => (
                  <div key={i} className="flex-1 bg-emerald-500/30 group-hover:bg-emerald-500/50 rounded-sm transition-colors" style={{ height: `${h}%` }} />
                ))}
              </div>
              <span className="text-emerald-500 group-hover:text-emerald-400 text-xs font-medium flex items-center gap-1 transition-colors">
                Ver carteira <ArrowRight size={11} />
              </span>
            </Link>

            <Link
              to="/profissional/carteira"
              className="bg-[#1C3454] border border-[#1C3050] hover:border-blue-500/30 rounded-xl p-5 transition-colors group"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] uppercase tracking-wide text-slate-400 leading-tight break-words min-w-0">Propostas Aceitas</h3>
                <Users size={14} className="text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-white mb-2">{stats.acceptedProposalsCount}</p>
              <div className="flex items-end gap-1 h-8 mb-3">
                {[55, 70, 45, 90, 60, 75].map((h, i) => (
                  <div key={i} className="flex-1 bg-blue-500/30 group-hover:bg-blue-500/50 rounded-sm transition-colors" style={{ height: `${h}%` }} />
                ))}
              </div>
              <span className="text-blue-400 group-hover:text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors">
                Ver carteira <ArrowRight size={11} />
              </span>
            </Link>

            <Link
              to="/profissional/meus-leads"
              className="bg-[#1C3454] border border-[#1C3050] hover:border-purple-500/30 rounded-xl p-5 transition-colors group"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] uppercase tracking-wide text-slate-400 leading-tight break-words min-w-0">Ticket Médio</h3>
                <Activity size={14} className="text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-white mb-2">
                R$ {stats.acceptedProposalsCount > 0
                  ? (stats.totalRevenue / stats.acceptedProposalsCount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                  : '0,00'}
              </p>
              <div className="flex items-end gap-1 h-8 mb-3">
                {[60, 50, 80, 55, 70, 65].map((h, i) => (
                  <div key={i} className="flex-1 bg-purple-500/30 group-hover:bg-purple-500/50 rounded-sm transition-colors" style={{ height: `${h}%` }} />
                ))}
              </div>
              <span className="text-purple-400 group-hover:text-purple-300 text-xs font-medium flex items-center gap-1 transition-colors">
                Taxa de conversão: {conversionRate}% <ArrowRight size={11} />
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* Modal de Planos */}
      {showPlansModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0E1C32]/80 backdrop-blur-sm" onClick={() => setShowPlansModal(false)} />
          <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-[#243F6A] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#4A6580]">Assinatura</p>
                <h2 className="text-base font-bold text-white leading-tight">Escolha o plano ideal para você</h2>
              </div>
              <button
                onClick={() => setShowPlansModal(false)}
                className="w-8 h-8 rounded-full bg-[#0E1C32] border border-[#243F6A] text-[#4A6580] hover:text-white flex items-center justify-center transition-colors shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className={cn(
                      'rounded-2xl border p-5 flex flex-col',
                      plan.highlight
                        ? 'bg-gradient-to-b from-purple-500/15 to-[#0E1C32] border-purple-500/40 shadow-lg shadow-purple-500/10'
                        : 'bg-[#0E1C32] border-[#243F6A]',
                    )}
                  >
                    {plan.highlight && (
                      <span className="inline-flex items-center gap-1 self-start text-[10px] font-black uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-md mb-3">
                        <Crown size={10} /> Mais popular
                      </span>
                    )}
                    <h3 className="text-white font-bold text-lg mb-1">{plan.name}</h3>
                    <p className="text-2xl font-black text-white mb-4">
                      R$ {plan.price}<span className="text-sm font-medium text-slate-400">/mês</span>
                    </p>
                    <ul className="space-y-2 mb-5 flex-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-xs text-slate-300">
                          <Check size={14} className="text-emerald-400 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => {
                        setShowPlansModal(false);
                        navigate('/profissional/assinatura');
                      }}
                      className={cn(
                        'h-10 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2',
                        plan.highlight
                          ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                          : 'bg-[#1C3454] hover:bg-[#243F6A] text-white border border-[#243F6A]',
                      )}
                    >
                      Assinar {plan.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
