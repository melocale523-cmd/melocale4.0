import { useClientProfile } from '../../hooks/useClientProfile';
import { isClientProfileComplete } from '../../lib/profileHelpers';
import { AlertCircle, ArrowRight, Plus, Hammer, RefreshCw, CalendarCheck, MapPin, Tag, Zap, Droplets, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService } from '../../services/dbServices';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/useIsMobile';
import RequestWizard, { WizardData } from '../../components/RequestWizard';
import { apiFetch } from '../../lib/api';

function categoryIcon(category: string) {
  const c = category?.toLowerCase() ?? '';
  if (c.includes('eletric') || c.includes('elétric')) return <Zap size={18} className="text-yellow-400" />;
  if (c.includes('hidr') || c.includes('encanamento')) return <Droplets size={18} className="text-blue-400" />;
  return <Hammer size={18} className="text-emerald-400" />;
}

function statusLabel(status: string) {
  if (status === 'open' || status === 'aberto') return 'Aberto';
  if (status === 'orçando') return 'Orçando';
  if (status === 'finalizado') return 'Finalizado';
  return status;
}

function statusColor(status: string) {
  if (status === 'orçando') return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
  if (status === 'finalizado') return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
}

export default function ClientDashboard() {
  const isMobile = useIsMobile();
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

  const { data: recentPedidos, isLoading: recentLoading } = useQuery({
    queryKey: ['clientRecentPedidos'],
    queryFn: () => leadService.getMyRequests().then(r => r.slice(0, 3)),
  });

  const { data: coinsData } = useQuery({
    queryKey: ['clientCoins'],
    queryFn: async () => {
      const res = await apiFetch('/api/client-coins/balance')
      if (!res.ok) return { balance: 0, total_earned: 0 }
      return res.json()
    },
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
      queryClient.invalidateQueries({ queryKey: ['clientRecentPedidos'] });
      setIsModalOpen(false);
      toast.success('Pedido criado com sucesso!');
      // Creditar 100 moedas no primeiro pedido (idempotente no backend)
      apiFetch('/api/client-coins/first-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {})
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

  const dynamicSubtitle = summaryLoading || profileLoading
    ? ''
    : (summary?.waiting ?? 0) > 0
      ? `Você tem ${summary!.waiting} pedido${summary!.waiting > 1 ? 's' : ''} aberto${summary!.waiting > 1 ? 's' : ''} aguardando propostas.`
      : 'Bem-vindo(a)! Crie seu primeiro pedido e receba orçamentos.';

  const statCards = [
    { label: 'Aguardando', value: summary?.waiting ?? 0, activeColor: 'text-emerald-400' },
    { label: 'Em andamento', value: summary?.in_progress ?? 0, activeColor: 'text-cyan-400' },
    { label: 'Propostas recebidas', value: summary?.orcando ?? 0, activeColor: 'text-yellow-400' },
    { label: 'Concluídos', value: summary?.finalizado ?? 0, activeColor: 'text-purple-400' },
  ];

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-700" style={{ display:'flex', flexDirection:'column', gap:'2rem' }}>

      {/* HEADER */}
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
              <p className="text-[#94A3B8] font-medium">{dynamicSubtitle}</p>
            </>
          )}
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
        >
          <Plus size={20} />
          Novo Pedido
        </button>
      </div>

      {/* BANNER PERFIL INCOMPLETO */}
      {!profileLoading && !profileComplete && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left transition-all hover:bg-amber-500/15">
          <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 shrink-0">
            <AlertCircle size={32} />
          </div>
          <div className="flex-1">
            <h3 className="text-amber-500 font-black text-xl mb-2">Ação Necessária: Perfil Incompleto</h3>
            <p className="text-[#94A3B8] font-medium">
              Para que os profissionais possam entrar em contato com você, precisamos que o seu telefone esteja cadastrado no sistema.
            </p>
          </div>
          <Link to="/cliente/perfil" className="px-4 h-12 flex items-center bg-amber-500 text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20">
            Completar Agora
          </Link>
        </div>
      )}

      {/* STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '1rem' }}>
        {statCards.map((card) => (
          <div key={card.label} className="bg-[#132236] rounded-2xl p-5 border border-white/5">
            <p className="text-[11px] text-[#7a9ebf] uppercase tracking-widest mb-2">{card.label}</p>
            <p className={cn(
              'text-3xl font-black',
              summaryLoading ? 'text-slate-600' : card.value > 0 ? card.activeColor : 'text-white'
            )}>
              {summaryLoading ? '—' : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* CONTENT GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>

        {/* COLUNA ESQUERDA — pedidos recentes */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-white">Pedidos recentes</h2>
            <Link
              to="/cliente/pedidos"
              className="text-emerald-400 hover:text-emerald-300 text-sm font-bold transition-colors flex items-center gap-1"
            >
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>

          {recentLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="bg-[#132236] rounded-xl p-4 border border-white/5 h-20 animate-pulse" />
              ))}
            </div>
          ) : recentPedidos && recentPedidos.length > 0 ? (
            <div>
              {recentPedidos.map((pedido: Record<string, unknown>) => {
                const id = pedido.id as string;
                const title = pedido.title as string;
                const location = pedido.location as string | undefined;
                const category = pedido.category as string ?? '';
                const status = pedido.status as string ?? '';
                const budget_min = pedido.budget_min as number | undefined;
                const budget_max = pedido.budget_max as number | undefined;
                const interested = (pedido.interested_count as number | undefined) ?? (pedido.purchases_count as number | undefined) ?? 0;
                return (
                  <Link
                    key={id}
                    to="/cliente/pedidos"
                    className="bg-[#132236] rounded-xl p-4 border border-white/5 mb-3 flex gap-3 items-start hover:border-emerald-500/20 hover:bg-[#0f1d2e] transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                      {categoryIcon(category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-white font-bold text-sm truncate group-hover:text-emerald-400 transition-colors">{title}</p>
                        <ArrowRight size={14} className="text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0 mt-0.5" />
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                        {location && (
                          <span className="flex items-center gap-1 text-[11px] text-[#4a6580]">
                            <MapPin size={10} /> {location}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-[#4a6580]">
                          <Tag size={10} /> {category}
                        </span>
                        {(budget_min != null || budget_max != null) && (
                          <span className="text-[11px] text-[#4a6580]">
                            R$ {budget_min ?? 0} – {budget_max ?? 0}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border', statusColor(status))}>
                          {statusLabel(status)}
                        </span>
                        {interested > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {interested} interessado{interested > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#132236] rounded-xl border border-white/5 text-center flex flex-col items-center" style={{ padding:'2.5rem 1.5rem', gap:'1.25rem' }}>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Hammer size={24} />
              </div>
              <div>
                <p className="text-white font-bold mb-1">Nenhum pedido ainda</p>
                <p className="text-[#4a6580] text-sm">Crie seu primeiro pedido e receba orçamentos de profissionais.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 h-10 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all active:scale-95"
              >
                <Plus size={16} /> Criar pedido
              </button>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          {/* CTA card */}
          <div className="bg-[#132236] rounded-2xl border border-white/5 relative overflow-hidden" style={{ padding:'1.75rem' }}>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center mb-3">
                <Hammer size={20} />
              </div>
              <h3 className="text-white font-black text-base mb-2">Encontre o profissional certo</h3>
              <p className="text-[#7a9ebf] text-sm mb-4 leading-relaxed">
                Descreva o serviço, anexe fotos e receba propostas em minutos.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                disabled={!profileComplete}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-2"
              >
                Solicitar orçamento <ArrowRight size={15} />
              </button>
            </div>
            <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none" />
          </div>

          {/* Moedas */}
          <div style={{ background: '#0b2818', border: '1px solid #10b981', borderRadius: '1rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Coins size={16} color="#10b981" />
              <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#10b981' }}>Suas moedas</span>
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '2rem', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>
              {coinsData?.balance ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: '#4ade80', marginTop: '4px' }}>
              = R${((coinsData?.balance ?? 0) / 100).toFixed(2).replace('.', ',')} · mínimo 1.000 p/ sacar
            </div>
            <div style={{ marginTop: '10px', background: '#1C3050', borderRadius: '100px', height: '6px' }}>
              <div style={{ background: '#10b981', borderRadius: '100px', height: '6px', width: `${Math.min(((coinsData?.balance ?? 0) / 1000) * 100, 100)}%`, transition: 'width .5s' }} />
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
              {Math.max(1000 - (coinsData?.balance ?? 0), 0)} moedas para o saque
            </div>
          </div>

          {/* Próximo agendamento */}
          <div className="bg-[#132236] rounded-2xl border border-white/5" style={{ padding:'1.25rem 1.5rem' }}>
            <div className="flex items-center gap-2 mb-3">
              <CalendarCheck size={16} className="text-purple-400" />
              <p className="text-[11px] font-black text-[#7a9ebf] uppercase tracking-widest">Próximo agendamento</p>
            </div>
            {apptLoading ? (
              <div className="h-6 w-32 bg-slate-700 animate-pulse rounded" />
            ) : nextAppointment?.scheduled_at ? (
              <p className="text-white font-black text-base">
                {new Date(nextAppointment.scheduled_at).toLocaleString('pt-BR', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </p>
            ) : (
              <p className="text-[#4a6580] text-sm font-medium">Nenhum agendado</p>
            )}
          </div>
        </div>
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
