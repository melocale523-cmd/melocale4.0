import { useState, useEffect } from 'react';
import { BellRing, X } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

const STORAGE_KEY = 'push_permission_asked';

export default function PushPermissionModal() {
  const { isSupported, isSubscribed, subscribe } = usePushNotifications();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isSupported) return;
    if (isSubscribed) return;
    if (typeof Notification !== 'undefined' && Notification.permission !== 'default') return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const timer = setTimeout(() => {
      // Re-check in case permission changed during the 3s window
      if (typeof Notification !== 'undefined' && Notification.permission !== 'default') return;
      localStorage.setItem(STORAGE_KEY, '1');
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
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleDismiss}
      />
      <div className="relative w-full max-w-sm bg-[#132540] border border-[#1C3050] rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4 text-center">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-[#4A6580] hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <BellRing size={32} className="text-emerald-400" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-black text-white">Não perca nenhum cliente!</h2>
          <p className="text-sm text-[#94A3B8] leading-relaxed">
            Ative as notificações para receber alertas de novos pedidos, mensagens e propostas mesmo com o app fechado.
          </p>
        </div>

        <div className="flex flex-col gap-2 w-full pt-1">
          <button
            onClick={handleActivate}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-colors"
          >
            Ativar notificações
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
