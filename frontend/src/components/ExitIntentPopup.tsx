import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

const SESSION_KEY = 'melocale_exit_shown';
const TIMER_MINUTES = 10;

export default function ExitIntentPopup() {
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_MINUTES * 60);
  const shownRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const show = useCallback(() => {
    if (shownRef.current || sessionStorage.getItem(SESSION_KEY)) return;
    shownRef.current = true;
    sessionStorage.setItem(SESSION_KEY, '1');
    setVisible(true);
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  useEffect(() => {
    const isMobile = window.matchMedia('(hover: none)').matches;

    if (!isMobile) {
      // Desktop: mouse leaves through top edge
      const handleMouseLeave = (e: MouseEvent) => {
        if (e.clientY < 10) show();
      };
      document.addEventListener('mouseleave', handleMouseLeave);
      return () => document.removeEventListener('mouseleave', handleMouseLeave);
    } else {
      // Mobile: 20 seconds of inactivity
      const IDLE_MS = 20_000;

      const resetIdle = () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(show, IDLE_MS);
      };

      resetIdle();
      window.addEventListener('scroll', resetIdle, { passive: true });
      window.addEventListener('touchstart', resetIdle, { passive: true });

      return () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        window.removeEventListener('scroll', resetIdle);
        window.removeEventListener('touchstart', resetIdle);
      };
    }
  }, [show]);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  if (!visible) return null;

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-9"
      style={{ backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.65)' }}
      onClick={close}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-8 text-center shadow-2xl"
        style={{
          background: '#1C3454',
          border: '2px solid #10b981',
          boxShadow: '0 0 40px rgba(16,185,129,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={close}
          aria-label="Fechar"
          className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors p-6 rounded-lg hover:bg-white/10"
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <p className="text-4xl mb-8">⚡</p>
        <h2 className="text-2xl font-extrabold text-white mb-7">
          Espera! Oferta exclusiva para você
        </h2>
        <p className="text-slate-300 text-sm mb-10">
          Cadastre agora e ganhe <strong className="text-emerald-400">50 moedas extras</strong> de bônus
        </p>

        {/* Countdown badge */}
        <div className="inline-flex items-center gap-7 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-9 py-7 mb-7">
          <span className="text-lg">🎁</span>
          <span className="text-emerald-300 text-sm font-bold">
            Oferta válida só por mais{' '}
            <span className="font-mono text-emerald-400">{mm}:{ss}</span>
          </span>
        </div>

        <div className="flex flex-col gap-8">
          <Link
            to="/login?mode=signup"
            onClick={close}
            className="block w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl py-3.5 text-sm transition-all shadow-lg shadow-emerald-500/30"
          >
            Quero minha oferta →
          </Link>
          <button
            onClick={close}
            className="text-slate-500 hover:text-slate-400 text-xs py-6 transition-colors"
          >
            Não, obrigado
          </button>
        </div>
      </div>
    </div>
  );
}
