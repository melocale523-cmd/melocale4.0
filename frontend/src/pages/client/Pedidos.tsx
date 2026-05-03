import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService, proposalService } from '../../services/dbServices';
import { FileText, Loader2, ArrowRight, CreditCard, Plus, X, MapPin, Tag, Calendar, MoreVertical, Search, Filter, Inbox, User, DollarSign, Clock, CheckCircle, MessageCircle, Send } from 'lucide-react';
import { payProfessional } from '../../lib/stripe';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
hh
export default function Pedidos() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<any | null>(null);
  const [isProposalsModalOpen, setIsProposalsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    location: '',
    budget_min: '',
    budget_max: ''
  });

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
      setFormData({
        title: '',
        category: '',
        description: '',
        location: '',
        budget_min: '',
        budget_max: ''
      });
      toast.success('Pedido criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar pedido: ${error.message}`);
    }
  });

  const respondMutation = useMutation({
    mutationFn: ({ proposalId, purchaseId, status }: { proposalId: string, purchaseId: string, status: any }) => 
      proposalService.respondProposal(proposalId, purchaseId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', selectedPedido?.id] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Resposta enviada! O profissional agora pode ver seus dados de contato.');
    },
    onError: (error: any) => toast.error(error.message)
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRequestMutation.mutate({
      ...formData,
      budget_min: parseFloat(formData.budget_min),
      budget_max: parseFloat(formData.budget_max)
    } as any);
  };

  const openProposals = (pedido: any) => {
    setSelectedPedido(pedido);
    setIsProposalsModalOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Meus Pedidos</h1>
          <p className="text-slate-400 font-medium">Gerencie e acompanhe suas solicitações de serviço em tempo real.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
        >
          <Plus size={20} />
          Novo Pedido
        </button>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex gap-4">
         <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={20} />
            <input 
               type="text" 
               placeholder="Buscar um pedido específico..."
               className="w-full bg-[#14161B] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
            />
         </div>
         <button className="p-4 bg-[#14161B] border border-white/5 rounded-2xl text-slate-400 hover:text-white transition-all">
            <Filter size={20} />
         </button>
      </div>

      <div className="bg-[#14161B] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="p-20 flex justify-center">
             <LoadingSpinner size={48} label="Sincronizando seus pedidos..." />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {pedidos?.map((pedido) => (
               <div 
                key={pedido.id} 
                onClick={() => openProposals(pedido)}
                className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-white/[0.02] transition-all cursor-pointer group active:bg-white/[0.04]"
               >
                  <div className="flex items-start gap-6">
                     <div className="w-16 h-16 bg-[#0A0B0D] rounded-2xl flex items-center justify-center border border-white/5 text-slate-500 group-hover:text-emerald-500 group-hover:border-emerald-500/30 transition-all shrink-0 shadow-inner">
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
                           <div className="flex items-center text-xs text-slate-500 font-bold">
                              <span className="text-emerald-500 mr-1.5 font-black">ID:</span> #{pedido.id.toString().slice(-6).toUpperCase()}
                           </div>
                           <div className="flex items-center text-xs text-slate-500 font-bold">
                              <MapPin size={14} className="mr-1 text-slate-600" />
                              {pedido.location}
                           </div>
                           <div className="flex items-center text-xs text-slate-500 font-bold">
                              <Tag size={14} className="mr-1 text-slate-600" />
                              {pedido.category}
                           </div>
                           <div className="flex items-center text-xs text-slate-500 font-bold">
                              <Calendar size={14} className="mr-1 text-slate-600" />
                              {new Date(pedido.created_at).toLocaleDateString('pt-BR')}
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-6 border-t lg:border-t-0 border-white/5 pt-6 lg:pt-0">
                    <div className="text-right hidden sm:block">
                       <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Interessados</p>
                       <p className="text-white font-black">{pedido.interested_count ?? 0} Profissionais</p>
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
                      <div className="w-10 h-10 bg-[#0A0B0D] rounded-xl flex items-center justify-center border border-white/5 text-slate-600 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                        <ArrowRight size={20} />
                      </div>
                    </div>
                  </div>
               </div>
            ))}
            {pedidos?.length === 0 && (
              <div className="p-20 text-center flex flex-col items-center justify-center gap-4 grayscale opacity-40">
                <Inbox size={64} className="text-slate-600" />
                <div>
                   <p className="text-white font-black text-lg">Nenhum pedido encontrado</p>
                   <p className="text-slate-500 text-sm font-medium">Você ainda não possui solicitações ativas no momento.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Propostas Recebidas */}
      {isProposalsModalOpen && selectedPedido && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsProposalsModalOpen(false)}></div>
          <div className="relative bg-[#14161B] border border-white/10 rounded-[2.5rem] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-[#14161B]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-500/20 text-blue-500 rounded-2xl flex items-center justify-center">
                  <MessageCircle size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Propostas Recebidas</h2>
                  <p className="text-slate-400 font-medium">{selectedPedido.title}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsProposalsModalOpen(false)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-500 hover:text-white transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-[#0A0B0D]/30">
               {proposalsLoading ? (
                 <div className="py-20 flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-blue-500" size={40} />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Buscando orçamentos...</p>
                 </div>
               ) : proposals && proposals.length > 0 ? (
                 proposals.map((prop: any) => (
                   <div key={prop.id} className="bg-[#14161B] border border-white/5 rounded-[2rem] p-8 hover:border-blue-500/30 transition-all group overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] rounded-full pointer-events-none group-hover:bg-blue-500/10 transition-all"></div>
                      
                      <div className="flex flex-col md:flex-row justify-between gap-8 relative z-10">
                        <div className="flex-1 space-y-6">
                           <div className="flex items-center gap-4">
                              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 relative">
                                 <User className="text-slate-500" size={32} />
                                 <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-[8px] font-black px-1.5 py-0.5 rounded-full text-black uppercase tracking-tighter">Verificado</div>
                              </div>
                              <div>
                                 <h4 className="text-xl font-black text-white">{prop.lead_purchases?.professional?.name || 'Profissional'}</h4>
                                 <p className="text-blue-500 font-bold text-sm">{prop.lead_purchases?.professional?.specialty || 'Especialista'}</p>
                                 <div className="flex items-center gap-3 mt-1">
                                    <div className="flex items-center gap-1">
                                       {Array.from({ length: 5 }).map((_, i) => (
                                          <div key={i} className={cn("w-2 h-2 rounded-full", i < 4 ? "bg-amber-500" : "bg-slate-800")}></div>
                                       ))}
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">4.8 • {prop.lead_purchases?.professional?.completed_services || 0} serviços</span>
                                 </div>
                              </div>
                           </div>

                           <div className="bg-[#0A0B0D] p-6 rounded-2xl border border-white/5">
                              <p className="text-slate-300 text-sm leading-relaxed italic">"{prop.description}"</p>
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><DollarSign size={12} /> Valor do Serviço</p>
                                 <p className="text-xl font-black text-white">R$ {prop.price.toLocaleString('pt-BR')}</p>
                              </div>
                              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Clock size={12} /> Prazo Estimado</p>
                                 <p className="text-xl font-black text-white">{prop.duration}</p>
                              </div>
                           </div>
                        </div>

                        <div className="md:w-64 flex flex-col gap-3 justify-center">
                           {prop.status === 'Enviada' || prop.status === 'Proposta Enviada' ? (
                             <>
                               <button 
                                 onClick={() => respondMutation.mutate({ proposalId: prop.id, purchaseId: prop.purchase_id || prop.lead_purchases?.id || '', status: 'Respondida pelo Cliente' })}
                                 disabled={respondMutation.isPending}
                                 className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
                               >
                                 {respondMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /> Tenho Interesse</>}
                               </button>
                               <button className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-2xl transition-all active:scale-95">
                                 Recusar Proposta
                               </button>
                             </>
                           ) : (
                             <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-4">
                                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                                   <Send size={24} />
                                </div>
                                <div>
                                   <p className="text-sm font-black text-emerald-500 uppercase tracking-widest">Interesse Enviado</p>
                                   <p className="text-[10px] text-slate-500 font-bold mt-1">O profissional já recebeu seus dados de contato.</p>
                                </div>
                                <button className="w-full py-3 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-500 transition-all flex items-center justify-center gap-2">
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
                    <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-xs mx-auto">Assim que os profissionais enviarem orçamentos, eles aparecerão aqui para sua avaliação.</p>
                 </div>
               )}
            </div>
            
            <div className="p-6 bg-[#14161B] border-t border-white/5 flex items-center justify-center">
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Analise com cuidado antes de aceitar • MeloCalé</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Pedido */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-[#14161B] border border-white/10 rounded-[2.5rem] p-8 sm:p-10 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center">
                <FileText size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Nova Solicitação</h2>
                <p className="text-slate-400 font-medium">Preencha os detalhes do que você precisa.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-5">
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Título do Pedido</label>
                <input 
                  required
                  type="text" 
                  placeholder="Ex: Pintura completa de apartamento"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-[#0A0B0D] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Categoria</label>
                <select 
                  required
                  value={formData.category}
                  onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-[#0A0B0D] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium appearance-none"
                >
                  <option value="">Selecione...</option>
                  <option value="Pintura">Pintura</option>
                  <option value="Elétrica">Elétrica</option>
                  <option value="Hidráulica">Hidráulica</option>
                  <option value="Reformas">Reformas</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Localização (Cidade/Estado)</label>
                <input 
                  required
                  type="text" 
                  placeholder="Ex: São Paulo, SP"
                  value={formData.location}
                  onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full bg-[#0A0B0D] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Descrição Detalhada</label>
                <textarea 
                  required
                  rows={4}
                  placeholder="Descreva o serviço com o máximo de detalhes possível..."
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-[#0A0B0D] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Orçamento Mín (R$)</label>
                <input 
                  required
                  type="number" 
                  placeholder="0"
                  value={formData.budget_min}
                  onChange={e => setFormData(prev => ({ ...prev, budget_min: e.target.value }))}
                  className="w-full bg-[#0A0B0D] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Orçamento Máx (R$)</label>
                <input 
                  required
                  type="number" 
                  placeholder="1000"
                  value={formData.budget_max}
                  onChange={e => setFormData(prev => ({ ...prev, budget_max: e.target.value }))}
                  className="w-full bg-[#0A0B0D] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                />
              </div>

              <div className="col-span-2 pt-6">
                <button 
                  disabled={createRequestMutation.isPending}
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-black py-5 rounded-[1.5rem] transition-all shadow-2xl shadow-emerald-500/20 flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  {createRequestMutation.isPending ? <Loader2 size={24} className="animate-spin" /> : <><Plus size={20} /> Publicar Solicitação de Orçamento</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
