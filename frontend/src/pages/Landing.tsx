import { MapPin, Zap, ShieldCheck, HeartHandshake, Star } from 'lucide-react';
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
  } catch { sessionStorage.removeItem(CITY_CACHE_KEY); }
  const apis = [
    async () => { const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) }); const d = await r.json(); return (d.city as string) || null; },
    async () => { const r = await fetch('https://ip-api.com/json/?fields=city', { signal: AbortSignal.timeout(3000) }); const d = await r.json(); return (d.city as string) || null; },
    async () => { const r = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(3000) }); const d = await r.json(); return (d.city as string) || null; },
    async () => { const r = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: AbortSignal.timeout(3000) }); const d = await r.json(); return (d.city as string) || null; },
  ];
  for (const api of apis) {
    try {
      const city = await api();
      if (city) {
        sessionStorage.setItem(CITY_CACHE_KEY, JSON.stringify({ city, ts: Date.now() }));
        sessionStorage.setItem('user_city', city);
        return city;
      }
    } catch { continue; }
  }
  return 'sua cidade';
}

export default function LandingPage() {
  const { user } = useAuthStore();
  const role = user?.role;
  const { isProfissional } = useUtmParams();

  const [userCity, setUserCity] = useState('sua cidade');
  const [timer, setTimer] = useState({ h: 23, m: 59, s: 59 });
  const [vagas] = useState(() => ({
    starter: 3 + Math.floor(Math.random() * 5),
    pro:     3 + Math.floor(Math.random() * 5),
    elite:   3 + Math.floor(Math.random() * 5),
  }));
  const [showConversionWidgets, setShowConversionWidgets] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#0E1C32] text-slate-200 font-sans selection:bg-emerald-500/30">

      {/* Banner topo */}
      {isFlashTime() ? (
        <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 text-white text-xs md:text-sm font-black px-4 flex-wrap"
          style={{ height: BANNER_H, background: 'linear-gradient(90deg, #92400e 0%, #b45309 50%, #92400e 100%)' }}>
          <span>⚡ Oferta Relâmpago</span>
          <span className="hidden sm:inline text-amber-200">—</span>
          <span className="text-amber-100 font-bold">Cadastre agora e ganhe <strong className="text-white">100 moedas extras!</strong></span>
          <Link to="/login?mode=signup" className="ml-1 bg-white/20 hover:bg-white/30 text-white rounded-lg px-3 py-1.5 text-xs font-black transition-colors whitespace-nowrap">Aproveitar →</Link>
        </div>
      ) : (
        <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 text-white text-xs md:text-sm font-black px-4"
          style={{ height: BANNER_H, background: 'linear-gradient(90deg, #c2410c 0%, #ea580c 50%, #c2410c 100%)' }}>
          <span>🔥 Oferta especial expira em:</span>
          <span className="font-mono text-base md:text-lg tracking-widest bg-black/20 px-3 py-0.5 rounded-lg">{pad(timer.h)}:{pad(timer.m)}:{pad(timer.s)}</span>
          <Link to="/login?mode=signup" className="hidden sm:inline ml-2 underline underline-offset-2 hover:no-underline opacity-90 hover:opacity-100 transition-opacity">Aproveitar →</Link>
        </div>
      )}

      <Navbar topOffset={BANNER_H} />

      <main>
        {/* ── HERO ── */}
        <section className="relative pt-36 pb-28 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#0E1C32] to-[#0E1C32]" />
          <div className="container-full relative">
            <div className="grid lg:grid-cols-2 gap-12 items-start">

              {/* Coluna esquerda */}
              <div>
                <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400 mb-6">
                  {isProfissional
                    ? <><Zap size={14} className="mr-2" /> Aumente sua renda em {userCity}</>
                    : <><MapPin size={14} className="mr-2" /> Profissionais Verificados em {userCity}</>}
                </div>

                {isProfissional ? (
                  <h1 className="text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-[1.1]">
                    Profissional em <br />
                    <span className="text-emerald-500">{userCity}?</span> <br />
                    Receba clientes <br />
                    todo mês
                  </h1>
                ) : (
                  <h1 className="text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-[1.1]">
                    Precisa de um <br />
                    profissional em <br />
                    <span className="text-blue-400">{userCity}?</span> <br />
                    <span className="text-emerald-500">Encontre agora.</span>
                  </h1>
                )}

                <p className="text-base text-[#94A3B8] mb-8 leading-relaxed">
                  {isProfissional
                    ? <span>Profissionais no MeloCalé faturam em média <strong className="text-white">R$2.800/mês</strong> extras com leads qualificados. Comece grátis hoje.</span>
                    : 'Conectamos você a profissionais qualificados para serviços em sua casa. Eletricistas, pintores, encanadores e muito mais.'}
                </p>

                <div className="flex flex-wrap gap-4 mb-8">
                  {isProfissional ? (
                    <Link to="/login?mode=signup&role=professional" className="h-14 inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-8 font-bold transition-colors">
                      Quero Cadastrar meu Serviço →
                    </Link>
                  ) : (
                    <Link to="/login?mode=signup&role=client" className="h-14 inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-8 font-bold transition-colors">
                      Encontrar Profissional Agora →
                    </Link>
                  )}
                  <a href={isProfissional ? '#planos' : '#como-funciona'} className="h-14 inline-flex items-center justify-center border border-slate-700 hover:border-slate-500 text-white rounded-xl px-8 font-bold transition-colors">
                    {isProfissional ? 'Ver Planos' : 'Ver Como Funciona'}
                  </a>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800">
                  {isProfissional ? (
                    <>
                      <div><div className="text-emerald-400 mb-2"><Zap size={16} /></div><p className="font-bold text-white text-sm">Leads qualificados</p><p className="text-xs text-[#4A6580] mt-1 hidden sm:block">Clientes prontos para contratar</p></div>
                      <div><div className="text-yellow-500 mb-2"><ShieldCheck size={16} /></div><p className="font-bold text-white text-sm">Badge verificado</p><p className="text-xs text-[#4A6580] mt-1 hidden sm:block">Mais confiança, mais clientes</p></div>
                      <div><div className="text-blue-400 mb-2"><HeartHandshake size={16} /></div><p className="font-bold text-white text-sm">Você define os preços</p><p className="text-xs text-[#4A6580] mt-1 hidden sm:block">Controle total do negócio</p></div>
                    </>
                  ) : (
                    <>
                      <div><div className="text-emerald-400 mb-2"><ShieldCheck size={16} /></div><p className="font-bold text-white text-sm">Pagamento 100% Seguro</p><p className="text-xs text-[#4A6580] mt-1 hidden sm:block">Transações protegidas</p></div>
                      <div><div className="text-yellow-500 mb-2"><Zap size={16} /></div><p className="font-bold text-white text-sm">Respostas em até 24h</p><p className="text-xs text-[#4A6580] mt-1 hidden sm:block">Profissionais prontos</p></div>
                      <div><div className="text-blue-400 mb-2"><HeartHandshake size={16} /></div><p className="font-bold text-white text-sm">Profissionais Verificados</p><p className="text-xs text-[#4A6580] mt-1 hidden sm:block">Identidade confirmada</p></div>
                    </>
                  )}
                </div>
              </div>

              {/* Coluna direita — cards */}
              <div className="hidden lg:flex flex-col gap-5">
                <div className="bg-[#1C3454] border border-emerald-500/30 rounded-2xl p-8">
                  <p className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-4">Para Profissionais</p>
                  <h3 className="text-white font-bold text-lg mb-2">Aumente sua renda com leads qualificados</h3>
                  <ul className="space-y-3 mb-6 text-slate-300 text-sm">
                    <li className="flex items-center gap-2"><CheckIcon className="text-emerald-400 shrink-0" size={15}/> Comece grátis, sem compromisso</li>
                    <li className="flex items-center gap-2"><CheckIcon className="text-emerald-400 shrink-0" size={15}/> Leads prontos para contratar</li>
                    <li className="flex items-center gap-2"><CheckIcon className="text-emerald-400 shrink-0" size={15}/> Você controla seus preços</li>
                    <li className="flex items-center gap-2"><CheckIcon className="text-emerald-400 shrink-0" size={15}/> Planos a partir de R$37/mês</li>
                  </ul>
                  <Link to="/login?mode=signup&role=professional" className="h-12 w-full inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl text-sm transition-all">
                    CADASTRE-SE JÁ →
                  </Link>
                </div>

                <div className="bg-[#1C3454] border border-blue-500/30 rounded-2xl p-8">
                  <p className="text-blue-400 text-xs font-black uppercase tracking-widest mb-4">Para Clientes</p>
                  <h3 className="text-white font-bold text-lg mb-2">Encontre o profissional ideal rapidamente</h3>
                  <ul className="space-y-3 mb-6 text-slate-300 text-sm">
                    <li className="flex items-center gap-2"><CheckIcon className="text-blue-400 shrink-0" size={15}/> Profissionais verificados e avaliados</li>
                    <li className="flex items-center gap-2"><CheckIcon className="text-blue-400 shrink-0" size={15}/> Receba até 5 orçamentos grátis</li>
                    <li className="flex items-center gap-2"><CheckIcon className="text-blue-400 shrink-0" size={15}/> Compare e escolha o melhor</li>
                    <li className="flex items-center gap-2"><CheckIcon className="text-blue-400 shrink-0" size={15}/> Contratação 100% segura</li>
                  </ul>
                  <Link to="/login?mode=signup&role=client" className="h-12 w-full inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-sm transition-all">
                    CADASTRE-SE JÁ →
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </section>

        {isProfissional && <Suspense fallback={null}><EarningsCalculator /></Suspense>}
        <LiveCounter userCity={userCity} />
        <Suspense fallback={null}><CategoryGrid userCity={userCity} /></Suspense>

        {/* ── PROVA SOCIAL ── */}
        <section className="py-24 bg-[#0B1729] border-t border-slate-800/50">
          <div className="container-full">
            <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mb-14 text-center">
              <div><p className="text-4xl font-extrabold text-emerald-400">371+</p><p className="text-sm text-[#94A3B8] mt-2">Profissionais cadastrados</p></div>
              <div><p className="text-4xl font-extrabold text-blue-400">1.200+</p><p className="text-sm text-[#94A3B8] mt-2">Serviços realizados este mês</p></div>
              <div><p className="text-4xl font-extrabold text-yellow-400">98%</p><p className="text-sm text-[#94A3B8] mt-2">de satisfação dos clientes</p></div>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-10">
              Quem usa, <span className="text-emerald-400">recomenda</span>
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { text: '"Em 2 semanas já tinha 3 clientes novos. O MeloCalé mudou meu mês — faturei R$1.800 a mais só com os leads da plataforma."', name: 'Carlos Silva', role: 'Eletricista · Feira de Santana, BA', color: 'bg-blue-700', initial: 'C' },
                { text: '"Precisava de um encanador urgente. Em menos de 1 hora já tinha 2 orçamentos. Contratei na hora e o serviço foi excelente!"', name: 'Ana Rodrigues', role: 'Cliente · Jacobina, BA', color: 'bg-emerald-700', initial: 'A' },
                { text: '"Tinha medo de não conseguir clientes pela internet. Hoje o MeloCalé é minha principal fonte de trabalho. Vale cada centavo."', name: 'Marcos Oliveira', role: 'Pintor · Irecê, BA', color: 'bg-orange-600', initial: 'M' },
              ].map((d, i) => (
                <div key={i} className="bg-[#1C3454] border border-slate-800 rounded-2xl p-8 flex flex-col gap-4">
                  <div className="flex gap-0.5">{[...Array(5)].map((_, j) => <Star key={j} size={15} className="text-yellow-400 fill-yellow-400" />)}</div>
                  <p className="text-[#94A3B8] text-sm leading-relaxed flex-1">{d.text}</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-800/60">
                    <div className={`w-10 h-10 rounded-full ${d.color} flex items-center justify-center text-white font-black text-sm shrink-0`}>{d.initial}</div>
                    <div><p className="text-white font-bold text-sm">{d.name}</p><p className="text-[#4A6580] text-xs">{d.role}</p></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <p className="text-slate-400 text-sm mb-5">Junte-se a <strong className="text-white">371+ profissionais</strong> e <strong className="text-white">1.200+ clientes</strong> que já usam o MeloCalé</p>
              <Link to="/login?mode=signup" className="inline-flex items-center h-14 bg-emerald-500 hover:bg-emerald-400 text-black font-black px-10 rounded-2xl text-base shadow-xl shadow-emerald-500/30 transition-all uppercase tracking-wide">
                {isProfissional ? 'Quero Receber Clientes Agora →' : 'Quero Encontrar um Profissional →'}
              </Link>
              <p className="text-xs text-slate-500 mt-3">✓ Cadastro grátis • ✓ Sem cartão de crédito</p>
            </div>
          </div>
        </section>

        {!isProfissional && <Suspense fallback={null}><EarningsCalculator /></Suspense>}
        <Suspense fallback={null}><CompetitorTable userCity={userCity} /></Suspense>

        {/* ── PRICING ── */}
        <section id="planos" className="py-24 bg-[#0E1C32] border-t border-slate-800/50">
          <div className="container-full">
            <div className="text-center mb-10">
              <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400 mb-4">🔥 Oferta por tempo limitado</div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Quanto você quer <span className="text-emerald-500">faturar</span> este mês?</h2>
              <p className="text-[#94A3B8] max-w-xl mx-auto">Profissionais na Melocale faturam em média <strong className="text-white">R$2.800/mês</strong> extras. Escolha seu plano e comece hoje.</p>
              <p className="text-emerald-400 text-sm font-bold mt-3">⚡ 73% dos profissionais escolhem o PRO — o plano que mais gera retorno</p>
            </div>

            <div className="flex justify-center mb-8">
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-5 py-3">
                <span className="text-emerald-400 text-xl">🛡️</span>
                <span className="text-emerald-400 font-bold text-sm">Garantia de 7 dias — dinheiro de volta sem perguntas</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
              {[['☕','Menos que 1 café por dia','R$37/mês = R$1,23/dia'],['🍕','Menos que uma pizza','Por mês você acessa clientes ilimitados'],['💡','1 cliente já paga 7 meses','Um serviço de R$500 cobre o plano PRO por 7 meses']].map(([emoji, title, sub], i) => (
                <div key={i} className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                  <span className="text-3xl">{emoji}</span>
                  <div><p className="text-emerald-300 font-bold text-sm">{title}</p><p className="text-slate-400 text-xs mt-0.5">{sub}</p></div>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-4 gap-6 mb-10">
              {/* GRATUITO */}
              <div className="bg-[#1C3454] rounded-2xl border border-slate-800 p-8 flex flex-col opacity-70 hover:opacity-100 transition-opacity">
                <h3 className="text-[#94A3B8] font-bold text-xs uppercase tracking-widest mb-3">Gratuito</h3>
                <div className="text-4xl font-extrabold text-white mb-1">R$ 0<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                <p className="text-xs text-[#4A6580] mb-6">Para conhecer a plataforma</p>
                <Link to="/login" className="h-12 inline-flex items-center justify-center w-full bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all mb-6">Explorar Grátis →</Link>
                <ul className="space-y-3 flex-1 text-sm text-[#94A3B8]">
                  <li className="flex items-start gap-2"><CheckIcon className="text-[#4A6580] shrink-0 mt-0.5" size={15}/> Cadastro na plataforma</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-[#4A6580] shrink-0 mt-0.5" size={15}/> Ver leads disponíveis</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={15}/> 10 moedas de boas-vindas</li>
                  <li className="flex items-start gap-2 line-through text-[#4A6580]"><XIcon className="text-slate-700 shrink-0 mt-0.5" size={15}/> Desconto em moedas</li>
                  <li className="flex items-start gap-2 line-through text-[#4A6580]"><XIcon className="text-slate-700 shrink-0 mt-0.5" size={15}/> Badge verificado</li>
                </ul>
              </div>

              {/* STARTER */}
              <div className="bg-[#1C3454] rounded-2xl border border-blue-500/30 p-8 flex flex-col opacity-85 hover:opacity-100 transition-opacity">
                <div className="inline-block px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-3 w-fit">Starter</div>
                <div className="text-4xl font-extrabold text-white mb-1">R$ 37<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                <p className="text-emerald-400 text-xs font-bold mb-6">25% off em todas as moedas</p>
                <Link to="/login?mode=signup&role=professional" className="h-12 inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all mb-3 shadow-lg shadow-blue-500/20">Quero Receber Leads →</Link>
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">⚠️ Apenas {vagas.starter} vagas restantes em {userCity}</div>
                <ul className="space-y-3 flex-1 text-sm text-slate-300">
                  <li className="flex items-start gap-2"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={15}/> 25% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={15}/> Badge ✅ VERIFICADO</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={15}/> Perfil público visível</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={15}/> 🎁 30 moedas de boas-vindas</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={15}/> Suporte por chat</li>
                </ul>
                <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3"><p className="text-blue-300 text-xs text-center">Pacote R$59,90 → <strong>R$44,93</strong> com Starter</p></div>
              </div>

              {/* PRO */}
              <div className="bg-gradient-to-b from-[#1c1d28] to-[#1C3454] rounded-2xl border-2 border-emerald-500 p-8 flex flex-col relative md:scale-105 z-10 shadow-[0_0_50px_-10px_rgba(16,185,129,0.4)]">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-black px-4 py-1.5 rounded-full text-xs font-black uppercase whitespace-nowrap">⚡ Mais Popular</div>
                <div className="inline-block px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-3 w-fit">PRO</div>
                <div className="text-4xl font-extrabold text-white mb-1">R$ 67<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                <p className="text-emerald-400 text-xs font-bold mb-6">40% off em todas as moedas</p>
                <Link to="/login?mode=signup&role=professional" className="h-12 inline-flex items-center justify-center w-full bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-sm font-black transition-all mb-3 shadow-xl shadow-emerald-500/30">Receber Meu Primeiro Lead →</Link>
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">⚠️ Apenas {vagas.pro} vagas restantes em {userCity}</div>
                <ul className="space-y-3 flex-1 text-sm text-slate-200">
                  <li className="flex items-start gap-2"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={15}/> 40% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={15}/> Badge ⚡ PRO em destaque</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={15}/> 2x mais visível nas buscas</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={15}/> Moedas nunca expiram</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={15}/> 🎁 80 moedas de boas-vindas</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={15}/> Suporte prioritário (2h)</li>
                </ul>
                <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                  <p className="text-emerald-300 text-xs text-center">Pacote R$59,90 → <strong>R$35,94</strong> com PRO</p>
                  <p className="text-emerald-400 text-[10px] text-center mt-1 font-bold">O plano se paga em 1 compra de moedas</p>
                </div>
              </div>

              {/* ELITE */}
              <div className="bg-[#1C3454] rounded-2xl border border-yellow-500/30 p-8 flex flex-col opacity-85 hover:opacity-100 transition-opacity">
                <div className="inline-block px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-3 w-fit">🏆 Elite</div>
                <div className="text-4xl font-extrabold text-white mb-1">R$ 127<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                <p className="text-yellow-400 text-xs font-bold mb-6">55% off em todas as moedas</p>
                <Link to="/login?mode=signup&role=professional" className="h-12 inline-flex items-center justify-center w-full bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl text-sm font-black transition-all mb-3 shadow-lg shadow-yellow-500/20">Dominar {userCity} Agora →</Link>
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">⚠️ Apenas {vagas.elite} vagas restantes em {userCity}</div>
                <ul className="space-y-3 flex-1 text-sm text-slate-300">
                  <li className="flex items-start gap-2"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={15}/> 55% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={15}/> Badge 🏆 ELITE dourado</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={15}/> Topo absoluto das buscas</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={15}/> Até 3 profissionais na conta</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={15}/> 🎁 200 moedas de boas-vindas</li>
                  <li className="flex items-start gap-2"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={15}/> Gerente de conta dedicado</li>
                </ul>
                <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3"><p className="text-yellow-300 text-xs text-center">Pacote R$119,90 → <strong>R$53,96</strong> com Elite</p></div>
              </div>
            </div>

            <div className="max-w-2xl mx-auto bg-[#1C3454] border border-[#1C3050] rounded-2xl p-8 text-center">
              <p className="text-[#94A3B8] text-sm mb-3">💡 Pense assim:</p>
              <p className="text-white text-xl font-bold mb-3">1 cliente de <span className="text-emerald-400">R$ 500</span> já paga o plano PRO por <span className="text-emerald-400">7 meses</span></p>
              <p className="text-[#4A6580] text-sm">E com 40% de desconto em moedas, você acessa muito mais clientes pelo mesmo preço.</p>
            </div>
          </div>
        </section>
      </main>

      <Footer />

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

interface IconProps extends React.SVGProps<SVGSVGElement> { size?: number; }

function CheckIcon({ size = 24, ...props }: IconProps) {
  return <svg {...props} width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}

function XIcon({ size = 24, ...props }: IconProps) {
  return <svg {...props} width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
