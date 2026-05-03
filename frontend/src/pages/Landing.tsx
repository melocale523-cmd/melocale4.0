import { Search, MapPin, Building2, ChevronDown, Zap, ShieldCheck, HeartHandshake, MousePointer2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import Navbar from '../components/Navbar';
import { useState, useEffect } from 'react';

export default function LandingPage() {
  const { isAuthenticated, user } = useAuthStore();
  const role = user?.role;
  const dashboardLink = role === 'admin' ? '/admin/dashboard' : role === 'professional' ? '/profissional/dashboard' : '/cliente/dashboard';
  const [userCity, setUserCity] = useState("São Paulo");

  useEffect(() => {
    fetch('https://get.geojs.io/v1/ip/geo.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.city) {
          setUserCity(data.city);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-slate-200 font-sans selection:bg-emerald-500/30">
      <Navbar />

      <main>
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#0A0B0D] to-[#0A0B0D]"></div>
          
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
              <p className="text-lg text-slate-400 mb-10 max-w-xl">
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
                  <p className="text-xs text-slate-500 mt-1">Transações protegidas</p>
                </div>
                <div>
                  <div className="flex items-center text-yellow-500 mb-2">
                    <Zap size={20} className="mr-2" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Respostas em até 24h</h3>
                  <p className="text-xs text-slate-500 mt-1">Profissionais prontos</p>
                </div>
                <div>
                  <div className="flex items-center text-blue-400 mb-2">
                    <HeartHandshake size={20} className="mr-2" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Profissionais Verificados</h3>
                  <p className="text-xs text-slate-500 mt-1">Identidade confirmada</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-br from-[#14161B] to-slate-900 border border-slate-800 rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10 text-emerald-500"><Building2 size={100} /></div>
                <div className="relative z-10">
                  <div className="bg-emerald-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-emerald-500 mb-6">
                    <BriefcaseIcon size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Para Profissionais</h2>
                  <p className="text-slate-400 mb-6">Aumente sua renda com leads qualificados</p>
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

              <div className="bg-gradient-to-br from-[#14161B] to-slate-900 border border-slate-800 rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10 text-blue-500"><UserIcon size={100} /></div>
                <div className="relative z-10">
                  <div className="bg-blue-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-blue-400 mb-6">
                    <UserIcon size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Para Clientes</h2>
                  <p className="text-slate-400 mb-6">Encontre o profissional ideal rapidamente</p>
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
        <section id="como-funciona" className="py-24 bg-[#0A0B0D] border-t border-slate-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Por que escolher o <span className="text-emerald-500">MeloCalé</span>?</h2>
            <p className="text-slate-400 mb-16">A melhor plataforma para contratar profissionais qualificados</p>

            <div id="categorias" className="grid md:grid-cols-4 gap-8 text-left">
              <div className="bg-[#14161B] p-6 rounded-2xl border border-slate-800">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 mb-6">
                  <ShieldCheck size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Profissionais Verificados</h3>
                <p className="text-slate-400 text-sm">Todos os profissionais passam por verificação de documentos e avaliações</p>
              </div>
              <div className="bg-[#14161B] p-6 rounded-2xl border border-slate-800">
                <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-500 mb-6">
                  <Zap size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Atendimento Rápido</h3>
                <p className="text-slate-400 text-sm">Receba orçamentos em minutos e agende serviços rapidamente</p>
              </div>
              <div className="bg-[#14161B] p-6 rounded-2xl border border-slate-800">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-6">
                  <MapPin size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Perto de Você</h3>
                <p className="text-slate-400 text-sm">Profissionais qualificados nos melhores bairros de São Paulo</p>
              </div>
              <div className="bg-[#14161B] p-6 rounded-2xl border border-slate-800">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 mb-6">
                  <CreditCardIcon size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Pagamento Seguro</h3>
                <p className="text-slate-400 text-sm">Múltiplas opções de pagamento com garantia e proteção</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */ }
        <section id="planos" className="py-24 bg-[#0A0B0D] border-t border-slate-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
             <div className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400 mb-6">
                <BriefcaseIcon size={14} className="mr-2" /> Planos para Profissionais
              </div>
            <h2 className="text-3xl font-bold text-white mb-4">Escolha o Plano Ideal</h2>
            <p className="text-slate-400 mb-16">Aumente sua visibilidade e receba mais solicitações</p>

            <div className="grid lg:grid-cols-4 gap-6 text-left max-w-5xl mx-auto">
              {/* Gratuito */}
              <div className="bg-[#14161B] rounded-2xl border border-slate-800 p-8">
                <h3 className="text-slate-300 font-bold mb-4">Gratuito</h3>
                <div className="text-4xl font-bold text-white mb-2">R$ 0<span className="text-sm font-normal text-slate-500">/mês</span></div>
                <p className="text-slate-400 text-sm mb-6 h-10">Para começar e testar a plataforma</p>
                <Link to="/login" className="block w-full bg-slate-800 hover:bg-slate-700 text-white text-center rounded-lg px-4 py-2 text-sm font-bold transition-colors mb-8">Começar Grátis</Link>
                <ul className="space-y-4">
                  <li className="flex items-start text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-3 shrink-0" size={18} /> Cadastro na plataforma</li>
                  <li className="flex items-start text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-3 shrink-0" size={18} /> Perfil público visível</li>
                  <li className="flex items-start text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-3 shrink-0" size={18} /> Receber solicitações (precisa moedas)</li>
                  <li className="flex items-start text-slate-500 text-sm"><XIcon className="text-slate-600 mr-3 shrink-0" size={18} /> Responder orçamentos ilimitados</li>
                </ul>
              </div>

               {/* Básico */}
               <div className="bg-[#14161B] rounded-2xl border border-blue-500/30 p-8 relative">
                <h3 className="text-blue-400 font-bold mb-4">Básico</h3>
                <div className="text-4xl font-bold text-white mb-2">R$ 49<span className="text-sm font-normal text-slate-500">/mês</span></div>
                <p className="text-slate-400 text-sm mb-6 h-10">Ideal para profissionais iniciantes</p>
                <Link to="/login" className="block w-full bg-blue-600 hover:bg-blue-500 text-white text-center rounded-lg px-4 py-2 text-sm font-bold transition-colors mb-8">Assinar Agora</Link>
                <ul className="space-y-4">
                  <li className="flex items-start text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-3 shrink-0" size={18} /> Tudo do plano Gratuito</li>
                  <li className="flex items-start text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-3 shrink-0" size={18} /> Até 30 solicitações/mês incluídas</li>
                  <li className="flex items-start text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-3 shrink-0" size={18} /> Responder orçamentos ilimitados</li>
                  <li className="flex items-start text-slate-500 text-sm"><XIcon className="text-slate-600 mr-3 shrink-0" size={18} /> Perfil destacado em buscas</li>
                </ul>
              </div>

              {/* Profissional */}
              <div className="bg-gradient-to-b from-[#1c1d24] to-[#14161B] rounded-2xl border-2 border-purple-500 p-8 relative transform scale-105 z-10 shadow-[0_0_40px_-10px_rgba(168,85,247,0.3)]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase">Mais Vendido</div>
                <h3 className="text-purple-400 font-bold mb-4">Profissional</h3>
                <div className="text-4xl font-bold text-white mb-2">R$ 99<span className="text-sm font-normal text-slate-500">/mês</span></div>
                <p className="text-slate-400 text-sm mb-6 h-10">Para profissionais estabelecidos</p>
                <Link to="/login" className="block w-full bg-purple-600 hover:bg-purple-500 text-white text-center rounded-lg px-4 py-2 text-sm font-bold transition-colors mb-8 shadow-lg shadow-purple-500/20">Escolher Profissional</Link>
                <ul className="space-y-4">
                  <li className="flex items-start text-slate-200 text-sm"><CheckIcon className="text-purple-400 mr-3 shrink-0" size={18} /> Tudo do plano Básico</li>
                  <li className="flex items-start text-slate-200 text-sm"><CheckIcon className="text-purple-400 mr-3 shrink-0" size={18} /> Até 80 solicitações/mês incluídas</li>
                  <li className="flex items-start text-slate-200 text-sm"><CheckIcon className="text-purple-400 mr-3 shrink-0" size={18} /> Perfil PREMIUM destacado</li>
                  <li className="flex items-start text-slate-200 text-sm"><CheckIcon className="text-purple-400 mr-3 shrink-0" size={18} /> Aparecer no topo das buscas</li>
                  <li className="flex items-start text-slate-200 text-sm"><CheckIcon className="text-purple-400 mr-3 shrink-0" size={18} /> Suporte prioritário (WhatsApp)</li>
                </ul>
              </div>

               {/* Empresarial */}
               <div className="bg-[#14161B] rounded-2xl border border-slate-800 p-8">
                <h3 className="text-emerald-400 font-bold mb-4">Empresarial</h3>
                <div className="text-4xl font-bold text-white mb-2">R$ 199<span className="text-sm font-normal text-slate-500">/mês</span></div>
                <p className="text-slate-400 text-sm mb-6 h-10">Para empresas e equipes</p>
                <Link to="/login" className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white text-center rounded-lg px-4 py-2 text-sm font-bold transition-colors mb-8">Assinar Empresarial</Link>
                <ul className="space-y-4">
                  <li className="flex items-start text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-3 shrink-0" size={18} /> Tudo do plano Profissional</li>
                  <li className="flex items-start text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-3 shrink-0" size={18} /> Até 200 solicitações/mês</li>
                  <li className="flex items-start text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-3 shrink-0" size={18} /> Perfil de EMPRESA</li>
                  <li className="flex items-start text-slate-300 text-sm"><CheckIcon className="text-emerald-500 mr-3 shrink-0" size={18} /> Adicionar até 5 profissionais</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

      </main>
      
      {/* Footer minimal */}
      <footer className="border-t border-slate-800/50 py-12 bg-[#0A0B0D] mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-sm">
          <p>&copy; {new Date().getFullYear()} MeloCalé. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

function CheckIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  );
}

function XIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  );
}

function BriefcaseIcon(props: any) {
   return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" ><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
  );
}

function UserIcon(props: any) {
   return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" ><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  );
}

function CreditCardIcon(props: any) {
   return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
  );
}
