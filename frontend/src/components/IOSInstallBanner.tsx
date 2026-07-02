import { useEffect, useState } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';

const LAST_SHOWN_KEY = 'ios_install_banner_last_shown';
const REASK_DAYS = 7;

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
}

export default function IOSInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIOS() || isStandalone()) return;
    const lastShown = localStorage.getItem(LAST_SHOWN_KEY);
    const daysSince = lastShown ? (Date.now() - Number(lastShown)) / 86400000 : Infinity;
    if (daysSince < REASK_DAYS) return;
    const t = setTimeout(() => {
      localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
      setVisible(true);
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
      <div className="max-w-sm mx-auto bg-[#132540] border border-[#1C3050] rounded-2xl shadow-2xl p-5 relative">
        <button onClick={() => setVisible(false)} className="absolute top-3 right-3 text-[#4A6580]">
          <X size={16} />
        </button>
        <p className="text-sm font-bold text-white mb-2">📲 Instale o app pra não perder pedido</p>
        <p className="text-xs text-[#94A3B8] mb-3 leading-relaxed">
          Notificações de novos pedidos só funcionam com o app instalado. Toque em{' '}
          <Share size={12} className="inline" /> <strong>Compartilhar</strong>, depois em{' '}
          <PlusSquare size={12} className="inline" /> <strong>Adicionar à Tela de Início</strong>.
        </p>
        <button onClick={() => setVisible(false)} className="w-full py-2 rounded-lg bg-emerald-500 text-black text-xs font-bold">
          Entendi
        </button>
      </div>
    </div>
  );
}
