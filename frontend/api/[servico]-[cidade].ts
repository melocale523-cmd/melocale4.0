/// <reference types="@vercel/edge" />
// Vercel Edge Function — SEO local para MeloCalé
// Intercepta /categoria-cidade e retorna HTML com meta tags para bots

export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!

const CATEGORY_LABELS: Record<string, string> = {
  'eletricista':            'Eletricista',
  'encanador':              'Encanador',
  'pintor':                 'Pintor',
  'pedreiro-construcao':    'Pedreiro',
  'limpeza-residencial':    'Limpeza Residencial',
  'marceneiro-carpinteiro': 'Marceneiro',
  'ar-condicionado':        'Técnico de Ar-condicionado',
  'chaveiro':               'Chaveiro',
  'dedetizacao':            'Dedetização',
  'desentupimento':         'Desentupimento',
  'gesseiro-drywall':       'Gesseiro',
  'impermeabilizacao':      'Impermeabilização',
  'instalacao-moveis':      'Montador de Móveis',
  'jardinagem-paisagismo':  'Jardineiro',
  'mudanca-carreto':        'Mudança e Carreto',
  'reforma-geral':          'Reforma Geral',
  'serralheiro':            'Serralheiro',
  'telhado-telhadista':     'Telhadista',
  'vidraceiro':             'Vidraceiro',
  'piscina-manutencao':     'Manutenção de Piscina',
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function cidadeSlugParaNome(slug: string): string {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace('Sao ', 'São ')
    .replace('Feira De Santana', 'Feira de Santana')
}

interface Professional {
  id: string
  name: string
  city: string
  bio: string | null
  category: string
  rating_avg: number | null
  review_count: number | null
}

async function fetchProfessionals(category: string, city: string): Promise<Professional[]> {
  const url = `${SUPABASE_URL}/rest/v1/rpc/get_seo_professionals`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_category: category, p_city: city }),
  })
  if (!res.ok) return []
  return res.json()
}

function renderHTML(
  categoriaLabel: string,
  cidadeNome: string,
  profissionais: Professional[],
  categoriaSlug: string,
  cidadeSlug: string,
): string {
  const safeCategoriaSlug = escapeHtml(categoriaSlug)
  const safeCidadeSlug = escapeHtml(cidadeSlug)
  const safeCidadeNome = escapeHtml(cidadeNome)
  const safeCategoriaLabel = escapeHtml(categoriaLabel)

  const title = `${safeCategoriaLabel} em ${safeCidadeNome} — MeloCalé`
  const description = profissionais.length > 0
    ? `${profissionais.length} ${safeCategoriaLabel.toLowerCase()}${profissionais.length > 1 ? 's' : ''} disponíve${profissionais.length > 1 ? 'is' : 'l'} em ${safeCidadeNome}. Contrate agora pelo MeloCalé — rápido, seguro e sem burocracia.`
    : `Encontre ${safeCategoriaLabel.toLowerCase()} em ${safeCidadeNome} pelo MeloCalé. Profissionais verificados, orçamento grátis.`

  const canonical = `https://melocale.com.br/${safeCategoriaSlug}-${safeCidadeSlug}`
  const appUrl = `https://melocale.com.br/busca?categoria=${encodeURIComponent(categoriaLabel)}&cidade=${encodeURIComponent(cidadeNome)}`

  const profListHTML = profissionais.map(p => {
    const safeName     = escapeHtml(p.name ?? '')
    const safeCategory = escapeHtml(p.category ?? '')
    const safeCity     = escapeHtml(p.city ?? '')
    const safeBio      = p.bio ? escapeHtml(p.bio) : null
    const stars = p.rating_avg ? '⭐'.repeat(Math.round(p.rating_avg)) : ''
    const rating = p.rating_avg ? `${Number(p.rating_avg).toFixed(1)} ${stars}` : 'Novo profissional'
    const reviews = p.review_count ? `(${p.review_count} avaliação${p.review_count > 1 ? 'ões' : ''})` : ''
    return `
      <div itemscope itemtype="https://schema.org/Person" style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;background:#fff">
        <h2 itemprop="name" style="font-size:18px;font-weight:700;color:#111827;margin:0 0 6px">${safeName}</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 8px">${safeCategory} · ${safeCity}</p>
        ${safeBio ? `<p itemprop="description" style="color:#374151;font-size:14px;margin:0 0 10px;line-height:1.5">${safeBio}</p>` : ''}
        <p style="font-size:14px;color:#f59e0b;margin:0">${rating} <span style="color:#6b7280">${reviews}</span></p>
        <meta itemprop="jobTitle" content="${safeCategory}">
        <meta itemprop="address" content="${safeCity}, Bahia, Brasil">
      </div>`
  }).join('')

  const emptyHTML = `
    <div style="text-align:center;padding:48px;color:#6b7280">
      <p style="font-size:16px">Nenhum profissional cadastrado ainda em ${safeCidadeNome}.</p>
      <p style="font-size:14px">Seja o primeiro! Cadastre-se gratuitamente.</p>
    </div>`

  const jsonLD = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': title,
    'description': description,
    'url': canonical,
    'numberOfItems': profissionais.length,
    'itemListElement': profissionais.map((p, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'item': {
        '@type': 'LocalBusiness',
        'name': p.name,
        'description': p.bio || `${p.category} em ${p.city}`,
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': p.city,
          'addressRegion': 'BA',
          'addressCountry': 'BR',
        },
        ...(p.rating_avg && p.review_count ? {
          'aggregateRating': {
            '@type': 'AggregateRating',
            'ratingValue': p.rating_avg,
            'reviewCount': p.review_count,
          },
        } : {}),
      },
    })),
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="https://melocale.com.br/icon-512.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <script type="application/ld+json">${JSON.stringify(jsonLD).replace(/<\//g, '<\\/')}</script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; color: #111827; }
    .container { max-width: 720px; margin: 0 auto; padding: 32px 16px; }
    .header { background: #0E5C8A; color: white; padding: 24px 16px; text-align: center; }
    .header h1 { font-size: 26px; font-weight: 800; margin-bottom: 6px; }
    .header p { font-size: 15px; opacity: 0.85; }
    .cta { display: block; margin: 24px 0; background: #00e5a0; color: #0a2540; font-weight: 700;
           font-size: 16px; text-align: center; padding: 14px 24px; border-radius: 12px;
           text-decoration: none; }
    .cta:hover { background: #00c987; }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 12px;
             font-weight: 600; padding: 4px 10px; border-radius: 100px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <p style="font-size:13px;opacity:0.7;margin-bottom:8px">melocale.com.br</p>
    <h1>${safeCategoriaLabel} em ${safeCidadeNome}</h1>
    <p>${description}</p>
  </div>
  <div class="container">
    <span class="badge">${profissionais.length} profissional${profissionais.length !== 1 ? 'is' : ''} encontrado${profissionais.length !== 1 ? 's' : ''}</span>
    <a href="${appUrl}" class="cta">Ver perfis completos e contratar →</a>
    ${profissionais.length > 0 ? profListHTML : emptyHTML}
    <a href="${appUrl}" class="cta" style="margin-top:24px">Contratar ${safeCategoriaLabel} em ${safeCidadeNome} →</a>
    <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:24px">
      MeloCalé · Profissionais de serviços domésticos · <a href="https://melocale.com.br" style="color:#0E5C8A">melocale.com.br</a>
    </p>
  </div>
  <script>
    const ua = navigator.userAgent.toLowerCase();
    const bots = ['googlebot','bingbot','slurp','duckduckbot','baiduspider','yandexbot'];
    const isBot = bots.some(b => ua.includes(b));
    if (!isBot) {
      window.location.replace('${appUrl}');
    }
  </script>
</body>
</html>`
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const pathname = url.pathname.slice(1)

  const knownCategories = Object.keys(CATEGORY_LABELS)

  let categoriaSlug = ''
  let cidadeSlug = ''

  for (const cat of knownCategories) {
    if (pathname.startsWith(cat + '-')) {
      categoriaSlug = cat
      cidadeSlug = pathname.slice(cat.length + 1)
      break
    }
  }

  if (!categoriaSlug || !cidadeSlug) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/' },
    })
  }

  const categoriaLabel = CATEGORY_LABELS[categoriaSlug]
  const cidadeNome = cidadeSlugParaNome(cidadeSlug)

  const profissionais = await fetchProfessionals(categoriaLabel, cidadeNome)
  const html = renderHTML(categoriaLabel, cidadeNome, profissionais, categoriaSlug, cidadeSlug)

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
