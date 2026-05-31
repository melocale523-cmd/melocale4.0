import { useClientProfile } from '../../hooks/useClientProfile';
import { isClientProfileComplete } from '../../lib/profileHelpers';
import { AlertCircle, ArrowRight, Plus, Hammer, Shield, Clock, TrendingUp, MessageCircle, RefreshCw, CheckCircle2, CalendarCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService } from '../../services/dbServices';
import { supabase } from '../../lib/supabase';
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

  const { data: nextAppointment, isLoading: apptLoading } = useQuery({
    queryKey: ['clientNextAppointment'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('appointments')
        .select('scheduled_at')
        .eq('client_id', user.id)
        .eq('status', 'confirmed')
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
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
      <div className="max-w-6xl mx-auto mt-16 flex flex-col items-center gap-9 text-center">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-slate-300 font-medium">Não foi possível carregar seu perfil.</p>
        <button
          onClick={() => refetchProfile()}
          className="flex items-center gap-7 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-colors"
        >
          <RefreshCw size={15} /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Greeting — skeleton while loading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-9">
        <div>
          {profileLoading ? (
            <div className="space-y-7">
              <div className="h-9 w-56 bg-slate-800 animate-pulse rounded-lg" />
              <div className="h-4 w-72 bg-slate-800/60 animate-pulse rounded" />
            </div>
          ) : (
            <>
              <h1 className="text-4xl font-black text-white tracking-tight mb-7">Olá, {userName}</h1>
              <p className="text-[#94A3B8] font-medium">Bem-vindo(a) ao seu painel de controle MeloCalé.</p>
            </>
          )}
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-7 px-11 py-9 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
        >
          <Plus size={20} />
          Solicitar Novo Orçamento
        </button>
      </div>

      {!profileLoading && !profileComplete && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-8 flex flex-col md:flex-row items-center gap-11 text-center md:text-left transition-all hover:bg-amber-500/15">
          <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 shrink-0">
            <AlertCircle size={32} />
          </div>
          <div className="flex-1">
            <h3 className="text-amber-500 font-black text-xl mb-6">Ação Necessária: Perfil Incompleto</h3>
            <p className="text-[#94A3B8] font-medium">
              Para que os profissionais possam entrar em contato com você, precisamos que o seu telefone esteja cadastrado no sistema.
            </p>
          </div>
          <Link to="/cliente/perfil" className="px-8 py-9 bg-amber-500 text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20">
            Completar Agora
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-11">
        <div className="bg-[#1C3454] border border-[#1C3050] rounded-[2.5rem] p-8 relative overflow-hidden group col-span-1 md:col-span-2">
          <div className="relative z-10">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mb-11">
              <Hammer size={24} />
            </div>
            <h3 className="text-2xl font-black text-white mb-8">Encontre o Profissional Ideal</h3>
            <p className="text-[#94A3B8] font-medium mb-13 max-w-md leading-relaxed">
              Descreva seu projeto, anexe fotos e receba orçamentos detalhados de profissionais verificados e avaliados pela nossa comunidade.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              disabled={!profileComplete}
              className="px-8 py-9 bg-emerald-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-500 active:scale-95 flex items-center gap-7"
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

        <div className="bg-[#1C3454] border border-[#1C3050] rounded-[2.5rem] p-8 flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between mb-11">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
                <TrendingUp size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4A6580]">Resumo</span>
            </div>
            <h3 className="text-white font-black text-xl mb-6">Seus Pedidos</h3>
            <p className="text-sm text-[#4A6580] font-medium">Acompanhe seu progresso</p>
          </div>
          <div className="grid grid-cols-2 gap-8 mt-11">
            <div className="bg-[#0E1C32] p-9 rounded-2xl border border-[#1C3050] hover:border-emerald-500/30 transition-all">
              <div className="text-2xl font-black text-white mb-6">
                {summaryLoading ? '...' : summary?.waiting ?? 0}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={10} className="text-emerald-500" />
                <span className="text-[9px] uppercase font-black text-emerald-500 tracking-widest">Aguardando</span>
              </div>
            </div>
            <div className="bg-[#0E1C32] p-9 rounded-2xl border border-[#1C3050] hover:border-cyan-500/30 transition-all">
              <div className="text-2xl font-black text-white mb-6">
                {summaryLoading ? '...' : summary?.in_progress ?? 0}
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingUp size={10} className="text-cyan-500" />
                <span className="text-[9px] uppercase font-black text-cyan-500 tracking-widest">Em Andamento</span>
              </div>
            </div>
            <div className="bg-[#0E1C32] p-9 rounded-2xl border border-[#1C3050] hover:border-purple-500/30 transition-all col-span-2">
              <div className="text-sm font-black text-white mb-6">
                {apptLoading ? '...' : nextAppointment?.scheduled_at
                  ? new Date(nextAppointment.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Nenhum'}
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarCheck size={10} className="text-purple-400" />
                <span className="text-[9px] uppercase font-black text-purple-400 tracking-widest">Próximo Agendamento</span>
              </div>
            </div>
            <div className="bg-[#0E1C32] p-9 rounded-2xl border border-[#1C3050] hover:border-amber-500/30 transition-all col-span-2">
              <div className="text-2xl font-black text-white mb-6">
                {summaryLoading ? '...' : summary?.finalizado ?? 0}
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={10} className="text-amber-500" />
                <span className="text-[9px] uppercase font-black text-amber-500 tracking-widest">Concluídos</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-11">
        {[
          { icon: <Clock />, label: 'Resposta Rápida', desc: 'Profissionais respondem em até 24h', color: 'text-orange-500' },
          { icon: <Shield />, label: 'Garantia', desc: 'Sua satisfação é nossa prioridade', color: 'text-emerald-500' },
          { icon: <MessageCircle />, label: 'Chat Direto', desc: 'Fale com o profissional no app', color: 'text-blue-500' },
          { icon: <TrendingUp />, label: 'Avaliações', desc: 'Veja o histórico do profissional', color: 'text-purple-500' }
        ].map((item, i) => (
          <div key={i} className="bg-[#1C3454]/50 border border-[#1C3050] rounded-3xl p-11 hover:bg-[#1C3454] transition-all">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-white/5', item.color)}>
              {item.icon}
            </div>
            <h4 className="text-white font-bold text-sm mb-6">{item.label}</h4>
            <p className="text-xs text-[#4A6580] font-medium leading-relaxed">{item.desc}</p>
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
