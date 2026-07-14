import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, MapPin, Users } from 'lucide-react';
import { seoPages } from '../../data/seoPages';

const BASE_URL = 'https://www.melocale.com.br';
const PRIORITY = new Set(['eletricista', 'encanador', 'ar-condicionado', 'diarista', 'pintor']);
const CITY_CONFIG: Record<string, { name: string; neighborhoods: string[] }> = {
  salvador: { name: 'Salvador', neighborhoods: ['Barra', 'Pituba', 'Brotas', 'Itapuã', 'Imbuí', 'Cabula', 'Paralela', 'Centro', 'Liberdade', 'São Cristóvão'] },
  'feira-de-santana': { name: 'Feira de Santana', neighborhoods: ['Centro', 'Santa Mônica', 'Muchila', 'Brasília', 'Mangabeira', 'Tomba', 'Caseb', 'Queimadinha', '35º BI', 'SIM'] },
};

function trackedLoginUrl(role: 'client' | 'professional', citySlug: string) {
  const params = new URLSearchParams({ role, utm_source: 'organic', utm_medium: 'seo', utm_campaign: 'city_landing', utm_content: `servicos-em-${citySlug}` });
  if (role === 'professional') params.set('mode', 'signup');
  return `${BASE_URL}/login?${params.toString()}`;
}

export default function SeoCityLanding() {
  const { citySlug = 'salvador' } = useParams<{ citySlug: string }>();
  const config = CITY_CONFIG[citySlug];
  if (!config) return <main className="min-h-screen bg-[#0E1C32] text-white p-12">Cidade não encontrada.</main>;

  const cityPages = seoPages.filter((page) => page.cidadeSlug === citySlug);
  const priorityPages = cityPages.filter((page) => PRIORITY.has(page.categoriaSlug));
  const otherPages = cityPages.filter((page) => !PRIORITY.has(page.categoriaSlug));
  const canonical = `${BASE_URL}/servicos-em-${citySlug}`;
  const clientUrl = trackedLoginUrl('client', citySlug);
  const professionalUrl = trackedLoginUrl('professional', citySlug);
  const title = `Serviços em ${config.name} | Encontre profissionais | MeloCalé`;
  const description = `Encontre eletricistas, encanadores, pintores, diaristas e outros profissionais em ${config.name}. Peça orçamento grátis pelo MeloCalé.`;

  return (
    <div className="min-h-screen bg-[#0E1C32] text-white">
      <Helmet>
        <title>{title}</title><meta name="description" content={description} /><link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} /><meta property="og:description" content={description} /><meta property="og:url" content={canonical} /><meta property="og:type" content="website" />
      </Helmet>
      <header className="border-b border-[#1C3050] bg-[#0B1628]"><div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between"><Link to="/" className="text-xl font-bold text-emerald-400">MeloCalé</Link><Link to="/" className="text-sm text-[#94A3B8] hover:text-white">Início</Link></div></header>
      <main className="max-w-5xl mx-auto px-6 py-12">
        <nav className="text-sm text-[#94A3B8] mb-10" aria-label="Breadcrumb"><Link to="/" className="hover:text-white">Início</Link><span className="mx-2">/</span><span className="text-white">Serviços em {config.name}</span></nav>
        <section className="mb-14"><div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-5"><MapPin size={16} />{config.name}, Bahia</div><h1 className="text-4xl md:text-5xl font-bold mb-6">Encontre profissionais em {config.name}</h1><p className="max-w-3xl text-lg leading-relaxed text-[#CBD5E1]">Precisa resolver um serviço em casa ou na empresa? Publique seu pedido no MeloCalé, informe seu bairro e receba propostas de profissionais disponíveis em {config.name}.</p></section>
        <section className="grid md:grid-cols-2 gap-5 mb-14">
          <a href={clientUrl} className="rounded-2xl border border-emerald-700/50 bg-emerald-900/20 p-7 hover:border-emerald-400 transition-colors"><CheckCircle2 className="text-emerald-400 mb-4" /><h2 className="text-xl font-bold mb-2">Preciso contratar</h2><p className="text-[#94A3B8] mb-5">Descreva o serviço, compare propostas e escolha um profissional para sua região.</p><span className="text-emerald-400 font-semibold inline-flex items-center gap-2">Criar pedido grátis <ArrowRight size={16} /></span></a>
          <a href={professionalUrl} className="rounded-2xl border border-[#1C3050] bg-[#0B1A2E] p-7 hover:border-emerald-400 transition-colors"><Users className="text-emerald-400 mb-4" /><h2 className="text-xl font-bold mb-2">Sou profissional</h2><p className="text-[#94A3B8] mb-5">Crie seu perfil e receba pedidos de clientes em {config.name} e região.</p><span className="text-emerald-400 font-semibold inline-flex items-center gap-2">Quero receber pedidos <ArrowRight size={16} /></span></a>
        </section>
        <section className="mb-14"><h2 className="text-2xl font-bold mb-6">Serviços mais procurados em {config.name}</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{priorityPages.map((page) => <Link key={page.slug} to={`/servicos/${page.slug}`} className="rounded-xl border border-emerald-800/50 bg-[#0B1A2E] p-5 hover:border-emerald-400 transition-colors"><h3 className="font-semibold text-white mb-2">{page.categoriaDisplay} em {config.name}</h3><p className="text-sm text-[#94A3B8]">{page.services.slice(0, 2).join(' · ')}</p></Link>)}</div></section>
        <section className="mb-14"><h2 className="text-2xl font-bold mb-6">Todos os serviços disponíveis</h2><div className="flex flex-wrap gap-3">{otherPages.map((page) => <Link key={page.slug} to={`/servicos/${page.slug}`} className="rounded-full border border-[#1C3050] px-4 py-2 text-sm text-[#CBD5E1] hover:border-emerald-500/60 hover:text-white">{page.categoriaDisplay} em {config.name}</Link>)}</div></section>
        <section className="rounded-2xl border border-[#1C3050] bg-[#0B1A2E] p-7 mb-12"><h2 className="text-xl font-bold mb-3">Atendimento por região</h2><p className="text-[#94A3B8] leading-relaxed">Os profissionais podem atender {config.neighborhoods.join(', ')} e outras áreas. Informe o bairro no pedido para receber propostas mais compatíveis.</p></section>
      </main>
      <footer className="border-t border-[#1C3050]"><div className="max-w-5xl mx-auto px-6 py-8 text-[#4A6580] text-xs">© {new Date().getFullYear()} MeloCalé. Todos os direitos reservados.</div></footer>
    </div>
  );
}