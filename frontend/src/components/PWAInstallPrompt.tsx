import { useEffect, useState } from 'react';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowModal(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setShowModal(false);
    setShowFab(false);
  };

  const handleClose = () => {
    setShowModal(false);
    setShowFab(true);
  };

  if (installed || !deferredPrompt) return null;

  return (
    <>
      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-9" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-11 relative">
            <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
            <div className="flex items-center gap-8 mb-9">
              <img src="/icon-192.png" alt="MeloCalé" className="w-14 h-14 rounded-xl shadow"/>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white text-lg">Instalar MeloCalé</h2>
                <p className="text-sm text-gray-500">[www.melocale.com.br](https://www.melocale.com.br)</p>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-10">
              Instale o app e acesse rapidamente profissionais perto de você — sem precisar abrir o navegador!
            </p>
            <div className="flex gap-8">
              <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50">
                Agora não
              </button>
              <button onClick={handleInstall} className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold flex items-center justify-center gap-7">
                <Download size={16} />
                Instalar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB flutuante */}
      {showFab && !showModal && (
        <button
          onClick={() => setShowModal(true)}
          className="fixed bottom-20 right-4 z-40 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-all"
          title="Instalar app"
        >
          <Smartphone size={18} />
          <span>Instalar app</span>
        </button>
      )}
    </>
  );
}
