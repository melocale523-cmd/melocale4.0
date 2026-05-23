import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { anthropic, chatRateLimit, PLANS } from "../config.js";
import { AuthRequest, requireAuth } from "../middleware/auth.js";
import { withTimeout } from "../lib/timeout.js";

const router = Router();

const chatUsageMap = new Map<string, { count: number; resetAt: number }>()

setInterval(() => {
  const now = Date.now()
  for (const [key, val] of chatUsageMap.entries()) {
    if (val.resetAt <= now) chatUsageMap.delete(key)
  }
}, 60 * 60 * 1000)

const chatSchema = z.object({
  messages: z.array(z.object({ role: z.string(), text: z.string() })).min(1),
  context: z.string().optional(),
  userData: z.record(z.string(), z.unknown()).optional(),
});

const SUSPICIOUS_PATTERN = /ignore|system\s*prompt|assistant|jailbreak|prompt\s*injection/i;

function sanitizeUserData(raw: Record<string, unknown>): {
  name: string;
  role: "client" | "professional" | null;
  category: string;
  coinBalance: unknown;
  activePlan: unknown;
  leadsBought: unknown;
  totalPedidos: unknown;
  openTickets: unknown;
  activeSubscriptions: unknown;
} {
  const stripTags = (v: unknown, max: number): string => {
    if (typeof v !== "string") return "";
    return v
      .replace(/<[^>]*>/g, "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/\r/g, "")
      .replace(/\n/g, " ")
      .trim()
      .slice(0, max);
  };

  const name = stripTags(raw.name, 100);
  const category = stripTags(raw.category, 100);

  if (SUSPICIOUS_PATTERN.test(name) || SUSPICIOUS_PATTERN.test(category)) {
    throw Object.assign(new Error("Conteúdo inválido em userData"), { status: 400 });
  }

  const rawRole = raw.role;
  const role: "client" | "professional" | null =
    rawRole === "client" || rawRole === "professional" ? rawRole : null;

  if (rawRole !== undefined && rawRole !== null && role === null) {
    throw Object.assign(new Error("role inválido"), { status: 400 });
  }

  return {
    name,
    role,
    category,
    coinBalance: raw.coinBalance,
    activePlan: raw.activePlan,
    leadsBought: raw.leadsBought,
    totalPedidos: raw.totalPedidos,
    openTickets: raw.openTickets,
    activeSubscriptions: raw.activeSubscriptions,
  };
}

const PLATFORM_KNOWLEDGE = `
SOBRE A MELOCALÉ: Conecta clientes que precisam de serviços domésticos a profissionais qualificados.
PLANOS: Starter R$37/mês (25% desc + 30 moedas) | PRO R$67/mês (40% desc + 80 moedas) ⭐ | Elite R$127/mês (55% desc + 200 moedas)
MOEDAS: Básico 60 por R$24,90 | Popular 200 por R$59,90 | Máximo 560 por R$119,90. Nunca expiram.
LEADS: custam 10-150 moedas dependendo de orçamento, urgência e categoria.`;

const BASE_PROMPT = `Você é o Assistente MeloCalé — amigável, direto e focado em ajudar. Use linguagem simples. Respostas curtas (máx 3 parágrafos). Sempre termine com uma ação clara. Use no máximo 2 emojis por resposta. Nunca invente informações.`;

function buildSystemPrompt(context: string, userData: Record<string, unknown>): string {
  const name = userData.name || "usuário";

  if (context === "professional") {
    const balance = Number(userData.coinBalance ?? 0);
    const plan = typeof userData.activePlan === "string" ? userData.activePlan : null;
    const leads = Number(userData.leadsBought ?? 0);
    return `${BASE_PROMPT}

CONTEXTO: Você está no painel PROFISSIONAL conversando com ${name}.
DADOS REAIS DO USUÁRIO:
- Saldo atual: ${balance} moedas${balance < 20 ? " ⚠️ BAIXO" : ""}
- Plano ativo: ${plan ? PLANS[plan]?.name ?? plan : "Nenhum (sem desconto)"}
- Leads comprados: ${leads}

${PLATFORM_KNOWLEDGE}

COMPORTAMENTO NESTE CONTEXTO:
- Se saldo < 20: mencione que está baixo e sugira recarregar
- Se sem plano: sugira o PRO como melhor custo-benefício
- Foque em estratégias para fechar mais serviços
- Ajude com dúvidas sobre leads, moedas, planos, perfil
- NUNCA fale sobre funcionalidades de cliente ou admin`;
  }

  if (context === "client") {
    const pedidos = userData.totalPedidos ?? 0;
    return `${BASE_PROMPT}

CONTEXTO: Você está no painel CLIENTE conversando com ${name}.
DADOS REAIS DO USUÁRIO:
- Total de pedidos criados: ${pedidos}

${PLATFORM_KNOWLEDGE}

COMPORTAMENTO NESTE CONTEXTO:
- Ajude a criar pedidos, entender propostas, contratar profissionais
- Se pedidos = 0: incentive a criar o primeiro pedido (é grátis!)
- Explique como funciona o processo de contratação
- NUNCA fale sobre moedas, leads ou funcionalidades de profissional/admin`;
  }

  if (context === "admin") {
    const tickets = userData.openTickets ?? 0;
    const subs = userData.activeSubscriptions ?? 0;
    return `${BASE_PROMPT}

CONTEXTO: Você está no painel ADMIN conversando com ${name}.
DADOS REAIS DO SISTEMA:
- Tickets de suporte abertos: ${tickets}
- Assinaturas ativas: ${subs}

COMPORTAMENTO NESTE CONTEXTO:
- Responda perguntas técnicas sobre o sistema
- Ajude a interpretar métricas e dados
- Sugira ações baseadas nos dados (ex: muitos tickets = verificar bug)
- Pode discutir estratégias de negócio e crescimento da plataforma
- Tom mais técnico e direto`;
  }

  return `${BASE_PROMPT}

CONTEXTO: Você está na PÁGINA INICIAL — o usuário pode ser visitante, cliente ou profissional.

${PLATFORM_KNOWLEDGE}

COMPORTAMENTO NESTE CONTEXTO:
- Foco em CONVERSÃO: convença visitantes a se cadastrar
- Primeira pergunta: descubra se é cliente ou profissional
- Para clientes: é grátis, rápido, seguro
- Para profissionais: ROI dos leads, plano PRO se paga em 2-3 clientes
- NUNCA mencione funcionalidades de admin`;
}

router.post("/chat", chatRateLimit, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Dados inválidos." });

  try {
    const authUser = (req as AuthRequest).authUser!
    const now = Date.now()
    const usage = chatUsageMap.get(authUser.id)
    if (usage && usage.resetAt > now && usage.count >= 20) {
      return res.status(429).json({ error: 'Limite de uso do chat atingido. Tente novamente em 1 hora.' })
    }
    if (!usage || usage.resetAt <= now) {
      chatUsageMap.set(authUser.id, { count: 1, resetAt: now + 60 * 60 * 1000 })
    } else {
      usage.count++
    }

    const { messages, context = "landing", userData: rawUserData = {} } = req.body;
    const userData = sanitizeUserData(rawUserData as Record<string, unknown>);
    const systemPrompt = buildSystemPrompt(context, userData);
    const mapped = (messages as { role: string; text: string }[])
      .map((m) => ({
        role: (m.role === "model" || m.role === "bot" || m.role === "assistant")
          ? "assistant" as const
          : "user" as const,
        content: typeof m.text === "string"
          ? m.text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/\r/g, "").slice(0, 4000)
          : "",
      }))
      .filter((m, idx) => !(idx === 0 && m.role === "assistant"));
    const response = await withTimeout(
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: mapped,
      }),
      15000
    );
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    res.json({ response: text });
  } catch (error) {
    next(error);
  }
});

export default router;
