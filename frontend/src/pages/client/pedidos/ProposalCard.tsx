import { useNavigate } from 'react-router-dom';
import {
  User, DollarSign, Clock, CheckCircle, MessageCircle, Send, X, Loader2,
} from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import { cn } from '../../../lib/utils';
import { proposalService } from '../../../services/dbServices';
import type { Proposal } from '../../../hooks/usePedidosData';

const proposalStatusConfig: Record<string, { label: string; className: string }> = {
  'Proposta Enviada': { label: 'Aguardando', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
  'Enviada':          { label: 'Aguardando', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
  'Aceita':           { label: 'Aceita',     className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  'Recusada':         { label: 'Recusada',   className: 'bg-red-500/20 text-red-400 border border-red-500/30' },
};

interface ProposalCardProps {
  proposal: Proposal;
  acceptMutation: UseMutationResult<unknown, Error, { purchaseId: string }>;
  refuseMutation: UseMutationResult<unknown, Error, { purchaseId: string }>;
  onOpenProfile: (modal: { userId: string; name: string; avatar: string | null }) => void;
}

export function ProposalCard({ proposal, acceptMutation, refuseMutation, onOpenProfile }: ProposalCardProps) {
  const navigate = useNavigate();
  const anyPending = acceptMutation.isPending || refuseMutation.isPending;
  const cfg = proposalStatusConfig[proposal.status] ?? { label: 'Aguardando', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' };

  return (
    <div className="bg-[#1C3454] border border-[#1C3050] rounded-[2rem] p-8 hover:border-blue-500/30 transition-all group overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] rounded-full pointer-events-none group-hover:bg-blue-500/10 transition-all" />

      <div className="flex flex-col md:flex-row justify-between gap-8 relative z-10">
        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl border border-[#1C3050] relative shrink-0">
              {proposal.profiles?.avatar_url ? (
                <img src={proposal.profiles.avatar_url} loading="lazy" className="w-16 h-16 rounded-2xl object-cover" alt="avatar" />
              ) : (
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center">
                  <User className="text-[#4A6580]" size={32} />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-[8px] font-black px-1.5 py-0.5 rounded-full text-black uppercase tracking-tighter">Verificado</div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xl font-black text-white">{proposal.profiles?.full_name || 'Profissional'}</h4>
                {proposal.profiles?.id && (
                  <button
                    type="button"
                    onClick={() => onOpenProfile({
                      userId: proposal.profiles!.id,
                      name: proposal.profiles?.full_name || 'Profissional',
                      avatar: proposal.profiles?.avatar_url ?? null,
                    })}
                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/50 px-2 py-0.5 rounded-full transition-all"
                  >
                    Ver perfil
                  </button>
                )}
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.className}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-blue-500 font-bold text-sm">Especialista verificado</p>
              <div className="flex items-center gap-3 mt-1">
                {proposal.avg_rating != null ? (
                  <>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={cn('w-2 h-2 rounded-full', i < Math.round(proposal.avg_rating!) ? 'bg-amber-500' : 'bg-slate-800')} />
                      ))}
                    </div>
                    <span className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest">
                      {proposal.avg_rating.toFixed(1)} • {proposal.reviews_count} avaliação{proposal.reviews_count !== 1 ? 'ões' : ''}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest">Sem avaliações</span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#0E1C32] p-6 rounded-2xl border border-[#1C3050]">
            <p className="text-slate-300 text-sm leading-relaxed italic">"{proposal.description}"</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-xl border border-[#1C3050]">
              <p className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest mb-1 flex items-center gap-1.5"><DollarSign size={12} /> Valor do Serviço</p>
              <p className="text-xl font-black text-white">R$ {(proposal.price ?? 0).toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-white/5 p-4 rounded-xl border border-[#1C3050]">
              <p className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest mb-1 flex items-center gap-1.5"><Clock size={12} /> Prazo Estimado</p>
              <p className="text-xl font-black text-white">{proposal.duration}</p>
            </div>
          </div>
        </div>

        <div className="md:w-64 flex flex-col gap-3 justify-center">
          {proposal.status === 'Enviada' || proposal.status === 'Proposta Enviada' ? (
            <>
              <button
                onClick={() => acceptMutation.mutate({ purchaseId: proposal.id })}
                disabled={anyPending}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
              >
                {acceptMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /> Tenho Interesse</>}
              </button>
              <button
                onClick={() => refuseMutation.mutate({ purchaseId: proposal.id })}
                disabled={anyPending}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {refuseMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : 'Recusar Proposta'}
              </button>
            </>
          ) : proposal.status === 'Recusada' ? (
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
                  let chatId = proposal.chat_id;
                  if (!chatId) {
                    chatId = await proposalService.ensureChatForPurchase(proposal.id);
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
  );
}
