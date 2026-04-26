import { useAuthStore } from '../../store/authStore';
import { Target, TrendingUp, Wallet, ArrowRight, ShieldCheck, DollarSign, Sparkles, Rocket, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { walletService } from '../../services/dbServices';
import { Link, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ProfessionalDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data: balance, isLoading } = useQuery({ 
    queryKey: ['walletBalance'], 
    retry: false, 
    refetchOnWindowFocus: false, 
    queryFn: walletService.getBalance 
  });
  const { data: purchases, isLoading: purchasesLoading } = useQuery({ 
    queryKey: ['purchases'], 
    retry: false, 
    refetchOnWindowFocus: false, 
    queryFn: api.getPurchases 
  });

  if (isLoading || purchasesLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size={40} label="Carregando seu painel..." />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Profile Completion Warning */}
      <div className="bg-gradient-to-r from-[#1C1613] to-[#14161B] border border-orange-500/20 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="relative w-16 h-16 rounded-full border-4 border-orange-500/20 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 36 36" className="absolute inset-0 w-16 h-16 -rotate-90">
                <path
                  className="text-orange-500/20"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                />
                <path
                  className="text-orange-500"
                  strokeDasharray="45, 100"
                  d="M18 2.0845 a 15.9155 a 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-white font-bold text-xs">45%</span>
            </div>
            <div>
              <h4 className="flex items-center gap-2 text-white font-bold text-lg mb-1">
                Melhore seu Perfil Profissional
              </h4>
              <p className="text-slate-400 text-sm max-w-lg">
                Profissionais com perfil 100% completo recebem até <span className="text-emerald-400 font-bold">3x mais contatos</span> de clientes novos.
              </p>
            </div>
          </div>
          <Link to="/profissional/perfil" className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-orange-500/20 shrink-0">
            Completar agora <ArrowRight size={18} />
          </Link>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/5">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
               <p className="text-white text-xs font-bold">Mais Confiança</p>
               <p className="text-slate-500 text-[10px]">Selo de verificado ativo</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-slate-700 shrink-0 mt-0.5" />
            <div>
               <p className="text-slate-400 text-xs font-bold opacity-50">Topo das Buscas</p>
               <p className="text-slate-600 text-[10px]">Exposição prioritária</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-slate-700 shrink-0 mt-0.5" />
            <div>
               <p className="text-slate-400 text-xs font-bold opacity-50">LinkedIn Sync</p>
               <p className="text-slate-600 text-[10px]">Importar qualificações</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
               <p className="text-white text-xs font-bold">Bio Completa</p>
               <p className="text-slate-500 text-[10px]">Melhor descrição</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4 py-2">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            Olá, {user?.name?.split(' ')[0] || 'Profissional'}! 👋
          </h1>
          <p className="text-slate-400 text-sm">Resumo do seu negócio.</p>
        </div>
        <button onClick={() => navigate('/profissional/leads')} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20">
          <span className="text-lg leading-none mb-[2px]">+</span> Novos Clientes
        </button>
      </div>

      {/* Mini Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                SALDO DE MOEDAS
              </h3>
              <Wallet size={16} className="text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-white mb-2">{isLoading ? '...' : (typeof balance === 'number' ? balance : 0)} moedas</p>
            <Link to="/profissional/carteira" className="text-emerald-500 hover:text-emerald-400 text-xs font-medium flex items-center gap-1 transition-colors">
              Recarregar <ArrowRight size={12} />
            </Link>
         </div>

         <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                STATUS
              </h3>
              <ShieldCheck size={16} className="text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-white mb-2">Perfil Aprovado</p>
            <p className="text-slate-500 text-xs">Perfil verificado</p>
         </div>

         <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                FATURAMENTO
              </h3>
              <DollarSign size={16} className="text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-white mb-2">R$ 0,00</p>
            <p className="text-slate-500 text-xs">Fechamentos do mês</p>
         </div>
      </div>
      
      {/* Score Profissional */}
      <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-8">
           <Sparkles size={20} className="text-purple-500" />
           <h2 className="text-lg font-bold text-white">Score Profissional</h2>
        </div>

        <div className="max-w-md mx-auto text-center mb-8">
          <div className="w-16 h-1 bg-slate-800 mx-auto rounded-full mb-4"></div>
          <p className="text-slate-400 text-sm">Seu score será calculado automaticamente</p>
        </div>

        <div className="space-y-4 pt-6 border-t border-slate-800/50">
          <div className="flex justify-between text-xs text-slate-400 font-medium">
            <span>Fatores de Influência</span>
            <span className="text-purple-400">0% Ativo</span>
          </div>
          <div className="w-full bg-slate-800/50 rounded-full h-1.5 border border-white/5">
             <div className="bg-gradient-to-r from-purple-600 to-emerald-500 h-1.5 rounded-full" style={{ width: '0%' }}></div>
          </div>
          <p className="text-xs text-slate-500">Perfil completo, propostas enviadas, avaliações e resolução de disputas influenciam seu score.</p>
        </div>
      </div>

      {/* Primeiros Passos */}
      <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-2">
             <Rocket size={20} className="text-orange-400" />
             <h2 className="text-lg font-bold text-white">Primeiros Passos para Faturar</h2>
           </div>
           <span className="text-orange-400 text-xs font-bold">1/4 concluídos</span>
        </div>

        <div className="w-full bg-slate-800/50 rounded-full h-1.5 mb-6 border border-white/5">
           <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: '25%' }}></div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl cursor-default">
             <CheckCircle2 size={20} className="text-emerald-500" />
             <span className="text-white text-sm font-medium flex-1">Criar conta</span>
             <CheckCircle2 size={16} className="text-emerald-500/50" />
          </div>

          <div className="flex items-center gap-3 p-4 bg-[#0A0B0D] border border-white/5 rounded-xl hover:border-white/10 transition-colors cursor-pointer group" onClick={() => navigate('/profissional/perfil')}>
             <div className="w-5 h-5 rounded-full border-2 border-slate-700 flex items-center justify-center group-hover:border-slate-500 transition-colors"></div>
             <span className="text-slate-300 text-sm font-medium flex-1">Completar perfil</span>
             <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400" />
          </div>

          <div className="flex items-center gap-3 p-4 bg-[#0A0B0D] border border-white/5 rounded-xl hover:border-white/10 transition-colors cursor-pointer group" onClick={() => navigate('/profissional/carteira')}>
             <div className="w-5 h-5 rounded-full border-2 border-slate-700 flex items-center justify-center group-hover:border-slate-500 transition-colors"></div>
             <span className="text-slate-300 text-sm font-medium flex-1">Recarregar carteira de moedas</span>
             <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400" />
          </div>

          <div className="flex items-center gap-3 p-4 bg-[#0A0B0D] border border-white/5 rounded-xl hover:border-white/10 transition-colors cursor-pointer group" onClick={() => navigate('/profissional/leads')}>
             <div className="w-5 h-5 rounded-full border-2 border-slate-700 flex items-center justify-center group-hover:border-slate-500 transition-colors"></div>
             <span className="text-slate-300 text-sm font-medium flex-1">Comprar primeiro lead</span>
             <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400" />
          </div>
        </div>
      </div>

    </div>
  );
}
