export const config = { runtime: 'edge' };

const BASE_URL = 'https://www.melocale.com.br';
const services = [
  ['eletricista', 'Eletricista', 'Troca de disjuntores e instalações'],
  ['encanador', 'Encanador', 'Vazamentos e desentupimentos'],
  ['ar-condicionado', 'Técnico de ar-condicionado', 'Instalação e manutenção'],
  ['diarista', 'Diarista', 'Faxina e limpeza pós-obra'],
  ['pintor', 'Pintor', 'Pintura interna e externa'],
  ['pedreiro', 'Pedreiro', 'Reformas e reparos'],
  ['marceneiro', 'Marceneiro', 'Móveis planejados e reparos'],
  ['jardineiro', 'Jardineiro', 'Jardins e paisagismo'],
  ['tecnico-de-informatica', 'Técnico de informática', 'Computadores e redes'],
  ['gesseiro', 'Gesseiro', 'Forro, drywall e acabamentos'],
  ['dedetizador', 'Dedetizador', 'Controle de pragas'],
] as const;

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function handler() {
  const canonical = `${BASE_URL}/servicos-em-salvador`;
  const clientUrl = `${BASE_URL}/login?role=client&utm_source=organic&utm_medium=seo&utm_campaign=city_landing&utm_content=servicos-em-salvador`;
  const professionalUrl = `${BASE_URL}/login?role=professional&mode=signup&utm_source=organic&utm_medium=seo&utm_campaign=city_landing&utm_content=servicos-em-salvador`;
  const serviceLinks = services.map(([slug, label, description]) => `<li><a href="${BASE_URL}/servicos/${slug}-em-salvador"><strong>${escapeHtml(label)} em Salvador</strong><span>${escapeHtml(description)}</span></a></li>`).join('');
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Serviços em Salvador',
    url: canonical,
    itemListElement: services.map(([slug, label], index) => ({ '@type': 'ListItem', position: index + 1, name: `${label} em Salvador`, url: `${BASE_URL}/servicos/${slug}-em-salvador` })),
  }).replace(/<\//g, '<\\/');

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Serviços em Salvador | Encontre profissionais | MeloCalé</title><meta name="description" content="Encontre eletricistas, encanadores, técnicos de ar-condicionado, diaristas e outros profissionais em Salvador. Peça orçamento grátis pelo MeloCalé."><link rel="canonical" href="${canonical}"><meta property="og:title" content="Serviços em Salvador | MeloCalé"><meta property="og:description" content="Compare profissionais e peça orçamento grátis em Salvador."><meta property="og:url" content="${canonical}"><meta property="og:type" content="website"><script type="application/ld+json">${jsonLd}</script><style>body{font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0}.wrap{max-width:900px;margin:auto;padding:32px 20px}.hero{background:#0e5c8a;color:#fff;padding:36px;border-radius:16px}.hero h1{font-size:32px;margin:10px 0}.hero p{line-height:1.6}.cta{display:inline-block;background:#00c987;color:#06233d;padding:13px 18px;border-radius:9px;text-decoration:none;font-weight:700;margin:8px 8px 8px 0}.pro{background:#e0f2fe;color:#075985}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;padding:0;list-style:none;margin:24px 0}.grid a{display:block;background:#fff;border:1px solid #dbeafe;border-radius:12px;padding:18px;text-decoration:none;color:#075985}.grid span{display:block;color:#64748b;margin-top:7px;font-size:14px}.area{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:22px;line-height:1.6}</style></head><body><main class="wrap"><section class="hero"><small>MeloCalé · Salvador, Bahia</small><h1>Encontre profissionais em Salvador</h1><p>Publique seu pedido, informe o bairro e receba propostas de profissionais disponíveis para serviços residenciais, comerciais e pequenos reparos.</p><a class="cta" href="${clientUrl}">Criar pedido grátis</a><a class="cta pro" href="${professionalUrl}">Sou profissional</a></section><h2>Serviços mais procurados em Salvador</h2><ul class="grid">${serviceLinks}</ul><section class="area"><h2>Atendimento por região</h2><p>Profissionais podem atender Barra, Pituba, Brotas, Itapuã, Imbuí, Cabula, Paralela, Centro, Liberdade, São Cristóvão e outras áreas. Informe sua localização no pedido para receber propostas mais compatíveis.</p></section></main></body></html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}