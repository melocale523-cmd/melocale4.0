import { MapPin, Tag, Calendar, ArrowRight, MoreVertical, Pencil, Trash2, Star, Zap, Droplets, Brush, Hammer } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { PedidoItem } from '../../../hooks/usePedidosData';

interface PedidoCardProps {
  pedido: PedidoItem;
  contextMenuId: string | null;
  onOpenProposals: (pedido: PedidoItem) => void;
  onOpenEdit: (pedido: PedidoItem) => void;
  onDelete: (pedido: PedidoItem) => void;
  onSetContextMenuId: (id: string | null) => void;
  onReview?: () => void;
}

function categoryIcon(category: string) {
  const c = category?.toLowerCase() ?? '';
  if (c.includes('eletric') || c.includes('elétric')) return <Zap size={18} className="text-yellow-400" />;
  if (c.includes('hidr') || c.includes('encanamento')) return <Droplets size={18} className="text-blue-400" />;
  if (c.includes('parede') || c.includes('pint')) return <Brush size={18} className="text-pink-400" />;
  return <Hammer size={18} className="text-emerald-400" />;
}

export function PedidoCard({
  pedido,
  contextMenuId,
  onOpenProposals,
  onOpenEdit,
  onDelete,
  onSetContextMenuId,
  onReview,
}: PedidoCardProps) {
  const statusLabel =
    pedido.status === 'open' || pedido.status === 'aberto'
      ? 'Aberto'
      : pedido.status === 'orçando'
      ? 'Orçando'
      : pedido.status === 'finalizado'
      ? 'Finalizado'
      : pedido.status;

  const statusColor =
    pedido.status === 'orçando'
      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
      : pedido.status === 'finalizado'
      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

  const interested = pedido.interested_count ?? 0;

  return (
    <div
      onClick={() => onOpenProposals(pedido)}
      className="bg-[#132236] rounded-2xl border border-white/5 mb-3 p-4 hover:border-emerald-500/20 hover:bg-[#0f1d2e] transition-all cursor-pointer group"
    >
      {/* Top row */}
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
          {categoryIcon(pedido.category)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate mb-1">{pedido.title}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {pedido.location && (
              <span className="flex items-center gap-1 text-[11px] text-[#4a6580]">
                <MapPin size={10} /> {pedido.location}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-[#4a6580]">
              <Tag size={10} /> {pedido.category}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-[#4a6580]">
              <Calendar size={10} /> {new Date(pedido.created_at).toLocaleDateString('pt-BR')}
            </span>
            {(pedido.budget_min != null || pedido.budget_max != null) && (
              <span className="text-[11px] text-[#4a6580]">
                R$ {pedido.budget_min ?? 0} – {pedido.budget_max ?? 0}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center gap-2 mt-3">
        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border', statusColor)}>
          {statusLabel}
        </span>
        {interested > 0 ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {interested} interessado{interested > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5 text-[#4a6580] border border-white/5">
            0 interessados
          </span>
        )}
        {pedido.description && (
          <span className="text-[11px] text-[#4a6580] truncate max-w-[180px]">
            {pedido.description.length > 60 ? pedido.description.slice(0, 60) + '…' : pedido.description}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {onReview && (
            <button
              onClick={e => { e.stopPropagation(); onReview(); }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 hover:border-yellow-500/40 text-yellow-400 text-[10px] font-bold rounded-lg transition-all"
            >
              <Star size={11} className="fill-yellow-400" />
              Avaliar
            </button>
          )}
          <div className="relative z-20">
            <button
              onClick={() => onSetContextMenuId(contextMenuId === pedido.id ? null : pedido.id)}
              className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/10 transition-all"
            >
              <MoreVertical size={15} />
            </button>
            {contextMenuId === pedido.id && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-[#1C1E25] border border-[#243F6A] rounded-2xl shadow-2xl overflow-hidden z-30">
                <button
                  onClick={() => onOpenEdit(pedido)}
                  className="w-full px-4 py-2.5 flex items-center gap-2 text-sm text-slate-300 hover:bg-white/5 transition-all text-left"
                >
                  <Pencil size={13} className="text-[#94A3B8] shrink-0" /> Editar
                </button>
                <button
                  onClick={() => onDelete(pedido)}
                  className="w-full px-4 py-2.5 flex items-center gap-2 text-sm text-red-400 hover:bg-red-500/10 transition-all text-left"
                >
                  <Trash2 size={13} className="shrink-0" /> Excluir
                </button>
              </div>
            )}
          </div>
          <div className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center text-slate-600 group-hover:bg-emerald-500 group-hover:text-black transition-all">
            <ArrowRight size={15} />
          </div>
        </div>
      </div>
    </div>
  );
}
