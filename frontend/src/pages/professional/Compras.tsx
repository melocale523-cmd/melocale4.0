import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService, proposalService } from '../../services/dbServices';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Loader2, Calendar, Phone, Mail, MapPin, Inbox, Send, DollarSign, Clock, FileText, X, CheckCircle2, Eye, CheckCircle, MessageCircle, Zap, Camera } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'sonner';

interface Purchase {
  id: string;
  lead_id: string;
  status?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  max_purchases?: number | null;
  purchases_count?: number | null;
  location?: string | null;
  images?: string[] | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  event_date?: string | null;
  contacted_at?: string | null;
  chat_id?: string | null;
  leads?: {
    title?: string | null;
    location?: string | null;
    clients?: { phone?: string | null; email?: string | null; full_name?: string | null; city?: string | null } | null;
    profiles?: { phone?: string | null; email?: string | null; name?: string | null; address?: string | null } | null;
  } | null;
}

interface ProposalInput {
  price: string;
  duration: string;
  durationUnit: string;
  description: string;
  status: string;
}

export default function ProfessionalCompras() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [proposalData, setProposalData] = useState({
    price: '',
    duration: '',
    durationUnit: 'dias',
    description: '',
    status: 'Proposta Enviada'
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: purchases, isLoading } = useQuery<Purchase[]>({
    queryKey: ['purchases', user?.id],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: leadService.getMyPurchases,
  });

  const sendProposalMutation = useMutation({
    mutationFn: ({ purchaseId, data }: { purchaseId: string, data: ProposalInput }) =>
      proposalService.sendProposal(purchaseId, {
        price: parseFloat(data.price),
        duration: `${data.duration} ${data.durationUnit}`,
        description: data.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setIsProposalModalOpen(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setProposalData({ price: '', duration: '', durationUnit: 'dias', description: '', status: 'Proposta Enviada' });
    },
    onError: (error: Error) => toast.error(`Erro ao enviar proposta: ${error.message}`)
  });

  const STATUS_TABS = ['Todos', 'Pendente Proposta', 'Proposta Enviada', 'Aceita', 'Recusada'] as const;
  type StatusTab = typeof STATUS_TABS[number];
  const [activeTab, setActiveTab] = useState<StatusTab>('Todos');

  const filteredPurchases = (purchases ?? []).filter(p => {
    if (activeTab === 'Todos') return true;
    if (activeTab === 'Proposta Enviada') return p.status === 'Proposta Enviada' || p.status === 'Enviada';
    return p.status === activeTab;
  });

  const canContact = (_status: string) => true;

  const formatPhone = (raw: unknown): string => {
    if (typeof raw !== 'string') return '';
    const d = raw.replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return raw;
  };

  const trackContactMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      const { error } = await supabase
        .from('lead_purchases')
        .update({ contacted_at: new Date().toISOString() })
        .eq('id', purchaseId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchases'] }),
  });

  const handleContact = (purchase: Purchase) => {
    try {
      const rawPhone = purchase.leads?.clients?.phone ?? purchase.leads?.profiles?.phone;
      const rawEmail = purchase.leads?.clients?.email ?? purchase.leads?.profiles?.email;
      const safePhone = typeof rawPhone === 'string' ? rawPhone : '';
      const safeEmail = typeof rawEmail === 'string' ? rawEmail : '';
      const digits = safePhone.replace(/\D/g, '');
      const clientName = purchase.leads?.clients?.full_name ?? purchase.leads?.profiles?.name ?? 'cliente';
      const serviceName = typeof purchase.leads?.title === 'string' ? purchase.leads.title : 'serviço';
      const message = `Olá ${clientName}, vi seu pedido de ${serviceName} na MeloCalé e posso te ajudar. Vamos conversar?`;
      if (digits) {
        trackContactMutation.mutate(purchase.id);
        window.open(`https://wa.me/55${digits}?text=${encodeURIComponent(message)}`, '_blank');
      } else if (safeEmail) {
        trackContactMutation.mutate(purchase.id);
        window.open(`mailto:${safeEmail}`, '_blank');
      } else {
        toast.error('Nenhum dado de contato disponível para este cliente.');
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('[handleContact]', err);
      toast.error('Erro ao abrir contato. Tente novamente.');
    }
  };

  const openProposalModal = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    // Reset status to the current purchase status or default to current
    setProposalData(prev => ({ ...prev, status: purchase.status === 'Pendente Proposta' ? 'Proposta Enviada' : (purchase.status ?? 'Proposta Enviada') }));
    setIsProposalModalOpen(true);
  };

  const handleSendProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchase) return;
    const price = parseFloat(proposalData.price);
    if (!proposalData.price || isNaN(price) || price <= 0) {
      toast.error('O valor da proposta deve ser maior que zero.');
      return;
    }
    sendProposalMutation.mutate({
      purchaseId: selectedPurchase.id,
      data: proposalData,
    });
  };

  return (
    <div className="w-full space-y-3">
      {/* Modal de Envio de Proposta */}
      {isProposalModalOpen && selectedPurchase && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-9">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsProposalModalOpen(false)}></div>
          <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-2xl p-11 sm:p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsProposalModalOpen(false)}
              className="absolute top-4 right-4 text-[#4A6580] hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-8 mb-11">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center">
                <Send size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Enviar Proposta</h2>
                <p className="text-[#94A3B8] text-sm">Pedido #{selectedPurchase.lead_id?.slice(-6).toUpperCase()} - {selectedPurchase.leads?.title}</p>
              </div>
            </div>

            <form onSubmit={handleSendProposal} className="space-y-10">
              <div className="space-y-7">
                <label className="text-xs font-bold text-[#4A6580] uppercase tracking-widest pl-1 flex items-center gap-7">
                   <DollarSign size={14} /> Valor Estimado (R$)
                </label>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Ex: 1200"
                  value={proposalData.price}
                  onChange={e => setProposalData(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-9 py-8 text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div className="space-y-7">
                <label className="text-xs font-bold text-[#4A6580] uppercase tracking-widest pl-1 flex items-center gap-7">
                   <Clock size={14} /> Prazo de Execução
                </label>
                <div className="flex gap-7">
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="Ex: 3"
                    value={proposalData.duration}
                    onChange={e => setProposalData(prev => ({ ...prev, duration: e.target.value }))}
                    className="w-24 bg-[#0E1C32] border border-[#1C3050] rounded-xl px-9 py-8 text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <select
                    value={proposalData.durationUnit}
                    onChange={e => setProposalData(prev => ({ ...prev, durationUnit: e.target.value }))}
                    className="flex-1 bg-[#0E1C32] border border-[#1C3050] rounded-xl px-8 py-8 text-white focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
                  >
                    <option value="horas">Horas</option>
                    <option value="dias">Dias</option>
                    <option value="dias úteis">Dias úteis</option>
                    <option value="semanas">Semanas</option>
                    <option value="meses">Meses</option>
                  </select>
                </div>
              </div>

              <div className="space-y-7">
                <label className="text-xs font-bold text-[#4A6580] uppercase tracking-widest pl-1 flex items-center gap-7">
                   <FileText size={14} /> Descrição Detalhada
                </label>
                <textarea 
                  required
                  rows={4}
                  placeholder="Descreva como você pretende realizar o serviço, materiais inclusos, etc..."
                  value={proposalData.description}
                  onChange={e => setProposalData(prev => ({ ...prev, description: e.target.value }))}
                  maxLength={2000}
                  className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-9 py-8 text-white focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                />
              </div>

              <div className="space-y-7">
                <label className="text-xs font-bold text-[#4A6580] uppercase tracking-widest pl-1 flex items-center gap-7">
                   <FileText size={14} /> Status
                </label>
                <div className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-9 py-8 text-blue-400 text-sm font-semibold">
                  Proposta Enviada
                </div>
              </div>

              <div className="pt-4">
                <button 
                  disabled={sendProposalMutation.isPending}
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold py-9 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-7"
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
        <div className="fixed top-6 right-6 z-[110] bg-emerald-500 text-black px-11 py-9 rounded-2xl font-bold shadow-2xl flex items-center gap-8 animate-in fade-in slide-in-from-right-4">
           <CheckCircle2 size={24} /> Proposta enviada com sucesso!
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold text-white">Meus Clientes</h1>
        <div className="text-xs font-bold px-4 py-2 bg-white/5 border border-[#243F6A] text-slate-300 rounded-full">
          {purchases?.length || 0} adquiridos
        </div>
      </div>

      <div className="flex gap-2 flex-wrap" style={{ marginTop: '0.75rem' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              activeTab === tab
                ? "bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                : "bg-transparent text-slate-400 border border-[#243F6A] hover:border-emerald-500/50 px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
            )}
          >
            {tab}
            {tab !== 'Todos' && (
              <span className="ml-1.5 opacity-70">
                ({(purchases ?? []).filter(p =>
                  tab === 'Proposta Enviada'
                    ? p.status === 'Proposta Enviada' || p.status === 'Enviada'
                    : p.status === tab
                ).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size={32} label="Carregando seus clientes..." />
        </div>
      ) : filteredPurchases.length > 0 ? (
        <div className="grid gap-9 md:grid-cols-2">
          {filteredPurchases.map((purchase) => (
            <div
              key={purchase.id}
              className={cn(
                "bg-gradient-to-b from-[#1C3454] to-[#0E1C32] border border-[#243F6A] rounded-2xl",
                purchase.status === 'Respondida pelo Cliente' && "ring-2 ring-emerald-500/40"
              )}
            >
              {/* Top gradient bar */}
              <div style={{ height: '4px', background: 'linear-gradient(90deg, #10b981, #059669)' }} />

              <div className="p-6 space-y-5">

                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-800 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {(purchase.leads?.title ?? 'S')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium text-sm leading-snug truncate">{purchase.leads?.title}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-[#4A6580] mt-0.5">
                      <Calendar size={12} />
                      {new Date(purchase.created_at || '').toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded text-xs font-medium border border-emerald-500/20">
                      Desbloqueado
                    </span>
                    <div className="flex items-center gap-1">
                      {purchase.status === 'Visualizada pelo Cliente' && <Eye size={10} className="text-blue-400" />}
                      {purchase.status === 'Respondida pelo Cliente' && <CheckCircle size={10} className="text-emerald-400" />}
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest",
                        purchase.status === 'Pendente Proposta' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                        purchase.status === 'Proposta Enviada' || purchase.status === 'Enviada' ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                        purchase.status === 'Visualizada pelo Cliente' ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                        purchase.status === 'Aceita' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                        purchase.status === 'Recusada' ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                        "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                      )}>
                        {purchase.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detalhes do Serviço */}
                <div className="bg-[#0E1C32] border border-[#1C3050] rounded-xl p-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580]">Detalhes do Serviço</p>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580]">💰 Orçamento</p>
                      <p className="text-sm font-medium text-white">
                        {purchase.budget_min && purchase.budget_max
                          ? `R$ ${purchase.budget_min.toLocaleString('pt-BR')} – R$ ${purchase.budget_max.toLocaleString('pt-BR')}`
                          : 'A combinar'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580]">📍 Localização</p>
                      <p className="text-sm font-medium text-white">
                        {purchase.city && purchase.state
                          ? `${purchase.city} - ${purchase.state}`
                          : purchase.location || '—'}
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const max = purchase.max_purchases as number | undefined;
                    const count = purchase.purchases_count as number | undefined;
                    if (max == null || count == null) return null;
                    const remaining = max - count;
                    return (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580]">👥 Concorrência</p>
                        {remaining <= 1
                          ? <p className="text-sm font-medium text-emerald-400">🏆 Você é o único profissional com acesso</p>
                          : <p className="text-sm font-medium text-white">{remaining} profissionais também viram</p>
                        }
                      </div>
                    );
                  })()}

                  {(() => {
                    if (!purchase.expires_at) return null;
                    const diff = (new Date(purchase.expires_at).getTime() - Date.now()) / (1000 * 60 * 60);
                    if (diff < 24) return <span className="inline-flex items-center px-2.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-[10px] font-bold uppercase tracking-widest">🔥 URGENTE</span>;
                    if (diff < 72) return <span className="inline-flex items-center px-2.5 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-[10px] font-bold uppercase tracking-widest">⚡ Em breve</span>;
                    return null;
                  })()}

                  {purchase.event_date && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580]">⏰ Data do Evento</p>
                      <p className="text-sm font-medium text-white">{new Date(purchase.event_date).toLocaleDateString('pt-BR')}</p>
                    </div>
                  )}

                  {purchase.description && (
                    <p className="text-xs text-[#94A3B8] leading-relaxed line-clamp-3">{purchase.description}</p>
                  )}

                  {Array.isArray(purchase.images) && purchase.images.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-[#4A6580] uppercase tracking-widest">📸 Fotos do local</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(purchase.images as string[]).map((url, i) => (
                          <button key={i} onClick={() => setLightboxUrl(url)}
                            className="block w-12 h-12 rounded-lg overflow-hidden border border-[#243F6A] hover:border-emerald-500/40 transition-colors shrink-0">
                            <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Contato do Cliente */}
                <div className="bg-[#0E1C32] border border-[#1C3050] rounded-xl p-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580]">Contato do Cliente</p>

                  {purchase.status === 'Respondida pelo Cliente' && (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2">
                      <Zap size={12} className="text-emerald-400 shrink-0" />
                      <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-widest">Cliente pronto para contato</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <span className="bg-slate-800 p-1.5 rounded-md shrink-0">
                      <Phone size={14} className="text-[#94A3B8]" />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580]">Telefone</p>
                      <p className="text-sm font-medium text-white">
                        {formatPhone(purchase.leads?.clients?.phone ?? purchase.leads?.profiles?.phone) || <span className="text-[#4A6580] italic text-xs">Não informado</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="bg-slate-800 p-1.5 rounded-md shrink-0">
                      <Mail size={14} className="text-[#94A3B8]" />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580]">E-mail</p>
                      <p className="text-sm font-medium text-white">
                        {(purchase.leads?.clients?.email ?? purchase.leads?.profiles?.email) || <span className="text-[#4A6580] italic text-xs">Não informado</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="bg-slate-800 p-1.5 rounded-md shrink-0">
                      <MapPin size={14} className="text-[#94A3B8]" />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580]">Endereço</p>
                      <p className="text-sm font-medium text-white">
                        {purchase.leads?.clients?.city || purchase.leads?.profiles?.address || purchase.leads?.location || <span className="text-[#4A6580] italic text-xs">Não informado</span>}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer — 3 col grid */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Chat */}
                  <button
                    onClick={async () => {
                      let chatId = purchase.chat_id ?? null;
                      if (!chatId) {
                        chatId = await proposalService.ensureChatForPurchase(purchase.id);
                      }
                      if (chatId) navigate(`/profissional/mensagens?chatId=${chatId}`);
                    }}
                    className="bg-[#132236] border border-white/[0.06] h-9 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 hover:bg-white/5 transition-colors"
                  >
                    <MessageCircle size={13} /> Chat
                  </button>

                  {/* Proposal / status */}
                  {purchase.status === 'Pendente Proposta' ? (
                    <button
                      onClick={() => openProposalModal(purchase)}
                      className="bg-emerald-500 hover:bg-emerald-400 h-9 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Send size={13} /> Proposta
                    </button>
                  ) : purchase.status === 'Proposta Enviada' || purchase.status === 'Enviada' ? (
                    <div className="bg-blue-500/10 border border-blue-500/20 h-9 rounded-xl text-xs font-bold text-blue-400 flex items-center justify-center gap-1.5">
                      <Clock size={13} /> Enviada
                    </div>
                  ) : purchase.status === 'Visualizada pelo Cliente' ? (
                    <div className="bg-indigo-500/10 border border-indigo-500/20 h-9 rounded-xl text-xs font-bold text-indigo-400 flex items-center justify-center gap-1.5 animate-pulse">
                      <Eye size={13} /> Visualizada
                    </div>
                  ) : purchase.status === 'Aceita' ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 h-9 rounded-xl text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                      <CheckCircle size={13} /> Aceita
                    </div>
                  ) : purchase.status === 'Recusada' ? (
                    <div className="bg-red-500/10 border border-red-500/20 h-9 rounded-xl text-xs font-bold text-red-400 flex items-center justify-center gap-1.5">
                      <X size={13} /> Recusada
                    </div>
                  ) : (
                    <div className="bg-slate-800/50 border border-slate-700/50 h-9 rounded-xl text-xs font-bold text-slate-400 flex items-center justify-center">
                      {purchase.status}
                    </div>
                  )}

                  {/* WhatsApp */}
                  {(() => {
                    const rawPhone = purchase.leads?.clients?.phone ?? purchase.leads?.profiles?.phone;
                    const hasPhone = typeof rawPhone === 'string' && rawPhone.trim() !== '';
                    return hasPhone ? (
                      <button
                        onClick={() => handleContact(purchase)}
                        className="bg-[#25D366] hover:bg-[#1ebe59] h-9 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-[#25D366]/20"
                      >
                        <MessageCircle size={13} /> WA
                      </button>
                    ) : (
                      <button disabled className="bg-slate-800 border border-slate-700 h-9 rounded-xl text-xs font-bold text-[#4A6580] flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60">
                        <Phone size={13} /> WA
                      </button>
                    );
                  })()}
                </div>

              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-[#243F6A] rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
          <Inbox className="text-slate-700 mb-9" size={48} />
          <p className="text-[#4A6580] font-medium">Nenhum cliente nesta categoria.</p>
        </div>
      )}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0E1C32]/95 backdrop-blur-md"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="relative max-w-3xl w-full mx-4 bg-[#1C3454] border border-[#243F6A] rounded-[2rem] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-11 py-9 border-b border-[#1C3050]">
              <div className="flex items-center gap-8">
                <div className="w-8 h-8 bg-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center">
                  <Camera size={16} />
                </div>
                <span className="text-white font-bold text-sm">Foto do Serviço</span>
              </div>
              <button
                onClick={() => setLightboxUrl(null)}
                className="p-7 bg-white/5 hover:bg-white/10 rounded-xl text-[#94A3B8] hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-9 bg-[#0E1C32]/50">
              <img
                src={lightboxUrl}
                alt="Foto do serviço"
                loading="lazy"
                className="w-full max-h-[70vh] object-contain rounded-xl"
              />
            </div>
            <div className="px-11 py-8 border-t border-[#1C3050] flex items-center justify-between">
              <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Clique fora para fechar</span>
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Melocale PRO</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
