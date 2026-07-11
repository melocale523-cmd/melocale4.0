import { useState, useEffect } from 'react';
import { BellRing, X } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

const BANNER_DISMISSED_SESSION_KEY = 'push_banner_dismissed_session';

export default function PushFloatingBanner() {
  const { isSupported, isSubscribed, subscribe } = usePushNotifications();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isSupported || isSubscribed) return;
    if (typeof Notification !== 'undefined' && Notification.permission !== 'default') return;
    if (sessionStorage.getItem(BANNER_DISMISSED_SESSION_KEY)) return;

    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [isSupported, isSubscribed]);

  if (!visible || isSubscribed) return null;

  const handleActivate = async () => {
    setVisible(false);
    await subscribe();
  };

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem(BANNER_DISMISSED_SESSION_KEY, '1');
  };

  return (
    <div className="mx-2 mb-3 bg-[#132540] border border-emerald-500/20 rounded-xl shadow p-3 flex items-center gap-2">
      <BellRing size={18} className="text-amber-400 shrink-0" />
      <button
        onClick={handleActivate}
        className="flex-1 text-left text-sm font-medium text-white hover:text-amber-400 transition-colors"
      >
        🔔 Ativar notificações
      </button>
      <button
        onClick={handleDismiss}
        className="text-[#4A6580] hover:text-white transition-colors shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}
