import { Bell, X } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface Props {
  onDismiss: () => void;
}

// Pedido de notificação contextual — aparece logo depois do cliente criar um
// pedido, quando o motivo ("saber quando um profissional responder") é óbvio
// na hora. Diferente de ClientPushModal (pop-up genérico, sem contexto) e de
// PushFloatingBanner (insiste em visitas futuras) — os três não competem:
// se a pessoa já decidiu sobre notificação (permission !== 'default'), este
// componente nem chega a ser renderizado (checagem em Pedidos.tsx antes de
// mostrar).
export default function OrderCreatedPushPrompt({ onDismiss }: Props) {
  const { subscribe } = usePushNotifications();

  const handleActivate = async () => {
    onDismiss();
    await subscribe();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-9">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onDismiss} />
      <div className="relative w-full max-w-sm bg-[#132540] border border-[#1C3050] rounded-2xl shadow-2xl p-11 flex flex-col items-center gap-9 text-center animate-in zoom-in-95 duration-200">
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-[#4A6580] hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <span className="text-xs font-semibold px-8 py-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          Pedido criado! 🎉
        </span>

        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <Bell size={32} className="text-amber-400 animate-pulse" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-black text-white">Quer ser avisado assim que um profissional enviar uma proposta?</h2>
          <p className="text-sm text-[#94A3B8] leading-relaxed">
            Sem isso, você só vai saber olhando o app.
          </p>
        </div>

        <div className="flex flex-col gap-7 w-full pt-1">
          <button
            onClick={handleActivate}
            className="w-full py-8 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm transition-colors"
          >
            Ativar notificações
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl text-[#4A6580] hover:text-white text-sm font-medium transition-colors"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
