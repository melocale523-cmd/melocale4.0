import { Helmet } from 'react-helmet-async';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MapPin, Star, Wrench } from 'lucide-react';
import { seoPages, seoPagesBySlug } from '../../data/seoPages';

const BASE_URL = 'https://www.melocale.com.br';
function trackedLoginUrl(role: 'client' | 'professional', slug: string) {
  const params = new URLSearchParams({
    role,
    utm_source: 'organic',
    utm_medium: 'seo',
    utm_campaign: 'service_city',
    utm_content: slug,
  });
  if (role === 'professional') params.set('mode', 'signup');
  return `${BASE_URL}/login?${params.toString()}`;
}

export default function ServiceCityPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = slug ? seoPagesBySlug.get(slug) : undefined;

  if (!page) return <Navigate to="/404" replace />;

  const canonicalUrl = `${BASE_URL}/servicos/${page.slug}`;
  const clientCtaUrl = trackedLoginUrl('client', page.slug);
  const professionalCtaUrl = trackedLoginUrl('professional', page.slug);
  const relatedPages = seoPages
    .filter((item) => item.cidadeSlug === page.cidadeSlug && item.slug !== page.slug)
    .slice(0, 6);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: page.h1,
    description: page.metaDescription,
    url: canonicalUrl,
    provider: {
      '@type': 'Organization',
      name: 'MeloCalé',
      url: BASE_URL,
    },
    areaServed: {
      '@type': 'City',
      name: page.cidadeDisplay,
      containedInPlace: {
        '@type': 'State',
        name: 'Bahia',
        containedInPlace: {
          '@type': 'Country',
          name: 'Brasil',
        },
      },
    },
    serviceType: page.categoriaDisplay,
    offers: {
      '@type': 'Offer',
      availability: 'https://schema.org/InStock',
      url: clientCtaUrl,
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-[#0E1C32] text-white">
      <Helmet>
        <title>{page.title}</title>
        <meta name="description" content={page.metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={page.title} />
        <meta property="og:description" content={page.metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      {/* Header */}
      <header className="border-b border-[#1C3050] bg-[#0B1628]">
        <div className="max-w-4xl mx-auto px-9 py-9 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-emerald-400 tracking-tight">
            MeloCalé
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-7 text-[#94A3B8] hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={15} /> Início
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-9 py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-[#94A3B8] mb-13" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-white transition-colors">Início</Link>
          <span className="mx-2">/</span>
          <span className="text-white">{page.h1}</span>
        </nav>

        {/* Hero */}
        <section className="mb-15">
          <div className="flex items-center gap-7 text-emerald-400 text-sm font-medium mb-8">
            <MapPin size={15} />
            <span>{page.cidadeDisplay}, Bahia</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-9">{page.h1}</h1>
          {page.paragraphs.map((text, i) => (
            <p key={i} className="text-[#94A3B8] leading-relaxed mb-9 text-base">
              {text}
            </p>
          ))}
          {page.localContext && (
            <p className="text-[#CBD5E1] leading-relaxed mb-9 text-base">
              {page.localContext}
            </p>
          )}
        </section>

        {page.neighborhoods?.length ? (
          <section className="mb-15 rounded-xl border border-[#1C3050] bg-[#0B1A2E] p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              Regiões de Salvador onde você pode solicitar atendimento
            </h2>
            <p className="text-[#94A3B8] text-sm leading-relaxed mb-5">
              O atendimento depende da disponibilidade de cada profissional. Se o seu bairro não estiver listado, informe a localização no pedido.
            </p>
            <div className="flex flex-wrap gap-3">
              {page.neighborhoods.map((neighborhood) => (
                <span key={neighborhood} className="rounded-full border border-[#1C3050] px-4 py-2 text-sm text-[#CBD5E1]">
                  {neighborhood}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {/* Benefits */}
        <section className="bg-[#0B1A2E] border border-[#1C3050] rounded-xl p-11 mb-15">
          <h2 className="text-lg font-semibold text-white mb-9 flex items-center gap-7">
            <Star size={18} className="text-emerald-400" />
            Por que usar o MeloCalé?
          </h2>
          <ul className="space-y-8">
            {[
              'Garantia de 7 dias — reembolso em moeda se não ficar satisfeito',
              'Orçamento gratuito sem compromisso',
              'Atendimento rápido na sua cidade',
              'Plataforma 100% gratuita para quem contrata',
              'Comunicação segura pelo chat integrado',
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-8 text-[#94A3B8]">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-15">
          <h2 className="text-xl font-semibold text-white mb-9">
            Serviços mais procurados de {page.categoriaDisplay.toLowerCase()} em {page.cidadeDisplay}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {page.services.map((service) => (
              <a
                key={service}
                href={clientCtaUrl}
                className="flex items-center gap-3 rounded-lg border border-[#1C3050] bg-[#0B1A2E] p-5 text-[#CBD5E1] hover:border-emerald-500/60 hover:text-white transition-colors"
              >
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{service}</span>
              </a>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-br from-emerald-900/40 to-[#0B1A2E] border border-emerald-800/40 rounded-xl p-8 text-center mb-12">
          <Wrench size={32} className="text-emerald-400 mx-auto mb-9" />
          <h2 className="text-2xl font-bold text-white mb-7">
            Precisa de {page.categoriaDisplay.toLowerCase()} em {page.cidadeDisplay}?
          </h2>
          <p className="text-[#94A3B8] mb-11 max-w-md mx-auto">
            Deixe seu pedido grátis em menos de 2 minutos — a plataforma avisa
            na hora os profissionais da região, e você recebe as propostas
            direto no seu WhatsApp ou no app.
          </p>
          <a
            href={clientCtaUrl}
            className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-8 rounded-lg transition-colors text-base"
          >
            Criar pedido grátis
          </a>
          <p className="text-[#4A6580] text-xs mt-9">
            Sem cadastro de cartão · Gratuito para clientes
          </p>
        </section>

        <section className="border border-[#1C3050] rounded-xl p-8 mb-12 text-center">
          <h2 className="text-xl font-semibold text-white mb-3">Você presta este serviço?</h2>
          <p className="text-[#94A3B8] mb-6">Crie seu perfil profissional e receba pedidos de clientes em {page.cidadeDisplay}.</p>
          <a
            href={professionalCtaUrl}
            className="inline-block border border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white font-semibold px-7 py-3 rounded-lg transition-colors"
          >
            Cadastrar como profissional
          </a>
        </section>
        {/* How it works */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-11">Como funciona</h2>
          <ol className="space-y-9">
            {[
              { step: '1', title: 'Descreva o serviço', desc: 'Conte o que você precisa e onde fica o imóvel em ' + page.cidadeDisplay + '.' },
              { step: '2', title: 'Receba propostas', desc: `Profissionais de ${page.categoriaDisplay.toLowerCase()} disponíveis entram em contato com orçamentos.` },
              { step: '3', title: 'Escolha e contrate', desc: 'Compare avaliações e preços e contrate o melhor profissional para o seu caso.' },
            ].map(({ step, title, desc }) => (
              <li key={step} className="flex items-start gap-9">
                <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-sm">
                  {step}
                </span>
                <div>
                  <p className="font-semibold text-white">{title}</p>
                  <p className="text-[#94A3B8] text-sm mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-9">Perguntas frequentes</h2>
          <div className="space-y-4">
            {page.faq.map((item) => (
              <details key={item.question} className="rounded-lg border border-[#1C3050] bg-[#0B1A2E] p-6">
                <summary className="cursor-pointer font-semibold text-white">{item.question}</summary>
                <p className="mt-4 text-sm leading-relaxed text-[#94A3B8]">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-7">Outros serviços em {page.cidadeDisplay}</h2>
          <div className="flex flex-wrap gap-3">
            {relatedPages.map((item) => (
              <Link
                key={item.slug}
                to={`/servicos/${item.slug}`}
                className="rounded-full border border-[#1C3050] px-4 py-2 text-sm text-[#CBD5E1] hover:border-emerald-500/60 hover:text-white transition-colors"
              >
                {item.categoriaDisplay} em {item.cidadeDisplay}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1C3050] mt-13">
        <div className="max-w-4xl mx-auto px-9 py-8 flex flex-col md:flex-row items-center justify-between gap-9 text-[#4A6580] text-xs">
          <p>© {new Date().getFullYear()} MeloCalé. Todos os direitos reservados.</p>
          <nav className="flex gap-9">
            <Link to="/termos" className="hover:text-white transition-colors">Termos</Link>
            <Link to="/privacidade" className="hover:text-white transition-colors">Privacidade</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
