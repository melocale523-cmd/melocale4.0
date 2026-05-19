import { FileText, MapPin, Tag, Calendar, ArrowRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { PedidoItem } from '../../../hooks/usePedidosData';

interface PedidoCardProps {
  pedido: PedidoItem;
  contextMenuId: string | null;
  onOpenProposals: (pedido: PedidoItem) => void;
  onOpenEdit: (pedido: PedidoItem) => void;
  onDelete: (pedido: PedidoItem) => void;
  onSetContextMenuId: (id: string | null) => void;
}

export function PedidoCard({
  pedido,
  contextMenuId,
  onOpenProposals,
  onOpenEdit,
  onDelete,
  onSetContextMenuId,
}: PedidoCardProps) {
  return (
    <div
      onClick={() => onOpenProposals(pedido)}
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
              'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/5 text-emerald-500 border border-emerald-500/10',
              pedido.status === 'Orçando' && 'bg-cyan-500/5 text-cyan-400 border border-cyan-500/10',
              pedido.status === 'in_progress' && 'bg-blue-500/5 text-blue-400 border border-blue-500/10',
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
              onClick={() => onSetContextMenuId(contextMenuId === pedido.id ? null : pedido.id)}
              className="w-10 h-10 bg-[#0E1C32] rounded-xl flex items-center justify-center border border-[#1C3050] text-slate-600 hover:text-white hover:border-white/20 transition-all"
            >
              <MoreVertical size={18} />
            </button>
            {contextMenuId === pedido.id && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-[#1C1E25] border border-[#243F6A] rounded-2xl shadow-2xl overflow-hidden z-30">
                <button
                  onClick={() => onOpenEdit(pedido)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-sm text-slate-300 hover:bg-white/5 transition-all text-left"
                >
                  <Pencil size={14} className="text-[#94A3B8] shrink-0" /> Editar
                </button>
                <button
                  onClick={() => onDelete(pedido)}
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
  );
}
