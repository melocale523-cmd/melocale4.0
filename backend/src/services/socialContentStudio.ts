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

export async function createSocialImage(itemId: string, visualPrompt: string): Promise<{ storagePath: string; model: string; usage: Usage; estimatedCostCents: number }> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY não está configurada. A geração visual permanece desativada.');

  const google = createGoogleGenerativeAI({ apiKey });
  const result = await generateImage({
    model: google.image(VISUAL_MODEL),
    prompt: `${visualPrompt}\n\nCrie uma imagem editorial original para a MeloCalé. Sem texto, sem logotipos de terceiros, sem selos de avaliação, sem preço e sem retratar pessoas sintéticas como clientes ou profissionais reais.`,
    aspectRatio: '4:5',
    abortSignal: AbortSignal.timeout(90_000),
  });

  const extension = result.image.mediaType?.split('/')[1] ?? 'png';
  const storagePath = `${itemId}/${randomUUID()}.${extension}`;
  const { error } = await supabaseAdmin.storage
    .from('social-content')
    .upload(storagePath, result.image.uint8Array, { contentType: result.image.mediaType ?? 'image/png', upsert: false });
  if (error) throw new Error(`Não foi possível salvar a imagem gerada: ${error.message}`);

  const usage = normalizeUsage(result.usage);
  const imageRate = Number(process.env.SOCIAL_VISUAL_CENTS_PER_IMAGE ?? 0);
  return { storagePath, model: VISUAL_MODEL, usage, estimatedCostCents: Math.max(0, Math.round(imageRate)) };
}