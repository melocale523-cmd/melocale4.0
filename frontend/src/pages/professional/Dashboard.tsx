import { useAuthStore, User } from '../../store/authStore';
import { Target, Wallet, ArrowRight, Briefcase, Rocket, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { walletService, leadService } from '../../services/dbServices';
import { Link, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';

// ─── Profile Completion ────────────────────────────────────────────────────────

interface CompletionResult {
  pct: number;
  missing: string[];
}

function calculateProfileCompletion(user: User | null): CompletionResult {
  if (!user) return { pct: 0, missing: [] };

  const missing: string[] = [];
  let score = 0;

  // Name (20%) — must be non-empty and not just the email prefix
  const nameIsReal = user.name && user.name !== user.email?.split('@')[0] && user.name.trim().length > 2;
  if (nameIsReal) { score += 20; } else { missing.push('Nome completo'); }

  // Phone (20%)
  if (user.phone?.trim()) { score += 20; } else { missing.push('Telefone'); }

  // Bio (25%) — must have meaningful text (professionals.bio)
  if (user.bio && user.bio.trim().length > 10) { score += 25; } else { missing.push('Biografia'); }

  // Category (20%) — first element of professionals.categories[]
  if (user.category?.trim()) { score += 20; } else { missing.push('Categoria'); }

  // Avatar (15%) — profiles.avatar_url
  if (user.avatar?.trim()) { score += 15; } else { missing.push('Foto de perfil'); }

  return { pct: score, missing };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfessionalDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['walletBalance'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: walletService.getBalance,
  });

  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ['myPurchases'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: leadService.getMyPurchases,
  });

  const completion = calculateProfileCompletion(user);
  const balanceCoins = typeof balance === 'number' ? balance : 0;
  const purchaseCount = Array.isArray(purchases) ? purchases.length : 0;

  // ─── Primeiros Passos ─────────────────────────────────────────────────────

  const steps = [
    {
      id: 'account',
      label: 'Criar conta',
      done: !!user,
      path: null,
    },
    {
      id: 'profile',
      label: 'Completar perfil (80% ou mais)',
      done: completion.pct >= 80,
      path: '/profissional/perfil',
    },
    {
      id: 'wallet',
      label: 'Recarregar carteira de moedas',
      done: balanceCoins > 0,
      path: '/profissional/carteira',
    },
    {
      id: 'lead',
      label: 'Comprar primeiro lead',
      done: purchaseCount > 0,
      path: '/profissional/leads',
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const checklistPct = Math.round((doneCount / steps.length) * 100);

  if (balanceLoading || purchasesLoading) {
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
            Olá, {user?.name?.split(' ')[0] || 'Profissional'}! 👋
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
            {user?.category || 'Não definida'}
          </p>
          <Link to="/profissional/perfil" className="text-purple-400 hover:text-purple-300 text-xs font-medium flex items-center gap-1 transition-colors">
            {user?.category ? 'Alterar' : 'Definir agora'} <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Profile Completion */}
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
                <p className="text-slate-400 text-sm max-w-lg">
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

      {/* Primeiros Passos */}
      <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Rocket size={20} className="text-orange-400" />
            <h2 className="text-lg font-bold text-white">Primeiros Passos para Faturar</h2>
          </div>
          <span className="text-orange-400 text-xs font-bold">{doneCount}/{steps.length} concluídos</span>
        </div>

        <div className="w-full bg-slate-800/50 rounded-full h-1.5 mb-6 border border-white/5">
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
                  : 'bg-[#0A0B0D] border border-white/5 hover:border-white/10 cursor-pointer group'
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
                <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
