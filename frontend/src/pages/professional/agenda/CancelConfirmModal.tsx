import { AlertTriangle, Loader2 } from 'lucide-react';

interface CancelTarget {
  id: string;
  clientId: string;
}

interface CancelConfirmModalProps {
  target: CancelTarget;
  onClose: () => void;
  onConfirm: (id: string, clientId: string) => void;
  isPending: boolean;
}

export function CancelConfirmModal({ target, onClose, onConfirm, isPending }: CancelConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-9">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1C3454] border border-red-500/30 rounded-2xl p-11 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-8 mb-9">
          <div className="p-7 bg-red-500/10 rounded-xl">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <h3 className="text-base font-bold text-white">Cancelar Agendamento</h3>
        </div>
        <p className="text-sm text-[#94A3B8] mb-11">
          Tem certeza que deseja cancelar este agendamento? O cliente será notificado.
        </p>
        <div className="flex gap-8">
          <button
            onClick={onClose}
            className="flex-1 py-8 text-[#94A3B8] hover:text-white text-sm font-bold rounded-xl border border-[#1C3050] hover:border-white/20 transition-all"
          >
            Voltar
          </button>
          <button
            onClick={() => onConfirm(target.id, target.clientId)}
            disabled={isPending}
            className="flex-1 py-8 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-bold rounded-xl border border-red-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-7"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Cancelar agendamento
          </button>
        </div>
      </div>
    </div>
  );
}
