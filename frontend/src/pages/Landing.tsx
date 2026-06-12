import { MapPin, Zap, ShieldCheck, HeartHandshake, Star, Briefcase, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import StickyCtaMobile from '../components/StickyCtaMobile';
import LiveCounter from '../components/LiveCounter';
import { useUtmParams } from '../hooks/useUtmParams';
import React, { useState, useEffect, lazy, Suspense } from 'react';

const EarningsCalculator = lazy(() => import('../components/EarningsCalculator'));
const CompetitorTable    = lazy(() => import('../components/CompetitorTable'));
const CategoryGrid       = lazy(() => import('../components/CategoryGrid'));
const FomoNotification   = lazy(() => import('../components/FomoNotification'));
const ExitIntentPopup    = lazy(() => import('../components/ExitIntentPopup'));
const ProactiveChat      = lazy(() => import('../components/ProactiveChat'));

const BANNER_H = 44;

function isFlashTime(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  return day === 0 || day === 6 || (hour >= 18 && hour < 22);
}

const CITY_CACHE_KEY = 'melocale_user_city';
const CITY_CACHE_TTL = 30 * 60 * 1000;

async function detectCity(): Promise<string> {
  try {
    const cached = sessionStorage.getItem(CITY_CACHE_KEY);
    if (cached) {
      const { city, ts } = JSON.parse(cached);
      if (city && Date.now() - ts < CITY_CACHE_TTL) return city;
    }
  } catch {
    sessionStorage.removeItem(CITY_CACHE_KEY);
  }

  const apis = [
    async () => {
      const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      return (d.city as string) || null;
    },
    async () => {
      const r = await fetch('https://ip-api.com/json/?fields=city', { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      return (d.city as string) || null;
    },
    async () => {
      const r = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      return (d.city as string) || null;
    },
    async () => {
      const r = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      return (d.city as string) || null;
    },
  ];

  for (const api of apis) {
    try {
      const city = await api();
      if (city) {
        const payload = JSON.stringify({ city, ts: Date.now() });
        sessionStorage.setItem(CITY_CACHE_KEY, payload);
        sessionStorage.setItem('user_city', city);
        return city;
      }
    } catch {
      continue;
    }
  }
  return 'sua cidade';
}

export default function LandingPage() {
  const { isAuthenticated, user } = useAuthStore();
  const role = user?.role;
  const dashboardLink = role === 'admin' ? '/admin/dashboard' : role === 'professional' ? '/profissional/dashboard' : '/cliente/dashboard';
  const { isProfissional } = useUtmParams();

  const [userCity, setUserCity] = useState('sua cidade');
  const [timer, setTimer] = useState({ h: 23, m: 59, s: 59 });
  const [vagas] = useState(() => ({
    starter: 3 + Math.floor(Math.random() * 5),
    pro:     3 + Math.floor(Math.random() * 5),
    elite:   3 + Math.floor(Math.random() * 5),
  }));
  const [showConversionWidgets, setShowConversionWidgets] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const delay = setTimeout(() => {
      detectCity().then(city => { if (!cancelled) setUserCity(city); });
    }, 1500);
    return () => { cancelled = true; clearTimeout(delay); };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setShowConversionWidgets(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setTimer(prev => {
        const { h, m, s } = prev;
        if (s > 0) return { h, m, s: s - 1 };
        if (m > 0) return { h, m: m - 1, s: 59 };
        if (h > 0) return { h: h - 1, m: 59, s: 59 };
        return { h: 23, m: 59, s: 59 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');

  const FAQ_ITEMS = [
    { q: 'Clientes pagam para usar?', a: 'Não. Clientes buscam e recebem orçamentos completamente grátis. Apenas profissionais pagam para acessar contatos.' },
    { q: 'E se o profissional não aparecer?', a: 'Reembolso completo. Garantia de 7 dias em todos os planos — sem questionamentos.' },
    { q: 'Posso cancelar meu plano?', a: 'Sim, a qualquer momento pelo painel. Sem multa e sem fidelidade.' },
    { q: 'Os profissionais são verificados?', a: 'Todos passam por validação de identidade antes de aparecer na plataforma.' },
    { q: 'Funciona em qual cidade?', a: 'Jacobina, Feira de Santana, Irecê e Senhor do Bonfim — expandindo em breve.' },
  ];

  // shared hover helpers
  const hoverGreen = {
    enter: (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,.45)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(16,185,129,.1)'; },
    leave: (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'rgba(16,185,129,.22)'; e.currentTarget.style.boxShadow = ''; },
  };
  const hoverBlue = {
    enter: (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(56,189,248,.45)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(56,189,248,.1)'; },
    leave: (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'rgba(56,189,248,.22)'; e.currentTarget.style.boxShadow = ''; },
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f0f6ff', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── 1. Banner ── */}
      {isFlashTime() ? (
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 md:gap-4 text-white text-xs md:text-sm font-black px-4 sm:px-6 flex-wrap"
          style={{ height: BANNER_H, background: 'linear-gradient(90deg, #92400e 0%, #b45309 50%, #92400e 100%)' }}
        >
          <span>⚡ Oferta Relâmpago</span>
          <span className="hidden sm:inline text-amber-200">—</span>
          <span className="text-amber-100 font-bold">Cadastre agora e ganhe <strong className="text-white">100 moedas extras!</strong></span>
          <Link to="/login?mode=signup" className="ml-1 bg-white/20 hover:bg-white/30 text-white rounded-lg px-3 py-1.5 text-xs font-black transition-colors whitespace-nowrap">
            Aproveitar →
          </Link>
        </div>
      ) : (
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 md:gap-4 text-white text-xs md:text-sm font-black px-4 sm:px-6"
          style={{ height: BANNER_H, background: '#0e1830', borderBottom: '1px solid #0e2035' }}
        >
          <span>🔥 Oferta especial expira em:</span>
          <span className="font-mono text-base md:text-lg tracking-widest bg-black/20 px-3 py-0.5 rounded-lg">
            {pad(timer.h)}:{pad(timer.m)}:{pad(timer.s)}
          </span>
          <Link to="/login?mode=signup" className="hidden sm:inline ml-2 underline underline-offset-2 hover:no-underline opacity-90 hover:opacity-100 transition-opacity">
            Aproveitar →
          </Link>
        </div>
      )}

      {/* ── 2. Navbar ── */}
      <Navbar topOffset={BANNER_H} />

      <main>
        {isProfissional && <Suspense fallback={null}><EarningsCalculator /></Suspense>}

        {/* ── 3. Hero 50/50 ── */}
        <section style={{ position: 'relative', paddingTop: 120, paddingBottom: 64, overflow: 'hidden', background: '#0f172a', borderTop: '2px solid #10b981' }}>
          <div className="container-app" style={{ position: 'relative' }}>

            {/* Eyebrow */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.30)', borderRadius: 20, padding: '4px 14px' }}>🔧 Para profissionais</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.30)', borderRadius: 20, padding: '4px 14px' }}>🏠 Para clientes</span>
            </div>

            {/* Headline */}
            <h1 style={{ textAlign: 'center', fontSize: 'clamp(1.9rem, 5vw, 3rem)', fontWeight: 900, lineHeight: 1.15, marginBottom: 14, color: '#f0f6ff' }}>
              <span style={{ background: 'linear-gradient(135deg,#10b981,#6ee7b7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Ganhe mais</span>
              {' '}ou{' '}
              <span style={{ background: 'linear-gradient(135deg,#38bdf8,#7dd3fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>contrate melhor</span>
              {' '}no interior da Bahia
            </h1>

            {/* Subheadline */}
            <p style={{ textAlign: 'center', fontSize: 15, color: '#6a9ab8', maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.7 }}>
              A plataforma que conecta profissionais qualificados a clientes que precisam de serviços — com segurança, agilidade e resultado.
            </p>

            {/* Two cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ maxWidth: 860, margin: '0 auto' }}>

              {/* Green — Profissional */}
              <div
                style={{ background: '#1e2d45', border: '1px solid rgba(16,185,129,.22)', borderRadius: 20, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14, transition: 'all .2s' }}
                onMouseEnter={hoverGreen.enter} onMouseLeave={hoverGreen.leave}
              >
                <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.30)', borderRadius: 6, padding: '3px 10px', display: 'inline-block', alignSelf: 'flex-start' }}>🔧 Para profissionais</span>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f0f6ff', margin: 0, lineHeight: 1.3 }}>Aumente sua renda com leads qualificados</h3>
                <p style={{ fontSize: 13, color: '#6a9ab8', margin: 0, lineHeight: 1.6 }}>Receba clientes prontos para contratar na sua cidade. Sem depender de indicação.</p>
                <div style={{ background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.30)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 9, color: '#6a9ab8', textTransform: 'uppercase', letterSpacing: '.06em' }}>resultado médio</span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: '#10b981' }}>+R$1.800/mês extra</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {['Leads prontos para contratar', 'Badge verificado no perfil', 'Planos a partir de R$37/mês', 'Comece grátis — sem cartão'].map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#10b981', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 12, color: '#94c4a8' }}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link to="/login?mode=signup&role=professional" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, background: 'linear-gradient(135deg,#047857,#059669,#10b981)', color: '#fff', fontWeight: 800, fontSize: 13, borderRadius: 11, textDecoration: 'none', marginTop: 'auto' }}>
                  Quero receber clientes agora →
                </Link>
              </div>

              {/* Blue — Cliente */}
              <div
                style={{ background: '#1e2d45', border: '1px solid rgba(56,189,248,.22)', borderRadius: 20, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14, transition: 'all .2s' }}
                onMouseEnter={hoverBlue.enter} onMouseLeave={hoverBlue.leave}
              >
                <span style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.30)', borderRadius: 6, padding: '3px 10px', display: 'inline-block', alignSelf: 'flex-start' }}>🏠 Para clientes</span>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f0f6ff', margin: 0, lineHeight: 1.3 }}>Encontre o profissional certo em minutos</h3>
                <p style={{ fontSize: 13, color: '#6a9ab8', margin: 0, lineHeight: 1.6 }}>Receba até 5 orçamentos de profissionais verificados. Grátis, sem compromisso.</p>
                <div style={{ background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.30)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 9, color: '#6a9ab8', textTransform: 'uppercase', letterSpacing: '.06em' }}>tempo médio de resposta</span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: '#38bdf8' }}>47 minutos</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {['Profissionais verificados e avaliados', 'Até 5 orçamentos grátis', 'Compare preços e escolha o melhor', 'Garantia de 7 dias'].map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#38bdf8', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 12, color: '#94b8d4' }}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link to="/login?mode=signup&role=client" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, background: 'linear-gradient(135deg,#0369a1,#0ea5e9,#38bdf8)', color: '#fff', fontWeight: 800, fontSize: 13, borderRadius: 11, textDecoration: 'none', marginTop: 'auto' }}>
                  Encontrar profissional agora →
                </Link>
              </div>
            </div>

            {/* Proof row */}
            <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#4a6a80' }}>
              371+ profissionais &nbsp;·&nbsp; 1.200+ serviços &nbsp;·&nbsp; 98% satisfação &nbsp;·&nbsp; 🔒 Grátis para começar
            </p>
          </div>
        </section>

        {/* ── 4. Trust bar ── */}
        <section style={{ background: '#182035', borderTop: '2px solid #f59e0b', padding: '24px 0' }}>
          <div className="container-app">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: '🔒', label: 'Pagamento seguro', sub: 'Stripe · SSL', border: 'rgba(100,120,180,.30)', bg: 'rgba(56,100,200,.05)' },
                { icon: '⚡', label: 'Resposta 47 min', sub: 'Média real', border: 'rgba(245,158,11,.25)', bg: 'rgba(245,158,11,.10)' },
                { icon: '✅', label: 'Verificados', sub: 'Identidade confirmada', border: 'rgba(16,185,129,.30)', bg: 'rgba(16,185,129,.10)' },
                { icon: '🛡️', label: 'Garantia 7 dias', sub: 'Dinheiro de volta', border: 'rgba(16,185,129,.3)', bg: 'rgba(16,185,129,.12)' },
              ].map(item => (
                <div key={item.label} style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#f0f6ff', margin: 0, lineHeight: 1.2 }}>{item.label}</p>
                    <p style={{ fontSize: 10, color: '#6a9ab8', margin: 0, marginTop: 2 }}>{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. Como funciona dual ── */}
        <section id="como-funciona" style={{ background: '#0f172a', borderTop: '2px solid #38bdf8', padding: '64px 0' }}>
          <div className="container-app">
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem,4vw,2rem)', fontWeight: 800, color: '#f0f6ff', marginBottom: 8 }}>Como funciona?</h2>
            <p style={{ textAlign: 'center', fontSize: 14, color: '#6a9ab8', marginBottom: 40, maxWidth: 480, margin: '0 auto 40px' }}>Três passos simples para cada lado da plataforma</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{ maxWidth: 860, margin: '0 auto' }}>

              {/* Painel Verde — Profissional */}
              <div style={{ background: '#1e2d45', border: '1px solid rgba(16,185,129,.30)', borderRadius: 18, padding: '24px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.30)', borderRadius: 6, padding: '3px 10px' }}>🔧 Profissional</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { n: '01', title: 'Crie seu perfil', sub: '2 minutos', color: '#10b981' },
                    { n: '02', title: 'Receba leads', sub: 'Diariamente', color: '#6ee7b7' },
                    { n: '03', title: 'Feche negócios', sub: '+R$1.800/mês', color: '#10b981' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: s.color, flexShrink: 0 }}>{s.n}</div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>{s.title}</p>
                        <p style={{ fontSize: 11, color: s.color, margin: 0, fontWeight: 700 }}>{s.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Painel Azul — Cliente */}
              <div style={{ background: '#1e2d45', border: '1px solid rgba(56,189,248,.30)', borderRadius: 18, padding: '24px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.30)', borderRadius: 6, padding: '3px 10px' }}>🏠 Cliente</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { n: '01', title: 'Descreva o serviço', sub: '30 segundos', color: '#38bdf8' },
                    { n: '02', title: 'Receba propostas', sub: '47 minutos', color: '#7dd3fc' },
                    { n: '03', title: 'Contrate com segurança', sub: 'Garantia 7 dias', color: '#38bdf8' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: s.color, flexShrink: 0 }}>{s.n}</div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>{s.title}</p>
                        <p style={{ fontSize: 11, color: s.color, margin: 0, fontWeight: 700 }}>{s.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <Link to="/login?mode=signup" style={{ display: 'inline-flex', alignItems: 'center', height: 44, background: 'linear-gradient(135deg,#047857,#10b981)', color: '#fff', fontWeight: 800, fontSize: 14, borderRadius: 12, textDecoration: 'none', padding: '0 28px', gap: 8 }}>
                Começar agora — é grátis →
              </Link>
            </div>
          </div>
        </section>

        {/* ── 6. Objeções ── */}
        <section style={{ background: '#182035', borderTop: '2px solid #10b981', padding: '64px 0' }}>
          <div className="container-app">
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 800, color: '#f0f6ff', marginBottom: 8 }}>Por que confiar no MeloCalé?</h2>
            <p style={{ textAlign: 'center', fontSize: 14, color: '#6a9ab8', marginBottom: 40, maxWidth: 440, margin: '0 auto 40px' }}>Respondemos os principais medos de cada lado</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{ maxWidth: 860, margin: '0 auto' }}>

              {/* Painel Verde */}
              <div style={{ background: '#1e2d45', border: '1px solid rgba(16,185,129,.30)', borderRadius: 18, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.30)', borderRadius: 6, padding: '3px 10px', alignSelf: 'flex-start' }}>🔧 Para profissionais</span>
                {[
                  { emoji: '😰', q: 'Vale o investimento?', a: '1 cliente de R$500 já paga o PRO por 7 meses. Média: +R$1.800/mês extra.' },
                  { emoji: '🤔', q: 'Os leads são de qualidade?', a: 'Clientes preenchem pedido detalhado antes de chegar até você. Já estão prontos para contratar.' },
                  { emoji: '⏳', q: 'Demora para funcionar?', a: 'Perfil criado em 2 minutos. Primeiros leads chegam no mesmo dia.' },
                ].map(item => (
                  <div key={item.q}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{item.emoji}</span> {item.q}
                    </p>
                    <p style={{ fontSize: 12, color: '#6a9ab8', margin: 0, lineHeight: 1.6, paddingLeft: 20 }}>{item.a}</p>
                  </div>
                ))}
              </div>

              {/* Painel Azul */}
              <div style={{ background: '#1e2d45', border: '1px solid rgba(56,189,248,.30)', borderRadius: 18, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.30)', borderRadius: 6, padding: '3px 10px', alignSelf: 'flex-start' }}>🏠 Para clientes</span>
                {[
                  { emoji: '😰', q: 'E se for golpe?', a: 'Todo profissional passa por validação de identidade. Garantia de 7 dias com dinheiro de volta.' },
                  { emoji: '💸', q: 'Vou pagar caro?', a: 'Você recebe até 5 orçamentos e escolhe o melhor preço. Nenhum compromisso antes de decidir.' },
                  { emoji: '⏳', q: 'Tem profissional perto?', a: '371 profissionais em 4 cidades. Resposta em 47 minutos — não horas, não dias.' },
                ].map(item => (
                  <div key={item.q}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{item.emoji}</span> {item.q}
                    </p>
                    <p style={{ fontSize: 12, color: '#6a9ab8', margin: 0, lineHeight: 1.6, paddingLeft: 20 }}>{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 7. Garantia ── */}
        <section style={{ background: '#0f172a', borderTop: '2px solid #f59e0b', padding: '48px 0' }}>
          <div className="container-app">
            <div style={{ maxWidth: 580, margin: '0 auto', background: 'linear-gradient(135deg,rgba(16,185,129,.12),rgba(16,185,129,.03))', border: '2px solid rgba(16,185,129,.28)', borderRadius: 20, padding: '32px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: 42, marginBottom: 12 }}>🛡️</div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#f0f6ff', marginBottom: 12 }}>Garantia incondicional de 7 dias</h3>
              <p style={{ fontSize: 14, color: '#6a9ab8', lineHeight: 1.7, margin: 0 }}>
                Se você não ficar satisfeito nos primeiros 7 dias, devolvemos cada centavo — sem questionamentos, sem burocracia, sem fidelidade. <strong style={{ color: '#10b981' }}>Zero risco para você.</strong>
              </p>
            </div>
          </div>
        </section>

        {/* ── 8. LiveCounter ── */}
        <LiveCounter userCity={userCity} />

        {/* ── 9. Por que escolher + CompetitorTable ── */}
        <section className="py-16" style={{ background: '#182035', borderTop: '2px solid #10b981' }}>
          <div className="container-app">
            <div className="text-center" style={{ marginBottom: '4rem' }}>
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                A plataforma que conecta você ao <span className="text-emerald-400">profissional certo</span> —<br className="hidden lg:block" /> rápido, seguro e perto de você
              </h2>
            </div>
            <div className="flex flex-col lg:flex-row gap-4 items-start">
              <div className="hidden lg:flex flex-col gap-2 w-[85px] shrink-0 relative">
                {[
                  { icon: <ShieldCheck size={14} className="text-purple-400" />, bg: 'bg-purple-500/10', title: 'Profissionais Verificados' },
                  { icon: <Zap size={14} className="text-emerald-400" />, bg: 'bg-emerald-500/10', title: 'Atendimento Rápido' },
                  { icon: <MapPin size={14} className="text-blue-400" />, bg: 'bg-blue-500/10', title: 'Perto de Você' },
                  { icon: <ShieldCheck size={14} className="text-emerald-400" />, bg: 'bg-emerald-500/10', title: 'Pagamento Seguro' },
                ].map((item, i) => (
                  <div key={i} className="bg-[#0D2318] border border-emerald-500/70 rounded-lg p-2 flex flex-col items-center justify-center gap-1.5 aspect-square shadow-[0_0_16px_rgba(16,185,129,0.35)]">
                    <div className={`w-7 h-7 rounded-md ${item.bg} flex items-center justify-center`}>{item.icon}</div>
                    <h3 className="text-white font-bold text-[10px] text-center leading-tight">{item.title}</h3>
                  </div>
                ))}
              </div>
              <div className="flex-1">
                <Suspense fallback={null}><CompetitorTable /></Suspense>
              </div>
            </div>
          </div>
        </section>

        {/* ── 10. CategoryGrid ── */}
        <div className="-mt-16"><Suspense fallback={null}><CategoryGrid userCity={userCity} /></Suspense></div>

        {/* ── 11. Stats + Depoimentos ── */}
        <section style={{ background: '#0f172a', borderTop: '2px solid #38bdf8', padding: '64px 0' }}>
          <div className="container-app">

            {/* Stats dual */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 48 }}>
              <div style={{ background: '#1e2d45', border: '1px solid rgba(16,185,129,.30)', borderRadius: 18, padding: '24px 20px' }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>🔧 Resultados dos profissionais</p>
                <div className="grid grid-cols-3 gap-3" style={{ textAlign: 'center' }}>
                  {[
                    { val: '371+', label: 'Profissionais' },
                    { val: '+R$1.800', label: 'Renda/mês extra' },
                    { val: '1º dia', label: '1º lead' },
                  ].map(s => (
                    <div key={s.label}>
                      <p style={{ fontSize: 'clamp(1.1rem,3vw,1.6rem)', fontWeight: 900, color: '#10b981', margin: 0 }}>{s.val}</p>
                      <p style={{ fontSize: 10, color: '#6a9ab8', margin: '4px 0 0' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#1e2d45', border: '1px solid rgba(56,189,248,.30)', borderRadius: 18, padding: '24px 20px' }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>🏠 Resultados dos clientes</p>
                <div className="grid grid-cols-3 gap-3" style={{ textAlign: 'center' }}>
                  {[
                    { val: '1.200+', label: 'Serviços' },
                    { val: '47 min', label: 'Resp. média' },
                    { val: '98%', label: 'Satisfação' },
                  ].map(s => (
                    <div key={s.label}>
                      <p style={{ fontSize: 'clamp(1.1rem,3vw,1.6rem)', fontWeight: 900, color: '#38bdf8', margin: 0 }}>{s.val}</p>
                      <p style={{ fontSize: 10, color: '#6a9ab8', margin: '4px 0 0' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Depoimentos */}
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 800, color: '#f0f6ff', marginBottom: 32 }}>
              Quem usa, <span style={{ color: '#10b981' }}>recomenda</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5" style={{ marginBottom: 40 }}>
              {/* Depoimento 1 — Carlos */}
              <div style={{ background: '#1e2d45', border: '1px solid rgba(16,185,129,.30)', borderRadius: 18, padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.30)', borderRadius: 5, padding: '2px 8px', alignSelf: 'flex-start' }}>🔧 Profissional</span>
                <div style={{ background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.30)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#6a9ab8', textTransform: 'uppercase', letterSpacing: '.05em' }}>resultado</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#10b981' }}>+R$1.800/mês</span>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />)}
                </div>
                <p style={{ fontSize: 13, color: '#6a9ab8', lineHeight: 1.6, flex: 1 }}>
                  "Em 2 semanas já tinha 3 clientes novos. O MeloCalé mudou meu mês — faturei R$1.800 a mais só com os leads da plataforma."
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid #0e2035' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>C</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>Carlos Silva</p>
                    <p style={{ fontSize: 11, color: '#4a6a80', margin: 0 }}>Eletricista · Feira de Santana, BA</p>
                  </div>
                </div>
              </div>

              {/* Depoimento 2 — Ana */}
              <div style={{ background: '#1e2d45', border: '1px solid rgba(56,189,248,.30)', borderRadius: 18, padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.30)', borderRadius: 5, padding: '2px 8px', alignSelf: 'flex-start' }}>🏠 Cliente</span>
                <div style={{ background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.30)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#6a9ab8', textTransform: 'uppercase', letterSpacing: '.05em' }}>resultado</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#38bdf8' }}>2 propostas em 47 min</span>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />)}
                </div>
                <p style={{ fontSize: 13, color: '#6a9ab8', lineHeight: 1.6, flex: 1 }}>
                  "Precisava de um encanador urgente. Em menos de 1 hora já tinha 2 orçamentos. Contratei na hora e o serviço foi excelente!"
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid #0e2035' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>A</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>Ana Rodrigues</p>
                    <p style={{ fontSize: 11, color: '#4a6a80', margin: 0 }}>Cliente · Jacobina, BA</p>
                  </div>
                </div>
              </div>

              {/* Depoimento 3 — Marcos */}
              <div style={{ background: '#1e2d45', border: '1px solid rgba(245,158,11,.30)', borderRadius: 18, padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.30)', borderRadius: 5, padding: '2px 8px', alignSelf: 'flex-start' }}>🔧 Profissional</span>
                <div style={{ background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.30)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#6a9ab8', textTransform: 'uppercase', letterSpacing: '.05em' }}>resultado</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#f59e0b' }}>Renda principal</span>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />)}
                </div>
                <p style={{ fontSize: 13, color: '#6a9ab8', lineHeight: 1.6, flex: 1 }}>
                  "Tinha medo de não conseguir clientes pela internet. Hoje o MeloCalé é minha principal fonte de trabalho. Vale cada centavo."
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid #0e2035' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>M</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>Marcos Oliveira</p>
                    <p style={{ fontSize: 11, color: '#4a6a80', margin: 0 }}>Pintor · Irecê, BA</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA dual pós-depoimentos */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/login?mode=signup&role=client" style={{ display: 'inline-flex', alignItems: 'center', height: 44, background: 'linear-gradient(135deg,#047857,#10b981)', color: '#fff', fontWeight: 800, fontSize: 13, borderRadius: 12, textDecoration: 'none', padding: '0 22px' }}>
                Ver profissionais disponíveis agora →
              </Link>
              <Link to="/login?mode=signup&role=professional" style={{ display: 'inline-flex', alignItems: 'center', height: 44, background: 'transparent', color: '#38bdf8', fontWeight: 700, fontSize: 13, borderRadius: 12, textDecoration: 'none', padding: '0 22px', border: '1px solid rgba(56,189,248,.3)' }}>
                Quero receber clientes →
              </Link>
            </div>
          </div>
        </section>

        {/* ── 12. EarningsCalculator (!isProfissional) ── */}
        {!isProfissional && <Suspense fallback={null}><EarningsCalculator /></Suspense>}

        {/* ── 13. Planos ── */}
        <section id="planos" className="py-28" style={{ background: '#182035', borderTop: '2px solid #f59e0b' }}>
          <div className="container-app">
            <div className="text-center mb-12" style={{ textAlign: 'center', marginLeft: 'auto', marginRight: 'auto', maxWidth: '48rem' }}>
              <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400 mb-5" style={{ marginBottom: '1rem' }}>
                🔥 Oferta por tempo limitado
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6" style={{ marginBottom: '1rem' }}>
                Quanto você quer <span className="text-emerald-500">faturar</span> este mês?
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: '#6a9ab8' }}>Para profissionais que querem</span>
                <span style={{ fontSize: 13, color: '#6ee7b7', fontWeight: 700 }}>receber mais clientes</span>
              </div>
              <p className="text-base leading-relaxed text-[#94A3B8] max-w-2xl mx-auto text-center" style={{ marginBottom: '1rem', textAlign: 'center', marginLeft: 'auto', marginRight: 'auto' }}>
                Profissionais na Melocale faturam em média <strong className="text-white">R$2.800/mês</strong> extras.<br />Escolha seu plano e comece hoje.
              </p>
              <p className="text-emerald-400 text-sm font-bold mt-4 text-center" style={{ marginBottom: '1rem' }}>⚡ 73% dos profissionais escolhem o PRO — o plano que mais gera retorno</p>
            </div>

            <div className="flex justify-center mb-10" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-3">
                <span className="text-emerald-400 text-xl">🛡️</span>
                <span className="text-emerald-400 font-bold text-sm">Garantia de 7 dias — dinheiro de volta sem perguntas</span>
              </div>
            </div>

            <div className="max-w-6xl mx-auto mb-10 grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ marginBottom: '1.5rem', marginLeft: 'auto', marginRight: 'auto', maxWidth: '72rem' }}>
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                <span className="text-3xl">☕</span>
                <div>
                  <p className="text-emerald-300 font-bold text-sm leading-tight">Menos que 1 café por dia</p>
                  <p className="text-slate-400 text-xs mt-0.5">R$37/mês = R$1,23/dia</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                <span className="text-3xl">🍕</span>
                <div>
                  <p className="text-emerald-300 font-bold text-sm leading-tight">Menos que uma pizza</p>
                  <p className="text-slate-400 text-xs mt-0.5">Por mês você acessa clientes ilimitados</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                <span className="text-3xl">💡</span>
                <div>
                  <p className="text-emerald-300 font-bold text-sm leading-tight">1 cliente já paga 7 meses</p>
                  <p className="text-slate-400 text-xs mt-0.5">Um serviço de R$500 cobre o plano PRO por 7 meses</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-left max-w-6xl mx-auto mb-12 px-0" style={{ marginBottom: '2rem' }}>
              {/* GRATUITO */}
              <div className="bg-[#1e2d45] rounded-2xl border border-slate-800 flex flex-col opacity-70 hover:opacity-100 transition-opacity duration-200" style={{ padding: '3.5rem 2rem' }}>
                <div className="mb-8">
                  <h3 className="text-[#94A3B8] font-bold text-sm uppercase tracking-widest mb-2">Gratuito</h3>
                  <div className="text-3xl font-extrabold text-white mb-2">R$ 0<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-sm text-[#4A6580]">Para conhecer a plataforma</p>
                </div>
                <Link to="/login" className="inline-flex items-center justify-center w-full h-14 bg-slate-800 hover:bg-slate-700 text-white rounded-xl px-10 text-sm font-bold transition-all mb-4">
                  Explorar Grátis →
                </Link>
                <ul className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <li className="flex items-start gap-3 text-[#94A3B8] text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-[#4A6580] shrink-0 mt-0.5" size={16}/> Cadastro na plataforma</li>
                  <li className="flex items-start gap-3 text-[#94A3B8] text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-[#4A6580] shrink-0 mt-0.5" size={16}/> Ver leads disponíveis</li>
                  <li className="flex items-start gap-3 text-[#94A3B8] text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> 10 moedas de boas-vindas</li>
                  <li className="hidden sm:flex items-start gap-3 text-[#4A6580] text-sm line-through" style={{ marginBottom: '1rem' }}><XIcon className="text-slate-700 shrink-0 mt-0.5" size={16}/> Desconto em moedas</li>
                  <li className="hidden sm:flex items-start gap-3 text-[#4A6580] text-sm line-through" style={{ marginBottom: '1rem' }}><XIcon className="text-slate-700 shrink-0 mt-0.5" size={16}/> Badge verificado</li>
                </ul>
              </div>

              {/* STARTER */}
              <div className="bg-[#1e2d45] rounded-2xl border border-blue-500/30 flex flex-col relative overflow-hidden opacity-85 hover:opacity-100 transition-opacity duration-200" style={{ padding: '3.5rem 2rem' }}>
                <div className="mb-8">
                  <div className="inline-block px-3 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">Starter</div>
                  <div className="text-3xl font-extrabold text-white mb-2">R$ 37<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-emerald-400 text-xs font-bold">25% off em todas as moedas</p>
                </div>
                <Link to="/login?mode=signup&role=professional" className="inline-flex items-center justify-center w-full h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-10 text-sm font-bold transition-all mb-4 shadow-lg shadow-blue-500/20">
                  Quero Receber Leads →
                </Link>
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <span>⚠️</span><span>Apenas {vagas.starter} vagas restantes em {userCity}</span>
                </div>
                <ul className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <li className="flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> 25% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> Badge ✅ VERIFICADO</li>
                  <li className="flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> Perfil público visível</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 🎁 30 moedas de boas-vindas</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> Suporte por chat</li>
                </ul>
                <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-blue-300 text-xs text-center">Pacote R$59,90 → <strong>R$44,93</strong> com Starter</p>
                </div>
              </div>

              {/* PRO — DESTAQUE */}
              <div className="bg-gradient-to-b from-[#1c1d28] to-[#1C3454] rounded-2xl border-2 border-emerald-500 flex flex-col relative mt-0 z-10 shadow-[0_0_50px_-10px_rgba(16,185,129,0.4)]" style={{ padding: '3.5rem 2rem' }}>
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-black px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase whitespace-nowrap">
                  ⚡ Mais Popular
                </div>
                <div className="mb-8">
                  <div className="inline-block px-3 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">PRO</div>
                  <div className="text-3xl font-extrabold text-white mb-2">R$ 67<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-emerald-400 text-xs font-bold">40% off em todas as moedas</p>
                </div>
                <Link to="/login?mode=signup&role=professional" className="inline-flex items-center justify-center w-full h-14 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl px-10 text-sm font-black transition-all mb-4 shadow-xl shadow-emerald-500/30">
                  Receber Meu Primeiro Lead →
                </Link>
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <span>⚠️</span><span>Apenas {vagas.pro} vagas restantes em {userCity}</span>
                </div>
                <ul className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <li className="flex items-start gap-3 text-slate-200 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> 40% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-3 text-slate-200 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> Badge ⚡ PRO em destaque</li>
                  <li className="flex items-start gap-3 text-slate-200 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> 2x mais visível nas buscas</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-200 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> Moedas nunca expiram</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-200 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 🎁 80 moedas de boas-vindas</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-200 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> Suporte prioritário (2h)</li>
                </ul>
                <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-emerald-300 text-xs text-center">Pacote R$59,90 → <strong>R$35,94</strong> com PRO</p>
                  <p className="text-emerald-400 text-[10px] text-center mt-2 font-bold">O plano se paga em 1 compra de moedas</p>
                </div>
              </div>

              {/* ELITE */}
              <div className="bg-[#1e2d45] rounded-2xl border border-yellow-500/30 flex flex-col relative overflow-hidden opacity-85 hover:opacity-100 transition-opacity duration-200" style={{ padding: '3.5rem 2rem' }}>
                <div className="mb-8">
                  <div className="inline-block px-3 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">🏆 Elite</div>
                  <div className="text-3xl font-extrabold text-white mb-2">R$ 127<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-yellow-400 text-xs font-bold">55% off em todas as moedas</p>
                </div>
                <Link to="/login?mode=signup&role=professional" className="inline-flex items-center justify-center w-full h-14 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl px-10 text-sm font-black transition-all mb-4 shadow-lg shadow-yellow-500/20">
                  Dominar {userCity} Agora →
                </Link>
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <span>⚠️</span><span>Apenas {vagas.elite} vagas restantes em {userCity}</span>
                </div>
                <ul className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <li className="flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 55% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Badge 🏆 ELITE dourado</li>
                  <li className="flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Topo absoluto das buscas</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Até 3 profissionais na conta</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 🎁 200 moedas de boas-vindas</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '1rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Gerente de conta dedicado</li>
                </ul>
                <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                  <p className="text-yellow-300 text-xs text-center">Pacote R$119,90 → <strong>R$53,96</strong> com Elite</p>
                </div>
              </div>
            </div>

            <div className="max-w-3xl mx-auto bg-[#1e2d45] border border-[#1C3050] rounded-2xl p-10 text-center" style={{ marginBottom: '1rem', marginLeft: 'auto', marginRight: 'auto' }}>
              <p className="text-[#94A3B8] text-sm mb-4">💡 Pense assim:</p>
              <p className="text-white text-xl font-bold mb-4">
                1 cliente de <span className="text-emerald-400">R$ 500</span> já paga o plano PRO por <span className="text-emerald-400">7 meses</span>
              </p>
              <p className="text-[#4A6580] text-sm">E com 40% de desconto em moedas, você acessa muito mais clientes pelo mesmo preço.</p>
            </div>
          </div>
        </section>

        {/* ── 14. FAQ ── */}
        <section style={{ background: '#0f172a', borderTop: '2px solid #38bdf8', padding: '64px 0' }}>
          <div className="container-app">
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 800, color: '#f0f6ff', marginBottom: 32 }}>Perguntas frequentes</h2>
            <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} style={{ background: '#1e2d45', border: `1px solid ${openFaq === i ? 'rgba(16,185,129,.3)' : '#0e2035'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color .2s' }}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{ width: '100%', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'none', border: 'none', color: '#f0f6ff', textAlign: 'left', fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{item.q}</span>
                    <span style={{ fontSize: 18, color: '#10b981', fontWeight: 900, flexShrink: 0, marginLeft: 12, transition: 'transform .2s', display: 'inline-block', transform: openFaq === i ? 'rotate(45deg)' : '' }}>+</span>
                  </button>
                  {openFaq === i && (
                    <div style={{ padding: '0 18px 14px', fontSize: 13, color: '#6a9ab8', lineHeight: 1.7 }}>
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 15. CTA Final Dual ── */}
        <section style={{ background: '#182035', borderTop: '2px solid #10b981', padding: '64px 0' }}>
          <div className="container-app">

            {/* Timer */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <p style={{ fontSize: 12, color: '#6a9ab8', marginBottom: 8 }}>🔥 Oferta especial expira em:</p>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 900, color: '#f59e0b', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, padding: '6px 18px', letterSpacing: '.1em' }}>
                {pad(timer.h)}:{pad(timer.m)}:{pad(timer.s)}
              </span>
            </div>

            {/* Two cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ maxWidth: 760, margin: '0 auto 28px' }}>

              {/* Verde */}
              <div style={{ background: '#1e2d45', border: '1px solid rgba(16,185,129,.22)', borderRadius: 18, padding: '28px 22px', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: 32 }}>🔧</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.30)', borderRadius: 6, padding: '3px 10px' }}>Para profissionais</span>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#f0f6ff', margin: 0 }}>Comece a receber clientes hoje</h3>
                <p style={{ fontSize: 12, color: '#6a9ab8', margin: 0 }}>Profissionais em {userCity} já estão recebendo leads qualificados.</p>
                <Link to="/login?mode=signup&role=professional" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, width: '100%', background: 'linear-gradient(135deg,#047857,#059669,#10b981)', color: '#fff', fontWeight: 800, fontSize: 13, borderRadius: 11, textDecoration: 'none' }}>
                  Quero receber clientes →
                </Link>
                <p style={{ fontSize: 10, color: '#4a6a80', margin: 0 }}>Grátis para começar · planos a partir de R$37/mês</p>
              </div>

              {/* Azul */}
              <div style={{ background: '#1e2d45', border: '1px solid rgba(56,189,248,.22)', borderRadius: 18, padding: '28px 22px', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: 32 }}>🏠</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.30)', borderRadius: 6, padding: '3px 10px' }}>Para clientes</span>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#f0f6ff', margin: 0 }}>Encontre o profissional em 47 min</h3>
                <p style={{ fontSize: 12, color: '#6a9ab8', margin: 0 }}>Profissionais verificados disponíveis em {userCity} agora.</p>
                <Link to="/login?mode=signup&role=client" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, width: '100%', background: 'linear-gradient(135deg,#0369a1,#0ea5e9,#38bdf8)', color: '#fff', fontWeight: 800, fontSize: 13, borderRadius: 11, textDecoration: 'none' }}>
                  Encontrar profissional →
                </Link>
                <p style={{ fontSize: 10, color: '#4a6a80', margin: 0 }}>Grátis · sem cartão · garantia de 7 dias</p>
              </div>
            </div>

            {/* Trust row */}
            <p style={{ textAlign: 'center', fontSize: 11, color: '#2a3a4a' }}>
              🔒 SSL &nbsp;·&nbsp; ⚡ 47 min &nbsp;·&nbsp; 🛡️ Garantia 7 dias &nbsp;·&nbsp; ✅ Verificados &nbsp;·&nbsp; 🚫 Sem spam
            </p>
          </div>
        </section>

      </main>

      {/* ── 16. Footer ── */}
      <Footer />

      {/* ── 17. Widgets de conversão ── */}
      <StickyCtaMobile vagasPro={vagas.pro} userCity={userCity} />
      {showConversionWidgets && (
        <>
          <Suspense fallback={null}><FomoNotification /></Suspense>
          <Suspense fallback={null}><ExitIntentPopup /></Suspense>
          <Suspense fallback={null}><ProactiveChat userCity={userCity} /></Suspense>
        </>
      )}
    </div>
  );
}

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

function CheckIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...props} width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  );
}

function XIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...props} width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  );
}
