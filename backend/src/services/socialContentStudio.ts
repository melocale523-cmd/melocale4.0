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

const STRATEGY_MODEL = process.env.SOCIAL_STRATEGY_MODEL ?? 'claude-sonnet-4-5';
const VISUAL_MODEL = process.env.SOCIAL_VISUAL_MODEL ?? 'gemini-3.1-flash-image-preview';
const RESEARCH_ENABLED = process.env.SOCIAL_RESEARCH_ENABLED === 'true';

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

export async function createSocialDraft(input: SocialContentRequest): Promise<{ draft: SocialDraft; usage: Usage; estimatedCostCents: number; sources: unknown[] }> {
  const location = [input.city, input.service].filter(Boolean).join(' — ') || 'Brasil';
  const researchAllowed = input.research === true && RESEARCH_ENABLED;
  const result = await generateText({
    model: anthropic(STRATEGY_MODEL),
    system: `Você é o diretor de marketing ético da MeloCalé, uma plataforma digital brasileira que aproxima clientes e profissionais de serviços. Crie conteúdo útil, humano e persuasivo em português do Brasil.\n\nRegras inegociáveis:\n- Não invente profissionais, clientes, avaliações, preços, disponibilidade, urgência, cobertura ou resultados.\n- Não prometa quantidade de pedidos, contratação, economia, segurança absoluta ou atendimento imediato.\n- Não use medo, manipulação, escassez falsa, spam ou comparações sem fonte.\n- Quando não houver prova real, explique processo, checklist ou orientação prática.\n- Arte: não inclua texto dentro da imagem; texto será aplicado no design depois. Não apresente pessoas geradas como clientes ou profissionais reais.\n- O conteúdo deve direcionar para um próximo passo honesto: pedir orçamento, entender o processo ou cadastrar-se como profissional.`,
    prompt: `Crie um rascunho de conteúdo para ${input.format}.\nObjetivo: ${input.objective}.\nPúblico: ${input.audience}.\nLocal/serviço: ${location}.\nTema: ${input.topic}.\n${researchAllowed ? 'Use a pesquisa na web apenas para identificar dúvidas e formatos; não use números ou fatos não verificáveis no texto final.' : 'Não há dados internos suficientes; trabalhe com educação e transparência, sem alegar evidências externas.'}\n\nRetorne uma proposta completa e pronta para aprovação.`,
    output: Output.object({ schema: contentSchema, name: 'social_content_draft' }),
    ...(researchAllowed ? {
      tools: { web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }) },
      stopWhen: stepCountIs(4),
    } : {}),
  });

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

async function createOpenAiFallbackImage(itemId: string, visualPrompt: string): Promise<{ storagePath: string; model: string; usage: Usage; estimatedCostCents: number }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('A cota do Gemini acabou e OPENAI_API_KEY não está configurada para fallback.');
  const model = process.env.SOCIAL_VISUAL_FALLBACK_MODEL?.trim() || 'gpt-image-1-mini';
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: `${visualPrompt}\n\nCrie uma imagem editorial original para a MeloCalé. Sem texto, sem logotipos de terceiros, sem selos de avaliação, sem preço e sem retratar pessoas sintéticas como clientes ou profissionais reais.`,
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
      prompt: `${visualPrompt}\n\nCrie uma imagem editorial original para a MeloCalé. Sem texto, sem logotipos de terceiros, sem selos de avaliação, sem preço e sem retratar pessoas sintéticas como clientes ou profissionais reais.`,
      aspectRatio: '4:5',
      abortSignal: AbortSignal.timeout(90_000),
    });
    const usage = normalizeUsage(result.usage);
    return saveGeneratedImage(itemId, result.image.uint8Array, result.image.mediaType ?? 'image/png', VISUAL_MODEL, usage);
  } catch (error) {
    if (!isGeminiQuotaError(error) || !process.env.OPENAI_API_KEY?.trim()) throw error;
    console.warn('[social-content] Gemini sem cota; usando fallback OpenAI.');
    return createOpenAiFallbackImage(itemId, visualPrompt);
  }
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
    model: anthropic(STRATEGY_MODEL),
    system: 'Voce planeja campanhas organicas eticas para a MeloCale. Priorize utilidade real, variedade de formato e intencao. Nunca invente demanda, resultados, profissionais, avaliacoes, precos ou urgencia. Cada pauta precisa ser diferente e funcionar mesmo sem dados internos.',
    prompt: `Monte ${input.postsPerWeek} pautas para a campanha ${input.name}. Cidade: ${input.city}. Servico: ${input.service ?? 'servicos locais'}. Publico: ${input.audience}. Objetivo: ${input.objective}. ${researchAllowed ? 'Use web apenas para descobrir duvidas recorrentes, sem inserir fatos ou numeros nao verificaveis.' : 'Nao use pesquisa externa.'}`,
    output: Output.object({ schema: campaignPlanSchema, name: 'social_campaign_plan' }),
    ...(researchAllowed ? { tools: { web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }) }, stopWhen: stepCountIs(4) } : {}),
  });
  const usage = normalizeUsage(result.totalUsage);
  return { plan: result.output, usage, estimatedCostCents: estimateCostCents(usage) };
}