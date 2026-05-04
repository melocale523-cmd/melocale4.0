import {
  Target, Wallet, ArrowRight, Briefcase, Rocket, CheckCircle2, ChevronRight,
  Sparkles, MapPin, Radius, Users, Camera, TrendingUp, ShoppingBag, Star,
} from 'lucide-react';
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
    displayDone,
    displayTotal,
    checklistPct,
    isChecklistComplete,
    onlyAvatarMissing,
  } = useDashboardData();

  const { data: leadsCount = 0 } = useQuery({
    queryKey: ['leadsCountByCategory', profile?.category],
    queryFn: () => leadService.getLeadsCountByCategory(profile!.category),
    enabled: !!profile?.category,
    staleTime: 5 * 60 * 1000,
  });

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
          <p className="text-slate-400 text-sm">Resumo do seu negócio.</p>
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
        <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Saldo de Moedas</h3>
            <Wallet size={16} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-white mb-2">{balanceCoins} moedas</p>
          <Link to="/profissional/carteira" className="text-emerald-500 hover:text-emerald-400 text-xs font-medium flex items-center gap-1 transition-colors">
            Recarregar <ArrowRight size={12} />
          </Link>
        </div>

        <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Leads Comprados</h3>
            <Target size={16} className="text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-white mb-2">{purchaseCount}</p>
          <Link to="/profissional/meus-leads" className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors">
            Ver contatos <ArrowRight size={12} />
          </Link>
        </div>

        <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Categoria</h3>
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

      {/* Profile Completion ring */}
      <div className="bg-gradient-to-r from-[#1C1613] to-[#14161B] border border-orange-500/20 rounded-2xl p-6">
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
                  className="text-orange-500 transition-all duration-700"
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
                <p className="text-slate-400 text-sm max-w-lg">
                  Faltam: <span className="text-orange-400 font-medium">{completion.missing.join(', ')}</span>
                </p>
              )}
              {completion.pct >= 100 && (
                <p className="text-emerald-400 text-sm">
                  Profissionais com perfil 100% completo recebem até <strong>3× mais contatos</strong>.
                </p>
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

      {/* ── STATE 1: all required done → CardResumoAvancado ── */}
      {isChecklistComplete && (
        <div className="bg-gradient-to-br from-emerald-950/60 to-[#14161B] border border-emerald-500/20 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b border-emerald-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Sparkles size={20} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Perfil ativo e gerando oportunidades 🚀</h2>
                <p className="text-xs text-emerald-400 font-medium">Perfis completos recebem até 3× mais contatos</p>
              </div>
            </div>
            <Link
              to="/profissional/perfil"
              className="shrink-0 text-xs font-bold text-slate-400 hover:text-white border border-white/10 hover:border-white/20 px-4 py-2 rounded-lg transition-all flex items-center gap-1.5"
            >
              Editar perfil <ArrowRight size={12} />
            </Link>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-white/5">
            <div className="p-5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                <ShoppingBag size={11} /> Leads comprados
              </div>
              <span className="text-2xl font-black text-white">{purchaseCount}</span>
              <Link to="/profissional/meus-leads" className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors">
                Ver contatos <ArrowRight size={10} />
              </Link>
            </div>

            <div className="p-5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                <Users size={11} /> Disponíveis agora
              </div>
              <span className="text-2xl font-black text-white">{leadsCount}</span>
              <Link to="/profissional/leads" className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 transition-colors">
                Ver leads <ArrowRight size={10} />
              </Link>
            </div>

            <div className="p-5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                <TrendingUp size={11} /> Conversão
              </div>
              <span className="text-2xl font-black text-slate-600">—</span>
              <span className="text-[11px] text-slate-600">Em breve</span>
            </div>

            <div className="p-5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                <Star size={11} /> Status do perfil
              </div>
              <span className="text-sm font-bold text-emerald-400">Completo</span>
              <span className="text-[11px] text-slate-500">100% preenchido</span>
            </div>
          </div>

          {/* Leads insight banner */}
          {leadsCount > 0 && profile?.category && (
            <div className="px-6 pb-5 pt-1">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium px-4 py-2.5 rounded-xl">
                <Users size={13} className="shrink-0" />
                Existem <span className="font-black text-white">{leadsCount}</span> clientes buscando{' '}
                <span className="font-black text-white">{profile.category}</span> na plataforma agora
              </div>
            </div>
          )}

          {/* Profile pills */}
          <div className="flex flex-wrap gap-2 px-6 pb-6">
            {profile?.category && (
              <span className="inline-flex items-center gap-1.5 bg-[#0A0B0D] border border-white/5 text-slate-400 text-xs font-medium px-3 py-1.5 rounded-full">
                <Briefcase size={11} className="text-purple-400" /> {profile.category}
              </span>
            )}
            {profile?.city && (
              <span className="inline-flex items-center gap-1.5 bg-[#0A0B0D] border border-white/5 text-slate-400 text-xs font-medium px-3 py-1.5 rounded-full">
                <MapPin size={11} className="text-blue-400" /> {profile.city}
              </span>
            )}
            {profile?.serviceRadius && (
              <span className="inline-flex items-center gap-1.5 bg-[#0A0B0D] border border-white/5 text-slate-400 text-xs font-medium px-3 py-1.5 rounded-full">
                <Radius size={11} className="text-orange-400" /> Raio: {profile.serviceRadius} km
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── STATE 2: avatar badge (additive — shown even when advanced card is visible) ── */}
      {onlyAvatarMissing && (
        <Link
          to="/profissional/perfil"
          className="flex items-center gap-3 bg-slate-800/60 border border-white/5 hover:border-emerald-500/30 rounded-xl px-5 py-3 transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/15 transition-colors">
            <Camera size={15} className="text-slate-400 group-hover:text-emerald-400 transition-colors" />
          </div>
          <p className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors flex-1">
            Adicione uma <span className="font-semibold text-slate-200">foto de perfil</span> para completar seu cadastro.
          </p>
          <ArrowRight size={14} className="text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0" />
        </Link>
      )}

      {/* ── STATE 3: checklist (only when required steps still pending) ── */}
      {!isChecklistComplete && (
        <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Rocket size={20} className="text-orange-400" />
              <h2 className="text-lg font-bold text-white">Primeiros Passos para Faturar</h2>
            </div>
            <span className="text-orange-400 text-xs font-bold">{displayDone}/{displayTotal} concluídos</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800/50 rounded-full h-1.5 mb-6 border border-white/5">
            <div
              className="bg-orange-500 h-1.5 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${checklistPct}%` }}
            />
          </div>

          <div className="space-y-2.5">
            {steps.filter(s => s.id !== 'avatar').map(step => (
              <div
                key={step.id}
                onClick={() => !step.done && step.path && navigate(step.path)}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-300 ${
                  step.done
                    ? 'bg-emerald-500/5 border-emerald-500/20 cursor-default'
                    : 'bg-[#0A0B0D] border-white/5 hover:border-white/10 cursor-pointer group'
                }`}
              >
                <div className={`shrink-0 transition-transform duration-300 ${step.done ? 'scale-110' : 'scale-100'}`}>
                  {step.done ? (
                    <CheckCircle2 size={20} className="text-emerald-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-700 group-hover:border-slate-500 transition-colors" />
                  )}
                </div>
                <span className={`text-sm font-medium flex-1 transition-colors duration-300 ${step.done ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                  {step.label}
                </span>
                {step.done ? (
                  <CheckCircle2 size={14} className="text-emerald-500/40 shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}


    </div>
  );
}
