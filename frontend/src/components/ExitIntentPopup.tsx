import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

const SESSION_KEY = 'melocale_exit_shown';
const TIMER_MINUTES = 10;

interface ExitIntentPopupProps {
  audience?: 'profissional' | 'cliente';
}

export default function ExitIntentPopup({ audience }: ExitIntentPopupProps) {
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
    if (audience !== 'cliente') {
      countdownRef.current = setInterval(() => {
        setTimeLeft(prev => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
  }, [audience]);

  const close = useCallback(() => {
    setVisible(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  useEffect(() => {
    const isMobile = window.matchMedia('(hover: none)').matches;

    if (!isMobile) {
      const handleMouseLeave = (e: MouseEvent) => {
        if (e.clientY < 10) show();
      };
      document.addEventListener('mouseleave', handleMouseLeave);
      return () => document.removeEventListener('mouseleave', handleMouseLeave);
    } else {
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

  if (audience === 'profissional') {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.65)' }}
        onClick={close}
      >
        <div
          className="relative w-full max-w-sm rounded-xl p-5 text-center shadow-2xl"
          style={{ background: '#1C3454', border: '2px solid #10b981', boxShadow: '0 0 40px rgba(16,185,129,0.3)' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={close}
            aria-label="Fechar"
            className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <p className="text-3xl mb-3">💸</p>
          <h2 className="text-lg font-bold text-white mb-2">
            Você vai fechar e perder R$1.800 esse mês
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Enquanto você hesita, outro profissional em Jacobina está recebendo os clientes que seriam seus.
          </p>

          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1.5 mb-4">
            <span className="text-sm">⚡</span>
            <span className="text-emerald-300 text-sm font-bold">
              Vaga reservada por{' '}
              <span className="font-mono text-emerald-400">{mm}:{ss}</span>
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              to="/login?mode=signup&role=professional"
              onClick={close}
              className="cta-pulse block w-full h-10 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-lg transition-all shadow-lg shadow-emerald-500/30"
            >
              Garantir minha vaga agora →
            </Link>
            <button
              onClick={close}
              className="text-slate-500 hover:text-slate-400 text-xs py-1.5 transition-colors"
            >
              Não, prefiro continuar perdendo clientes
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (audience === 'cliente') {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.65)' }}
        onClick={close}
      >
        <div
          className="relative w-full max-w-sm rounded-xl p-5 text-center shadow-2xl"
          style={{ background: '#1C3454', border: '2px solid #38bdf8', boxShadow: '0 0 40px rgba(56,189,248,0.3)' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={close}
            aria-label="Fechar"
            className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <p className="text-3xl mb-3">⚡</p>
          <h2 className="text-lg font-bold text-white mb-2">
            Ainda precisa resolver o problema?
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Profissionais disponíveis em Jacobina agora. Em 47 minutos você já tem orçamentos —{' '}
            <strong className="text-sky-400">100% grátis.</strong>
          </p>

          <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/30 rounded-full px-3 py-1.5 mb-4">
            <span className="text-sm">🏠</span>
            <span className="text-sky-300 text-sm font-bold">2 eletricistas disponíveis hoje</span>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              to="/login?mode=signup&role=client"
              onClick={close}
              className="cta-pulse block w-full h-10 flex items-center justify-center bg-sky-500 hover:bg-sky-400 text-black text-sm font-bold rounded-lg transition-all shadow-lg shadow-sky-500/30"
            >
              Ver profissionais disponíveis →
            </Link>
            <button
              onClick={close}
              className="text-slate-500 hover:text-slate-400 text-xs py-1.5 transition-colors"
            >
              Não, vou procurar sozinho
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Genérico — oferta de 50 moedas
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.65)' }}
      onClick={close}
    >
      <div
        className="relative w-full max-w-sm rounded-xl p-5 text-center shadow-2xl"
        style={{ background: '#1C3454', border: '2px solid #10b981', boxShadow: '0 0 40px rgba(16,185,129,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Fechar"
          className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <p className="text-3xl mb-3">⚡</p>
        <h2 className="text-lg font-bold text-white mb-2">
          Espera! Oferta exclusiva para você
        </h2>
        <p className="text-slate-400 text-sm mb-4">
          Cadastre agora e ganhe <strong className="text-emerald-400">50 moedas extras</strong> de bônus
        </p>

        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1.5 mb-4">
          <span className="text-sm">🎁</span>
          <span className="text-emerald-300 text-sm font-bold">
            Oferta válida só por mais{' '}
            <span className="font-mono text-emerald-400">{mm}:{ss}</span>
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            to="/login?mode=signup"
            onClick={close}
            className="cta-pulse block w-full h-10 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-lg transition-all shadow-lg shadow-emerald-500/30"
          >
            Quero minha oferta →
          </Link>
          <button
            onClick={close}
            className="text-slate-500 hover:text-slate-400 text-xs py-1.5 transition-colors"
          >
            Não, obrigado
          </button>
        </div>
      </div>
    </div>
  );
}
