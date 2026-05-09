import { Target, Wallet, ArrowRight, Briefcase, Rocket, CheckCircle2, ChevronRight, TrendingUp, Users, Activity } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useDashboardData } from '../../hooks/useDashboardData';
import { leadService } from '../../services/dbServices';

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
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Greeting */}
      <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4 py-2">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Olá, {profile?.full_name?.split(' ')[0] || 'Profissional'}! 👋
          </h1>
          <p className="text-[#94A3B8] text-sm">Resumo do seu negócio.</p>
        </div>
        <button
          onClick={() => navigate('/profissional/leads')}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          <span className="text-lg leading-none mb-[2px]">+</span> Novos Clientes
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#94A3B8] text-xs font-bold uppercase tracking-widest">Saldo de Moedas</h3>
            <Wallet size={16} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-white mb-2">{balanceCoins} moedas</p>
          <Link to="/profissional/carteira" className="text-emerald-500 hover:text-emerald-400 text-xs font-medium flex items-center gap-1 transition-colors">
            Recarregar <ArrowRight size={12} />
          </Link>
        </div>

        <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#94A3B8] text-xs font-bold uppercase tracking-widest">Leads Comprados</h3>
            <Target size={16} className="text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-white mb-2">{purchaseCount}</p>
          <Link to="/profissional/meus-leads" className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors">
            Ver contatos <ArrowRight size={12} />
          </Link>
        </div>

        <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#94A3B8] text-xs font-bold uppercase tracking-widest">Categoria</h3>
            <Briefcase size={16} className="text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white mb-2 truncate">
            {profile?.category || 'Não definida'}
          </p>
          <Link to="/profissional/perfil" className="text-purple-400 hover:text-purple-300 text-xs font-medium flex items-center gap-1 transition-colors">
            {profile?.category ? 'Alterar' : 'Definir agora'} <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Profile Completion */}
      <div className="bg-gradient-to-r from-[#1C1613] to-[#1C3454] border border-orange-500/20 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="relative w-16 h-16 rounded-full border-4 border-orange-500/20 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 36 36" className="absolute inset-0 w-16 h-16 -rotate-90">
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
              <h4 className="text-white font-bold text-lg mb-1">
                {completion.pct >= 100 ? 'Perfil Completo!' : 'Melhore seu Perfil Profissional'}
              </h4>
              {completion.pct < 100 && (
                <p className="text-[#94A3B8] text-sm max-w-lg">
                  Faltam: <span className="text-orange-400 font-medium">{completion.missing.join(', ')}</span>
                </p>
              )}
              {completion.pct >= 100 && (
                <p className="text-emerald-400 text-sm">Profissionais com perfil 100% completo recebem até <strong>3x mais contatos</strong>.</p>
              )}
            </div>
          </div>
          {completion.pct < 100 && (
            <Link
              to="/profissional/perfil"
              className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-orange-500/20 shrink-0"
            >
              Completar agora <ArrowRight size={18} />
            </Link>
          )}
        </div>
      </div>

      {/* Performance do Mês */}
      <div className="space-y-4">
        <h2 className="text-white font-bold text-lg">Performance do Mês</h2>

        {!stats || stats.totalRevenue === 0 ? (
          <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-8 flex flex-col items-center text-center gap-3">
            <Rocket size={32} className="text-emerald-500/60" />
            <p className="text-slate-300 font-medium">Sua jornada começa aqui!</p>
            <p className="text-[#4A6580] text-sm max-w-sm">
              Envie propostas para desbloquear suas estatísticas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/profissional/carteira"
              className="bg-[#1C3454] border border-[#1C3050] hover:border-emerald-500/30 rounded-2xl p-6 transition-colors group"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#94A3B8] text-xs font-bold uppercase tracking-widest">Faturamento Estimado</h3>
                <TrendingUp size={16} className="text-emerald-500" />
              </div>
              <p className="text-3xl font-bold text-white mb-2">
                R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-emerald-500 group-hover:text-emerald-400 text-xs font-medium flex items-center gap-1 transition-colors">
                Ver carteira <ArrowRight size={12} />
              </span>
            </Link>

            <Link
              to="/profissional/carteira"
              className="bg-[#1C3454] border border-[#1C3050] hover:border-blue-500/30 rounded-2xl p-6 transition-colors group"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#94A3B8] text-xs font-bold uppercase tracking-widest">Propostas Aceitas</h3>
                <Users size={16} className="text-blue-500" />
              </div>
              <p className="text-3xl font-bold text-white mb-2">{stats.acceptedProposalsCount}</p>
              <span className="text-blue-400 group-hover:text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors">
                Ver carteira <ArrowRight size={12} />
              </span>
            </Link>

            <Link
              to="/profissional/meus-leads"
              className="bg-[#1C3454] border border-[#1C3050] hover:border-purple-500/30 rounded-2xl p-6 transition-colors group"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#94A3B8] text-xs font-bold uppercase tracking-widest">Taxa de Conversão</h3>
                <Activity size={16} className="text-purple-400" />
              </div>
              <p className="text-3xl font-bold text-white mb-2">{conversionRate}%</p>
              <span className="text-purple-400 group-hover:text-purple-300 text-xs font-medium flex items-center gap-1 transition-colors">
                Meus leads <ArrowRight size={12} />
              </span>
            </Link>
          </div>
        )}
      </div>

      {/* Primeiros Passos — only while steps remain */}
      {doneCount < steps.length && (
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Rocket size={20} className="text-orange-400" />
            <h2 className="text-lg font-bold text-white">Primeiros Passos para Faturar</h2>
          </div>
          <span className="text-orange-400 text-xs font-bold">{doneCount}/{steps.length} concluídos</span>
        </div>

        <div className="w-full bg-slate-800/50 rounded-full h-1.5 mb-6 border border-[#1C3050]">
          <div
            className="bg-orange-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${checklistPct}%` }}
          />
        </div>

        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-4 rounded-xl transition-colors ${
                step.done
                  ? 'bg-emerald-500/5 border border-emerald-500/20 cursor-default'
                  : 'bg-[#0E1C32] border border-[#1C3050] hover:border-[#243F6A] cursor-pointer group'
              }`}
              onClick={() => !step.done && step.path && navigate(step.path)}
            >
              {step.done ? (
                <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-700 group-hover:border-slate-500 transition-colors shrink-0" />
              )}
              <span className={`text-sm font-medium flex-1 ${step.done ? 'text-white' : 'text-slate-300'}`}>
                {step.label}
              </span>
              {step.done ? (
                <CheckCircle2 size={16} className="text-emerald-500/50" />
              ) : (
                <ChevronRight size={16} className="text-slate-600 group-hover:text-[#94A3B8] transition-colors" />
              )}
            </div>
          ))}
        </div>
      </div>
      )}

    </div>
  );
}
