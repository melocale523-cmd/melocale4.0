import { Trash2, Archive } from 'lucide-react';
import type { PedidoItem } from '../../../hooks/usePedidosData';

interface DeleteConfirmModalProps {
  pedido: PedidoItem;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

export function DeleteConfirmModal({ pedido, onClose, onConfirm }: DeleteConfirmModalProps) {
  const willArchive = (pedido.purchases_count ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-9">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#1C3454] border border-slate-700 rounded-3xl shadow-2xl p-8 flex flex-col gap-11">
        <div className="text-center space-y-8">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${willArchive ? 'bg-yellow-500/10' : 'bg-red-500/10'}`}>
            {willArchive
              ? <Archive size={28} className="text-yellow-400" />
              : <Trash2 size={28} className="text-red-400" />
            }
          </div>
          <h3 className="text-xl font-black text-white">
            {willArchive ? 'Arquivar pedido?' : 'Excluir pedido?'}
          </h3>
          <p className="text-[#94A3B8] text-sm leading-relaxed">
            {willArchive
              ? `Este pedido já recebeu propostas de profissionais. Deseja arquivá-lo? Ele não aparecerá mais na sua lista, mas os profissionais que compraram ainda terão acesso.`
              : `Tem certeza que deseja excluir "${pedido.title}"? Esta ação não pode ser desfeita.`
            }
          </p>
        </div>
        <div className="flex gap-8">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 bg-white/5 hover:bg-white/10 text-[#B0C4D8] font-bold rounded-2xl transition-all text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(pedido.id)}
            className={`flex-1 h-12 font-black rounded-2xl transition-all text-sm ${willArchive ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-red-600 hover:bg-red-500 text-white'}`}
          >
            {willArchive ? 'Arquivar' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}
