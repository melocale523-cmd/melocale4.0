import { useState, useEffect } from 'react';
import { BellRing, X } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

const MODAL_DISMISSED_KEY = 'push_modal_dismissed';
const BANNER_DISMISSED_KEY = 'push_banner_dismissed';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export default function PushFloatingBanner() {
  const { isSupported, isSubscribed, subscribe } = usePushNotifications();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isSupported || isSubscribed) return;

    const modalDismissed = localStorage.getItem(MODAL_DISMISSED_KEY);
    const bannerDismissed = localStorage.getItem(BANNER_DISMISSED_KEY);

    if (modalDismissed && !bannerDismissed) {
      // Modal was dismissed but banner hasn't been dismissed yet — show after 2s
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }

    if (bannerDismissed) {
      const elapsed = Date.now() - Number(bannerDismissed);
      if (elapsed >= THREE_DAYS_MS) {
        const timer = setTimeout(() => setVisible(true), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [isSupported, isSubscribed]);

  if (!visible || isSubscribed) return null;

  const handleActivate = async () => {
    setVisible(false);
    await subscribe();
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(BANNER_DISMISSED_KEY, String(Date.now()));
  };

  return (
    <div className="fixed bottom-4 left-4 z-[50] max-w-xs w-full bg-[#132540] border border-[#1C3050] rounded-2xl shadow-xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
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
