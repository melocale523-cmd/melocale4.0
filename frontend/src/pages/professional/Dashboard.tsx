import { Target, Wallet, ArrowRight, Briefcase, Rocket, CheckCircle2, ChevronRight, TrendingUp, Users, Activity, Star, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useDashboardData } from '../../hooks/useDashboardData';
import { leadService } from '../../services/dbServices';
import { useTheme } from '../../hooks/useTheme';
import { apiFetch } from '../../lib/api';

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

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [featuredBusy, setFeaturedBusy] = useState(false);

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

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size={40} label="Carregando seu painel..." />
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">

      {/* Greeting */}
      <div className="flex flex-col sm:flex-row items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-white">
            Olá, {profile?.full_name?.split(' ')[0] || 'Profissional'}! 👋
          </h1>
          <p className="text-slate-400 text-xs uppercase tracking-wide">Resumo do seu negócio.</p>
        </div>
        <button
          onClick={() => navigate('/profissional/leads')}
          className="h-10 px-6 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          <span className="text-base leading-none">+</span> Novos Clientes
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full">
        <div
          className="rounded-xl p-3 dark:bg-[#1C3454] dark:border dark:border-[#1C3050]"
          style={!isDark ? {
            background: 'linear-gradient(180deg, rgba(0,40,30,0.92) 0%, rgba(0,80,60,0.75) 100%)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '0.5px solid rgba(52,211,153,0.35)',
          } : undefined}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Saldo de Moedas</h3>
            <Wallet size={14} className="text-[#6EE7B7] dark:text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-white mb-1">{balanceCoins}</p>
          <Link to="/profissional/carteira" className="text-[#A7F3D0] hover:text-[#6EE7B7] dark:text-emerald-500 dark:hover:text-emerald-400 text-xs font-medium flex items-center gap-1 transition-colors">
            Recarregar <ArrowRight size={11} />
          </Link>
        </div>

        <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Leads Comprados</h3>
            <Target size={14} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-white mb-1">{purchaseCount}</p>
          <Link to="/profissional/meus-leads" className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors">
            Ver contatos <ArrowRight size={11} />
          </Link>
        </div>

        <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Categoria</h3>
            <Briefcase size={14} className="text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white mb-1 truncate">
            {profile?.category || 'Não definida'}
          </p>
          <Link to="/profissional/perfil" className="text-purple-400 hover:text-purple-300 text-xs font-medium flex items-center gap-1 transition-colors">
            {profile?.category ? 'Alterar' : 'Definir agora'} <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* Profile Completion */}
      <div className="mt-4 bg-gradient-to-r from-[#1C1613] to-[#1C3454] border border-orange-500/20 rounded-xl p-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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
            <div>
              <h4 className="text-white font-bold text-sm mb-1">
                {completion.pct >= 100 ? 'Perfil Completo!' : 'Melhore seu Perfil Profissional'}
              </h4>
              {completion.pct < 100 && (
                <p className="text-slate-400 text-xs">
                  Faltam: <span className="text-orange-400 font-medium">{completion.missing.join(', ')}</span>
                </p>
              )}
              {completion.pct >= 100 && (
                <p className="text-emerald-400 text-xs">Perfil completo recebe até <strong>3x mais contatos</strong>.</p>
              )}
            </div>
          </div>
          {completion.pct < 100 && (
            <Link
              to="/profissional/perfil"
              className="h-10 px-6 text-sm font-bold bg-orange-600 hover:bg-orange-500 text-white flex items-center rounded-lg transition-all gap-2 shadow-lg shadow-orange-500/20 shrink-0"
            >
              Completar agora <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>

      {/* Performance do Mês */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-white">Performance do Mês</h2>

        {!stats || stats.totalRevenue === 0 ? (
          <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-6 flex flex-col items-center text-center gap-3">
            <Rocket size={28} className="text-emerald-500/60" />
            <p className="text-slate-300 font-medium text-sm">Sua jornada começa aqui!</p>
            <p className="text-slate-500 text-xs max-w-sm">
              Envie propostas para desbloquear suas estatísticas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full">
            <Link
              to="/profissional/carteira"
              className="bg-[#1C3454] border border-[#1C3050] hover:border-emerald-500/30 rounded-xl p-3 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs uppercase tracking-wide text-slate-400">Faturamento Est.</h3>
                <TrendingUp size={14} className="text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-white mb-1">
                R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-emerald-500 group-hover:text-emerald-400 text-xs font-medium flex items-center gap-1 transition-colors">
                Ver carteira <ArrowRight size={11} />
              </span>
            </Link>

            <Link
              to="/profissional/carteira"
              className="bg-[#1C3454] border border-[#1C3050] hover:border-blue-500/30 rounded-xl p-3 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs uppercase tracking-wide text-slate-400">Propostas Aceitas</h3>
                <Users size={14} className="text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-white mb-1">{stats.acceptedProposalsCount}</p>
              <span className="text-blue-400 group-hover:text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors">
                Ver carteira <ArrowRight size={11} />
              </span>
            </Link>

            <Link
              to="/profissional/meus-leads"
              className="bg-[#1C3454] border border-[#1C3050] hover:border-purple-500/30 rounded-xl p-3 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs uppercase tracking-wide text-slate-400">Taxa de Conversão</h3>
                <Activity size={14} className="text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-white mb-1">{conversionRate}%</p>
              <span className="text-purple-400 group-hover:text-purple-300 text-xs font-medium flex items-center gap-1 transition-colors">
                Meus leads <ArrowRight size={11} />
              </span>
            </Link>
          </div>
        )}
      </div>

      {/* Destaque Pontual */}
      <div className="bg-gradient-to-r from-[#1C1613] to-[#1C2A3A] border border-yellow-500/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
            <Star size={18} className="text-yellow-400 fill-yellow-400/30" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Destaque Pontual</h3>
            <p className="text-slate-400 text-xs">Apareça no topo das buscas por 7 dias</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isFeaturedActive && featuredUntil ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
              <CheckCircle2 size={12} />
              Ativo até {featuredUntil.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
          ) : (
            <>
              <span className="text-yellow-400 font-black text-base">R$19</span>
              <button
                onClick={() => void handleActivateFeatured()}
                disabled={featuredBusy}
                className="h-8 px-4 text-xs font-semibold bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-wait text-black rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-yellow-500/20"
              >
                {featuredBusy ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} className="fill-black/30" />}
                Ativar Destaque
              </button>
            </>
          )}
        </div>
      </div>

      {/* Primeiros Passos — only while steps remain */}
      {doneCount < steps.length && (
        <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Rocket size={16} className="text-orange-400" />
              <h2 className="text-lg font-bold text-white">Primeiros Passos para Faturar</h2>
            </div>
            <span className="text-orange-400 text-xs font-bold">{doneCount}/{steps.length} concluídos</span>
          </div>

          <div className="w-full bg-slate-800/50 rounded-full h-1.5 mb-3 border border-[#1C3050]">
            <div
              className="bg-orange-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${checklistPct}%` }}
            />
          </div>

          <div className="space-y-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
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

    </div>
  );
}
