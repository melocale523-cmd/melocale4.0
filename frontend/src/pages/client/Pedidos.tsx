import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService, proposalService } from '../../services/dbServices';
import { supabase } from '../../lib/supabase';
import { FileText, Loader2, ArrowRight, Plus, X, MapPin, Tag, Calendar, Search, Inbox, User, DollarSign, Clock, CheckCircle, MessageCircle, Send, MoreVertical, Pencil, Trash2, Star, Briefcase } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import RequestWizard, { WizardData } from '../../components/RequestWizard';
import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface PedidoItem {
  id: string;
  title: string;
  category: string;
  description: string;
  location: string;
  budget_min: number;
  budget_max: number;
  status: string;
  created_at: string;
  interested_count?: number;
  images?: string[];
}

const STATUS_TABS = ['Todos', 'Aberto', 'Orçando', 'Finalizado'] as const;

interface TimelineStage {
  label: string;
  icon: ReactNode;
  done: boolean;
  date?: string;
}

function LeadTimeline({ pedido, appointment }: {
  pedido: PedidoItem;
  appointment: { scheduled_at: string } | null | undefined;
}) {
  const isInterested = pedido.status === 'orçando' || pedido.status === 'finalizado';
  const isScheduled = !!appointment;
  const isCompleted = pedido.status === 'finalizado';

  const stages: TimelineStage[] = [
    {
      label: 'Publicado',
      icon: <FileText size={13} />,
      done: true,
      date: new Date(pedido.created_at).toLocaleDateString('pt-BR'),
    },
    {
      label: 'Com Interesse',
      icon: <User size={13} />,
      done: isInterested,
    },
    {
      label: 'Agendado',
      icon: <Calendar size={13} />,
      done: isScheduled,
      date: isScheduled ? new Date(appointment!.scheduled_at).toLocaleDateString('pt-BR') : undefined,
    },
    {
      label: 'Concluído',
      icon: <CheckCircle size={13} />,
      done: isCompleted,
    },
  ];

  return (
    <div className="w-full py-2">
      <div className="flex items-center">
        {stages.map((stage, i) => (
          <div key={stage.label} className={cn('flex items-center', i < stages.length - 1 ? 'flex-1' : '')}>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0',
                stage.done
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-[#0E1C32] border-[#1C3050] text-[#4A6580]',
              )}>
                {stage.icon}
              </div>
              <p className={cn('text-[9px] font-bold text-center whitespace-nowrap', stage.done ? 'text-emerald-400' : 'text-[#4A6580]')}>
                {stage.label}
              </p>
              <p className="text-[8px] text-[#4A6580] text-center whitespace-nowrap h-3">
                {stage.date ?? ''}
              </p>
            </div>
            {i < stages.length - 1 && (
              <div className={cn(
                'h-0.5 flex-1 mx-2 -mt-7 rounded-full',
                stage.done ? 'bg-emerald-500/50' : 'bg-[#1C3050]',
              )} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const proposalStatusConfig: Record<string, { label: string; className: string }> = {
  'Proposta Enviada': { label: 'Aguardando', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
  'Enviada':          { label: 'Aguardando', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
  'Aceita':           { label: 'Aceita',     className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  'Recusada':         { label: 'Recusada',   className: 'bg-red-500/20 text-red-400 border border-red-500/30' },
};

function ProfileModal({ userId, name, avatar, onClose }: {
  userId: string;
  name: string;
  avatar: string | null;
  onClose: () => void;
}) {
  const [prof, setProf] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('professionals')
      .select('id, bio, category, city, is_active')
      .eq('user_id', userId)
      .single()
      .then(({ data: profData }) => {
        setProf(profData);
        if (profData?.id) {
          supabase
            .from('reviews')
            .select('id, rating, comment, created_at, client_name')
            .eq('professional_id', profData.id)
            .order('created_at', { ascending: false })
            .limit(5)
            .then(({ data }) => setReviews(data || []));
        }
        setLoading(false);
      });
  }, [userId]);

  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#1C3454] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">

        <div className="h-20 bg-gradient-to-r from-slate-800 to-emerald-900/30 shrink-0" />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-black/30 hover:bg-black/50 text-white transition-all"
        >
          <X size={18} />
        </button>

        <div className="px-6 -mt-10 pb-4 border-b border-slate-700/50 shrink-0">
          <div className="flex items-end gap-4 mb-3">
            <div className="w-20 h-20 rounded-full border-4 border-[#1C3454] bg-emerald-600 flex items-center justify-center text-white font-bold text-xl overflow-hidden shrink-0">
              {avatar
                ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
                : initials}
            </div>
            <div className="pb-1">
              <h3 className="text-xl font-black text-white">{name}</h3>
              {prof && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {prof.category && (
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                      <Briefcase size={12} /> {prof.category}
                    </span>
                  )}
                  {prof.city && (
                    <span className="text-xs text-[#94A3B8] flex items-center gap-1">
                      <MapPin size={12} /> {prof.city}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {reviews.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={14} className={s <= Math.round(avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600 fill-slate-600'} />
                ))}
              </div>
              <span className="text-yellow-400 font-bold text-sm">{avgRating.toFixed(1)}</span>
              <span className="text-[#4A6580] text-xs">({reviews.length} avaliação{reviews.length !== 1 ? 'ões' : ''})</span>
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-emerald-500" size={28} />
            </div>
          ) : (
            <>
              {prof?.bio && (
                <div>
                  <p className="text-xs font-bold text-[#4A6580] uppercase tracking-widest mb-2">Sobre</p>
                  <p className="text-sm text-[#94A3B8] leading-relaxed">{prof.bio}</p>
                </div>
              )}

              {reviews.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-[#4A6580] uppercase tracking-widest mb-3">Avaliações</p>
                  <div className="space-y-3">
                    {reviews.map(r => (
                      <div key={r.id} className="bg-[#0E1C32] rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-200">{r.client_name ?? 'Cliente'}</span>
                          <span className="text-xs text-[#4A6580]">
                            {new Date(r.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <div className="flex">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={12} className={s <= r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700 fill-slate-700'} />
                          ))}
                        </div>
                        {r.comment && <p className="text-xs text-[#94A3B8]">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!prof?.bio && reviews.length === 0 && !loading && (
                <p className="text-center text-[#4A6580] text-sm py-4">Nenhuma informação adicional disponível.</p>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-700/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Pedidos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<PedidoItem | null>(null);
  const [isProposalsModalOpen, setIsProposalsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [editingPedido, setEditingPedido] = useState<PedidoItem | null>(null);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [profileModal, setProfileModal] = useState<{
    userId: string;
    name: string;
    avatar: string | null;
  } | null>(null);

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ['pedidos'],
    queryFn: leadService.getMyRequests,
  });

  const { data: proposals, isLoading: proposalsLoading } = useQuery({
    queryKey: ['proposals', selectedPedido?.id],
    queryFn: () => selectedPedido ? proposalService.getProposalsForLead(selectedPedido.id) : Promise.resolve([]),
    enabled: !!selectedPedido && isProposalsModalOpen,
  });

  const { data: linkedAppointment } = useQuery({
    queryKey: ['lead_appointment', selectedPedido?.id],
    queryFn: async () => {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .eq('lead_id', selectedPedido!.id);
      if (!convs?.length) return null;
      const { data } = await supabase
        .from('appointments')
        .select('scheduled_at')
        .in('conversation_id', convs.map((c: { id: string }) => c.id))
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!selectedPedido?.id && isProposalsModalOpen,
  });

  const createRequestMutation = useMutation({
    mutationFn: leadService.createRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['clientSummary'] });
      setIsModalOpen(false);
      toast.success('Pedido criado com sucesso!');
    },
    onError: (error: Error) => {
      if (error.message.includes('Sessão expirada')) {
        supabase.auth.signOut();
        toast.error('Sua sessão expirou. Faça login novamente.');
      } else {
        toast.error(`Erro ao criar pedido: ${error.message}`);
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { title: string; description: string; category: string; location: string; budget_min: number; budget_max: number; images?: string[]; metadata?: Record<string, string> } }) =>
      leadService.updateRequest(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      setIsModalOpen(false);
      setEditingPedido(null);
      toast.success('Pedido atualizado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar pedido: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadService.deleteRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Pedido arquivado.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const acceptMutation = useMutation({
    mutationFn: ({ purchaseId }: { purchaseId: string }) =>
      proposalService.respondProposal('', purchaseId, 'Aceita'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', selectedPedido?.id] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Interesse enviado! O profissional já pode ver seus dados de contato.');
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const refuseMutation = useMutation({
    mutationFn: ({ purchaseId }: { purchaseId: string }) =>
      proposalService.respondProposal('', purchaseId, 'Recusada'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', selectedPedido?.id] });
      toast.success('Proposta recusada.');
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPedido(null);
  };

  const openEditModal = (pedido: PedidoItem) => {
    setEditingPedido(pedido);
    setIsModalOpen(true);
    setContextMenuId(null);
  };

  const handleDelete = (pedido: PedidoItem) => {
    setContextMenuId(null);
    if (!window.confirm(`Arquivar "${pedido.title}"?`)) return;
    deleteMutation.mutate(pedido.id);
  };

  const handleWizardSubmit = (wizardData: WizardData) => {
    const metadata: Record<string, string> = {
      urgency: wizardData.urgency,
      work_size: wizardData.work_size,
      availability: wizardData.availability,
      local_condition: wizardData.local_condition,
      purchase_decision: wizardData.purchase_decision,
    };

    if (editingPedido) {
      updateMutation.mutate({
        id: editingPedido.id,
        updates: {
          title: wizardData.title,
          category: wizardData.category,
          description: wizardData.description,
          location: wizardData.location,
          budget_min: parseFloat(wizardData.budget_min) || 0,
          budget_max: parseFloat(wizardData.budget_max) || 0,
          images: wizardData.images,
          metadata,
        },
      });
    } else {
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
    }
  };

  const isMutating = createRequestMutation.isPending || updateMutation.isPending;

  const openProposals = (pedido: PedidoItem) => {
    setSelectedPedido(pedido);
    setIsProposalsModalOpen(true);
  };

  const filteredPedidos = ((pedidos as PedidoItem[]) ?? []).filter(p =>
    (statusFilter === 'todos' ||
      (statusFilter === 'Aberto' && (p.status === 'open' || p.status === 'aberto')) ||
      (statusFilter === 'Orçando' && p.status === 'orçando') ||
      (statusFilter === 'Finalizado' && p.status === 'finalizado') ||
      p.status === statusFilter) &&
    (p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const wizardInitialData: Partial<WizardData> | undefined = editingPedido ? {
    title: editingPedido.title,
    category: editingPedido.category,
    description: editingPedido.description,
    location: editingPedido.location,
    budget_min: String(editingPedido.budget_min ?? 0),
    budget_max: String(editingPedido.budget_max ?? 5000),
    images: editingPedido.images ?? [],
  } : undefined;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Meus Pedidos</h1>
          <p className="text-[#94A3B8] font-medium">Gerencie e acompanhe suas solicitações de serviço em tempo real.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
        >
          <Plus size={20} />
          Novo Pedido
        </button>
      </div>

      <div className="space-y-4">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Buscar um pedido específico..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[#1C3454] border border-[#1C3050] rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab === 'Todos' ? 'todos' : tab)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all",
                (statusFilter === 'todos' && tab === 'Todos') || statusFilter === tab
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                  : "bg-[#1C3454] border border-[#1C3050] text-[#94A3B8] hover:text-white hover:border-white/20"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#1C3454] border border-[#1C3050] rounded-[2.5rem] overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="p-20 flex justify-center">
            <LoadingSpinner size={48} label="Sincronizando seus pedidos..." />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {filteredPedidos.map((pedido) => (
              <div
                key={pedido.id}
                onClick={() => openProposals(pedido)}
                className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-white/[0.02] transition-all cursor-pointer group active:bg-white/[0.04]"
              >
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 bg-[#0E1C32] rounded-2xl flex items-center justify-center border border-[#1C3050] text-[#4A6580] group-hover:text-emerald-500 group-hover:border-emerald-500/30 transition-all shrink-0 shadow-inner">
                    <FileText size={28} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors truncate">{pedido.title}</h3>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/5 text-emerald-500 border border-emerald-500/10",
                        pedido.status === 'Orçando' && "bg-cyan-500/5 text-cyan-400 border border-cyan-500/10",
                        pedido.status === 'in_progress' && "bg-blue-500/5 text-blue-400 border border-blue-500/10"
                      )}>
                        {pedido.status === 'open' ? 'Aberto' : pedido.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-y-2 gap-x-4">
                      <div className="flex items-center text-xs text-[#4A6580] font-bold">
                        <span className="text-emerald-500 mr-1.5 font-black">ID:</span> #{pedido.id.toString().slice(-6).toUpperCase()}
                      </div>
                      <div className="flex items-center text-xs text-[#4A6580] font-bold">
                        <MapPin size={14} className="mr-1 text-slate-600" />
                        {pedido.location}
                      </div>
                      <div className="flex items-center text-xs text-[#4A6580] font-bold">
                        <Tag size={14} className="mr-1 text-slate-600" />
                        {pedido.category}
                      </div>
                      <div className="flex items-center text-xs text-[#4A6580] font-bold">
                        <Calendar size={14} className="mr-1 text-slate-600" />
                        {new Date(pedido.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-6 border-t lg:border-t-0 border-[#1C3050] pt-6 lg:pt-0">
                  <div className="text-right hidden md:block">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Interessados</p>
                    <p className="text-white font-black">{pedido.interested_count ?? 0} Profissionais</p>
                  </div>

                  <div className="md:hidden text-left">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Interessados</p>
                    <p className="text-white font-black text-sm">{pedido.interested_count ?? 0} Profissionais</p>
                  </div>

                  <div className="flex items-center gap-4">

                    <div className="relative z-20" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setContextMenuId(contextMenuId === pedido.id ? null : pedido.id)}
                        className="w-10 h-10 bg-[#0E1C32] rounded-xl flex items-center justify-center border border-[#1C3050] text-slate-600 hover:text-white hover:border-white/20 transition-all"
                      >
                        <MoreVertical size={18} />
                      </button>
                      {contextMenuId === pedido.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-[#1C1E25] border border-[#243F6A] rounded-2xl shadow-2xl overflow-hidden z-30">
                          <button
                            onClick={() => openEditModal(pedido)}
                            className="w-full px-4 py-3 flex items-center gap-3 text-sm text-slate-300 hover:bg-white/5 transition-all text-left"
                          >
                            <Pencil size={14} className="text-[#94A3B8] shrink-0" /> Editar
                          </button>
                          <button
                            onClick={() => handleDelete(pedido)}
                            className="w-full px-4 py-3 flex items-center gap-3 text-sm text-red-400 hover:bg-red-500/10 transition-all text-left"
                          >
                            <Trash2 size={14} className="shrink-0" /> Excluir
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="w-10 h-10 bg-[#0E1C32] rounded-xl flex items-center justify-center border border-[#1C3050] text-slate-600 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                      <ArrowRight size={20} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filteredPedidos.length === 0 && (
              <div className="p-20 text-center flex flex-col items-center justify-center gap-4 grayscale opacity-40">
                <Inbox size={64} className="text-slate-600" />
                <div>
                  <p className="text-white font-black text-lg">Nenhum pedido encontrado</p>
                  <p className="text-[#4A6580] text-sm font-medium">Você ainda não possui solicitações ativas no momento.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isProposalsModalOpen && selectedPedido && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsProposalsModalOpen(false)}></div>
          <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-[2.5rem] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-[#1C3050] flex items-center justify-between bg-[#1C3454]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-500/20 text-blue-500 rounded-2xl flex items-center justify-center">
                  <MessageCircle size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Propostas Recebidas</h2>
                  <p className="text-[#94A3B8] font-medium">{selectedPedido.title}</p>
                </div>
              </div>
              <button
                onClick={() => setIsProposalsModalOpen(false)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[#4A6580] hover:text-white transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="px-8 py-4 border-b border-[#1C3050] bg-[#0E1C32]/20">
              <p className="text-[10px] font-bold text-[#4A6580] uppercase tracking-widest mb-2">Progresso do pedido</p>
              <LeadTimeline pedido={selectedPedido} appointment={linkedAppointment} />
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-[#0E1C32]/30">
              {proposalsLoading ? (
                <div className="py-20 flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin text-blue-500" size={40} />
                  <p className="text-xs font-black uppercase tracking-widest text-[#4A6580]">Buscando orçamentos...</p>
                </div>
              ) : proposals && proposals.length > 0 ? (
                proposals.map((prop: any) => (
                  <div key={prop.id} className="bg-[#1C3454] border border-[#1C3050] rounded-[2rem] p-8 hover:border-blue-500/30 transition-all group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] rounded-full pointer-events-none group-hover:bg-blue-500/10 transition-all"></div>

                    <div className="flex flex-col md:flex-row justify-between gap-8 relative z-10">
                      <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl border border-[#1C3050] relative shrink-0">
                            {(prop as any).profiles?.avatar_url ? (
                              <img src={(prop as any).profiles.avatar_url} loading="lazy" className="w-16 h-16 rounded-2xl object-cover" alt="avatar" />
                            ) : (
                              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center">
                                <User className="text-[#4A6580]" size={32} />
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-[8px] font-black px-1.5 py-0.5 rounded-full text-black uppercase tracking-tighter">Verificado</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xl font-black text-white">{(prop as any).profiles?.full_name || 'Profissional'}</h4>
                              {(prop as any).profiles?.id && (
                                <button
                                  type="button"
                                  onClick={() => setProfileModal({
                                    userId: (prop as any).profiles.id,
                                    name: (prop as any).profiles?.full_name || 'Profissional',
                                    avatar: (prop as any).profiles?.avatar_url ?? null,
                                  })}
                                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/50 px-2 py-0.5 rounded-full transition-all"
                                >
                                  Ver perfil
                                </button>
                              )}
                              {(() => {
                                const cfg = proposalStatusConfig[prop.status] ?? { label: 'Aguardando', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' };
                                return (
                                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.className}`}>
                                    {cfg.label}
                                  </span>
                                );
                              })()}
                            </div>
                            <p className="text-blue-500 font-bold text-sm">Especialista verificado</p>
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <div key={i} className={cn("w-2 h-2 rounded-full", i < 4 ? "bg-amber-500" : "bg-slate-800")}></div>
                                ))}
                              </div>
                              <span className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest">4.8 • {prop.lead_purchases?.professional?.completed_services || 0} serviços</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-[#0E1C32] p-6 rounded-2xl border border-[#1C3050]">
                          <p className="text-slate-300 text-sm leading-relaxed italic">"{prop.description}"</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 p-4 rounded-xl border border-[#1C3050]">
                            <p className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest mb-1 flex items-center gap-1.5"><DollarSign size={12} /> Valor do Serviço</p>
                            <p className="text-xl font-black text-white">R$ {(prop.price ?? 0).toLocaleString('pt-BR')}</p>
                          </div>
                          <div className="bg-white/5 p-4 rounded-xl border border-[#1C3050]">
                            <p className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest mb-1 flex items-center gap-1.5"><Clock size={12} /> Prazo Estimado</p>
                            <p className="text-xl font-black text-white">{prop.duration}</p>
                          </div>
                        </div>
                      </div>

                      <div className="md:w-64 flex flex-col gap-3 justify-center">
                        {prop.status === 'Enviada' || prop.status === 'Proposta Enviada' ? (
                          <>
                            <button
                              onClick={() => acceptMutation.mutate({ purchaseId: prop.id })}
                              disabled={acceptMutation.isPending || refuseMutation.isPending}
                              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
                            >
                              {acceptMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /> Tenho Interesse</>}
                            </button>
                            <button
                              onClick={() => refuseMutation.mutate({ purchaseId: prop.id })}
                              disabled={refuseMutation.isPending || acceptMutation.isPending}
                              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                              {refuseMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : 'Recusar Proposta'}
                            </button>
                          </>
                        ) : prop.status === 'Recusada' ? (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center space-y-3">
                            <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto">
                              <X size={24} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-red-400 uppercase tracking-widest">Proposta Recusada</p>
                              <p className="text-[10px] text-[#4A6580] font-bold mt-1">Você recusou esta proposta.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-4">
                            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                              <Send size={24} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-emerald-500 uppercase tracking-widest">Interesse Enviado</p>
                              <p className="text-[10px] text-[#4A6580] font-bold mt-1">O profissional já recebeu seus dados de contato.</p>
                            </div>
                            <button
                              onClick={async () => {
                                let chatId = (prop as any).chat_id as string | null;
                                if (!chatId) {
                                  chatId = await proposalService.ensureChatForPurchase(prop.id);
                                }
                                if (chatId) navigate(`/cliente/mensagens?chatId=${chatId}`);
                              }}
                              className="w-full py-3 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-500 transition-all flex items-center justify-center gap-2"
                            >
                              <MessageCircle size={14} /> Abrir Chat
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-4 opacity-50 grayscale">
                  <Inbox size={64} className="text-slate-700" />
                  <p className="text-white font-black text-lg">Nenhuma proposta ainda</p>
                  <p className="text-[#4A6580] text-sm font-medium leading-relaxed max-w-xs mx-auto">Assim que os profissionais enviarem orçamentos, eles aparecerão aqui para sua avaliação.</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-[#1C3454] border-t border-[#1C3050] flex items-center justify-center">
              <p className="text-[10px] text-[#4A6580] font-bold uppercase tracking-[0.2em]">Analise com cuidado antes de aceitar • MeloCalé</p>
            </div>
          </div>
        </div>
      )}

      {contextMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setContextMenuId(null)} />
      )}

      {isModalOpen && (
        <RequestWizard
          onSubmit={handleWizardSubmit}
          onClose={closeModal}
          isPending={isMutating}
          isUploading={false}
          onImageUpload={() => undefined}
          initialData={wizardInitialData}
        />
      )}

      {profileModal && (
        <ProfileModal
          userId={profileModal.userId}
          name={profileModal.name}
          avatar={profileModal.avatar}
          onClose={() => setProfileModal(null)}
        />
      )}
    </div>
  );
}
