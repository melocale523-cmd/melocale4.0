import { useState, useEffect } from 'react';
import { Trophy, X } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

export const ASKED_KEY = 'push_permission_asked';
export const MODAL_DISMISSED_KEY = 'push_modal_dismissed';

interface Props {
  onDismiss: () => void;
}

export default function ProfessionalPushModal({ onDismiss }: Props) {
  const { isSupported, isSubscribed, subscribe } = usePushNotifications();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isSupported) return;
    if (isSubscribed) return;
    if (typeof Notification !== 'undefined' && Notification.permission !== 'default') return;
    if (localStorage.getItem(ASKED_KEY)) return;

    const timer = setTimeout(() => {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'default') return;
      localStorage.setItem(ASKED_KEY, '1');
      setVisible(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isSupported, isSubscribed]);

  if (!visible) return null;

  const handleActivate = async () => {
    setVisible(false);
    await subscribe();
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(MODAL_DISMISSED_KEY, '1');
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleDismiss} />
      <div className="relative w-full max-w-sm bg-[#132540] border border-[#1C3050] rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-200">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-[#4A6580] hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          🏆 Profissionais PRO não perdem oportunidades
        </span>

        <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <Trophy size={32} className="text-emerald-400 animate-pulse" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-black text-white">Seja o primeiro a fechar o cliente!</h2>
          <p className="text-sm text-[#94A3B8] leading-relaxed">
            Profissionais que ativam notificações fecham 3x mais:
          </p>
        </div>

        <div className="w-full space-y-2 text-left">
          {[
            { icon: '⚡', text: 'Novo pedido disponível na sua região' },
            { icon: '✅', text: 'Cliente aceitou sua proposta' },
            { icon: '📅', text: 'Lembrete do seu agendamento amanhã' },
          ].map(({ icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-3 bg-[#0E1C32] border border-[#1C3050] rounded-xl px-3 py-2 text-sm text-[#94A3B8]"
            >
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 w-full pt-1">
          <button
            onClick={handleActivate}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-colors"
          >
            Ativar e fechar mais clientes!
          </button>
          <button
            onClick={handleDismiss}
            className="w-full py-2.5 rounded-xl text-[#4A6580] hover:text-white text-sm font-medium transition-colors"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
