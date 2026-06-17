import React, { useEffect, useState, useRef } from 'react';

interface Props {
  userCity: string;
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function LiveCounter({ userCity }: Props) {
  const [visitors, setVisitors] = useState(() => rand(23, 47));
  const [budgets, setBudgets] = useState(() => rand(8, 24));
  const [visFlash, setVisFlash] = useState(false);
  const [budFlash, setBudFlash] = useState(false);

  const visTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const budTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function scheduleVisitor() {
      visTimerRef.current = setTimeout(() => {
        setVisitors(prev => {
          const next = prev + (Math.random() > 0.5 ? 1 : -1);
          return Math.max(18, Math.min(60, next));
        });
        setVisFlash(true);
        setTimeout(() => setVisFlash(false), 500);
        scheduleVisitor();
      }, rand(8_000, 15_000));
    }

    function scheduleBudget() {
      budTimerRef.current = setTimeout(() => {
        setBudgets(prev => prev + 1);
        setBudFlash(true);
        setTimeout(() => setBudFlash(false), 500);
        scheduleBudget();
      }, rand(3 * 60_000, 7 * 60_000));
    }

    scheduleVisitor();
    scheduleBudget();

    return () => {
      if (visTimerRef.current) clearTimeout(visTimerRef.current);
      if (budTimerRef.current) clearTimeout(budTimerRef.current);
    };
  }, []);

  return (
    <div
      className="w-full py-2.5 px-9"
      style={{ background: '#182035', borderTop: '2px solid #38bdf8', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-8">
        <span
          className="text-xs text-slate-400 transition-colors duration-300"
          style={visFlash ? { color: '#34d399' } : undefined}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1.5 align-middle animate-pulse" />
          <span
            className="font-bold text-slate-200 tabular-nums"
            style={visFlash ? { color: '#34d399' } : undefined}
          >
            {visitors}
          </span>{' '}
          pessoas visitando agora
        </span>

        <span className="hidden sm:block text-slate-700">|</span>

        <span
          className="text-xs text-slate-400 transition-colors duration-300"
          style={budFlash ? { color: '#34d399' } : undefined}
        >
          📋{' '}
          <span
            className="font-bold text-slate-200 tabular-nums"
            style={budFlash ? { color: '#34d399' } : undefined}
          >
            {budgets}
          </span>{' '}
          orçamentos enviados hoje em {userCity}
        </span>
      </div>
    </div>
  );
}
