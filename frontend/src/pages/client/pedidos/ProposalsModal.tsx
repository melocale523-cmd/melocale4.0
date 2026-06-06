import { X, Inbox, Loader2 } from 'lucide-react';
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
      <div className="absolute inset-0 bg-[#0E1C32]/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-3xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="px-4 py-3 border-b border-[#243F6A] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#4A6580]">Propostas Recebidas</p>
            <h2 className="text-base font-bold text-white leading-tight">{pedido.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#0E1C32] border border-[#243F6A] text-[#4A6580] hover:text-white flex items-center justify-center transition-colors shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Progress */}
        <div className="px-4 py-2 border-b border-[#243F6A] bg-[#0E1C32]/30">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#4A6580] mb-1">Progresso do pedido</p>
          <LeadTimeline pedido={pedido} appointment={linkedAppointment} />
        </div>

        {/* Proposals list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {proposalsLoading ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-emerald-500" size={32} />
              <p className="text-xs font-bold uppercase tracking-widest text-[#4A6580]">Buscando orçamentos...</p>
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
            <div className="py-8 text-center flex flex-col items-center justify-center gap-2 opacity-50">
              <Inbox size={32} className="text-slate-600" />
              <p className="text-white font-bold text-sm">Nenhuma proposta ainda</p>
              <p className="text-[#4A6580] text-xs leading-relaxed max-w-xs mx-auto">
                Assim que os profissionais enviarem orçamentos, eles aparecerão aqui para sua avaliação.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
