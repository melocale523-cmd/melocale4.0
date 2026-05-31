import { useEffect, useRef, useState } from 'react';
import { X, MessageCircle } from 'lucide-react';

const WA_NUMBER = '5574999215307';
const SESSION_KEY = 'proactive_chat_shown';
const DELAY_MS = 25_000;

interface Props {
  userCity: string;
}

type Section = 'hero' | 'planos' | 'como-funciona' | null;

function buildMessage(section: Section, city: string): string {
  if (section === 'hero')
    return `Profissionais verificados em ${city} estão disponíveis agora. Quer receber orçamentos grátis hoje?`;
  if (section === 'planos')
    return 'A maioria dos clientes começa pelo plano grátis e já recebe orçamentos no mesmo dia. Posso te ajudar a escolher?';
  if (section === 'como-funciona')
    return 'Em menos de 5 minutos você já pode receber orçamentos de profissionais perto de você. Vamos começar?';
  return `Ei! Tem profissionais qualificados em ${city} esperando por clientes agora. Posso te ajudar?`;
}

export default function ProactiveChat({ userCity }: Props) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const sectionRef = useRef<Section>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;

    // Observe main sections to pick context-aware message
    const ids: Section[] = ['hero', 'planos', 'como-funciona'];
    const observers: IntersectionObserver[] = [];

    ids.forEach(id => {
      const el = document.getElementById(id ?? '');
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) sectionRef.current = id; },
        { threshold: 0.3 },
      );
      obs.observe(el);
      observers.push(obs);
    });

    timerRef.current = setTimeout(() => {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      const city = sessionStorage.getItem('user_city') || userCity;
      setMessage(buildMessage(sectionRef.current, city));
      setVisible(true);
    }, DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      observers.forEach(o => o.disconnect());
    };
  }, [userCity]);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(SESSION_KEY, '1');
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent(message);
    window.open(`https://wa.me/${WA_NUMBER}?text=${text}`, '_blank', 'noopener');
    dismiss();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-20 right-3 z-[85] w-72 max-w-[calc(100vw-1.5rem)] animate-slide-up"
      style={{ animation: 'slideUp 0.4s ease-out forwards' }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slideUp 0.4s ease-out forwards; }
      `}</style>

      <div className="bg-[#1C3454] border border-emerald-500/30 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-9 py-8 bg-emerald-600">
          <div className="flex items-center gap-7">
            {/* Avatar com logo */}
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 text-emerald-600 font-black text-xs">
              MC
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">MeloCalé</p>
              <p className="text-emerald-100 text-[10px]">Online agora</p>
            </div>
          </div>
          <button onClick={dismiss} className="text-white/70 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-9 py-9">
          <div className="flex items-start gap-7 mb-9">
            <MessageCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-slate-200 text-sm leading-relaxed">{message}</p>
          </div>

          <div className="flex flex-col gap-7">
            <button
              onClick={openWhatsApp}
              className="w-full bg-[#25d366] hover:bg-[#1ebe5a] text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-7"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              Falar no WhatsApp
            </button>
            <button
              onClick={dismiss}
              className="w-full text-[#7A9EBF] hover:text-slate-300 text-xs py-1.5 transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
