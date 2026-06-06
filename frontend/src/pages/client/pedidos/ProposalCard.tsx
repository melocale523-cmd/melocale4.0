import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, X, Send, MessageCircle, Loader2,
} from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import { cn } from '../../../lib/utils';
import { proposalService } from '../../../services/dbServices';
import type { Proposal } from '../../../hooks/usePedidosData';

function getAvatarInfo(name: string): { initials: string; colorClass: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  const palette = ['bg-blue-800', 'bg-purple-700', 'bg-orange-700', 'bg-teal-700'];
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return { initials, colorClass: palette[Math.abs(hash) % palette.length] };
}

interface ProposalCardProps {
  proposal: Proposal;
  acceptMutation: UseMutationResult<unknown, Error, { purchaseId: string }>;
  refuseMutation: UseMutationResult<unknown, Error, { purchaseId: string }>;
  onOpenProfile: (modal: { userId: string; name: string; avatar: string | null }) => void;
}

export function ProposalCard({ proposal, acceptMutation, refuseMutation, onOpenProfile }: ProposalCardProps) {
  const navigate = useNavigate();
  const anyPending = acceptMutation.isPending || refuseMutation.isPending;
  const name = proposal.profiles?.full_name || 'Profissional';
  const { initials, colorClass } = getAvatarInfo(name);

  return (
    <div className="bg-[#1C3454] border border-[#243F6A] rounded-2xl p-4">
      {/* Professional header */}
      <div className="flex items-center gap-3">
        <div className={cn('w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white', colorClass)}>
          {proposal.profiles?.avatar_url ? (
            <img src={proposal.profiles.avatar_url} loading="lazy" className="w-11 h-11 rounded-full object-cover" alt="avatar" />
          ) : initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-[15px] font-bold text-white truncate">{name}</h4>
            <span className="text-[11px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-lg shrink-0">
              Verificado
            </span>
          </div>
          {proposal.avg_rating != null ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={cn('w-1.5 h-1.5 rounded-full', i < Math.round(proposal.avg_rating!) ? 'bg-amber-500' : 'bg-slate-700')} />
                ))}
              </div>
              <span className="text-[10px] text-[#4A6580]">
                {proposal.avg_rating.toFixed(1)} • {proposal.reviews_count} avaliação{proposal.reviews_count !== 1 ? 'ões' : ''}
              </span>
            </div>
          ) : (
            <p className="text-xs text-[#4A6580] mt-0.5">Sem avaliações</p>
          )}
        </div>

        {proposal.profiles?.id && (
          <button
            type="button"
            onClick={() => onOpenProfile({
              userId: proposal.profiles!.id,
              name,
              avatar: proposal.profiles?.avatar_url ?? null,
            })}
            className="text-xs text-[#94A3B8] border border-[#243F6A] bg-transparent px-2.5 py-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
          >
            Ver perfil
          </button>
        )}
      </div>

      {/* Description */}
      <div className="bg-[#0E1C32] border border-[#243F6A] rounded-xl px-3 py-2.5 mt-3">
        <p className="text-[13px] text-[#94A3B8] italic">"{proposal.description}"</p>
      </div>

      {/* Price + duration */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="bg-[#0E1C32] border border-[#243F6A] rounded-xl px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580] mb-0.5">Valor</p>
          <p className="text-lg font-bold text-white">R$ {(proposal.price ?? 0).toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-[#0E1C32] border border-[#243F6A] rounded-xl px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580] mb-0.5">Prazo</p>
          <p className="text-lg font-bold text-white">{proposal.duration}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 space-y-2">
        {proposal.status === 'Enviada' || proposal.status === 'Proposta Enviada' ? (
          <>
            <button
              onClick={() => acceptMutation.mutate({ purchaseId: proposal.id })}
              disabled={anyPending}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {acceptMutation.isPending
                ? <Loader2 size={18} className="animate-spin" />
                : <><CheckCircle2 size={18} /> Tenho Interesse</>}
            </button>
            <button
              onClick={() => refuseMutation.mutate({ purchaseId: proposal.id })}
              disabled={anyPending}
              className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold rounded-2xl transition-all disabled:opacity-50"
            >
              {refuseMutation.isPending ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Recusar Proposta'}
            </button>
          </>
        ) : proposal.status === 'Recusada' ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
            <div className="w-10 h-10 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-2">
              <X size={20} />
            </div>
            <p className="text-sm font-bold text-red-400 uppercase tracking-widest">Proposta Recusada</p>
            <p className="text-[10px] text-[#4A6580] font-bold mt-1">Você recusou esta proposta.</p>
          </div>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Send size={20} />
            </div>
            <p className="text-sm font-bold text-emerald-500 uppercase tracking-widest">Interesse Enviado</p>
            <p className="text-[10px] text-[#4A6580] font-bold mt-1">O profissional já recebeu seus dados de contato.</p>
            <button
              onClick={async () => {
                let chatId = proposal.chat_id;
                if (!chatId) {
                  chatId = await proposalService.ensureChatForPurchase(proposal.id);
                }
                if (chatId) navigate(`/cliente/mensagens?chatId=${chatId}`);
              }}
              className="mt-3 w-full py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-500 transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle size={14} /> Abrir Chat
            </button>
          </div>
        )}
        <p className="text-[10px] text-[#4A6580] text-center uppercase tracking-wider">
          Analise com cuidado antes de aceitar • MeloCalé
        </p>
      </div>
    </div>
  );
}
