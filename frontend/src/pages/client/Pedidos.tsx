import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService, proposalService } from '../../services/dbServices';
import { supabase } from '../../lib/supabase';
import { FileText, Loader2, ArrowRight, CreditCard, Plus, X, MapPin, Tag, Calendar, Search, Inbox, User, DollarSign, Clock, CheckCircle, MessageCircle, Send, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { payProfessional } from '../../lib/stripe';
import LoadingSpinner from '../../components/LoadingSpinner';
import RequestWizard, { WizardData } from '../../components/RequestWizard';
import { useState } from 'react';
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

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ['pedidos'],
    queryFn: leadService.getMyRequests,
  });

  const { data: proposals, isLoading: proposalsLoading } = useQuery({
    queryKey: ['proposals', selectedPedido?.id],
    queryFn: () => selectedPedido ? proposalService.getProposalsForLead(selectedPedido.id) : Promise.resolve([]),
    enabled: !!selectedPedido && isProposalsModalOpen,
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
      (statusFilter === 'Aberto' && p.status === 'open') ||
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
                    {pedido.status === 'Finalizado' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          payProfessional(500, 'acct_mock', pedido.title);
                        }}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl flex items-center gap-2 transition-all shadow-xl shadow-emerald-500/20 uppercase tracking-widest active:scale-90"
                      >
                        <CreditCard size={14} />
                        Pagar R$ 500
                      </button>
                    )}

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
                              <img src={(prop as any).profiles.avatar_url} className="w-16 h-16 rounded-2xl object-cover" alt="avatar" />
                            ) : (
                              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center">
                                <User className="text-[#4A6580]" size={32} />
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-[8px] font-black px-1.5 py-0.5 rounded-full text-black uppercase tracking-tighter">Verificado</div>
                          </div>
                          <div>
                            <h4 className="text-xl font-black text-white">{(prop as any).profiles?.full_name || 'Profissional'}</h4>
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
    </div>
  );
}
