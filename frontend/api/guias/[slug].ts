export const config = { runtime: 'edge' };

const BASE_URL = 'https://www.melocale.com.br';

type Guide = {
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  intro: string;
  sections: { title: string; paragraphs: string[] }[];
  faq: { question: string; answer: string }[];
  links: { href: string; label: string }[];
};

const guides: Record<string, Guide> = {
  'preco-eletricista-em-salvador': {
    title: 'Quanto custa um eletricista em Salvador? | MeloCalé',
    description: 'Entenda o que influencia o preço de eletricista em Salvador e como comparar orçamentos com segurança antes de contratar.',
    eyebrow: 'Guia de orçamento · Salvador, BA',
    heading: 'Quanto custa um eletricista em Salvador?',
    intro: 'O valor de um serviço elétrico varia conforme a urgência, o tipo de reparo, os materiais, o acesso ao local e a experiência necessária. Em vez de confiar apenas em um preço anunciado, descreva o problema com clareza e compare propostas que expliquem o que está incluído.',
    sections: [
      { title: 'O que costuma influenciar o orçamento', paragraphs: ['Troca de tomada, instalação de luminária e pequenos ajustes têm escopos diferentes de uma revisão de quadro, investigação de curto-circuito ou adequação de uma instalação antiga.', 'Antes de confirmar, pergunte se a visita, os materiais, o deslocamento e eventuais testes estão incluídos. Um orçamento claro reduz surpresas e facilita comparar propostas.'] },
      { title: 'Como pedir um orçamento mais útil', paragraphs: ['Informe o bairro, o tipo de imóvel, o que acontece hoje e, quando for seguro, envie fotos do local. Evite mexer em fiação exposta ou quadro elétrico energizado.', 'Peça que cada profissional detalhe o serviço proposto e o prazo estimado. Se houver risco elétrico, priorize a segurança e desligue o circuito apenas se souber como fazê-lo.'] },
    ],
    faq: [
      { question: 'O orçamento de eletricista é gratuito?', answer: 'No MeloCalé, o cliente pode criar um pedido sem cadastrar cartão. A existência de cobrança por visita ou materiais deve ser combinada diretamente no orçamento.' },
      { question: 'Devo escolher apenas o menor preço?', answer: 'Não. Compare o escopo, os materiais previstos, o prazo e as avaliações disponíveis. Um preço menor pode não incluir todos os itens necessários.' },
    ],
    links: [
      { href: '/servicos/eletricista-em-salvador', label: 'Ver eletricistas em Salvador' },
      { href: '/servicos-em-salvador', label: 'Explorar serviços em Salvador' },
      { href: '/guias/como-pedir-orcamento-com-seguranca', label: 'Como pedir orçamento com segurança' },
    ],
  },
  'encanador-urgente-em-feira-de-santana': {
    title: 'Encanador urgente em Feira de Santana: o que fazer | MeloCalé',
    description: 'Passos seguros para lidar com vazamento, entupimento e outros imprevistos antes de pedir um encanador em Feira de Santana.',
    eyebrow: 'Guia urgente · Feira de Santana, BA',
    heading: 'Encanador urgente em Feira de Santana: o que fazer primeiro',
    intro: 'Vazamentos, retorno de água e entupimentos podem piorar rapidamente. O primeiro passo é reduzir o risco: proteja pessoas e objetos, evite improvisos e reúna as informações que ajudam o profissional a entender a urgência.',
    sections: [
      { title: 'Medidas seguras antes do atendimento', paragraphs: ['Se for seguro e você souber onde fica, feche o registro de água do ponto afetado. Em caso de água próxima a tomadas, desligue a energia da área somente se puder fazê-lo sem contato com água.', 'Não use produtos corrosivos nem force tubulações. Tire fotos ou vídeo curto do problema, anote o bairro e diga se o imóvel é casa, apartamento ou comércio.'] },
      { title: 'Como explicar a urgência no pedido', paragraphs: ['Descreva quando o problema começou, onde a água aparece, se há mau cheiro, retorno de esgoto ou risco de infiltração. Essas informações ajudam a priorizar o atendimento e tornar o orçamento mais claro.', 'Confirme se a proposta informa o diagnóstico, a mão de obra, os materiais e qualquer taxa de deslocamento antes de aprovar o serviço.'] },
    ],
    faq: [
      { question: 'Posso usar produto químico para desentupir?', answer: 'Evite soluções corrosivas, especialmente se houver risco de mistura de produtos ou tubulação antiga. Explique o que já foi tentado ao profissional.' },
      { question: 'Como comparar orçamentos urgentes?', answer: 'Compare o que será feito, o prazo, os materiais e as possíveis cobranças adicionais. Um serviço urgente precisa de escopo claro, não apenas de um preço total.' },
    ],
    links: [
      { href: '/servicos/encanador-em-feira-de-santana', label: 'Ver encanadores em Feira de Santana' },
      { href: '/servicos-em-feira-de-santana', label: 'Explorar serviços em Feira de Santana' },
      { href: '/guias/como-pedir-orcamento-com-seguranca', label: 'Como pedir orçamento com segurança' },
    ],
  },
  'como-pedir-orcamento-com-seguranca': {
    title: 'Como pedir orçamento com segurança para serviços | MeloCalé',
    description: 'Checklist prático para solicitar e comparar orçamentos de serviços residenciais com mais clareza e segurança.',
    eyebrow: 'Guia prático · Bahia',
    heading: 'Como pedir orçamento com segurança',
    intro: 'Um bom pedido deixa claro o que precisa ser feito e ajuda você a comparar propostas de maneira justa. O objetivo não é escolher automaticamente o menor valor, mas entender o serviço, os materiais e as condições antes de contratar.',
    sections: [
      { title: 'Inclua informações que fazem diferença', paragraphs: ['Informe cidade, bairro, tipo de imóvel, problema principal e prazo desejado. Fotos ajudam quando mostram o local com segurança, sem expor documentos, dados pessoais ou imagens de terceiros.', 'Diga se você já comprou materiais, se há restrições de horário e se o serviço exige visita técnica. Quanto mais claro o escopo, mais útil tende a ser a resposta.'] },
      { title: 'Compare além do preço', paragraphs: ['Peça para separar mão de obra, materiais e deslocamento quando aplicável. Verifique o que está incluso, como será o pagamento e o prazo estimado.', 'Mantenha a comunicação registrada pela plataforma sempre que possível e não compartilhe senhas, códigos de autenticação ou dados bancários. Se algo não estiver claro, pergunte antes de autorizar o início do serviço.'] },
    ],
    faq: [
      { question: 'Devo pagar tudo adiantado?', answer: 'Combine as condições de pagamento apenas depois de entender o escopo. Para serviços maiores, registre etapas, materiais e entregas antes de qualquer pagamento.' },
      { question: 'O que fazer se o orçamento mudar?', answer: 'Peça uma explicação do motivo e um novo detalhamento antes de aprovar custos adicionais. Alterações devem ser claras para as duas partes.' },
    ],
    links: [
      { href: '/servicos-em-salvador', label: 'Serviços em Salvador' },
      { href: '/servicos-em-feira-de-santana', label: 'Serviços em Feira de Santana' },
      { href: '/guias/preco-eletricista-em-salvador', label: 'Preço de eletricista em Salvador' },
    ],
  },
};

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function handler(request: Request) {
  const slug = new URL(request.url).pathname.split('/').filter(Boolean).pop() || '';
  const guide = guides[slug];
  if (!guide) return new Response('Guia não encontrado.', { status: 404 });

  const canonical = `${BASE_URL}/guias/${slug}`;
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: guide.title, description: guide.description, url: canonical, inLanguage: 'pt-BR' },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Início', item: `${BASE_URL}/` }, { '@type': 'ListItem', position: 2, name: guide.heading, item: canonical }] },
      { '@type': 'FAQPage', mainEntity: guide.faq.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) },
    ],
  }).replace(/<\//g, '<\\/');
  const sections = guide.sections.map((section) => `<section><h2>${escapeHtml(section.title)}</h2>${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</section>`).join('');
  const faq = guide.faq.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('');
  const links = guide.links.map((link) => `<a href="${BASE_URL}${link.href}">${escapeHtml(link.label)}</a>`).join('');

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(guide.title)}</title><meta name="description" content="${escapeHtml(guide.description)}"><link rel="canonical" href="${canonical}"><meta property="og:title" content="${escapeHtml(guide.title)}"><meta property="og:description" content="${escapeHtml(guide.description)}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="article"><meta name="twitter:card" content="summary"><script type="application/ld+json">${structuredData}</script><style>body{font-family:Arial,sans-serif;background:#f8fafc;color:#172033;margin:0}.wrap{max-width:760px;margin:auto;padding:32px 20px}.top{font-size:14px;color:#0e5c8a;font-weight:700}.hero{padding:28px 0;border-bottom:1px solid #dbe4ee}.hero h1{font-size:34px;line-height:1.15;margin:12px 0}.hero p,p{line-height:1.65;color:#46556b}.card,section{background:#fff;border:1px solid #dbe4ee;border-radius:14px;padding:24px;margin:20px 0}h2{font-size:22px;margin-top:0}details{border-top:1px solid #dbe4ee;padding:15px 0}details:first-of-type{border-top:0}summary{font-weight:700;cursor:pointer}.links{display:flex;flex-wrap:wrap;gap:10px}.links a,.cta{background:#0e5c8a;color:#fff;border-radius:8px;padding:11px 14px;text-decoration:none;font-weight:700}.cta{display:inline-block;background:#00a56b;margin-top:8px}.notice{font-size:14px;background:#eff6ff;color:#1e3a5f}</style></head><body><main class="wrap"><a class="top" href="${BASE_URL}/">MeloCalé</a><header class="hero"><div class="top">${escapeHtml(guide.eyebrow)}</div><h1>${escapeHtml(guide.heading)}</h1><p>${escapeHtml(guide.intro)}</p><a class="cta" href="${BASE_URL}/login?role=client&utm_source=organic&utm_medium=seo&utm_campaign=guide&utm_content=${slug}">Criar pedido grátis</a></header>${sections}<section class="card"><h2>Perguntas frequentes</h2>${faq}</section><section class="card"><h2>Continue sua busca</h2><div class="links">${links}</div></section><p class="notice card">As informações são orientativas. Para serviços com risco elétrico, vazamentos graves ou emergência, priorize a segurança e procure ajuda técnica adequada.</p></main></body></html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}