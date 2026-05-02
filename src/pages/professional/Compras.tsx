import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService, proposalService } from '../../services/dbServices';
import { ShoppingBag, Loader2, Calendar, Phone, Mail, MapPin, Inbox, Send, DollarSign, Clock, FileText, X, CheckCircle2, Lock, Eye, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ProfessionalCompras() {
  const queryClient = useQueryClient()
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  , setProposalData] = useState({
    price: '',
    duration: '',
    description: '',
    status: 'Proposta Enviada'
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: purchases, isLoading } = useQuery({
    queryKey: ['purchases'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: leadService.getMyPurchases,h
  });

  const sendProposalMutation = useMutation({
    mutationFn: ({ purchaseId, data, clientId }: { purchaseId: string, data: any, clientId?: string }) => 
      proposalService.sendProposal(purchaseId, {
        price: parseFloat(data.price),
        duration: data.duration,
        description: data.description,
        status: 'Proposta Enviada'
      }, clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setIsProposalModalOpen(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setProposalData({ price: '', duration: '', description: '', status: 'Proposta Enviada' });
    },
    onError: (error: any) => alert(`Erro ao enviar proposta: ${error.message}`)
  });

  const [activeTab, setActiveTab] = useState('Todos');
  const tabs = ['Todos', 'Pendente Proposta', 'Proposta Enviada', 'Respondida pelo Cliente'];

  const filteredPurchases = purchases?.filter(p => 
    activeTab === 'Todos' || p.status === activeTab
  );

  const canContact = (status: string) => status === 'Respondida pelo Cliente';

  const handleContact = (phone?: string, email?: string) => {
    console.log('[handleContact] client contact data:', { phone, email });
    if (phone) {
      const formattedPhone = phone.replace(/\D/g, '');
      window.open(`https://wa.me/55${formattedPhone}`, '_blank');
    } else if (email) {
      window.open(`mailto:${email}`, '_blank');
    } else {
      alert('Nenhum dado de contato disponível para este cliente.');
    }
  };

  const openProposalModal = (purchase: any) => {
    setSelectedPurchase(purchase);
    // Reset status to the current purchase status or default to current
    setProposalData(prev => ({ ...prev, status: purchase.status === 'Pendente Proposta' ? 'Proposta Enviada' : purchase.status }));
    setIsProposalModalOpen(true);
  };

  const handleSendProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchase) return;
    sendProposalMutation.mutate({ 
      purchaseId: selectedPurchase.id, 
      data: proposalData,
      clientId: selectedPurchase.leads?.client_id 
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Modal de Envio de Proposta */}
      {isProposalModalOpen && selectedPurchase && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsProposalModalOpen(false)}></div>
          <div className="relative bg-[#14161B] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsProposalModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center">
                <Send size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Enviar Proposta</h2>
                <p className="text-slate-400 text-sm">Pedido #{selectedPurchase.lead_id?.slice(-6).toUpperCase()} - {selectedPurchase.leads?.title}</p>
              </div>
            </div>

            <form onSubmit={handleSendProposal} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                   <DollarSign size={14} /> Valor Estimado (R$)
                </label>
                <input 
                  required
                  type="number" 
                  placeholder="Ex: 1200"
                  value={proposalData.price}
                  onChange={e => setProposalData(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                   <Clock size={14} /> Prazo de Execução
                </label>
                <input 
                  required
                  type="text" 
                  placeholder="Ex: 3 dias úteis"
                  value={proposalData.duration}
                  onChange={e => setProposalData(prev => ({ ...prev, duration: e.target.value }))}
                  className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                   <FileText size={14} /> Descrição Detalhada
                </label>
                <textarea 
                  required
                  rows={4}
                  placeholder="Descreva como você pretende realizar o serviço, materiais inclusos, etc..."
                  value={proposalData.description}
                  onChange={e => setProposalData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                   <FileText size={14} /> 
                </label>
                <select 
                  value={proposalData.status}
                  onChange={e => setProposalData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
                >
                   <option value="Pendente Proposta">Pendente Proposta</option>
                   <option value="Proposta Enviada">Proposta Enviada</option>
                   <option value="Respondida pelo Cliente">Respondida pelo Cliente</option>
                </select>
              </div>

              <div className="pt-4">
                <button 
                  disabled={sendProposalMutation.isPending}
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  {sendProposalMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <><Send size={18} /> Enviar Proposta para o Cliente</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alerta de Sucesso */}
      {showSuccess && (
        <div className="fixed top-6 right-6 z-[110] bg-emerald-500 text-black px-6 py-4 rounded-2xl font-bold shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
           <CheckCircle2 size={24} /> Proposta enviada com sucesso!
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Meus Clientes</h1>
        <div className="text-xs font-bold px-3 py-1 bg-white/5 border border-white/10 text-slate-300 rounded-full">
          {purchases?.length || 0} adquiridos
        </div>
      </div>

      <div className="flex gap-6 border-b border-slate-800 overflow-x-auto pb-px">
         {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                 "pb-3 text-sm font-bold transition-colors border-b-2 whitespace-nowrap",
                 activeTab === tab ? "border-emerald-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
              )}
            >
              {tab}
            </button>
         ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size={32} label="Carregando seus clientes..." />
        </div>
      ) : filteredPurchases && filteredPurchases.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredPurchases.map((purchase) => (
            <div key={purchase.id} className="bg-[#14161B] border border-slate-800/50 rounded-xl p-6 hover:border-emerald-500/30 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-slate-200 font-medium">{purchase.leads?.title}</h3>
                  <div className="flex items-center text-sm text-slate-500 mt-1">
                    <Calendar size={14} className="mr-1.5" />
                    {new Date(purchase.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded text-xs font-medium border border-emerald-500/20">
                    Desbloqueado
                  </span>
                  <div className="flex items-center gap-1.5">
                    {purchase.status === 'Visualizada pelo Cliente' && <Eye size={12} className="text-blue-400" />}
                    {purchase.status === 'Respondida pelo Cliente' && <CheckCircle size={12} className="text-emerald-400" />}
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest",
                      purchase.status === 'Pendente Proposta' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : 
                      purchase.status === 'Proposta Enviada' || purchase.status === 'Enviada' ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                      purchase.status === 'Visualizada pelo Cliente' ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                      "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    )}>
                      {purchase.status}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 bg-[#0A0B0D] p-4 rounded-lg border border-slate-800/50 relative overflow-hidden group/info">
                {!canContact(purchase.status) && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-4 text-center">
                    <Lock size={20} className="text-slate-500 mb-2" />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Bloqueado</p>
                    <p className="text-[9px] text-slate-500 mt-1">Aguarde a resposta do cliente para ver os detalhes de contato.</p>
                  </div>
                )}
                
                <div className="flex items-center text-slate-300">
                  <span className="bg-slate-800 p-1.5 rounded-md mr-3">
                    <Phone size={16} className="text-slate-400" />
                  </span>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">Telefone do Cliente</p>
                    <p className="text-sm font-medium">
                      {canContact(purchase.status) ? (purchase.leads?.clients?.phone ?? purchase.leads?.profiles?.phone) : '(**) *****-****'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-slate-300">
                  <span className="bg-slate-800 p-1.5 rounded-md mr-3">
                    <Mail size={16} className="text-slate-400" />
                  </span>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">E-mail</p>
                    <p className="text-sm font-medium">
                      {canContact(purchase.status) ? (purchase.leads?.clients?.email ?? purchase.leads?.profiles?.email) : '*******@****.com'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-slate-300">
                  <span className="bg-slate-800 p-1.5 rounded-md mr-3">
                    <MapPin size={16} className="text-slate-400" />
                  </span>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">Endereço (Aproximado)</p>
                    <p className="text-sm font-medium">{purchase.leads?.clients?.city || purchase.leads?.profiles?.address || purchase.leads?.location}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button 
                  disabled={!canContact(purchase.status)}
                  onClick={() => handleContact(purchase.leads?.clients?.phone, purchase.leads?.clients?.email)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                    canContact(purchase.status) 
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                      : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
                  )}
                >
                  <Phone size={16} /> {canContact(purchase.status) ? 'Contactar Agora' : (purchase.proposals_count ?? 0) > 0 ? 'Aguardando Resposta' : 'Enviar Proposta'}
                </button>
                {purchase.status === 'Pendente Proposta' && (
                  <button 
                    onClick={() => openProposalModal(purchase)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg text-sm font-bold transition-all border border-white/10 flex items-center justify-center gap-2"
                  >
                    <Send size={16} /> Enviar Proposta
                  </button>
                )}
                {purchase.status === 'Proposta Enviada' && (
                  <div className="flex-1 bg-blue-500/5 text-blue-500 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-500/20 flex items-center justify-center gap-2">
                    <Clock size={14} /> Enviada
                  </div>
                )}
                {purchase.status === 'Visualizada pelo Cliente' && (
                  <div className="flex-1 bg-indigo-500/5 text-indigo-400 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-500/20 flex items-center justify-center gap-2 animate-pulse">
                    <Eye size={14} /> Visualizada
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
          <Inbox className="text-slate-700 mb-4" size={48} />
          <p className="text-slate-500 font-medium">Nenhum cliente nesta categoria.</p>
        </div>
      )}
    </div>
  );
}
