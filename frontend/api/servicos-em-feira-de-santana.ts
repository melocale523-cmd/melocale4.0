export const config = { runtime: 'edge' };

const BASE_URL = 'https://www.melocale.com.br';
const city = 'Feira de Santana';
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

function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

export default function handler() {
  const slug = 'feira-de-santana';
  const canonical = `${BASE_URL}/servicos-em-${slug}`;
  const clientUrl = `${BASE_URL}/login?role=client&utm_source=organic&utm_medium=seo&utm_campaign=city_landing&utm_content=servicos-em-${slug}`;
  const professionalUrl = `${BASE_URL}/login?role=professional&mode=signup&utm_source=organic&utm_medium=seo&utm_campaign=city_landing&utm_content=servicos-em-${slug}`;
  const serviceLinks = services.map(([serviceSlug, label, description]) => `<li><a href="${BASE_URL}/servicos/${serviceSlug}-em-${slug}"><strong>${escapeHtml(label)} em ${city}</strong><span>${escapeHtml(description)}</span></a></li>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Serviços em Feira de Santana | Encontre profissionais | MeloCalé</title><meta name="description" content="Encontre eletricistas, encanadores, pintores, diaristas e outros profissionais em Feira de Santana. Peça orçamento grátis pelo MeloCalé."><link rel="canonical" href="${canonical}"><meta property="og:title" content="Serviços em Feira de Santana | MeloCalé"><meta property="og:description" content="Compare profissionais e peça orçamento grátis em Feira de Santana."><meta property="og:url" content="${canonical}"><meta property="og:type" content="website"><style>body{font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0}.wrap{max-width:900px;margin:auto;padding:32px 20px}.hero{background:#0e5c8a;color:#fff;padding:36px;border-radius:16px}.hero h1{font-size:32px;margin:10px 0}.hero p{line-height:1.6}.cta{display:inline-block;background:#00c987;color:#06233d;padding:13px 18px;border-radius:9px;text-decoration:none;font-weight:700;margin:8px 8px 8px 0}.pro{background:#e0f2fe;color:#075985}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;padding:0;list-style:none;margin:24px 0}.grid a{display:block;background:#fff;border:1px solid #dbeafe;border-radius:12px;padding:18px;text-decoration:none;color:#075985}.grid span{display:block;color:#64748b;margin-top:7px;font-size:14px}.area{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:22px;line-height:1.6}</style></head><body><main class="wrap"><section class="hero"><small>MeloCalé · ${city}, Bahia</small><h1>Encontre profissionais em ${city}</h1><p>Publique seu pedido, informe o bairro e receba propostas de profissionais disponíveis para serviços residenciais, comerciais e pequenos reparos.</p><a class="cta" href="${clientUrl}">Criar pedido grátis</a><a class="cta pro" href="${professionalUrl}">Sou profissional</a></section><h2>Serviços mais procurados em ${city}</h2><ul class="grid">${serviceLinks}</ul><section class="area"><h2>Atendimento por região</h2><p>Profissionais podem atender Centro, Santa Mônica, Muchila, Brasília, Mangabeira, Tomba, Caseb, Queimadinha, 35º BI, SIM e outras áreas. Informe sua localização no pedido para receber propostas mais compatíveis.</p></section><section class="area"><h2>Guias para contratar com mais segurança</h2><p>Vazamento, entupimento ou outro imprevisto? Veja medidas seguras e o que informar antes de solicitar atendimento.</p><p><a href="https://www.melocale.com.br/guias/encanador-urgente-em-feira-de-santana">Encanador urgente em Feira de Santana: o que fazer</a> · <a href="https://www.melocale.com.br/guias/como-pedir-orcamento-com-seguranca">Como pedir orçamento com segurança</a></p></section></main></body></html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}