import { MapPin, Building2, Zap, ShieldCheck, HeartHandshake, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import StickyCtaMobile from '../components/StickyCtaMobile';
import FomoNotification from '../components/FomoNotification';
import EarningsCalculator from '../components/EarningsCalculator';
import ExitIntentPopup from '../components/ExitIntentPopup';
import LiveCounter from '../components/LiveCounter';
import CompetitorTable from '../components/CompetitorTable';
import CategoryGrid from '../components/CategoryGrid';
import ProactiveChat from '../components/ProactiveChat';
import { useUtmParams } from '../hooks/useUtmParams';
import React, { useState, useEffect } from 'react';

const BANNER_H = 44; // px — height of the countdown banner

function isFlashTime(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const hour = now.getHours();
  return day === 0 || day === 6 || (hour >= 18 && hour < 22);
}

const CITY_CACHE_KEY = 'melocale_user_city';
const CITY_CACHE_TTL = 30 * 60 * 1000;

async function detectCity(): Promise<string> {
  // Serve from cache if still fresh
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

  const [userCity, setUserCity] = useState("sua cidade");

  // Countdown — starts fresh every page load, auto-restarts at zero
  const [timer, setTimer] = useState({ h: 23, m: 59, s: 59 });

  // Random "vagas restantes" per plan (3-7), generated once per page load
  const [vagas] = useState(() => ({
    starter: 3 + Math.floor(Math.random() * 5),
    pro:     3 + Math.floor(Math.random() * 5),
    elite:   3 + Math.floor(Math.random() * 5),
  }));

  useEffect(() => {
    let cancelled = false;
    detectCity().then(city => { if (!cancelled) setUserCity(city); });
    return () => { cancelled = true; };
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

      {/* ── Banner topo — countdown padrão ou relâmpago 18-22h/fins de semana ── */}
      {isFlashTime() ? (
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 md:gap-4 text-white text-xs md:text-sm font-black px-4 flex-wrap"
          style={{ height: BANNER_H, background: 'linear-gradient(90deg, #92400e 0%, #b45309 50%, #92400e 100%)' }}
        >
          <span>⚡ Oferta Relâmpago</span>
          <span className="hidden sm:inline text-amber-200">—</span>
          <span className="text-amber-100 font-bold">Cadastre agora e ganhe <strong className="text-white">100 moedas extras!</strong></span>
          <Link to="/login?mode=signup" className="ml-1 bg-white/20 hover:bg-white/30 text-white rounded-lg px-3 py-1 text-xs font-black transition-colors whitespace-nowrap">
            Aproveitar →
          </Link>
        </div>
      ) : (
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 md:gap-4 text-white text-xs md:text-sm font-black px-4"
          style={{ height: BANNER_H, background: 'linear-gradient(90deg, #c2410c 0%, #ea580c 50%, #c2410c 100%)' }}
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

      <Navbar topOffset={BANNER_H} />

      <main>
        {/* ── Hero ── pt accounts for banner (44px) + nav (~64px) */}
        <section id="hero" className="relative pt-32 pb-32 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#0E1C32] to-[#0E1C32]"></div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative grid lg:grid-cols-2 gap-16 items-center">

            <div className="max-w-2xl">
              {isProfissional ? (
                /* ── Hero Profissional (utm_content=profissional) ── */
                <>
                  <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400 mb-6">
                    <Zap size={14} className="mr-2" /> Aumente sua renda em {userCity}
                  </div>
                  <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
                    Profissional em <br />
                    <span className="text-emerald-500">{userCity}?</span> <br />
                    Receba clientes <br />
                    todo mês
                  </h1>
                  <p className="text-lg text-[#94A3B8] mb-10 max-w-xl">
                    Profissionais no MeloCalé faturam em média <strong className="text-white">R$2.800/mês</strong> extras com leads qualificados. Comece grátis hoje.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="flex flex-col">
                      <Link
                        to="/login?mode=signup&role=professional"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-8 py-4 font-bold transition-colors text-center"
                      >
                        Quero Cadastrar meu Serviço →
                      </Link>
                      <p className="text-xs text-slate-500 text-center mt-1.5">Grátis para começar • Sem cartão de crédito</p>
                    </div>
                    <a
                      href="#planos"
                      className="bg-transparent border border-slate-700 hover:border-slate-500 text-white rounded-lg px-8 py-4 font-bold transition-colors text-center self-start"
                    >
                      Ver Planos
                    </a>
                  </div>
                  <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-800 mt-8">
                    <div>
                      <div className="flex items-center text-emerald-400 mb-2"><Zap size={20} className="mr-2" /></div>
                      <h3 className="font-bold text-white text-sm">Leads qualificados</h3>
                      <p className="text-xs text-[#4A6580] mt-1">Clientes prontos para contratar</p>
                    </div>
                    <div>
                      <div className="flex items-center text-yellow-500 mb-2"><ShieldCheck size={20} className="mr-2" /></div>
                      <h3 className="font-bold text-white text-sm">Badge verificado</h3>
                      <p className="text-xs text-[#4A6580] mt-1">Mais confiança, mais clientes</p>
                    </div>
                    <div>
                      <div className="flex items-center text-blue-400 mb-2"><HeartHandshake size={20} className="mr-2" /></div>
                      <h3 className="font-bold text-white text-sm">Você define os preços</h3>
                      <p className="text-xs text-[#4A6580] mt-1">Controle total do seu negócio</p>
                    </div>
                  </div>
                </>
              ) : (
                /* ── Hero Cliente (padrão) ── */
                <>
                  <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400 mb-6">
                    <MapPin size={14} className="mr-2" /> Profissionais Verificados em {userCity}
                  </div>
                  <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
                    Precisa de um <br />
                    profissional em <br />
                    <span className="text-blue-400">{userCity}?</span> <br />
                    <span className="text-emerald-500">Encontre agora.</span>
                  </h1>
                  <p className="text-lg text-[#94A3B8] mb-6 max-w-xl">
                    Conectamos você a profissionais qualificados para serviços em sua casa. Eletricistas, pintores, encanadores e muito mais.
                  </p>

                  {/* CTA mobile — acima da dobra */}
                  <div className="flex flex-col sm:hidden gap-3 mt-2 mb-4">
                    <Link
                      to="/login?mode=signup"
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-2xl text-base text-center shadow-xl shadow-emerald-500/30 transition-all uppercase tracking-wide"
                    >
                      {isProfissional ? 'Quero Receber Clientes Agora →' : `Encontrar Profissional em ${userCity} →`}
                    </Link>
                    <p className="text-center text-[11px] text-slate-400">✓ Grátis • ✓ Sem cartão • ✓ Cancele quando quiser</p>
                  </div>

                  <div className="hidden sm:flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="flex flex-col">
                      <Link
                        to="/login?mode=signup&role=client"
                        className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-8 py-4 font-bold transition-colors text-center"
                      >
                        Encontrar Profissional em {userCity} →
                      </Link>
                      <p className="text-xs text-slate-500 text-center mt-1.5">Grátis • Até 5 orçamentos em minutos</p>
                    </div>
                    <a
                      href="#como-funciona"
                      className="bg-transparent border border-slate-700 hover:border-slate-500 text-white rounded-lg px-8 py-4 font-bold transition-colors text-center self-start"
                    >
                      Ver Como Funciona
                    </a>
                  </div>
                  <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-800 mt-8">
                    <div>
                      <div className="flex items-center text-emerald-400 mb-2"><ShieldCheck size={20} className="mr-2" /></div>
                      <h3 className="font-bold text-white text-sm">Pagamento 100% Seguro</h3>
                      <p className="text-xs text-[#4A6580] mt-1">Transações protegidas</p>
                    </div>
                    <div>
                      <div className="flex items-center text-yellow-500 mb-2"><Zap size={20} className="mr-2" /></div>
                      <h3 className="font-bold text-white text-sm">Respostas em até 24h</h3>
                      <p className="text-xs text-[#4A6580] mt-1">Profissionais prontos</p>
                    </div>
                    <div>
                      <div className="flex items-center text-blue-400 mb-2"><HeartHandshake size={20} className="mr-2" /></div>
                      <h3 className="font-bold text-white text-sm">Profissionais Verificados</h3>
                      <p className="text-xs text-[#4A6580] mt-1">Identidade confirmada</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-6">
              {/* Pro card */}
              <div className="bg-gradient-to-br from-[#1C3454] to-slate-900 border border-slate-800 rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10 text-emerald-500"><Building2 size={100} /></div>
                <div className="relative z-10">
                  <div className="bg-emerald-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-emerald-500 mb-6">
                    <BriefcaseIcon size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Para Profissionais</h2>
                  <p className="text-[#94A3B8] mb-6">Aumente sua renda com leads qualificados</p>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-2" size={16} /> Comece grátis, sem compromisso</li>
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-2" size={16} /> Leads prontos para contratar</li>
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-2" size={16} /> Você controla seus preços</li>
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-2" size={16} /> Planos a partir de R$49/mês</li>
                  </ul>
                  <Link
                    to="/login?mode=signup&role=professional"
                    className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white text-center rounded-lg px-4 py-3 font-bold transition-colors"
                  >
                    Quero Receber Clientes Agora →
                  </Link>
                  <p className="text-xs text-slate-500 text-center mt-1.5">Grátis para começar • Sem cartão de crédito</p>
                </div>
              </div>

              {/* Client card */}
              <div className="bg-gradient-to-br from-[#1C3454] to-slate-900 border border-slate-800 rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10 text-blue-500"><UserIcon size={100} /></div>
                <div className="relative z-10">
                  <div className="bg-blue-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-blue-400 mb-6">
                    <UserIcon size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Para Clientes</h2>
                  <p className="text-[#94A3B8] mb-6">Encontre o profissional ideal rapidamente</p>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-blue-400 mr-2" size={16} /> Profissionais verificados e avaliados</li>
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-blue-400 mr-2" size={16} /> Receba até 5 orçamentos grátis</li>
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-blue-400 mr-2" size={16} /> Compare e escolha o melhor</li>
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-blue-400 mr-2" size={16} /> Contratação 100% segura</li>
                  </ul>
                  <Link
                    to="/login?mode=signup&role=client"
                    className="block w-full bg-blue-600 hover:bg-blue-500 text-white text-center rounded-lg px-4 py-3 font-bold transition-colors"
                  >
                    Encontrar Profissional em {userCity} →
                  </Link>
                  <p className="text-xs text-slate-500 text-center mt-1.5">Grátis • Até 5 orçamentos em minutos</p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ── EarningsCalculator condicional (profissional) ── */}
        {isProfissional && <EarningsCalculator />}

        {/* Live Counter */}
        <LiveCounter userCity={userCity} />

        {/* ── Categorias de serviços ── */}
        <CategoryGrid userCity={userCity} />

        {/* ── Prova Social — Stats + Depoimentos ── */}
        <section className="pt-20 pb-10 bg-[#0B1729] border-t border-slate-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-2xl mx-auto mb-16 text-center">
              <div>
                <p className="text-3xl md:text-4xl font-extrabold text-emerald-400">371+</p>
                <p className="text-xs md:text-sm text-[#94A3B8] mt-1">Profissionais cadastrados</p>
              </div>
              <div>
                <p className="text-3xl md:text-4xl font-extrabold text-blue-400">1.200+</p>
                <p className="text-xs md:text-sm text-[#94A3B8] mt-1">Serviços realizados este mês</p>
              </div>
              <div>
                <p className="text-3xl md:text-4xl font-extrabold text-yellow-400">98%</p>
                <p className="text-xs md:text-sm text-[#94A3B8] mt-1">de satisfação dos clientes</p>
              </div>
            </div>

            {/* Depoimentos */}
            <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-10">
              Quem usa, <span className="text-emerald-400">recomenda</span>
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Depoimento 1 — Carlos (profissional) */}
              <div className="bg-[#1C3454] border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-[#94A3B8] text-sm leading-relaxed flex-1">
                  "Em 2 semanas já tinha 3 clientes novos. O MeloCalé mudou meu mês — faturei R$1.800 a mais só com os leads da plataforma."
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-slate-800/60">
                  <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-white font-black text-sm shrink-0">
                    C
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Carlos Silva</p>
                    <p className="text-[#4A6580] text-xs">Eletricista · Feira de Santana, BA</p>
                  </div>
                </div>
              </div>

              {/* Depoimento 2 — Ana (cliente) */}
              <div className="bg-[#1C3454] border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-[#94A3B8] text-sm leading-relaxed flex-1">
                  "Precisava de um encanador urgente. Em menos de 1 hora já tinha 2 orçamentos. Contratei na hora e o serviço foi excelente!"
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-slate-800/60">
                  <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center text-white font-black text-sm shrink-0">
                    A
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Ana Rodrigues</p>
                    <p className="text-[#4A6580] text-xs">Cliente · Jacobina, BA</p>
                  </div>
                </div>
              </div>

              {/* Depoimento 3 — Marcos (profissional) */}
              <div className="bg-[#1C3454] border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-[#94A3B8] text-sm leading-relaxed flex-1">
                  "Tinha medo de não conseguir clientes pela internet. Hoje o MeloCalé é minha principal fonte de trabalho. Vale cada centavo."
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-slate-800/60">
                  <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                    M
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Marcos Oliveira</p>
                    <p className="text-[#4A6580] text-xs">Pintor · Irecê, BA</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA pós-depoimentos */}
            <div className="mt-8 text-center">
              <p className="text-slate-400 text-sm mb-4">
                Junte-se a <strong className="text-white">371+ profissionais</strong> e <strong className="text-white">1.200+ clientes</strong> que já usam o MeloCalé
              </p>
              <Link
                to="/login?mode=signup"
                className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 py-4 rounded-2xl text-base shadow-xl shadow-emerald-500/30 transition-all uppercase tracking-wide"
              >
                {isProfissional ? 'Quero Receber Clientes Agora →' : 'Quero Encontrar um Profissional →'}
              </Link>
              <p className="text-[11px] text-slate-500 mt-3">✓ Cadastro grátis • ✓ Sem cartão de crédito</p>
            </div>
          </div>
        </section>

        {/* ── Calculadora de Ganhos (clientes) ── */}
        {!isProfissional && <EarningsCalculator />}

        {/* ── Por que escolher + Comparativo com concorrentes ── */}
        <CompetitorTable userCity={userCity} />

        {/* ── Pricing ── */}
        <section id="planos" className="pt-16 pb-24 bg-[#0E1C32] border-t border-slate-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <div className="text-center mb-16">
              <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 mb-6">
                🔥 Oferta por tempo limitado
              </div>
              <h2 className="text-4xl font-extrabold text-white mb-4">
                Quanto você quer <span className="text-emerald-500">faturar</span> este mês?
              </h2>
              <p className="text-[#94A3B8] max-w-2xl mx-auto">
                Profissionais na Melocale faturam em média <strong className="text-white">R$2.800/mês</strong> extras.
                Escolha seu plano e comece hoje.
              </p>
              <p className="text-emerald-400 text-sm font-bold mt-4">⚡ 73% dos profissionais escolhem o PRO — o plano que mais gera retorno</p>
            </div>

            <div className="flex justify-center mb-12">
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-6 py-3">
                <span className="text-emerald-400 text-xl">🛡️</span>
                <span className="text-emerald-400 font-bold text-sm">Garantia de 7 dias — dinheiro de volta sem perguntas</span>
              </div>
            </div>


            {/* Ancoragem de preço psicológica */}
            <div className="max-w-4xl mx-auto mb-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 overflow-x-auto sm:overflow-visible">
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 shrink-0">
                <span className="text-3xl">☕</span>
                <div>
                  <p className="text-emerald-300 font-bold text-sm leading-tight">Menos que 1 café por dia</p>
                  <p className="text-slate-400 text-xs mt-0.5">R$37/mês = R$1,23/dia</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 shrink-0">
                <span className="text-3xl">🍕</span>
                <div>
                  <p className="text-emerald-300 font-bold text-sm leading-tight">Menos que uma pizza</p>
                  <p className="text-slate-400 text-xs mt-0.5">Por mês você acessa clientes ilimitados</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 shrink-0">
                <span className="text-3xl">💡</span>
                <div>
                  <p className="text-emerald-300 font-bold text-sm leading-tight">1 cliente já paga 7 meses</p>
                  <p className="text-slate-400 text-xs mt-0.5">Um serviço de R$500 cobre o plano PRO por 7 meses</p>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-4 gap-4 lg:gap-6 text-left max-w-6xl mx-auto mb-16">

              {/* GRATUITO */}
              <div className="bg-[#1C3454] rounded-2xl border border-slate-800 p-5 sm:p-8 flex flex-col opacity-70 hover:opacity-100 transition-opacity duration-200">
                <div className="mb-6">
                  <h3 className="text-[#94A3B8] font-bold text-sm uppercase tracking-widest mb-2">Gratuito</h3>
                  <div className="text-4xl font-extrabold text-white mb-1">R$ 0<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-[#4A6580] text-xs">Para conhecer a plataforma</p>
                </div>
                <Link to="/login" className="block w-full bg-slate-800 hover:bg-slate-700 text-white text-center rounded-xl px-4 py-3 text-sm font-bold transition-all mb-6">
                  Explorar Grátis →
                </Link>
                <ul className="space-y-3 flex-1">
                  <li className="flex items-start gap-2 text-[#94A3B8] text-sm"><CheckIcon className="text-[#4A6580] shrink-0 mt-0.5" size={16}/> Cadastro na plataforma</li>
                  <li className="flex items-start gap-2 text-[#94A3B8] text-sm"><CheckIcon className="text-[#4A6580] shrink-0 mt-0.5" size={16}/> Ver leads disponíveis</li>
                  <li className="flex items-start gap-2 text-[#94A3B8] text-sm"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> 10 moedas de boas-vindas</li>
                  <li className="hidden sm:flex items-start gap-2 text-[#4A6580] text-sm line-through"><XIcon className="text-slate-700 shrink-0 mt-0.5" size={16}/> Desconto em moedas</li>
                  <li className="hidden sm:flex items-start gap-2 text-[#4A6580] text-sm line-through"><XIcon className="text-slate-700 shrink-0 mt-0.5" size={16}/> Badge verificado</li>
                </ul>
              </div>

              {/* STARTER */}
              <div className="bg-[#1C3454] rounded-2xl border border-blue-500/30 p-5 sm:p-8 flex flex-col relative opacity-85 hover:opacity-100 transition-opacity duration-200">
                <div className="mb-6">
                  <div className="inline-block px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-3">Starter</div>
                  <div className="text-4xl font-extrabold text-white mb-1">R$ 37<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-emerald-400 text-xs font-bold">25% off em todas as moedas</p>
                </div>
                <Link to="/login?mode=signup&role=professional" className="block w-full bg-blue-600 hover:bg-blue-500 text-white text-center rounded-xl px-4 py-3 text-sm font-bold transition-all mb-4 shadow-lg shadow-blue-500/20">
                  Quero Receber Leads →
                </Link>
                {/* Vagas urgência */}
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <span>⚠️</span>
                  <span>Apenas {vagas.starter} vagas restantes em {userCity}</span>
                </div>
                <ul className="space-y-3 flex-1">
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> 25% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> Badge ✅ VERIFICADO</li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> Perfil público visível</li>
                  <li className="hidden sm:flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 🎁 30 moedas de boas-vindas</li>
                  <li className="hidden sm:flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> Suporte por chat</li>
                </ul>
                <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <p className="text-blue-300 text-xs text-center">Pacote R$59,90 → <strong>R$44,93</strong> com Starter</p>
                </div>
              </div>

              {/* PRO — DESTAQUE */}
              <div className="bg-gradient-to-b from-[#1c1d28] to-[#1C3454] rounded-2xl border-2 border-emerald-500 p-5 sm:p-8 flex flex-col relative transform scale-105 z-10 shadow-[0_0_50px_-10px_rgba(16,185,129,0.4)]">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-black px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase whitespace-nowrap">
                  ⚡ Mais Popular
                </div>
                <div className="mb-6">
                  <div className="inline-block px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-3">PRO</div>
                  <div className="text-4xl font-extrabold text-white mb-1">R$ 67<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-emerald-400 text-xs font-bold">40% off em todas as moedas</p>
                </div>
                <Link to="/login?mode=signup&role=professional" className="block w-full bg-emerald-500 hover:bg-emerald-400 text-black text-center rounded-xl px-4 py-3 text-sm font-black transition-all mb-4 shadow-xl shadow-emerald-500/30">
                  Receber Meu Primeiro Lead →
                </Link>
                {/* Vagas urgência */}
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <span>⚠️</span>
                  <span>Apenas {vagas.pro} vagas restantes em {userCity}</span>
                </div>
                <ul className="space-y-3 flex-1">
                  <li className="flex items-start gap-2 text-slate-200 text-sm"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> 40% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-2 text-slate-200 text-sm"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> Badge ⚡ PRO em destaque</li>
                  <li className="flex items-start gap-2 text-slate-200 text-sm"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> 2x mais visível nas buscas</li>
                  <li className="hidden sm:flex items-start gap-2 text-slate-200 text-sm"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> Moedas nunca expiram</li>
                  <li className="hidden sm:flex items-start gap-2 text-slate-200 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 🎁 80 moedas de boas-vindas</li>
                  <li className="hidden sm:flex items-start gap-2 text-slate-200 text-sm"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> Suporte prioritário (2h)</li>
                </ul>
                <div className="mt-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                  <p className="text-emerald-300 text-xs text-center">Pacote R$59,90 → <strong>R$35,94</strong> com PRO</p>
                  <p className="text-emerald-400 text-[10px] text-center mt-1 font-bold">O plano se paga em 1 compra de moedas</p>
                </div>
              </div>

              {/* ELITE */}
              <div className="bg-[#1C3454] rounded-2xl border border-yellow-500/30 p-5 sm:p-8 flex flex-col relative opacity-85 hover:opacity-100 transition-opacity duration-200">
                <div className="mb-6">
                  <div className="inline-block px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-3">🏆 Elite</div>
                  <div className="text-4xl font-extrabold text-white mb-1">R$ 127<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-yellow-400 text-xs font-bold">55% off em todas as moedas</p>
                </div>
                <Link to="/login?mode=signup&role=professional" className="block w-full bg-yellow-500 hover:bg-yellow-400 text-black text-center rounded-xl px-4 py-3 text-sm font-black transition-all mb-4 shadow-lg shadow-yellow-500/20">
                  Dominar {userCity} Agora →
                </Link>
                {/* Vagas urgência */}
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <span>⚠️</span>
                  <span>Apenas {vagas.elite} vagas restantes em {userCity}</span>
                </div>
                <ul className="space-y-3 flex-1">
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 55% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Badge 🏆 ELITE dourado</li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Topo absoluto das buscas</li>
                  <li className="hidden sm:flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Até 3 profissionais na conta</li>
                  <li className="hidden sm:flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 🎁 200 moedas de boas-vindas</li>
                  <li className="hidden sm:flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Gerente de conta dedicado</li>
                </ul>
                <div className="mt-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                  <p className="text-yellow-300 text-xs text-center">Pacote R$119,90 → <strong>R$53,96</strong> com Elite</p>
                </div>
              </div>
            </div>

            {/* Ancoragem de ROI */}
            <div className="max-w-3xl mx-auto bg-[#1C3454] border border-[#1C3050] rounded-2xl p-8 text-center">
              <p className="text-[#94A3B8] text-sm mb-2">💡 Pense assim:</p>
              <p className="text-white text-xl font-bold mb-2">
                1 cliente de <span className="text-emerald-400">R$ 500</span> já paga o plano PRO por <span className="text-emerald-400">7 meses</span>
              </p>
              <p className="text-[#4A6580] text-sm">E com 40% de desconto em moedas, você acessa muito mais clientes pelo mesmo preço.</p>
            </div>

          </div>
        </section>

      </main>

      <Footer />

      {/* ── Global conversion widgets ── */}
      <StickyCtaMobile vagasPro={vagas.pro} userCity={userCity} />
      <FomoNotification />
      <ExitIntentPopup />
      <ProactiveChat userCity={userCity} />
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

function BriefcaseIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...props} width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
  );
}

function UserIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...props} width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  );
}

