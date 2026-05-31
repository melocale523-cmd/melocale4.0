import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  networkName: string;
}

export default function SocialComingSoonModal({ open, onClose, networkName }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-9"
      onClick={onClose}
    >
      <div
        className="bg-[#132540] border border-[#1C3050] rounded-2xl p-8 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-9">
          <h3 className="text-white font-bold text-lg">{networkName}</h3>
          <button
            onClick={onClose}
            className="text-[#4A6580] hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-[#94A3B8] leading-relaxed mb-11">
          No momento não temos redes sociais ativas, mas em breve estaremos por lá! 🚀
        </p>

        <button
          onClick={onClose}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-8 rounded-xl transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
