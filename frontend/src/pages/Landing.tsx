import { Search, MapPin, Building2, ChevronDown, Zap, ShieldCheck, HeartHandshake, MousePointer2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import React, { useState, useEffect } from 'react';

export default function LandingPage() {
  const { isAuthenticated, user } = useAuthStore();
  const role = user?.role;
  const dashboardLink = role === 'admin' ? '/admin/dashboard' : role === 'professional' ? '/profissional/dashboard' : '/cliente/dashboard';
  const [userCity, setUserCity] = useState("São Paulo");

  useEffect(() => {
    let cancelled = false;
    fetch('https://get.geojs.io/v1/ip/geo.json')
      .then(res => res.json())
      .then(data => { if (!cancelled && data?.city) setUserCity(data.city); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-[#0E1C32] text-slate-200 font-sans selection:bg-emerald-500/30">
      <Navbar />

      <main>
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#0E1C32] to-[#0E1C32]"></div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative grid lg:grid-cols-2 gap-16 items-center">
            
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400 mb-6">
                <MapPin size={14} className="mr-2" /> Profissionais Verificados em {userCity}
              </div>
              <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
                Encontre o <br />
                <span className="text-blue-400">Profissional</span> <br />
                <span className="text-emerald-500">Certo</span> <br />
                Perto de Você
              </h1>
              <p className="text-lg text-[#94A3B8] mb-10 max-w-xl">
                Conectamos você a profissionais qualificados para serviços em sua casa. Eletricistas, pintores, encanadores e muito mais.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                 <Link to="/login?mode=signup&role=client" className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-8 py-4 font-bold transition-colors text-center">
                   Encontrar Profissional Agora
                 </Link>
                 <a href="#como-funciona" className="bg-transparent border border-slate-700 hover:border-slate-500 text-white rounded-lg px-8 py-4 font-bold transition-colors text-center">
                   Ver Como Funciona
                 </a>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-800">
                <div>
                  <div className="flex items-center text-emerald-400 mb-2">
                    <ShieldCheck size={20} className="mr-2" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Pagamento 100% Seguro</h3>
                  <p className="text-xs text-[#4A6580] mt-1">Transações protegidas</p>
                </div>
                <div>
                  <div className="flex items-center text-yellow-500 mb-2">
                    <Zap size={20} className="mr-2" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Respostas em até 24h</h3>
                  <p className="text-xs text-[#4A6580] mt-1">Profissionais prontos</p>
                </div>
                <div>
                  <div className="flex items-center text-blue-400 mb-2">
                    <HeartHandshake size={20} className="mr-2" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Profissionais Verificados</h3>
                  <p className="text-xs text-[#4A6580] mt-1">Identidade confirmada</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-br from-[#1C3454] to-slate-900 border border-slate-800 rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10 text-emerald-500"><Building2 size={100} /></div>
                <div className="relative z-10">
                  <div className="bg-emerald-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-emerald-500 mb-6">
                    <BriefcaseIcon size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Para Profissionais</h2>
                  <p className="text-[#94A3B8] mb-6">Aumente sua renda com leads qualificados</p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-2" size={16} /> Comece grátis, sem compromisso</li>
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-2" size={16} /> Leads prontos para contratar</li>
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-2" size={16} /> Você controla seus preços</li>
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-2" size={16} /> Planos a partir de R$49/mês</li>
                  </ul>
                  <Link to="/login?mode=signup&role=professional" className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white text-center rounded-lg px-4 py-3 font-bold transition-colors">
                    CADASTRE-SE JÁ!
                  </Link>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#1C3454] to-slate-900 border border-slate-800 rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10 text-blue-500"><UserIcon size={100} /></div>
                <div className="relative z-10">
                  <div className="bg-blue-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-blue-400 mb-6">
                    <UserIcon size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Para Clientes</h2>
                  <p className="text-[#94A3B8] mb-6">Encontre o profissional ideal rapidamente</p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-blue-400 mr-2" size={16} /> Profissionais verificados e avaliados</li>
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-blue-400 mr-2" size={16} /> Receba até 5 orçamentos grátis</li>
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-blue-400 mr-2" size={16} /> Compare e escolha o melhor</li>
                    <li className="flex items-center text-slate-300 text-sm"><CheckIcon className="text-blue-400 mr-2" size={16} /> Contratação 100% segura</li>
                  </ul>
                  <Link to="/login?mode=signup&role=client" className="block w-full bg-blue-600 hover:bg-blue-500 text-white text-center rounded-lg px-4 py-3 font-bold transition-colors">
                    CADASTRE-SE JÁ!
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </section>
        
        {/* Why choose us */}
        <section id="como-funciona" className="py-24 bg-[#0E1C32] border-t border-slate-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Por que escolher o <span className="text-emerald-500">MeloCalé</span>?</h2>
            <p className="text-[#94A3B8] mb-16">A melhor plataforma para contratar profissionais qualificados</p>

            <div id="categorias" className="grid md:grid-cols-4 gap-8 text-left">
              <div className="bg-[#1C3454] p-6 rounded-2xl border border-slate-800">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 mb-6">
                  <ShieldCheck size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Profissionais Verificados</h3>
                <p className="text-[#94A3B8] text-sm">Todos os profissionais passam por verificação de documentos e avaliações</p>
              </div>
              <div className="bg-[#1C3454] p-6 rounded-2xl border border-slate-800">
                <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-500 mb-6">
                  <Zap size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Atendimento Rápido</h3>
                <p className="text-[#94A3B8] text-sm">Receba orçamentos em minutos e agende serviços rapidamente</p>
              </div>
              <div className="bg-[#1C3454] p-6 rounded-2xl border border-slate-800">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-6">
                  <MapPin size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Perto de Você</h3>
                <p className="text-[#94A3B8] text-sm">Profissionais qualificados nos melhores bairros de São Paulo</p>
              </div>
              <div className="bg-[#1C3454] p-6 rounded-2xl border border-slate-800">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 mb-6">
                  <CreditCardIcon size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Pagamento Seguro</h3>
                <p className="text-[#94A3B8] text-sm">Múltiplas opções de pagamento com garantia e proteção</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="planos" className="py-24 bg-[#0E1C32] border-t border-slate-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Header */}
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
            </div>

            {/* Garantia badge */}
            <div className="flex justify-center mb-12">
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-6 py-3">
                <span className="text-emerald-400 text-xl">🛡️</span>
                <span className="text-emerald-400 font-bold text-sm">Garantia de 7 dias — dinheiro de volta sem perguntas</span>
              </div>
            </div>

            {/* Grid 4 planos */}
            <div className="grid lg:grid-cols-4 gap-6 text-left max-w-6xl mx-auto mb-16">

              {/* GRATUITO */}
              <div className="bg-[#1C3454] rounded-2xl border border-slate-800 p-8 flex flex-col">
                <div className="mb-6">
                  <h3 className="text-[#94A3B8] font-bold text-sm uppercase tracking-widest mb-2">Gratuito</h3>
                  <div className="text-4xl font-extrabold text-white mb-1">R$ 0<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-[#4A6580] text-xs">Para conhecer a plataforma</p>
                </div>
                <Link to="/login" className="block w-full bg-slate-800 hover:bg-slate-700 text-white text-center rounded-xl px-4 py-3 text-sm font-bold transition-all mb-6">
                  Começar Grátis
                </Link>
                <ul className="space-y-3 flex-1">
                  <li className="flex items-start gap-2 text-[#94A3B8] text-sm"><CheckIcon className="text-[#4A6580] shrink-0 mt-0.5" size={16}/> Cadastro na plataforma</li>
                  <li className="flex items-start gap-2 text-[#94A3B8] text-sm"><CheckIcon className="text-[#4A6580] shrink-0 mt-0.5" size={16}/> Ver leads disponíveis</li>
                  <li className="flex items-start gap-2 text-[#94A3B8] text-sm"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> 10 moedas de boas-vindas</li>
                  <li className="flex items-start gap-2 text-[#4A6580] text-sm line-through"><XIcon className="text-slate-700 shrink-0 mt-0.5" size={16}/> Desconto em moedas</li>
                  <li className="flex items-start gap-2 text-[#4A6580] text-sm line-through"><XIcon className="text-slate-700 shrink-0 mt-0.5" size={16}/> Badge verificado</li>
                </ul>
              </div>

              {/* STARTER */}
              <div className="bg-[#1C3454] rounded-2xl border border-blue-500/30 p-8 flex flex-col relative">
                <div className="mb-6">
                  <div className="inline-block px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-3">Starter</div>
                  <div className="text-4xl font-extrabold text-white mb-1">R$ 37<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-emerald-400 text-xs font-bold">25% off em todas as moedas</p>
                </div>
                <Link to="/login?mode=signup&role=professional" className="block w-full bg-blue-600 hover:bg-blue-500 text-white text-center rounded-xl px-4 py-3 text-sm font-bold transition-all mb-6 shadow-lg shadow-blue-500/20">
                  Quero começar agora →
                </Link>
                <ul className="space-y-3 flex-1">
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> 25% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> Badge ✅ VERIFICADO</li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> Perfil público visível</li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 🎁 30 moedas de boas-vindas</li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-emerald-500 shrink-0 mt-0.5" size={16}/> Suporte por chat</li>
                </ul>
                <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <p className="text-blue-300 text-xs text-center">Pacote R$59,90 → <strong>R$44,93</strong> com Starter</p>
                </div>
              </div>

              {/* PRO — DESTAQUE */}
              <div className="bg-gradient-to-b from-[#1c1d28] to-[#1C3454] rounded-2xl border-2 border-emerald-500 p-8 flex flex-col relative transform scale-105 z-10 shadow-[0_0_50px_-10px_rgba(16,185,129,0.4)]">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-black px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase whitespace-nowrap">
                  ⚡ Mais Popular
                </div>
                <div className="mb-6">
                  <div className="inline-block px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-3">PRO</div>
                  <div className="text-4xl font-extrabold text-white mb-1">R$ 67<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-emerald-400 text-xs font-bold">40% off em todas as moedas</p>
                </div>
                <Link to="/login?mode=signup&role=professional" className="block w-full bg-emerald-500 hover:bg-emerald-400 text-black text-center rounded-xl px-4 py-3 text-sm font-black transition-all mb-6 shadow-xl shadow-emerald-500/30">
                  Quero receber clientes agora →
                </Link>
                <ul className="space-y-3 flex-1">
                  <li className="flex items-start gap-2 text-slate-200 text-sm"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> 40% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-2 text-slate-200 text-sm"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> Badge ⚡ PRO em destaque</li>
                  <li className="flex items-start gap-2 text-slate-200 text-sm"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> 2x mais visível nas buscas</li>
                  <li className="flex items-start gap-2 text-slate-200 text-sm"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> Moedas nunca expiram</li>
                  <li className="flex items-start gap-2 text-slate-200 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 🎁 80 moedas de boas-vindas</li>
                  <li className="flex items-start gap-2 text-slate-200 text-sm"><CheckIcon className="text-emerald-400 shrink-0 mt-0.5" size={16}/> Suporte prioritário (2h)</li>
                </ul>
                <div className="mt-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                  <p className="text-emerald-300 text-xs text-center">Pacote R$59,90 → <strong>R$35,94</strong> com PRO</p>
                  <p className="text-emerald-400 text-[10px] text-center mt-1 font-bold">O plano se paga em 1 compra de moedas</p>
                </div>
              </div>

              {/* ELITE */}
              <div className="bg-[#1C3454] rounded-2xl border border-yellow-500/30 p-8 flex flex-col relative">
                <div className="mb-6">
                  <div className="inline-block px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-3">🏆 Elite</div>
                  <div className="text-4xl font-extrabold text-white mb-1">R$ 127<span className="text-sm font-normal text-[#4A6580]">/mês</span></div>
                  <p className="text-yellow-400 text-xs font-bold">55% off em todas as moedas</p>
                </div>
                <Link to="/login?mode=signup&role=professional" className="block w-full bg-yellow-500 hover:bg-yellow-400 text-black text-center rounded-xl px-4 py-3 text-sm font-black transition-all mb-6 shadow-lg shadow-yellow-500/20">
                  Quero dominar minha região →
                </Link>
                <ul className="space-y-3 flex-1">
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 55% desconto em moedas avulsas</li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Badge 🏆 ELITE dourado</li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Topo absoluto das buscas</li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Até 3 profissionais na conta</li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> 🎁 200 moedas de boas-vindas</li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm"><CheckIcon className="text-yellow-400 shrink-0 mt-0.5" size={16}/> Gerente de conta dedicado</li>
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

function CreditCardIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...props} width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
  );
}
