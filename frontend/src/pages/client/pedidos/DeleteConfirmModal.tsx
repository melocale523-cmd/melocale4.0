import { Trash2 } from 'lucide-react';
import type { PedidoItem } from '../../../hooks/usePedidosData';

interface DeleteConfirmModalProps {
  pedido: PedidoItem;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

export function DeleteConfirmModal({ pedido, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#1C3454] border border-slate-700 rounded-3xl shadow-2xl p-8 flex flex-col gap-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto">
            <Trash2 size={28} className="text-red-400" />
          </div>
          <h3 className="text-xl font-black text-white">Arquivar pedido?</h3>
          <p className="text-[#94A3B8] text-sm">
            "{pedido.title}" será arquivado e não aparecerá mais na lista.
          </p>
        </div>
        <div className="flex gap-3">
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
            className="flex-1 h-12 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl transition-all text-sm"
          >
            Arquivar
          </button>
        </div>
      </div>
    </div>
  );
}
