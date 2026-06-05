import { X, MessageCircle, Inbox, Loader2 } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { PedidoItem, Proposal } from '../../../hooks/usePedidosData';
import { LeadTimeline } from './LeadTimeline';
import { ProposalCard } from './ProposalCard';

interface ProfileModalState {
  userId: string;
  name: string;
  avatar: string | null;
}

interface ProposalsModalProps {
  pedido: PedidoItem;
  proposals: Proposal[];
  proposalsLoading: boolean;
  linkedAppointment: { scheduled_at: string } | null | undefined;
  onClose: () => void;
  acceptMutation: UseMutationResult<unknown, Error, { purchaseId: string }>;
  refuseMutation: UseMutationResult<unknown, Error, { purchaseId: string }>;
  onOpenProfile: (modal: ProfileModalState) => void;
}

export function ProposalsModal({
  pedido,
  proposals,
  proposalsLoading,
  linkedAppointment,
  onClose,
  acceptMutation,
  refuseMutation,
  onOpenProfile,
}: ProposalsModalProps) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-[2.5rem] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">

        <div className="p-5 border-b border-[#1C3050] flex items-center justify-between bg-[#1C3454]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 text-blue-500 rounded-2xl flex items-center justify-center">
              <MessageCircle size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Propostas Recebidas</h2>
              <p className="text-[#94A3B8] font-medium text-sm">{pedido.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-2xl text-[#4A6580] hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-[#1C3050] bg-[#0E1C32]/20">
          <p className="text-[10px] font-bold text-[#4A6580] uppercase tracking-widest mb-3">Progresso do pedido</p>
          <LeadTimeline pedido={pedido} appointment={linkedAppointment} />
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-[#0E1C32]/30">
          {proposalsLoading ? (
            <div className="py-10 flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-blue-500" size={40} />
              <p className="text-xs font-black uppercase tracking-widest text-[#4A6580]">Buscando orçamentos...</p>
            </div>
          ) : proposals.length > 0 ? (
            proposals.map(proposal => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                acceptMutation={acceptMutation}
                refuseMutation={refuseMutation}
                onOpenProfile={onOpenProfile}
              />
            ))
          ) : (
            <div className="py-10 text-center flex flex-col items-center justify-center gap-4 opacity-50 grayscale">
              <Inbox size={48} className="text-slate-700" />
              <p className="text-white font-black text-lg">Nenhuma proposta ainda</p>
              <p className="text-[#4A6580] text-sm font-medium leading-relaxed max-w-xs mx-auto">Assim que os profissionais enviarem orçamentos, eles aparecerão aqui para sua avaliação.</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-[#1C3454] border-t border-[#1C3050] flex items-center justify-center">
          <p className="text-[10px] text-[#4A6580] font-bold uppercase tracking-[0.2em]">Analise com cuidado antes de aceitar • MeloCalé</p>
        </div>
      </div>
    </div>
  );
}
