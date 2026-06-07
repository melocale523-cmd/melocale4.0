import {
  Target, Wallet, ArrowRight, Briefcase, Rocket, CheckCircle2, ChevronRight,
  TrendingUp, Users, Activity, Star, Loader2, Zap, Crown, Check, CalendarPlus, X,
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

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size={40} label="Carregando seu painel..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-baseline justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white">
              Olá, {profile?.full_name?.split(' ')[0] || 'Profissional'}! 👋
            </h1>
            {isFeaturedActive && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-md">
                <Star size={10} className="fill-yellow-400" /> PRO
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs uppercase tracking-wide">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            {profile?.city ? ` • ${profile.city}` : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/profissional/leads')}
          className="h-10 px-6 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          <Zap size={16} /> Ver Novos Clientes
        </button>
      </div>

      {/* Alerta de urgência — leads disponíveis */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl px-5 py-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
          <Activity size={16} className="text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold truncate">Clientes disponíveis na sua cidade!</p>
          <p className="text-slate-400 text-xs">Novos pedidos chegam todos os dias. Não perca a chance de fechar negócio.</p>
        </div>
        <Link
          to="/profissional/leads"
          className="text-emerald-400 hover:text-emerald-300 text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
        >
          Ver agora <ArrowRight size={12} />
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
        <div
          className="rounded-xl p-5 dark:bg-[#1C3454] dark:border dark:border-[#1C3050]"
          style={!isDark ? {
            background: 'linear-gradient(180deg, rgba(0,40,30,0.92) 0%, rgba(0,80,60,0.75) 100%)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '0.5px solid rgba(52,211,153,0.35)',
          } : undefined}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Moedas</h3>
            <Wallet size={14} className="text-[#6EE7B7] dark:text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-white mb-2">{balanceCoins}</p>
          <Link to="/profissional/carteira" className="text-[#A7F3D0] hover:text-[#6EE7B7] dark:text-emerald-500 dark:hover:text-emerald-400 text-xs font-medium flex items-center gap-1 transition-colors">
            Recarregar <ArrowRight size={11} />
          </Link>
        </div>

        <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Leads Comprados</h3>
            <Target size={14} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-white mb-2">{purchaseCount}</p>
          <Link to="/profissional/meus-leads" className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors">
            Ver contatos <ArrowRight size={11} />
          </Link>
        </div>

        <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Avaliação</h3>
            <Star size={14} className="text-purple-400 fill-purple-400/30" />
          </div>
          <p className="text-2xl font-bold text-white mb-2">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</p>
          <Link to="/profissional/perfil" className="text-purple-400 hover:text-purple-300 text-xs font-medium flex items-center gap-1 transition-colors">
            Ver avaliações <ArrowRight size={11} />
          </Link>
        </div>

        <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Categoria</h3>
            <Briefcase size={14} className="text-pink-400" />
          </div>
          <p className="text-2xl font-bold text-white mb-2 truncate">
            {profile?.category || 'Não definida'}
          </p>
          <Link to="/profissional/perfil" className="text-pink-400 hover:text-pink-300 text-xs font-medium flex items-center gap-1 transition-colors">
            {profile?.category ? 'Alterar' : 'Definir agora'} <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* Grid 2x2 — Perfil / Agendamento / Destaque / Assinatura */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">

        {/* Card A — Perfil completo */}
        <div className="bg-gradient-to-r from-[#1C1613] to-[#1C3454] border border-orange-500/20 rounded-xl p-5 min-h-[130px]">
          <div className="flex items-center gap-4">
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
              <h4 className="text-white font-bold text-sm mb-1">
                {completion.pct >= 100 ? 'Perfil Completo!' : 'Melhore seu Perfil'}
              </h4>
              {completion.pct < 100 ? (
                <p className="text-slate-400 text-sm truncate">
                  Faltam: <span className="text-orange-400 font-medium">{completion.missing.join(', ')}</span>
                </p>
              ) : (
                <p className="text-emerald-400 text-sm">Recebe até <strong>3x mais contatos</strong>.</p>
              )}
            </div>
          </div>
          {completion.pct < 100 && (
            <Link
              to="/profissional/perfil"
              className="mt-4 h-10 px-4 text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center rounded-lg transition-all gap-2 shadow-lg shadow-orange-500/20 w-full"
            >
              Completar agora <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {/* Card B — Próximo agendamento */}
        <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-5 min-h-[130px]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <CalendarPlus size={18} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-bold text-sm">Próximo Agendamento</h4>
              {nextAppointment ? (
                <p className="text-slate-400 text-sm truncate">
                  {new Date(nextAppointment.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {nextAppointment.title ? ` • ${nextAppointment.title}` : ''}
                </p>
              ) : (
                <p className="text-slate-500 text-sm">Nenhum agendamento marcado</p>
              )}
            </div>
          </div>
          <Link
            to="/profissional/agenda"
            className="mt-4 h-10 px-4 text-xs font-bold bg-[#0E1C32] border border-[#1C3050] hover:border-blue-500/30 text-blue-400 flex items-center justify-center rounded-lg transition-all gap-2 w-full"
          >
            Ver agenda completa <ArrowRight size={14} />
          </Link>
        </div>

        {/* Card C — Destaque Pontual */}
        <div className="bg-gradient-to-r from-[#1C1613] to-[#1C2A3A] border border-yellow-500/20 rounded-xl p-5 min-h-[130px]">
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
                className="h-10 px-4 text-xs font-semibold bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-wait text-black rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-500/20 w-full"
              >
                {featuredBusy ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} className="fill-black/30" />}
                Ativar por R$19
              </button>
            )}
          </div>
        </div>

        {/* Card D — Assinatura */}
        <div className={cn(
          'rounded-xl p-5 border min-h-[130px]',
          hasSubscription ? 'bg-gradient-to-r from-purple-500/10 to-[#1C3454] border-purple-500/20' : 'bg-[#1C3454] border-[#1C3050]',
        )}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
              <Crown size={18} className="text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-bold text-sm">Assinatura</h4>
              <p className="text-slate-400 text-sm truncate">
                {hasSubscription ? 'Você tem um plano ativo' : 'Tenha leads recorrentes todo mês'}
              </p>
            </div>
          </div>
          <button
            onClick={() => hasSubscription ? navigate('/profissional/assinatura') : setShowPlansModal(true)}
            className="mt-4 h-10 px-4 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center rounded-lg transition-all gap-2 w-full shadow-lg shadow-purple-500/20"
          >
            {hasSubscription ? 'Gerenciar assinatura' : 'Ver planos'} <ArrowRight size={14} />
          </button>
        </div>
      </div>

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
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">Performance do Mês</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
            <Link
              to="/profissional/carteira"
              className="bg-[#1C3454] border border-[#1C3050] hover:border-emerald-500/30 rounded-xl p-5 transition-colors group"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-wide text-slate-400">Faturamento Est.</h3>
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
                <h3 className="text-xs uppercase tracking-wide text-slate-400">Propostas Aceitas</h3>
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
                <h3 className="text-xs uppercase tracking-wide text-slate-400">Ticket Médio</h3>
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
