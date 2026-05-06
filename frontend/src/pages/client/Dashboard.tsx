import { useClientProfile } from '../../hooks/useClientProfile';
import { isClientProfileComplete } from '../../lib/profileHelpers';
import { AlertCircle, ArrowRight, Plus, Hammer, Shield, Clock, TrendingUp, MessageCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService } from '../../services/dbServices';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import RequestWizard, { WizardData } from '../../components/RequestWizard';

export default function ClientDashboard() {
  const { data: profile, isLoading: profileLoading, isError: profileError, refetch: refetchProfile } = useClientProfile();
  const queryClient = useQueryClient();

  const profileComplete = isClientProfileComplete(profile);
  const userName = !profileLoading && profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n.charAt(0).toUpperCase() + n.slice(1)).join(' ')
    : '';

  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['clientSummary'],
    queryFn: leadService.getClientSummary,
  });

  const createRequestMutation = useMutation({
    mutationFn: leadService.createRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientSummary'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      setIsModalOpen(false);
      toast.success('Pedido criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar pedido: ${error.message}`);
    }
  });

  const handleWizardSubmit = (wizardData: WizardData) => {
    const metadata: Record<string, string> = {
      urgency: wizardData.urgency,
      work_size: wizardData.work_size,
      availability: wizardData.availability,
      local_condition: wizardData.local_condition,
      purchase_decision: wizardData.purchase_decision,
    };

    createRequestMutation.mutate({
      title: wizardData.title,
      category: wizardData.category,
      description: wizardData.description,
      location: wizardData.location,
      budget_min: parseFloat(wizardData.budget_min) || 0,
      budget_max: parseFloat(wizardData.budget_max) || 0,
      images: wizardData.images,
      metadata,
    });
  };

  if (profileError) {
    return (
      <div className="max-w-6xl mx-auto mt-16 flex flex-col items-center gap-4 text-center">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-slate-300 font-medium">Não foi possível carregar seu perfil.</p>
        <button
          onClick={() => refetchProfile()}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-colors"
        >
          <RefreshCw size={15} /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Greeting — skeleton while loading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {profileLoading ? (
            <div className="space-y-2">
              <div className="h-9 w-56 bg-slate-800 animate-pulse rounded-lg" />
              <div className="h-4 w-72 bg-slate-800/60 animate-pulse rounded" />
            </div>
          ) : (
            <>
              <h1 className="text-4xl font-black text-white tracking-tight mb-2">Olá, {userName}</h1>
              <p className="text-slate-400 font-medium">Bem-vindo(a) ao seu painel de controle MeloCalé.</p>
            </>
          )}
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
        >
          <Plus size={20} />
          Solicitar Novo Orçamento
        </button>
      </div>

      {!profileLoading && !profileComplete && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left transition-all hover:bg-amber-500/15">
          <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 shrink-0">
            <AlertCircle size={32} />
          </div>
          <div className="flex-1">
            <h3 className="text-amber-500 font-black text-xl mb-1">Ação Necessária: Perfil Incompleto</h3>
            <p className="text-slate-400 font-medium">
              Para que os profissionais possam entrar em contato com você, precisamos que o seu telefone esteja cadastrado no sistema.
            </p>
          </div>
          <Link to="/cliente/perfil" className="px-8 py-4 bg-amber-500 text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20">
            Completar Agora
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#14161B] border border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden group col-span-1 md:col-span-2">
          <div className="relative z-10">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mb-6">
              <Hammer size={24} />
            </div>
            <h3 className="text-2xl font-black text-white mb-3">Encontre o Profissional Ideal</h3>
            <p className="text-slate-400 font-medium mb-8 max-w-md leading-relaxed">
              Descreva seu projeto, anexe fotos e receba orçamentos detalhados de profissionais verificados e avaliados pela nossa comunidade.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              disabled={!profileComplete}
              className="px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-500 active:scale-95 flex items-center gap-2"
            >
              Solicitar Orçamento Agora
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -right-8 -bottom-8 opacity-5">
            <Shield size={200} />
          </div>
        </div>

        <div className="bg-[#14161B] border border-white/5 rounded-[2.5rem] p-8 flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
                <TrendingUp size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Hoje</span>
            </div>
            <h3 className="text-white font-black text-xl mb-1">Resumo do Painel</h3>
            <p className="text-sm text-slate-500 font-medium">Acompanhe seu progresso</p>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-[#0A0B0D] p-6 rounded-3xl border border-white/5 hover:border-emerald-500/30 transition-all">
              <div className="text-3xl font-black text-white mb-1">
                {summaryLoading ? '...' : summary?.waiting || 0}
              </div>
              <div className="text-[10px] uppercase font-black text-emerald-500 tracking-widest">Aguardando</div>
            </div>
            <div className="bg-[#0A0B0D] p-6 rounded-3xl border border-white/5 hover:border-cyan-500/30 transition-all">
              <div className="text-3xl font-black text-white mb-1">
                {summaryLoading ? '...' : summary?.in_progress || 0}
              </div>
              <div className="text-[10px] uppercase font-black text-cyan-500 tracking-widest">Em Andamento</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { icon: <Clock />, label: 'Resposta Rápida', desc: 'Profissionais respondem em até 24h', color: 'text-orange-500' },
          { icon: <Shield />, label: 'Garantia', desc: 'Sua satisfação é nossa prioridade', color: 'text-emerald-500' },
          { icon: <MessageCircle />, label: 'Chat Direto', desc: 'Fale com o profissional no app', color: 'text-blue-500' },
          { icon: <TrendingUp />, label: 'Avaliações', desc: 'Veja o histórico do profissional', color: 'text-purple-500' }
        ].map((item, i) => (
          <div key={i} className="bg-[#14161B]/50 border border-white/5 rounded-3xl p-6 hover:bg-[#14161B] transition-all">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-white/5', item.color)}>
              {item.icon}
            </div>
            <h4 className="text-white font-bold text-sm mb-1">{item.label}</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <RequestWizard
          onSubmit={handleWizardSubmit}
          onClose={() => setIsModalOpen(false)}
          isPending={createRequestMutation.isPending}
          isUploading={false}
          onImageUpload={() => undefined}
        />
      )}
    </div>
  );
}
