import { randomUUID } from 'node:crypto';
import { generateImage, generateText, Output, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { supabaseAdmin } from '../config.js';

export type SocialContentRequest = {
  objective: 'reach' | 'client_leads' | 'professional_signup' | 'trust' | 'education';
  audience: 'client' | 'professional' | 'mixed';
  format: 'reel' | 'carousel' | 'story' | 'feed' | 'article';
  city?: string;
  service?: string;
  topic: string;
  research?: boolean;
};

const QUALITY_MODEL = process.env.SOCIAL_STRATEGY_MODEL ?? 'claude-sonnet-4-5';
const ECONOMY_MODEL = process.env.SOCIAL_ECONOMY_MODEL ?? 'claude-haiku-4-5-20251001';
const VISUAL_MODEL = process.env.SOCIAL_VISUAL_MODEL ?? 'gemini-3.1-flash-image-preview';
const RESEARCH_ENABLED = process.env.SOCIAL_RESEARCH_ENABLED === 'true';

function strategyModel(): string {
  return process.env.SOCIAL_STRATEGY_MODE === 'quality' ? QUALITY_MODEL : ECONOMY_MODEL;
}

export function getSocialStrategyModel(): string {
  return strategyModel();
}

const researchCache = new Map<string, { sources: unknown[]; expiresAt: number }>();

export function socialResearchCacheKey(input: Pick<SocialContentRequest, 'city' | 'service' | 'topic'>): string {
  return [input.city, input.service, input.topic].filter(Boolean).join('|').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9|]+/g, ' ').trim();
}

export function getSocialResearchCache(cacheKey: string): unknown[] | null {
  const cached = researchCache.get(cacheKey);
  if (!cached || cached.expiresAt <= Date.now()) {
    researchCache.delete(cacheKey);
    return null;
  }
  return cached.sources;
}

export function setSocialResearchCache(cacheKey: string, sources: unknown[]): void {
  if (sources.length) researchCache.set(cacheKey, { sources, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
}


const contentSchema = z.object({
  title: z.string().min(8).max(110),
  hook: z.string().min(8).max(180),
  caption: z.string().min(40).max(1800),
  cta: z.string().min(4).max(180),
  slides: z.array(z.object({ heading: z.string().min(2).max(100), body: z.string().min(2).max(260) })).max(8),
  visualPrompt: z.string().min(30).max(1800),
  safetyNotes: z.array(z.string().min(3).max(220)).max(8),
});

export type SocialDraft = z.infer<typeof contentSchema>;

type Usage = { inputTokens: number; outputTokens: number; totalTokens: number };

function normalizeUsage(value: unknown): Usage {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const number = (key: string) => typeof record[key] === 'number' ? record[key] as number : 0;
  return { inputTokens: number('inputTokens'), outputTokens: number('outputTokens'), totalTokens: number('totalTokens') };
}

function estimateCostCents(usage: Usage, inputRate = Number(process.env.SOCIAL_STRATEGY_INPUT_CENTS_PER_MTOKEN ?? 0), outputRate = Number(process.env.SOCIAL_STRATEGY_OUTPUT_CENTS_PER_MTOKEN ?? 0)): number {
  return Math.max(0, Math.round((usage.inputTokens * inputRate + usage.outputTokens * outputRate) / 1_000_000));
}

function rejectUnsafeCopy(draft: SocialDraft): void {
  const text = `${draft.title} ${draft.hook} ${draft.caption} ${draft.cta} ${draft.slides.map((slide) => `${slide.heading} ${slide.body}`).join(' ')}`.toLowerCase();
  const forbidden = [
    /profissionais? verificados?/, /melhor pre[çc]o/, /resultado garantido/, /atendimento imediato/,
    /dispon[ií]vel agora/, /garantia de contrata[çc][ãa]o/, /avalia[çc][õo]es? reais?/, /n[úu]mero de pedidos garantido/,
  ];
  if (forbidden.some((pattern) => pattern.test(text))) {
    throw new Error('O rascunho foi bloqueado por conter uma promessa que a plataforma não consegue comprovar.');
  }
}

function parseJsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('A IA n\u00e3o retornou um objeto JSON v\u00e1lido.');
  return JSON.parse(cleaned.slice(first, last + 1));
}

function draftPrompt(input: SocialContentRequest, researchAllowed: boolean): string {
  const location = [input.city, input.service].filter(Boolean).join(' \u00b7 ') || 'Brasil';
  return `Crie um rascunho de conte\u00fado para ${input.format}.
Objetivo: ${input.objective}.
P\u00fablico: ${input.audience}.
Local/servi\u00e7o: ${location}.
Tema: ${input.topic}.\nFramework persuasivo MeloCale:\n- Comece com um gancho curto que interrompa a rolagem e nomeie uma dor ou desejo concreto.\n- Mostre uma consequencia pratica sem alarmismo e entregue uma orientacao que a pessoa consiga usar.\n- Antecipe uma objecao comum (preco, confianca, prazo ou como escolher) e responda com transparencia.\n- Termine com um proximo passo unico e mensuravel, ligado ao objetivo: pedir orcamento, comparar profissionais ou cadastrar-se.\n- Use linguagem especifica, humana e visual; evite frases genericas.\n- Para alcance ou educacao, priorize salvar e compartilhar; para cliente, pedir orcamento; para profissional, cadastrar perfil.\n
${researchAllowed ? 'Use a pesquisa na web apenas para identificar d\u00favidas e formatos; n\u00e3o use n\u00fameros ou fatos n\u00e3o verific\u00e1veis no texto final.' : 'N\u00e3o h\u00e1 dados internos suficientes; trabalhe com educa\u00e7\u00e3o e transpar\u00eancia, sem alegar evid\u00eancias externas.'}

Retorne somente JSON v\u00e1lido, sem markdown, com exatamente estas chaves:
{"title":"","hook":"","caption":"","cta":"","slides":[{"heading":"","body":""}],"visualPrompt":"","safetyNotes":[""]}`;
}

async function generateFallbackDraft(input: SocialContentRequest, researchAllowed: boolean): Promise<{ draft: SocialDraft; usage: Usage }> {
  const result = await generateText({
    model: anthropic(strategyModel()),
    system: 'Voc\u00ea \u00e9 o diretor de marketing \u00e9tico da MeloCal\u00e9. Responda em portugu\u00eas do Brasil. N\u00e3o invente profissionais, avalia\u00e7\u00f5es, pre\u00e7os, disponibilidade ou resultados. N\u00e3o fa\u00e7a promessas que a plataforma n\u00e3o possa comprovar. N\u00e3o inclua texto na arte.',
    prompt: draftPrompt(input, researchAllowed),
  });
  const parsed = contentSchema.safeParse(parseJsonObject(result.text));
  if (!parsed.success) throw new Error(`A resposta da IA n\u00e3o passou na valida\u00e7\u00e3o: ${parsed.error.issues[0]?.message ?? 'formato inv\u00e1lido'}.`);
  return { draft: parsed.data, usage: normalizeUsage(result.totalUsage) };
}

export async function createSocialDraft(input: SocialContentRequest): Promise<{ draft: SocialDraft; usage: Usage; estimatedCostCents: number; sources: unknown[] }> {
  const researchAllowed = input.research === true && RESEARCH_ENABLED;
  let result: any;
  try {
    result = await generateText({
      model: anthropic(strategyModel()),
      system: `Voc\u00ea \u00e9 o diretor de marketing \u00e9tico da MeloCal\u00e9, uma plataforma digital brasileira que aproxima clientes e profissionais de servi\u00e7os. Crie conte\u00fado \u00fatil, humano e persuasivo em portugu\u00eas do Brasil.

Regras inegoci\u00e1veis:
- N\u00e3o invente profissionais, clientes, avalia\u00e7\u00f5es, pre\u00e7os, disponibilidade, urg\u00eancia, cobertura ou resultados.
- N\u00e3o prometa quantidade de pedidos, contrata\u00e7\u00e3o, economia, seguran\u00e7a absoluta ou atendimento imediato.
- N\u00e3o use medo, manipula\u00e7\u00e3o, escassez falsa, spam ou compara\u00e7\u00f5es sem fonte.
- Quando n\u00e3o houver prova real, explique processo, checklist ou orienta\u00e7\u00e3o pr\u00e1tica.
- Arte: n\u00e3o inclua texto dentro da imagem; texto ser\u00e1 aplicado no design depois. N\u00e3o apresente pessoas geradas como clientes ou profissionais reais.
- O conte\u00fado deve direcionar para um pr\u00f3ximo passo honesto: pedir or\u00e7amento, entender o processo ou cadastrar-se como profissional.`,
      prompt: draftPrompt(input, researchAllowed),
      output: Output.object({ schema: contentSchema, name: 'social_content_draft' }),
      ...(researchAllowed ? {
        tools: { web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }) },
        stopWhen: stepCountIs(4),
      } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/no object generated|schema|structured output|valid json/i.test(message)) throw error;
    console.warn('[social-content] resposta estruturada inv\u00e1lida; usando fallback JSON validado');
    const fallback = await generateFallbackDraft(input, researchAllowed);
    rejectUnsafeCopy(fallback.draft);
    return { draft: fallback.draft, usage: fallback.usage, estimatedCostCents: estimateCostCents(fallback.usage), sources: [] };
  }

  const draft = result.output;
  rejectUnsafeCopy(draft);
  const usage = normalizeUsage(result.totalUsage);
  return {
    draft,
    usage,
    estimatedCostCents: estimateCostCents(usage),
    sources: JSON.parse(JSON.stringify(result.sources ?? [])) as unknown[],
  };
}

async function saveGeneratedImage(itemId: string, imageBytes: Uint8Array, mediaType: string, model: string, usage: Usage): Promise<{ storagePath: string; model: string; usage: Usage; estimatedCostCents: number }> {
  const extension = mediaType.split('/')[1] ?? 'png';
  const storagePath = `${itemId}/${randomUUID()}.${extension}`;
  const { error } = await supabaseAdmin.storage
    .from('social-content')
    .upload(storagePath, imageBytes, { contentType: mediaType, upsert: false });
  if (error) throw new Error(`Não foi possível salvar a imagem gerada: ${error.message}`);
  const imageRate = Number(process.env.SOCIAL_VISUAL_CENTS_PER_IMAGE ?? 0);
  return { storagePath, model, usage, estimatedCostCents: Math.max(0, Math.round(imageRate)) };
}

function isGeminiQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /quota|rate.?limit|resource.?exhausted|too many requests|429/i.test(message);
}

const MELOCALE_IMAGE_GUIDANCE = [
  'Direcao visual MeloCale: marketplace brasileiro de servicos locais, acolhedor, confiavel e contemporaneo. Paleta fixa da marca: navy #092D86, royal blue #0B43B8, cyan #08BDF2, emerald #08734F, ice #F4F8FF e coral #FF7A59. Use uma paleta sutil inspirada na marca: azul-marinho profundo, verde-esmeralda e pequenos acentos coral/laranja, sem transformar a imagem em um anuncio carregado. Prefira uma cena fotografica editorial fotorrealista, com iluminacao natural, materiais e proporcoes plausiveis, contexto brasileiro cotidiano e detalhes humanos autenticos. Quando uma explicacao visual for melhor atendida por ilustracao, use uma composicao 3D editorial premium, limpa e com acabamento profissional.',
  'Composicao para redes sociais: retrato vertical 4:5, um ponto focal claro nos primeiros segundos, tensao visual legivel e resolucao emocional ou pratica evidente. Use contraste, profundidade, gesto ou objeto em acao para interromper a rolagem; mantenha hierarquia forte e area de respiro. A imagem deve parecer uma capa editorial premium, nao um banner generico, com fundo organizado e area de respiro para a legenda ser aplicada fora da imagem. Mantenha uma assinatura visual repetivel da MeloCale: luz natural, contraste azul-marinho com verde-esmeralda e um pequeno acento coral/laranja em cada arte, sem parecer template rigido. Nao inclua texto, letras, numeros, logotipo, marca d agua, interface, preco, selo de avaliacao ou identidade visual de terceiros. Nao invente resultados, clientes, profissionais, avaliacoes ou disponibilidade. Se houver pessoas, trate-as como personagens editoriais genericos, sem sugerir que sao profissionais ou clientes reais.',
].join('\n');

function buildBrandImagePrompt(visualPrompt: string): string {
  return visualPrompt + '\n\n' + MELOCALE_IMAGE_GUIDANCE;
}

async function createOpenAiFallbackImage(itemId: string, visualPrompt: string): Promise<{ storagePath: string; model: string; usage: Usage; estimatedCostCents: number }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('A cota do Gemini acabou e OPENAI_API_KEY não está configurada para fallback.');
  const model = process.env.SOCIAL_VISUAL_FALLBACK_MODEL?.trim() || 'gpt-image-1-mini';
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: buildBrandImagePrompt(visualPrompt),
      size: '1024x1536',
      quality: 'low',
      output_format: 'webp',
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const payload = await response.json().catch(() => ({})) as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
  if (!response.ok || !payload.data?.[0]?.b64_json) {
    throw new Error(`OpenAI não conseguiu gerar a imagem: ${payload.error?.message ?? `HTTP ${response.status}`}`);
  }
  return saveGeneratedImage(itemId, Buffer.from(payload.data[0].b64_json, 'base64'), 'image/webp', `openai:${model}`, { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
}

export async function createSocialImage(itemId: string, visualPrompt: string): Promise<{ storagePath: string; model: string; usage: Usage; estimatedCostCents: number }> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return createOpenAiFallbackImage(itemId, visualPrompt);
  try {
    const google = createGoogleGenerativeAI({ apiKey });
    const result = await generateImage({
      model: google.image(VISUAL_MODEL),
      prompt: buildBrandImagePrompt(visualPrompt),
      aspectRatio: '4:5',
      abortSignal: AbortSignal.timeout(90_000),
    });
    const usage = normalizeUsage(result.usage);
    return saveGeneratedImage(itemId, result.image.uint8Array, result.image.mediaType ?? 'image/png', VISUAL_MODEL, usage);
  } catch (error) {
    if (process.env.SOCIAL_VISUAL_FALLBACK_ENABLED !== 'true' || !isGeminiQuotaError(error) || !process.env.OPENAI_API_KEY?.trim()) throw error;
    console.warn('[social-content] Gemini sem cota; usando fallback OpenAI.');
    return createOpenAiFallbackImage(itemId, visualPrompt);
  }
}
export type InstagramMediaMetrics = { likes: number; comments: number; reach: number; clicks: number; conversions: number; leads: number; metrics_source: string; metrics_collected_at: string };

export async function fetchInstagramMediaMetrics(mediaId: string): Promise<InstagramMediaMetrics> {
  const accessToken = process.env.META_INSTAGRAM_ACCESS_TOKEN?.trim();
  const version = process.env.META_INSTAGRAM_GRAPH_API_VERSION?.trim() || 'v22.0';
  if (!accessToken) throw new Error('META_INSTAGRAM_ACCESS_TOKEN nao esta configurado.');
  const base = `https://graph.facebook.com/${version}/${encodeURIComponent(mediaId)}`;
  const query = (path: string) => `${base}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(accessToken)}`;
  const mediaResponse = await fetch(query('?fields=like_count,comments_count'), { signal: AbortSignal.timeout(20_000) });
  const media = await mediaResponse.json().catch(() => ({})) as { like_count?: number; comments_count?: number; error?: { message?: string } };
  if (!mediaResponse.ok || media.error) throw new Error(`A Meta nao retornou os dados da publicacao: ${media.error?.message ?? `HTTP ${mediaResponse.status}`}`);
  let reach = 0;
  try {
    const insightsResponse = await fetch(query('/insights?metric=reach,views,total_interactions'), { signal: AbortSignal.timeout(20_000) });
    const insights = await insightsResponse.json().catch(() => ({})) as { data?: Array<{ name?: string; values?: Array<{ value?: number }> }>; error?: { message?: string } };
    if (insightsResponse.ok && !insights.error) reach = Number(insights.data?.find((metric) => metric.name === 'reach')?.values?.[0]?.value ?? 0) || 0;
  } catch {
    // Basic counts remain useful when the account lacks the insights permission.
  }
  return { likes: Number(media.like_count ?? 0) || 0, comments: Number(media.comments_count ?? 0) || 0, reach, clicks: 0, conversions: 0, leads: 0, metrics_source: 'instagram_graph_api', metrics_collected_at: new Date().toISOString() };
}

type InstagramPublishResult = { containerId: string; mediaId: string };

function instagramApiUrl(path: string): string {
  const version = process.env.META_INSTAGRAM_GRAPH_API_VERSION?.trim();
  return `https://graph.instagram.com/${version ? `${version}/` : ''}${path}`;
}

async function instagramRequest<T>(path: string, body: URLSearchParams): Promise<T> {
  const response = await fetch(instagramApiUrl(path), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string } } & T;
  if (!response.ok || payload.error) {
    throw new Error(`A Meta recusou a publicação: ${payload.error?.message ?? `HTTP ${response.status}`}`);
  }
  return payload;
}

/** Publica somente uma imagem que já recebeu aprovação humana no painel. */
export async function publishApprovedInstagramImage(input: { imageUrl: string; caption: string }): Promise<InstagramPublishResult> {
  const accessToken = process.env.META_INSTAGRAM_ACCESS_TOKEN?.trim();
  const accountId = process.env.META_INSTAGRAM_ACCOUNT_ID?.trim();
  if (!accessToken || !accountId) throw new Error('META_INSTAGRAM_ACCESS_TOKEN e META_INSTAGRAM_ACCOUNT_ID precisam estar configuradas no servidor.');
  const caption = input.caption.trim();
  if (!caption) throw new Error('O conteúdo aprovado não possui legenda para publicar.');
  if (caption.length > 2_200) throw new Error('A legenda excede o limite de 2.200 caracteres do Instagram.');

  const container = await instagramRequest<{ id?: string }>(`${accountId}/media`, new URLSearchParams({ image_url: input.imageUrl, caption, access_token: accessToken }));
  if (!container.id) throw new Error('A Meta não retornou o identificador do contêiner de mídia.');

  let ready = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const response = await fetch(`${instagramApiUrl(container.id)}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`, { signal: AbortSignal.timeout(15_000) });
    const status = await response.json().catch(() => ({})) as { status_code?: string; error?: { message?: string } };
    if (status.error) throw new Error(`A Meta não conseguiu processar a mídia: ${status.error.message ?? 'erro desconhecido'}`);
    if (status.status_code === 'FINISHED') { ready = true; break; }
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') throw new Error(`A Meta não pôde processar a mídia (${status.status_code}).`);
  }
  if (!ready) throw new Error('A Meta ainda está processando a imagem. Aguarde alguns segundos e publique novamente.');

  const published = await instagramRequest<{ id?: string }>(`${accountId}/media_publish`, new URLSearchParams({ creation_id: container.id, access_token: accessToken }));
  if (!published.id) throw new Error('A Meta não retornou o identificador da publicação.');
  return { containerId: container.id, mediaId: published.id };
}
/** Publica uma imagem aprovada como Story; a cria??o do Destaque continua sendo confirmada no Instagram. */
export async function publishApprovedInstagramStory(input: { imageUrl: string }): Promise<InstagramPublishResult> {
  const accessToken = process.env.META_INSTAGRAM_ACCESS_TOKEN?.trim();
  const accountId = process.env.META_INSTAGRAM_ACCOUNT_ID?.trim();
  if (!accessToken || !accountId) throw new Error('META_INSTAGRAM_ACCESS_TOKEN e META_INSTAGRAM_ACCOUNT_ID precisam estar configuradas no servidor.');
  const container = await instagramRequest<{ id?: string }>(accountId + '/media', new URLSearchParams({ media_type: 'STORIES', image_url: input.imageUrl, access_token: accessToken }));
  if (!container.id) throw new Error('A Meta n?o retornou o identificador do Story.');
  let ready = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const response = await fetch(instagramApiUrl(container.id) + '?fields=status_code&access_token=' + encodeURIComponent(accessToken), { signal: AbortSignal.timeout(15_000) });
    const status = await response.json().catch(() => ({})) as { status_code?: string; error?: { message?: string } };
    if (status.error) throw new Error('A Meta n?o conseguiu processar o Story: ' + (status.error.message ?? 'erro desconhecido'));
    if (status.status_code === 'FINISHED') { ready = true; break; }
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') throw new Error('A Meta n?o p?de processar o Story (' + status.status_code + ').');
  }
  if (!ready) throw new Error('A Meta ainda est? processando o Story. Aguarde alguns segundos e tente novamente.');
  const published = await instagramRequest<{ id?: string }>(accountId + '/media_publish', new URLSearchParams({ creation_id: container.id, access_token: accessToken }));
  if (!published.id) throw new Error('A Meta n?o retornou o identificador do Story publicado.');
  return { containerId: container.id, mediaId: published.id };
}
export type SocialCampaignPlanRequest = {
  name: string;
  city: string;
  service?: string;
  audience: SocialContentRequest['audience'];
  objective: SocialContentRequest['objective'];
  postsPerWeek: number;
  research?: boolean;
};

const campaignPlanSchema = z.object({
  items: z.array(z.object({
    topic: z.string().min(12).max(240),
    format: z.enum(['reel', 'carousel', 'story', 'feed', 'article']),
    pillar: z.enum(['educacao', 'confianca', 'decisao', 'profissionais', 'marca']),
    reason: z.string().min(12).max(240),
    qualityScore: z.number().int().min(60).max(100),
  })).min(1).max(7),
});
export type SocialCampaignPlan = z.infer<typeof campaignPlanSchema>;

export async function createSocialCampaignPlan(input: SocialCampaignPlanRequest): Promise<{ plan: SocialCampaignPlan; usage: Usage; estimatedCostCents: number }> {
  const researchAllowed = input.research === true && RESEARCH_ENABLED;
  const result = await generateText({
    model: anthropic(strategyModel()),
    system: 'Voce planeja campanhas organicas eticas para a MeloCale. Priorize utilidade real, variedade de formato e intencao. Nunca invente demanda, resultados, profissionais, avaliacoes, precos ou urgencia. Cada pauta precisa ser diferente e funcionar mesmo sem dados internos.',
    prompt: `Monte ${input.postsPerWeek} pautas para a campanha ${input.name}. Cidade: ${input.city}. Servico: ${input.service ?? 'servicos locais'}. Publico: ${input.audience}. Objetivo: ${input.objective}. ${researchAllowed ? 'Use web apenas para descobrir duvidas recorrentes, sem inserir fatos ou numeros nao verificaveis.' : 'Nao use pesquisa externa.'}`,
    output: Output.object({ schema: campaignPlanSchema, name: 'social_campaign_plan' }),
    ...(researchAllowed ? { tools: { web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }) }, stopWhen: stepCountIs(4) } : {}),
  });
  const usage = normalizeUsage(result.totalUsage);
  return { plan: result.output, usage, estimatedCostCents: estimateCostCents(usage) };
}