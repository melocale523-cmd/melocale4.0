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

const BANNER_H = 52;

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
  const { isProfissional, isCliente } = useUtmParams();

  const [userCity, setUserCity] = useState('sua cidade');

  const urlParams = new URLSearchParams(window.location.search);
  const cidadeParam = urlParams.get('cidade');
  const displayCity = cidadeParam || userCity;

  const [timer, setTimer] = useState({ h: 23, m: 59, s: 59 });
  const [vagas] = useState(() => ({
    starter: 3 + Math.floor(Math.random() * 5),
    pro:     3 + Math.floor(Math.random() * 5),
    elite:   3 + Math.floor(Math.random() * 5),
  }));
  const [showConversionWidgets, setShowConversionWidgets] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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

  const stepsData = isProfissional ? [
    { n: '01', title: 'Crie seu perfil', sub: '2 minutos', desc: `Adicione seu serviço, foto e área de atuação. Seu perfil fica visível para clientes de ${displayCity} imediatamente.`, color: '#10b981', bg: 'rgba(16,185,129,.14)', border: 'rgba(16,185,129,.35)' },
    { n: '02', title: 'Receba leads no celular', sub: 'Todo dia', desc: 'Clientes preenchem pedido detalhado — você recebe o contato direto. Só chegam quem já quer contratar.', color: '#10b981', bg: 'rgba(16,185,129,.14)', border: 'rgba(16,185,129,.35)' },
    { n: '03', title: 'Feche e fature', sub: '+R$1.800/mês extra', desc: 'Entre em contato, faça o orçamento, feche o serviço. Profissionais ativos fecham 3–5 serviços por semana.', color: '#10b981', bg: 'rgba(16,185,129,.14)', border: 'rgba(16,185,129,.35)' },
  ] : [
    { n: '01', title: 'Descreva o serviço', sub: '30 segundos', desc: 'Conte o que precisa — eletricista, pintor, encanador. Quanto mais detalhe, melhor o orçamento.', color: '#38bdf8', bg: 'rgba(56,189,248,.12)', border: 'rgba(56,189,248,.35)' },
    { n: '02', title: 'Receba propostas', sub: 'Até 5 em 47 min', desc: `Profissionais verificados de ${displayCity} entram em contato. Compare preços sem sair de casa.`, color: '#38bdf8', bg: 'rgba(56,189,248,.12)', border: 'rgba(56,189,248,.35)' },
    { n: '03', title: 'Contrate com segurança', sub: 'Garantia 7 dias', desc: 'Escolha o melhor, pague com segurança. Insatisfeito em 7 dias? Devolvemos tudo.', color: '#38bdf8', bg: 'rgba(56,189,248,.12)', border: 'rgba(56,189,248,.35)' },
  ];

  const trustData = isProfissional ? [
    { icon: '💰', q: 'Vale o investimento?', a: '1 cliente de R$500 já paga o PRO por 7 meses. Com 3 serviços por semana, o ROI é de mais de 2.000% ao mês.', color: '#10b981', border: 'rgba(16,185,129,.35)' },
    { icon: '🎯', q: 'Os leads são sérios?', a: 'Clientes preenchem pedido detalhado antes de chegar até você. Zero lead "só pra saber o preço" — chegam prontos para fechar.', color: '#10b981', border: 'rgba(16,185,129,.35)' },
    { icon: '⚡', q: 'Quanto tempo leva?', a: 'Perfil em 2 minutos. Primeiros leads no mesmo dia. Em uma semana você já tem retorno sobre o investimento.', color: '#10b981', border: 'rgba(16,185,129,.35)' },
  ] : [
    { icon: '🛡️', q: 'É seguro de verdade?', a: 'Todo profissional passa por validação de identidade. Mais seguro que pedir indicação no grupo do WhatsApp — onde você não sabe nada do prestador.', color: '#38bdf8', border: 'rgba(56,189,248,.35)' },
    { icon: '💸', q: 'Vou economizar?', a: 'Com 5 orçamentos para comparar, clientes economizam em média 23% no preço final. Você escolhe com calma — sem pressão.', color: '#38bdf8', border: 'rgba(56,189,248,.35)' },
    { icon: '📍', q: 'Tem perto de mim?', a: `Profissionais ativos em ${displayCity} e região. Resposta em 47 minutos — não dias esperando alguém indicar.`, color: '#38bdf8', border: 'rgba(56,189,248,.35)' },
  ];

  const statsData = isProfissional ? [
    { val: '+R$1.800', lbl: 'Renda extra por mês', sub: 'média dos profissionais ativos', color: '#10b981' },
    { val: '1º dia', lbl: 'Primeiro lead chega', sub: 'após criar o perfil', color: '#10b981' },
    { val: '3–5x', lbl: 'Mais serviços por semana', sub: 'vs. só indicação', color: '#10b981' },
  ] : [
    { val: '47 min', lbl: 'Tempo médio de resposta', sub: 'do pedido ao 1º orçamento', color: '#38bdf8' },
    { val: '23%', lbl: 'Economia média', sub: 'comparando 5 orçamentos', color: '#38bdf8' },
    { val: '98%', lbl: 'Satisfação', sub: 'avaliação pós-serviço', color: '#38bdf8' },
  ];

  const FAQ_PROF = [
    { q: 'Quantos leads vou receber por mês?', a: `Em ${displayCity}, profissionais ativos no plano PRO recebem em média 8–15 leads por mês. Depende da categoria — eletricistas e encanadores têm mais demanda. Você pode ver os leads disponíveis antes de assinar.` },
    { q: 'Vale o investimento se sou autônomo?', a: '1 cliente de R$500 já paga o plano PRO por 7 meses. Se você fechar apenas 1 serviço por mês via plataforma, já teve retorno. A maioria dos profissionais ativos fecha 3–5 por semana.' },
    { q: 'Posso cancelar meu plano?', a: 'Sim, a qualquer momento pelo painel. Sem multa, sem fidelidade, sem ligação de retenção. Zero burocracia.' },
    { q: `Tem cliente na minha área em ${displayCity}?`, a: `Estamos ativos em ${displayCity} e região. Você vê os leads disponíveis na sua categoria antes de assinar qualquer plano.` },
    { q: 'Demora para funcionar?', a: 'Perfil criado em 2 minutos. Primeiros leads chegam no mesmo dia. Em uma semana você já tem retorno sobre o investimento.' },
    { q: 'Preciso de cartão de crédito para começar?', a: 'Não. O cadastro e criação do perfil são totalmente gratuitos. Você só paga quando escolher um plano pago — e mesmo assim pode cancelar quando quiser.' },
  ];

  const FAQ_CLIENTE = [
    { q: 'Isso é seguro? Não é golpe?', a: 'Todo profissional passa por validação de identidade antes de aparecer na plataforma. É mais seguro do que contratar pelo boca a boca do grupo do WhatsApp, onde você não sabe nada sobre quem vai entrar na sua casa.' },
    { q: 'Clientes realmente não pagam nada?', a: 'Zero. O MeloCalé é financiado pelos profissionais que pagam mensalidade para receber leads. Para você, cliente, é 100% grátis — sem cartão, sem taxa oculta, sem nada.' },
    { q: 'E se o profissional não aparecer?', a: 'Reembolso completo. Garantia de 7 dias em todos os casos — sem questionamentos, sem burocracia.' },
    { q: `Tem profissional no meu bairro em ${displayCity}?`, a: `Estamos ativos em ${displayCity} e região. Após descrever o serviço você vê quem está disponível perto de você com tempo de resposta estimado.` },
    { q: 'E se o serviço ficar mal feito?', a: 'Nossa garantia de 7 dias cobre isso. Basta abrir uma disputa pelo app — devolvemos seu dinheiro sem burocracia.' },
    { q: 'Como funciona o pagamento ao profissional?', a: 'Você paga pelo app com segurança via Stripe. O profissional só recebe após a confirmação do serviço concluído. Seu dinheiro fica protegido em todas as etapas.' },
  ];

  const FAQ_DUAL = [
    { q: 'Clientes pagam para usar?', a: 'Não. Clientes buscam e recebem orçamentos completamente grátis. Apenas profissionais pagam para acessar contatos.' },
    { q: 'E se o profissional não aparecer?', a: 'Reembolso completo. Garantia de 7 dias em todos os planos — sem questionamentos.' },
    { q: 'Posso cancelar meu plano?', a: 'Sim, a qualquer momento pelo painel. Sem multa e sem fidelidade.' },
    { q: 'Os profissionais são verificados?', a: 'Todos passam por validação de identidade antes de aparecer na plataforma.' },
    { q: 'Funciona em qual cidade?', a: 'Salvador — expandindo para outras cidades da Bahia em breve.' },
  ];

  const FAQ_ITEMS = isProfissional ? FAQ_PROF : isCliente ? FAQ_CLIENTE : FAQ_DUAL;

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
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 md:gap-4 text-white font-black px-4"
          style={{ height: BANNER_H, background: 'linear-gradient(90deg, #92400e 0%, #b45309 50%, #92400e 100%)' }}
        >
          <span className="text-sm">⚡ Oferta Relâmpago</span>
          <span className="hidden sm:inline text-amber-200 text-sm">—</span>
          <span className="hidden sm:inline text-amber-100 font-bold text-sm">Cadastre agora e ganhe <strong className="text-white">100 moedas extras!</strong></span>
          <Link to="/login?mode=signup" className="ml-1 text-white rounded-lg px-3 py-1 text-xs font-black whitespace-nowrap" style={{ background:'rgba(255,255,255,.25)', animation:'aproveitar-pulse 1.5s ease-in-out infinite', boxShadow:'0 0 12px rgba(255,255,255,.6)' }}>
            Aproveitar →
          </Link>
          <style>{`
            @keyframes aproveitar-pulse {
              0%, 100% { box-shadow: 0 0 8px rgba(255,255,255,.5), 0 0 20px rgba(255,200,0,.3); transform: scale(1); }
              50% { box-shadow: 0 0 18px rgba(255,255,255,.9), 0 0 36px rgba(255,200,0,.6); transform: scale(1.06); }
            }
          `}</style>
        </div>
      ) : (
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 md:gap-4 text-white text-sm font-black px-4"
          style={{ height: BANNER_H, background: '#ea580c', borderBottom: '1px solid #0e2035' }}
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
        {/* ── 3. Hero 50/50 ── */}
        <section className="landing-hero-section" style={{ position: 'relative', paddingTop: 120, paddingBottom: 64, overflow: 'hidden', background: '#0f172a', borderTop: '2px solid #10b981' }}>
          <div className="container-app" style={{ position: 'relative' }}>

            {(isProfissional || isCliente) ? (
              <div className="landing-hero-grid landing-hero-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center', maxWidth: '60rem', margin: '0 auto', transform: 'translateX(2rem)' }}>
                {/* Coluna esquerda */}
                <div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                    {!isCliente && <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,.14)', border: '1px solid rgba(16,185,129,.35)', borderRadius: 20, padding: '4px 14px' }}>🔧 Para profissionais de {displayCity}</span>}
                    {!isProfissional && <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.35)', borderRadius: 20, padding: '4px 14px' }}>🏠 Para clientes em {displayCity}</span>}
                  </div>

                  {isProfissional ? (
                    <>
                      <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, lineHeight: 1.15, marginBottom: 14, color: '#f0f6ff' }}>
                        Pare de perder{' '}
                        <span style={{ background: 'linear-gradient(135deg,#10b981,#6ee7b7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>R$1.800/mês</span>
                        {' '}esperando indicação
                      </h1>
                      <p style={{ fontSize: 15, color: '#94b8d8', marginBottom: 16, lineHeight: 1.7 }}>
                        Profissionais que dependem só de indicação deixam essa renda na mesa todo mês. O MeloCalé conecta você a clientes prontos para fechar — sem depender de ninguém.
                      </p>
                      <div style={{ background: '#1a0a0a', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                        <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 4 }}>Sem o MeloCalé, você perde em média:</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#ef4444' }}>R$1.800/mês em serviços que poderiam ser seus</div>
                      </div>
                      <div style={{ background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#6ee7b7' }}>Menos que 1 café por dia —</span>
                        <span style={{ fontSize: 15, fontWeight: 900, color: '#10b981' }}>R$1,23/dia resolve isso</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
                        {[
                          'Leads de clientes prontos para fechar hoje',
                          'Badge verificado — apareça primeiro nas buscas',
                          'Primeiros leads chegam no mesmo dia do cadastro',
                          'Cancele quando quiser — sem fidelidade',
                          'Comece grátis — sem cartão de crédito',
                        ].map(f => (
                          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#10b981', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>✓</span>
                            <span style={{ fontSize: 13, color: '#94c4a8' }}>{f}</span>
                          </div>
                        ))}
                      </div>
                      <Link to="/login?mode=signup&role=professional" className="cta-pulse" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52, background: 'linear-gradient(135deg,#047857,#059669,#10b981)', color: '#fff', fontWeight: 800, fontSize: 15, borderRadius: 13, textDecoration: 'none', marginBottom: 10, boxShadow: '0 4px 24px rgba(16,185,129,.35)' }}>
                        Quero receber meus primeiros leads →
                      </Link>
                      <Link to="/login?mode=signup&role=professional" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40, background: 'transparent', color: '#6a9ab8', fontWeight: 600, fontSize: 13, borderRadius: 10, textDecoration: 'none', border: '1px solid rgba(56,189,248,.2)' }}>
                        Ver leads disponíveis em {displayCity}
                      </Link>
                    </>
                  ) : (
                    <>
                      <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, lineHeight: 1.15, marginBottom: 14, color: '#f0f6ff' }}>
                        Encontre o profissional certo em{' '}
                        <span style={{ background: 'linear-gradient(135deg,#38bdf8,#7dd3fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{displayCity}</span>
                        {' '}— sem sair de casa
                      </h1>
                      <p style={{ fontSize: 15, color: '#94b8d8', marginBottom: 16, lineHeight: 1.7 }}>
                        Sem ligar para desconhecidos. Sem depender de indicação de vizinho. Receba até 5 orçamentos de profissionais verificados e escolha o melhor preço.
                      </p>
                      <div style={{ background: '#0a1628', border: '1px solid rgba(56,189,248,.35)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                        <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 700, marginBottom: 4 }}>Urgência real em {displayCity}:</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>Apenas 2 eletricistas disponíveis esta semana</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Profissionais verificados · agenda se esgota rapidamente</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
                        {[
                          'Profissionais com identidade confirmada',
                          'Até 5 orçamentos grátis — compare e economize até 23%',
                          'Resposta em 47 minutos — não dias',
                          'Garantia de 7 dias — dinheiro de volta',
                          '100% gratuito para clientes — sem cartão',
                        ].map(f => (
                          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#38bdf8', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>✓</span>
                            <span style={{ fontSize: 13, color: '#94b8d4' }}>{f}</span>
                          </div>
                        ))}
                      </div>
                      <Link to="/login?mode=signup&role=client" className="cta-pulse" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52, background: 'linear-gradient(135deg,#0369a1,#0ea5e9,#38bdf8)', color: '#fff', fontWeight: 800, fontSize: 15, borderRadius: 13, textDecoration: 'none', marginBottom: 10, boxShadow: '0 4px 24px rgba(56,189,248,.35)' }}>
                        Ver profissionais disponíveis agora →
                      </Link>
                      <Link to="/login?mode=signup&role=client" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40, background: 'transparent', color: '#6a9ab8', fontWeight: 600, fontSize: 13, borderRadius: 10, textDecoration: 'none', border: '1px solid rgba(56,189,248,.2)' }}>
                        Descrever meu serviço
                      </Link>
                    </>
                  )}
                  <p style={{ fontSize: 11, color: '#4a6a80', marginTop: 12 }}>
                    {isProfissional
                      ? `Beta fechado · 7 profissionais ativos em ${displayCity} · Grátis para começar`
                      : `Profissionais verificados em ${displayCity} · 47 min de resposta · Grátis`}
                  </p>
                </div>

                {/* Coluna direita — foto hero */}
                <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', height: '100%', minHeight: 340 }}>
                  <img
                    src={isProfissional ? '/hero-profissional.jpg' : '/hero-cliente.jpg'}
                    alt={isProfissional ? 'Profissional verificado MeloCalé' : 'Cliente satisfeita com profissional MeloCalé'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                    loading="eager"
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(15,23,42,0.15) 0%, transparent 40%)' }} />
                  <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0, boxShadow: '0 0 6px #10b981' }} />
                    <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>
                      {isProfissional
                        ? '371+ profissionais ativos em Jacobina agora'
                        : '28 clientes buscando profissionais agora em Jacobina'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Eyebrow */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,.14)', border: '1px solid rgba(16,185,129,.35)', borderRadius: 20, padding: '4px 14px' }}>🔧 Para profissionais</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.35)', borderRadius: 20, padding: '4px 14px' }}>🏠 Para clientes</span>
                </div>

                {/* Headline dual */}
                <h1 style={{ textAlign: 'center', fontSize: 'clamp(2.4rem, 6vw, 4rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: 14, color: '#f0f6ff' }}>
                  <span style={{ background: 'linear-gradient(135deg,#10b981,#6ee7b7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Ganhe mais</span>
                  {' '}ou{' '}
                  <span style={{ background: 'linear-gradient(135deg,#38bdf8,#7dd3fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>contrate melhor</span>
                  {' '}em Salvador
                </h1>

                <p style={{ textAlign: 'center', fontSize: 17, color: '#94b8d8', maxWidth: 600, margin: '0 auto 32px', lineHeight: 1.7 }}>
                  A plataforma que conecta profissionais qualificados a clientes que precisam de serviços — com segurança, agilidade e resultado.
                </p>

                {/* Two cards dual */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ maxWidth: 860, margin: '0 auto', alignItems: 'stretch' }}>
                  {/* Green — Profissional */}
                  <div
                    style={{ background: '#1e2d45', border: '1px solid rgba(16,185,129,.22)', borderRadius: 20, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 18, transition: 'all .2s', alignSelf: 'stretch' }}
                    onMouseEnter={hoverGreen.enter} onMouseLeave={hoverGreen.leave}
                  >
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,.14)', border: '1px solid rgba(16,185,129,.35)', borderRadius: 6, padding: '3px 10px', display: 'inline-block', alignSelf: 'flex-start' }}>🔧 Para profissionais</span>
                    <h3 style={{ fontSize: 21, fontWeight: 900, color: '#ffffff', margin: 0, lineHeight: 1.3 }}>Aumente sua renda com leads qualificados</h3>
                    <p style={{ fontSize: 14, color: '#94b8d4', margin: 0, lineHeight: 1.6 }}>Receba clientes prontos para contratar na sua cidade. Sem depender de indicação.</p>
                    <div style={{ background: 'rgba(16,185,129,.14)', border: '1px solid rgba(16,185,129,.35)', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#6a9ab8', textTransform: 'uppercase', letterSpacing: '.06em' }}>resultado médio</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: '#10b981', letterSpacing: '.01em' }}>+R$1.800/mês extra</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {['Leads prontos para contratar', 'Badge verificado no perfil', 'Planos a partir de R$37/mês', 'Comece grátis — sem cartão'].map(f => (
                        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#10b981', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>✓</span>
                          <span style={{ fontSize: 12, color: '#94c4a8' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <Link to="/login?mode=signup&role=professional" className="cta-pulse" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52, background: 'linear-gradient(135deg,#047857,#059669,#10b981)', color: '#fff', fontWeight: 800, fontSize: 15, borderRadius: 13, textDecoration: 'none', marginTop: 'auto', padding: '0 32px', boxShadow: '0 4px 24px rgba(16,185,129,.35)' }}>
                      Quero receber clientes agora →
                    </Link>
                  </div>

                  {/* Blue — Cliente */}
                  <div
                    style={{ background: '#1e2d45', border: '1px solid rgba(56,189,248,.22)', borderRadius: 20, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 18, transition: 'all .2s', alignSelf: 'stretch' }}
                    onMouseEnter={hoverBlue.enter} onMouseLeave={hoverBlue.leave}
                  >
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.35)', borderRadius: 6, padding: '3px 10px', display: 'inline-block', alignSelf: 'flex-start' }}>🏠 Para clientes</span>
                    <h3 style={{ fontSize: 21, fontWeight: 900, color: '#ffffff', margin: 0, lineHeight: 1.3 }}>Encontre o profissional certo em minutos</h3>
                    <p style={{ fontSize: 14, color: '#94b8d4', margin: 0, lineHeight: 1.6 }}>Receba até 5 orçamentos de profissionais verificados. Grátis, sem compromisso.</p>
                    <div style={{ background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.35)', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#6a9ab8', textTransform: 'uppercase', letterSpacing: '.06em' }}>tempo médio de resposta</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: '#38bdf8', letterSpacing: '.01em' }}>47 minutos</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {['Profissionais verificados e avaliados', 'Até 5 orçamentos grátis', 'Compare preços e escolha o melhor', 'Garantia de 7 dias'].map(f => (
                        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#38bdf8', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>✓</span>
                          <span style={{ fontSize: 12, color: '#94b8d4' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <Link to="/login?mode=signup&role=client" className="cta-pulse" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52, background: 'linear-gradient(135deg,#0369a1,#0ea5e9,#38bdf8)', color: '#fff', fontWeight: 800, fontSize: 15, borderRadius: 13, textDecoration: 'none', marginTop: 'auto', padding: '0 32px', boxShadow: '0 4px 24px rgba(56,189,248,.35)' }}>
                      Encontrar profissional agora →
                    </Link>
                  </div>
                </div>

                {/* Proof row dual */}
                <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#7a9ab8' }}>
                  Primeiros profissionais em Salvador · 47 min resposta · 🔒 Grátis para começar
                </p>
              </>
            )}
          </div>
        </section>

        {/* ── 4. Trust bar ── */}
        <section style={{ background: '#182035', borderTop: '2px solid #f59e0b', padding: '28px 0' }}>
          <div className="container-app">
            <div className="landing-trust-bar flex overflow-x-auto md:grid md:grid-cols-4 md:overflow-visible" style={{ gap: 16, paddingBottom: 4, ...(isProfissional || isCliente ? { marginLeft: '4rem', width: 'calc(100% - 4rem)' } : {}) }}>
              {[
                { icon: '🔒', label: 'Pagamento seguro', sub: 'Stripe · SSL', border: 'rgba(56,189,248,.35)', bg: 'rgba(56,189,248,.08)', accent: '#38bdf8' },
                { icon: '⚡', label: 'Resposta em 47 min', sub: 'Média real verificada', border: 'rgba(245,158,11,.35)', bg: 'rgba(245,158,11,.08)', accent: '#f59e0b' },
                { icon: '✅', label: 'Profissionais verificados', sub: 'Identidade confirmada', border: 'rgba(16,185,129,.35)', bg: 'rgba(16,185,129,.08)', accent: '#10b981' },
                { icon: '🛡️', label: 'Garantia de 7 dias', sub: 'Dinheiro de volta', border: 'rgba(16,185,129,.35)', bg: 'rgba(16,185,129,.10)', accent: '#10b981' },
              ].map(item => (
                <div key={item.label} style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, minWidth: 160 }}>
                  <span style={{ fontSize: 28, flexShrink: 0 }}>{item.icon}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', margin: 0, lineHeight: 1.2 }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: item.accent, margin: 0, marginTop: 3, fontWeight: 600 }}>{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {(isProfissional || isCliente) && (
          <section style={{ background: isProfissional ? 'rgba(16,185,129,.08)' : 'rgba(56,189,248,.06)', borderTop: `1px solid ${isProfissional ? 'rgba(16,185,129,.2)' : 'rgba(56,189,248,.2)'}`, borderBottom: `1px solid ${isProfissional ? 'rgba(16,185,129,.2)' : 'rgba(56,189,248,.2)'}`, padding: '20px 0' }}>
            <div className="container-app">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, textAlign: 'center', marginLeft: '4rem', width: 'calc(100% - 4rem)' }}>
                {isProfissional ? (
                  <>
                    <div><div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>R$1,23</div><div style={{ fontSize: 12, color: '#6ee7b7' }}>por dia — plano Starter</div><div style={{ fontSize: 11, color: '#64748b' }}>menos que 1 café</div></div>
                    <div><div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>R$0</div><div style={{ fontSize: 12, color: '#6ee7b7' }}>para começar</div><div style={{ fontSize: 11, color: '#64748b' }}>sem cartão de crédito</div></div>
                    <div><div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>7 dias</div><div style={{ fontSize: 12, color: '#6ee7b7' }}>de garantia</div><div style={{ fontSize: 11, color: '#64748b' }}>dinheiro de volta</div></div>
                  </>
                ) : (
                  <>
                    <div><div style={{ fontSize: 22, fontWeight: 900, color: '#38bdf8' }}>R$0</div><div style={{ fontSize: 12, color: '#93c5fd' }}>para clientes</div><div style={{ fontSize: 11, color: '#64748b' }}>sem cartão</div></div>
                    <div><div style={{ fontSize: 22, fontWeight: 900, color: '#38bdf8' }}>47 min</div><div style={{ fontSize: 12, color: '#93c5fd' }}>até o 1º orçamento</div><div style={{ fontSize: 11, color: '#64748b' }}>não horas nem dias</div></div>
                    <div><div style={{ fontSize: 22, fontWeight: 900, color: '#38bdf8' }}>23%</div><div style={{ fontSize: 12, color: '#93c5fd' }}>economia média</div><div style={{ fontSize: 11, color: '#64748b' }}>comparando orçamentos</div></div>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── 5. Como funciona dual ── */}
        <section id="como-funciona" style={{ background: '#0f172a', borderTop: '2px solid #38bdf8', padding: '64px 0' }}>
          <div className="container-app">
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem,4vw,2rem)', fontWeight: 800, color: '#f0f6ff', marginBottom: 8 }}>Como funciona?</h2>
            <p style={{ textAlign: 'center', fontSize: 14, color: '#6a9ab8', marginBottom: 40, maxWidth: 480, margin: '0 auto 40px' }}>Três passos simples para cada lado da plataforma</p>

            {(isProfissional || isCliente) ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 1040, margin: '0 auto 32px' }}>
                {stepsData.map((s, i) => (
                  <div key={i} style={{ background: '#1e2d45', border: `1px solid ${s.border}`, borderRadius: 16, padding: '20px 16px', borderTop: `2px solid ${s.color}` }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: s.bg, border: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: s.color, marginBottom: 12 }}>{s.n}</div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f6ff', margin: '0 0 4px' }}>{s.title}</p>
                    <p style={{ fontSize: 12, color: s.color, fontWeight: 700, margin: '0 0 8px' }}>{s.sub}</p>
                    <p style={{ fontSize: 12, color: '#6a9ab8', lineHeight: 1.5, margin: 0 }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{ maxWidth: 860, margin: '0 auto' }}>
                {/* Painel Verde — Profissional */}
                <div style={{ background: '#1e2d45', border: '1px solid rgba(16,185,129,.35)', borderRadius: 18, padding: '24px 20px', borderTop: '3px solid #10b981', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,.14)', border: '1px solid rgba(16,185,129,.35)', borderRadius: 6, padding: '3px 10px' }}>🔧 Profissional</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {[
                      { n: '01', title: 'Crie seu perfil', sub: '2 minutos', color: '#10b981' },
                      { n: '02', title: 'Receba leads', sub: 'Diariamente', color: '#6ee7b7' },
                      { n: '03', title: 'Feche negócios', sub: '+R$1.800/mês', color: '#10b981' },
                    ].map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16,185,129,.14)', border: '1px solid rgba(16,185,129,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: s.color, flexShrink: 0 }}>{s.n}</div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>{s.title}</p>
                          <p style={{ fontSize: 11, color: s.color, margin: 0, fontWeight: 700 }}>{s.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Painel Azul — Cliente */}
                <div style={{ background: '#1e2d45', border: '1px solid rgba(56,189,248,.35)', borderRadius: 18, padding: '24px 20px', borderTop: '3px solid #38bdf8', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.35)', borderRadius: 6, padding: '3px 10px' }}>🏠 Cliente</span>
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
            )}

            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <Link to="/login?mode=signup" style={{ display: 'inline-flex', alignItems: 'center', height: 56, background: 'linear-gradient(135deg,#047857,#10b981)', color: '#fff', fontWeight: 800, fontSize: 17, borderRadius: 14, textDecoration: 'none', padding: '0 40px', gap: 8, animation: 'comecar-pulse 1.8s ease-in-out infinite' }}>
                Começar agora — é grátis →
              </Link>
              <style>{`
                @keyframes comecar-pulse {
                  0%, 100% { box-shadow: 0 0 8px rgba(16,185,129,.4), 0 0 20px rgba(16,185,129,.2); transform: scale(1); }
                  50% { box-shadow: 0 0 18px rgba(16,185,129,.7), 0 0 36px rgba(16,185,129,.4); transform: scale(1.05); }
                }
              `}</style>
            </div>
          </div>
        </section>

        {/* ── 6. Objeções ── */}
        <section style={{ background: '#182035', borderTop: '2px solid #10b981', padding: '64px 0' }}>
          <div className="container-app">
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 800, color: '#f0f6ff', marginBottom: 8 }}>Por que confiar no MeloCalé?</h2>
            <p style={{ textAlign: 'center', fontSize: 14, color: '#6a9ab8', marginBottom: 40, maxWidth: 440, margin: '0 auto 40px' }}>Respondemos os principais medos de cada lado</p>

            {(isProfissional || isCliente) ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 860, margin: '0 auto' }}>
                {trustData.map((item, i) => (
                  <div key={i} style={{ background: '#1e2d45', border: `1px solid ${item.border}`, borderRadius: 16, padding: '20px 16px', borderTop: `2px solid ${item.color}` }}>
                    <div style={{ fontSize: 24, marginBottom: 10 }}>{item.icon}</div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff', margin: '0 0 6px' }}>{item.q}</p>
                    <p style={{ fontSize: 12, color: '#6a9ab8', lineHeight: 1.6, margin: 0 }}>{item.a}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{ maxWidth: 860, margin: '0 auto' }}>
                {/* Painel Verde */}
                <div style={{ background: '#1e2d45', border: '1px solid rgba(16,185,129,.35)', borderRadius: 18, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 18, borderTop: '3px solid #10b981' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,.14)', border: '1px solid rgba(16,185,129,.35)', borderRadius: 6, padding: '3px 10px', alignSelf: 'flex-start' }}>🔧 Para profissionais</span>
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
                <div style={{ background: '#1e2d45', border: '1px solid rgba(56,189,248,.35)', borderRadius: 18, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 18, borderTop: '3px solid #38bdf8' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.35)', borderRadius: 6, padding: '3px 10px', alignSelf: 'flex-start' }}>🏠 Para clientes</span>
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
            )}
          </div>
        </section>

        {/* ── 7. Garantia ── */}
        <section style={{ background: '#0f172a', borderTop: '2px solid #f59e0b', padding: '48px 0' }}>
          <div className="container-app">
            <div style={{ maxWidth: 760, margin: '0 auto', background: 'linear-gradient(135deg,rgba(16,185,129,.14),rgba(16,185,129,.03))', border: '2px solid rgba(16,185,129,.28)', borderRadius: 20, padding: '32px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>🛡️</div>
              <h3 style={{ fontSize: 26, fontWeight: 900, color: '#f0f6ff', marginBottom: 14 }}>Garantia incondicional de 7 dias</h3>
              <p style={{ fontSize: 16, color: '#6a9ab8', lineHeight: 1.7, margin: 0 }}>
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
            <div className="flex flex-col lg:flex-row gap-4 items-start" style={{ maxWidth: '62.5rem', margin: '0 auto' }}>
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
              <div className="flex-1 landing-competitor-wrapper">
                <Suspense fallback={null}><CompetitorTable /></Suspense>
              </div>
            </div>
          </div>
        </section>

        {/* ── 10. CategoryGrid ── */}
        <div className="-mt-16"><Suspense fallback={null}><CategoryGrid userCity={displayCity} /></Suspense></div>

        {/* ── 11. Stats + Depoimentos ── */}
        <section style={{ background: '#0f172a', borderTop: '2px solid #38bdf8', padding: '64px 0' }}>
          <div className="container-app">

            {/* Stats */}
            {(isProfissional || isCliente) ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 860, margin: '0 auto 48px' }}>
                {statsData.map((s, i) => (
                  <div key={i} style={{ background: '#1e2d45', border: `1px solid ${isProfissional ? 'rgba(16,185,129,.35)' : 'rgba(56,189,248,.35)'}`, borderRadius: 16, padding: '20px', textAlign: 'center', borderBottom: `2px solid ${s.color}` }}>
                    <p style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 900, color: s.color, margin: '0 0 4px' }}>{s.val}</p>
                    <p style={{ fontSize: 12, color: '#f0f6ff', fontWeight: 700, margin: '0 0 4px' }}>{s.lbl}</p>
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{s.sub}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 48 }}>
                <div style={{ background: '#1e2d45', border: '1px solid rgba(16,185,129,.35)', borderRadius: 18, padding: '24px 20px', width: '100%' }}>
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
                <div style={{ background: '#1e2d45', border: '1px solid rgba(56,189,248,.35)', borderRadius: 18, padding: '24px 20px', width: '100%' }}>
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
            )}

            {/* Depoimentos */}
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 800, color: '#f0f6ff', marginBottom: 32 }}>
              Quem usa, <span style={{ color: '#10b981' }}>recomenda</span>
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 760, margin: '0 auto 40px' }}>
              {/* Depoimento 1 — Carlos Augusto */}
              <div style={{ background: '#1a2d45', border: '1px solid rgba(16,185,129,.35)', borderRadius: 18, padding: '20px', display: isCliente ? 'none' : 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,.14)', border: '1px solid rgba(16,185,129,.35)', borderRadius: 5, padding: '2px 8px', alignSelf: 'flex-start' }}>🔧 Profissional</span>
                <div style={{ background: 'rgba(16,185,129,.14)', border: '1px solid rgba(16,185,129,.35)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>CA</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>Carlos Augusto</p>
                    <p style={{ fontSize: 11, color: '#4a6a80', margin: 0 }}>Pintor · Salvador, BA</p>
                  </div>
                </div>
              </div>

              {/* Depoimento 2 — Ana Rodrigues */}
              <div style={{ background: '#1a2d45', border: '1px solid rgba(56,189,248,.35)', borderRadius: 18, padding: '20px', display: isProfissional ? 'none' : 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.35)', borderRadius: 5, padding: '2px 8px', alignSelf: 'flex-start' }}>🏠 Cliente</span>
                <div style={{ background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.35)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>AR</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>Ana Rodrigues</p>
                    <p style={{ fontSize: 11, color: '#4a6a80', margin: 0 }}>Cliente · Salvador, BA</p>
                  </div>
                </div>
              </div>

              {/* Depoimento 3 — Simone Marques */}
              <div style={{ background: '#1a2d45', border: '1px solid rgba(245,158,11,.35)', borderRadius: 18, padding: '20px', display: isCliente ? 'none' : 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,.14)', border: '1px solid rgba(16,185,129,.35)', borderRadius: 5, padding: '2px 8px', alignSelf: 'flex-start' }}>🔧 Profissional</span>
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
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>SM</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>Simone Marques</p>
                    <p style={{ fontSize: 11, color: '#4a6a80', margin: 0 }}>Limpeza residencial · Salvador, BA</p>
                  </div>
                </div>
              </div>

              {/* Depoimento 4 — Francisco Oliveira */}
              <div style={{ background: '#1a2d45', border: '1px solid rgba(56,189,248,.35)', borderRadius: 18, padding: '20px', display: isProfissional ? 'none' : 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.35)', borderRadius: 5, padding: '2px 8px', alignSelf: 'flex-start' }}>🏠 Cliente</span>
                <div style={{ background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.35)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#6a9ab8', textTransform: 'uppercase', letterSpacing: '.05em' }}>resultado</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#38bdf8' }}>Serviço excelente</span>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />)}
                </div>
                <p style={{ fontSize: 13, color: '#6a9ab8', lineHeight: 1.6, flex: 1 }}>
                  "Descrevi o problema, em 40 minutos tinha 3 orçamentos. Nunca pensei que fosse tão fácil de encontrar um profissional de confiança."
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid #0e2035' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>FO</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>Francisco Oliveira</p>
                    <p style={{ fontSize: 11, color: '#4a6a80', margin: 0 }}>Cliente · Jacobina, BA</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA dual pós-depoimentos */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/login?mode=signup&role=client" className="cta-pulse" style={{ display: 'inline-flex', alignItems: 'center', height: 44, background: 'linear-gradient(135deg,#047857,#10b981)', color: '#fff', fontWeight: 800, fontSize: 13, borderRadius: 12, textDecoration: 'none', padding: '0 22px' }}>
                Ver profissionais disponíveis agora →
              </Link>
              <Link to="/login?mode=signup&role=professional" style={{ display: 'inline-flex', alignItems: 'center', height: 44, background: 'transparent', color: '#38bdf8', fontWeight: 700, fontSize: 13, borderRadius: 12, textDecoration: 'none', padding: '0 22px', border: '1px solid rgba(56,189,248,.3)' }}>
                Quero receber clientes →
              </Link>
            </div>
          </div>
        </section>

        {/* ── 12. EarningsCalculator ── */}
        {!isCliente && <Suspense fallback={null}><EarningsCalculator /></Suspense>}

        {/* ── 13. Planos ── */}
        <section id="planos" className="py-28" style={{ background: '#182035', borderTop: '2px solid #f59e0b', display: isCliente ? 'none' : 'block' }}>
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
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-6 py-4">
                <span className="text-emerald-400 text-xl">🛡️</span>
                <span className="text-emerald-400 font-bold text-base">Garantia de 7 dias — dinheiro de volta sem perguntas</span>
              </div>
            </div>

            <div className="landing-badges-grid landing-planos-wrapper grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-6xl mx-auto mb-10 px-4" style={{ marginBottom: '1.5rem', transform: 'translateX(10rem)' }}>
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

            <div className="landing-planos-grid landing-planos-wrapper grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-left max-w-6xl mx-auto mb-12 px-4" style={{ marginBottom: '2rem', transform: 'translateX(10rem)' }}>
              {/* GRATUITO */}
              <div className="bg-[#1a2840] rounded-2xl border border-slate-800 flex flex-col opacity-80 hover:opacity-100 transition-opacity duration-200" style={{ padding: '1.75rem 1.5rem', borderTop: '3px solid rgba(148,163,184,.3)' }}>
                <div className="mb-4">
                  <h3 className="text-[#94A3B8] font-bold text-sm uppercase tracking-widest mb-2">Gratuito</h3>
                  <div className="text-3xl font-extrabold text-white mb-2">R$ 0<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-sm text-[#4A6580]">Para conhecer a plataforma</p>
                </div>
                <Link to="/login" className="cta-pulse inline-flex items-center justify-center w-full h-11 bg-slate-800 hover:bg-slate-700 text-white rounded-xl px-3 text-sm font-bold transition-all mt-4 mb-4 whitespace-nowrap" style={{ marginTop: '1.75rem', marginBottom: '1.75rem' }}>
                  Explorar Grátis →
                </Link>
                <ul className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <li className="flex items-start gap-3 text-[#94A3B8] text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-[#4A6580] shrink-0 mt-0.5" size={16}/> Cadastro na plataforma</li>
                  <li className="flex items-start gap-3 text-[#94A3B8] text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-[#4A6580] shrink-0 mt-0.5" size={16}/> Ver leads disponíveis</li>
                  <li className="flex items-start gap-3 text-[#94A3B8] text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> 10 moedas de boas-vindas</li>
                  <li className="hidden sm:flex items-start gap-3 text-[#4A6580] text-sm line-through" style={{ marginBottom: '0.25rem' }}><XIcon className="text-slate-700 shrink-0 mt-0.5" size={16}/> Desconto em moedas</li>
                  <li className="hidden sm:flex items-start gap-3 text-[#4A6580] text-sm line-through" style={{ marginBottom: '0.25rem' }}><XIcon className="text-slate-700 shrink-0 mt-0.5" size={16}/> Badge verificado</li>
                </ul>
              </div>

              {/* STARTER */}
              <div className="bg-[#1a2840] rounded-2xl border border-blue-500/30 flex flex-col relative overflow-hidden opacity-95 hover:opacity-100 transition-opacity duration-200" style={{ padding: '1.75rem 1.5rem', borderTop: '3px solid #38bdf8' }}>
                <div className="mb-4">
                  <div className="inline-block px-3 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">Starter</div>
                  <div className="text-3xl font-extrabold text-white mb-2">R$ 37<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-emerald-400 text-xs font-bold">25% off em todas as moedas</p>
                </div>
                <Link to="/login?mode=signup&role=professional" className="cta-pulse inline-flex items-center justify-center w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-3 text-sm font-bold transition-all mt-3 mb-3 shadow-lg shadow-blue-500/20 whitespace-nowrap" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                  Quero Receber Leads →
                </Link>
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <span>⚠️</span><span>Apenas {vagas.starter} vagas restantes em {userCity}</span>
                </div>
                <ul className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <li className="flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> 25% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> Badge ✅ VERIFICADO</li>
                  <li className="flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> Perfil público visível</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 🎁 30 moedas de boas-vindas</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> Suporte por chat</li>
                </ul>
                <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-blue-300 text-xs text-center">Pacote R$59,90 → <strong>R$44,93</strong> com Starter</p>
                </div>
              </div>

              {/* PRO — DESTAQUE */}
              <div className="bg-gradient-to-b from-[#1c1d28] to-[#1C3454] rounded-2xl border-2 border-emerald-500 flex flex-col relative mt-6 sm:mt-0 z-10 shadow-[0_0_50px_-10px_rgba(16,185,129,0.4)]" style={{ padding: '1.75rem 1.5rem', boxShadow: '0 0 60px -5px rgba(16,185,129,.5), 0 0 120px -20px rgba(16,185,129,.25)', borderTop: '3px solid #10b981' }}>
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-black px-5 py-2 rounded-full text-sm font-black tracking-wider uppercase whitespace-nowrap">
                  ⚡ Mais Popular
                </div>
                <div className="mb-4">
                  <div className="inline-block px-3 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">PRO</div>
                  <div className="text-3xl font-extrabold text-white mb-2">R$ 67<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-emerald-400 text-xs font-bold">40% off em todas as moedas</p>
                </div>
                <Link to="/login?mode=signup&role=professional" className="cta-pulse inline-flex items-center justify-center w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl px-3 text-sm font-black transition-all mt-3 mb-3 shadow-xl shadow-emerald-500/30 whitespace-nowrap" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                  Receber Meu Primeiro Lead →
                </Link>
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <span>⚠️</span><span>Apenas {vagas.pro} vagas restantes em {userCity}</span>
                </div>
                <ul className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <li className="flex items-start gap-3 text-slate-200 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> 40% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-3 text-slate-200 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> Badge ⚡ PRO em destaque</li>
                  <li className="flex items-start gap-3 text-slate-200 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> 2x mais visível nas buscas</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-200 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> Moedas nunca expiram</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-200 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 🎁 80 moedas de boas-vindas</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-200 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> Suporte prioritário (2h)</li>
                </ul>
                <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-emerald-300 text-xs text-center">Pacote R$59,90 → <strong>R$35,94</strong> com PRO</p>
                  <p className="text-emerald-400 text-[10px] text-center mt-2 font-bold">O plano se paga em 1 compra de moedas</p>
                </div>
              </div>

              {/* ELITE */}
              <div className="bg-[#1a2840] rounded-2xl border border-yellow-500/30 flex flex-col relative overflow-hidden opacity-95 hover:opacity-100 transition-opacity duration-200" style={{ padding: '1.75rem 1.5rem', borderTop: '3px solid #f59e0b' }}>
                <div className="mb-4">
                  <div className="inline-block px-3 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">🏆 Elite</div>
                  <div className="text-3xl font-extrabold text-white mb-2">R$ 127<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-yellow-400 text-xs font-bold">55% off em todas as moedas</p>
                </div>
                <Link to="/login?mode=signup&role=professional" className="cta-pulse inline-flex items-center justify-center w-full h-11 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl px-3 text-sm font-black transition-all mt-3 mb-3 shadow-lg shadow-yellow-500/20 whitespace-nowrap" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                  Dominar {userCity} Agora →
                </Link>
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <span>⚠️</span><span>Apenas {vagas.elite} vagas restantes em {userCity}</span>
                </div>
                <ul className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <li className="flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 55% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Badge 🏆 ELITE dourado</li>
                  <li className="flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Topo absoluto das buscas</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Até 3 profissionais na conta</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 🎁 200 moedas de boas-vindas</li>
                  <li className="hidden sm:flex items-start gap-3 text-slate-300 text-sm" style={{ marginBottom: '0.25rem' }}><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Gerente de conta dedicado</li>
                </ul>
                <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                  <p className="text-yellow-300 text-xs text-center">Pacote R$119,90 → <strong>R$53,96</strong> com Elite</p>
                </div>
              </div>
            </div>

            <div className="landing-planos-wrapper max-w-6xl mx-auto px-4" style={{ marginBottom: '1rem', transform: 'translateX(10rem)' }}>
              <div className="landing-pense-card" style={{ width: '82%', margin: '0 auto', background: '#1e2d45', border: '1px solid #1C3050', borderRadius: 16, padding: '1rem 2rem', textAlign: 'center', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>💡</span>
                  <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 600 }}>Pense assim:</span>
                </div>
                <p style={{ fontSize: 24, fontWeight: 700, color: '#f0f6ff', margin: '0 0 4px', lineHeight: 1.25 }}>
                  1 cliente de <span style={{ color: '#10b981' }}>R$ 500</span> já paga o plano PRO por <span style={{ color: '#10b981' }}>7 meses</span>
                </p>
                <p style={{ fontSize: 14, color: '#94A3B8', margin: '0 0 12px' }}>
                  Ou seja: o 2º cliente que você fechar no mês já é lucro puro no seu bolso.
                </p>
                <div className="landing-pense-selos" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 10, padding: '6px 14px', flex: 1, minWidth: 0, whiteSpace: 'normal', overflow: 'hidden' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>🧮</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>matemática real</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff' }}>R$67 × 7 ≈ R$469</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 10, padding: '6px 14px', flex: 1, minWidth: 0, whiteSpace: 'normal', overflow: 'hidden' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>🎁</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>desconto em moedas</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff' }}>40% off</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 10, padding: '6px 14px', flex: 1, minWidth: 0, whiteSpace: 'normal', overflow: 'hidden' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>⚡</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>retorno rápido</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff' }}>2 leads cobrem o mês</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 10, padding: '6px 14px', flex: 1, minWidth: 0, whiteSpace: 'normal', overflow: 'hidden' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>📈</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>ganho médio extra</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f6ff' }}>+R$1.800/mês</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {isCliente && (
          <section style={{ background: '#0a1628', borderTop: '2px solid #38bdf8', padding: '48px 0' }}>
            <div className="container-app">
              <div style={{ background: '#162032', border: '2px solid rgba(56,189,248,.4)', borderRadius: 20, padding: '32px 28px', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#f0f6ff', marginBottom: 10 }}>100% gratuito — sem cartão, sem taxa</h3>
                <p style={{ fontSize: 14, color: '#6a9ab8', lineHeight: 1.7, marginBottom: 20 }}>
                  Você não paga absolutamente nada. Receba orçamentos, compare preços, escolha o melhor profissional.<br/>
                  <strong style={{ color: '#38bdf8' }}>O MeloCalé é financiado pelos profissionais, não por você.</strong>
                </p>
                <Link to="/login?mode=signup&role=client" className="cta-pulse" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52, background: 'linear-gradient(135deg,#0369a1,#0ea5e9,#38bdf8)', color: '#fff', fontWeight: 800, fontSize: 15, borderRadius: 13, textDecoration: 'none', boxShadow: '0 4px 24px rgba(56,189,248,.35)' }}>
                  Quero encontrar um profissional →
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── 14. FAQ ── */}
        <section style={{ background: '#0f172a', borderTop: '2px solid #38bdf8', padding: '64px 0' }}>
          <div className="container-app">
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 800, color: '#f0f6ff', marginBottom: 32 }}>Perguntas frequentes</h2>
            <div className="landing-faq-grid" style={(isProfissional || isCliente) ? { maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, alignItems: 'start' } : { maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} style={{ background: '#1a2840', border: `1px solid ${openFaq === i ? 'rgba(16,185,129,.5)' : 'rgba(56,189,248,.15)'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color .2s' }}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{ width: '100%', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'none', border: 'none', color: '#f0f6ff', textAlign: 'left', fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{item.q}</span>
                    <span style={{ fontSize: 18, color: '#10b981', fontWeight: 900, flexShrink: 0, marginLeft: 12, transition: 'transform .2s', display: 'inline-block', transform: openFaq === i ? 'rotate(45deg)' : '' }}>+</span>
                  </button>
                  {openFaq === i && (
                    <div style={{ padding: '0 22px 18px', fontSize: 14, color: '#94b8d4', lineHeight: 1.7 }}>
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
              <p style={{ fontSize: 14, fontWeight: 700, color: '#6a9ab8', marginBottom: 8 }}>🔥 Oferta especial expira em:</p>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 36, fontWeight: 900, color: '#f59e0b', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, padding: '10px 24px', letterSpacing: '.1em' }}>
                {pad(timer.h)}:{pad(timer.m)}:{pad(timer.s)}
              </span>
            </div>

            {/* Two cards */}
            <div className={`landing-cta-final-wrapper ${isProfissional || isCliente ? 'flex justify-center' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}`} style={{ maxWidth: 800, margin: '0 auto 28px' }}>

              {/* Verde */}
              <div className="landing-cta-final-card" style={{ background: '#1e2d45', border: '1px solid rgba(16,185,129,.22)', borderRadius: 18, padding: '36px 28px', display: isCliente ? 'none' : 'flex', flexDirection: 'column', gap: 14, textAlign: 'center', alignItems: 'center', maxWidth: isProfissional || isCliente ? 700 : undefined, width: '100%' }}>
                <span style={{ fontSize: 40 }}>🔧</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,.14)', border: '1px solid rgba(16,185,129,.35)', borderRadius: 6, padding: '3px 10px' }}>Para profissionais</span>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#f0f6ff', margin: 0 }}>Pare de depender de indicação.<br/>Comece a receber clientes hoje.</h3>
                <p style={{ fontSize: 13, color: '#94b8d4', margin: 0, lineHeight: 1.6 }}>Cada dia sem o MeloCalé é mais R$60 que você deixa na mesa. Profissionais em {displayCity} já estão faturando R$1.800/mês a mais.</p>
                <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 12, padding: '12px 16px', textAlign: 'left', width: '100%' }}>
                  <div style={{ color: '#fbbf24', fontSize: 12, marginBottom: 4 }}>★★★★★</div>
                  <p style={{ fontSize: 13, color: '#e2e8f0', margin: '0 0 4px', lineHeight: 1.5 }}>"Em 2 semanas já tinha 3 clientes novos. Faturei R$1.800 a mais só com os leads."</p>
                  <p style={{ fontSize: 11, color: '#6a9ab8', margin: 0 }}>— Carlos Augusto, Pintor · Salvador</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, width: '100%' }}>
                  <div style={{ background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 10, padding: '8px 14px', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>R$1,23</div>
                    <div style={{ fontSize: 10, color: '#94b8d4' }}>por dia</div>
                  </div>
                  <div style={{ background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 10, padding: '8px 14px', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>R$0</div>
                    <div style={{ fontSize: 10, color: '#94b8d4' }}>pra começar</div>
                  </div>
                  <div style={{ background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 10, padding: '8px 14px', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>7 dias</div>
                    <div style={{ fontSize: 10, color: '#94b8d4' }}>garantia</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#10b981', fontWeight: 900, fontSize: 13 }}>✓</span>
                    <span style={{ fontSize: 12, color: '#94c4a8' }}>Garantia de 7 dias — dinheiro de volta sem perguntas</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#10b981', fontWeight: 900, fontSize: 13 }}>✓</span>
                    <span style={{ fontSize: 12, color: '#94c4a8' }}>Cancele quando quiser — sem multa, sem fidelidade</span>
                  </div>
                </div>
                <Link to="/login?mode=signup&role=professional" className="cta-pulse" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 56, width: '100%', background: 'linear-gradient(135deg,#047857,#059669,#10b981)', color: '#fff', fontWeight: 900, fontSize: 16, borderRadius: 13, textDecoration: 'none', boxShadow: '0 4px 28px rgba(16,185,129,.4)' }}>
                  Quero receber clientes →
                </Link>
                <p style={{ fontSize: 10, color: '#4a6a80', margin: 0 }}>Grátis para começar · planos a partir de R$37/mês</p>
              </div>

              {/* Azul */}
              <div className="landing-cta-final-card" style={{ background: '#1e2d45', border: '1px solid rgba(56,189,248,.22)', borderRadius: 18, padding: '36px 28px', display: isProfissional ? 'none' : 'flex', flexDirection: 'column', gap: 14, textAlign: 'center', alignItems: 'center', maxWidth: isProfissional || isCliente ? 700 : undefined, width: '100%' }}>
                <span style={{ fontSize: 40 }}>🏠</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.35)', borderRadius: 6, padding: '3px 10px' }}>Para clientes</span>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#f0f6ff', margin: 0 }}>Pare de esperar indicação.<br/>Encontre seu profissional em 47 min.</h3>
                <p style={{ fontSize: 13, color: '#94b8d4', margin: 0, lineHeight: 1.6 }}>Profissionais verificados disponíveis em {displayCity} agora. Grátis, rápido, seguro — e com garantia de 7 dias.</p>
                <div style={{ background: 'rgba(56,189,248,.08)', border: '1px solid rgba(56,189,248,.2)', borderRadius: 12, padding: '12px 16px', textAlign: 'left', width: '100%' }}>
                  <div style={{ color: '#fbbf24', fontSize: 12, marginBottom: 4 }}>★★★★★</div>
                  <p style={{ fontSize: 13, color: '#e2e8f0', margin: '0 0 4px', lineHeight: 1.5 }}>"Precisava de um encanador urgente. Em menos de 1 hora já tinha 2 orçamentos."</p>
                  <p style={{ fontSize: 11, color: '#6a9ab8', margin: 0 }}>— Ana Rodrigues, Cliente · Salvador</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, width: '100%' }}>
                  <div style={{ background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.3)', borderRadius: 10, padding: '8px 14px', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#38bdf8' }}>R$0</div>
                    <div style={{ fontSize: 10, color: '#94b8d4' }}>pra clientes</div>
                  </div>
                  <div style={{ background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.3)', borderRadius: 10, padding: '8px 14px', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#38bdf8' }}>47 min</div>
                    <div style={{ fontSize: 10, color: '#94b8d4' }}>resposta</div>
                  </div>
                  <div style={{ background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.3)', borderRadius: 10, padding: '8px 14px', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#38bdf8' }}>23%</div>
                    <div style={{ fontSize: 10, color: '#94b8d4' }}>economia</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#38bdf8', fontWeight: 900, fontSize: 13 }}>✓</span>
                    <span style={{ fontSize: 12, color: '#94b8d4' }}>Você só paga depois que o profissional confirmar o serviço</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#38bdf8', fontWeight: 900, fontSize: 13 }}>✓</span>
                    <span style={{ fontSize: 12, color: '#94b8d4' }}>Reembolso garantido em 7 dias, sem burocracia</span>
                  </div>
                </div>
                <Link to="/login?mode=signup&role=client" className="cta-pulse" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 56, width: '100%', background: 'linear-gradient(135deg,#0369a1,#0ea5e9,#38bdf8)', color: '#fff', fontWeight: 900, fontSize: 16, borderRadius: 13, textDecoration: 'none', boxShadow: '0 4px 28px rgba(56,189,248,.4)' }}>
                  Encontrar profissional →
                </Link>
                <p style={{ fontSize: 10, color: '#4a6a80', margin: 0 }}>Grátis · sem cartão · garantia de 7 dias</p>
              </div>
            </div>

            {/* Trust row */}
            <p style={{ textAlign: 'center', fontSize: 13, color: '#4a6a80' }}>
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
