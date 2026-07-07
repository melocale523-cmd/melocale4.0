import { Request, Response } from "express";
import crypto from "node:crypto";
import { supabaseAdmin } from "../config.js";
import { sendWhatsAppText } from "../services/whatsappService.js";
import { ensureConversation, getConversationByPhone, insertMessage, processBotTurn, touchConversation } from "../services/whatsappConversationService.js";

// Webhook da Meta (WhatsApp Cloud API).
// GET  → verificação inicial (hub.challenge) com WHATSAPP_WEBHOOK_VERIFY_TOKEN
// POST → mensagens recebidas no número business. Quando um profissional com
//        whatsapp_marketing_opt_in = true manda mensagem, marcamos
//        whatsapp_connected = true e respondemos confirmação (janela 24h).

const CONFIRMATION_TEXT =
  "WhatsApp conectado! Você vai receber avisos de novos pedidos por aqui. ✅";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Janela de debounce por conversa (telefone) antes de chamar o bot — evita
// que duas mensagens chegando quase juntas (ex.: "Como funciona" + "?" a
// poucos segundos de distância) disparem duas chamadas ao Haiku em paralelo,
// cada uma sem saber que a outra já respondeu.
//
// ⚠️ Isto usa um Map em memória do processo — só funciona corretamente com
// UMA única instância do backend rodando (Render Web Service sem scale
// horizontal, que é o setup atual). Se o serviço passar a rodar em múltiplas
// instâncias, cada instância teria seu próprio Map e o debounce deixaria de
// funcionar entre requests que caem em instâncias diferentes (voltaria a
// acontecer a resposta duplicada, só que com probabilidade menor). Resolver
// isso exigiria um lock distribuído (ex.: Redis) — não implementado agora
// por ser over-engineering para o estágio atual do produto.
const BOT_DEBOUNCE_MS = envInt("WHATSAPP_BOT_DEBOUNCE_MS", 3500);
const pendingBotTimers = new Map<string, NodeJS.Timeout>();

function scheduleBotTurn(phone: string, lastMessageBody: string): void {
  const existing = pendingBotTimers.get(phone);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingBotTimers.delete(phone);
    void runDebouncedBotTurn(phone, lastMessageBody);
  }, BOT_DEBOUNCE_MS);
  // Não impede o processo de encerrar (ex.: shutdown gracioso) por causa de
  // um timer de debounce pendente.
  if (typeof timer.unref === "function") timer.unref();
  pendingBotTimers.set(phone, timer);
}

async function runDebouncedBotTurn(phone: string, lastMessageBody: string): Promise<void> {
  try {
    // Rebusca a conversa — o status pode ter mudado durante a janela de
    // espera (ex.: admin assumiu a conversa nesse meio-tempo).
    const conv = await getConversationByPhone(phone);
    if (!conv || conv.status !== "bot_active") return;
    await processBotTurn(conv, lastMessageBody);
  } catch (err) {
    console.error(`[wa-webhook] erro ao processar bot (debounce) de ${phone}:`, err instanceof Error ? err.message : String(err));
  }
}

export function whatsappWebhookVerifyHandler(req: Request, res: Response) {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (!verifyToken) {
    console.warn("[wa-webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado — verificação recusada");
    return res.sendStatus(403);
  }
  if (mode === "subscribe" && token === verifyToken && typeof challenge === "string") {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

function isValidSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    // Sem app secret configurado, não dá pra validar — aceita mas avisa.
    console.warn("[wa-webhook] WHATSAPP_APP_SECRET ausente — assinatura X-Hub-Signature-256 NÃO validada");
    return true;
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

type WebhookMessage = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  // Clique em botão de resposta rápida de template (categoria Marketing) —
  // a Meta manda type="interactive" em vez de type="text".
  interactive?: { type?: string; button_reply?: { id?: string; title?: string } };
};
type WebhookChange = { field?: string; value?: { messages?: WebhookMessage[] } };
type WebhookBody = { object?: string; entry?: { changes?: WebhookChange[] }[] };

/**
 * Extrai o texto "equivalente" de uma mensagem inbound: corpo de texto normal,
 * ou o título do botão clicado (resposta rápida de template). Tratado como
 * mensagem de texto comum dali pra frente — mesmo pipeline do bot.
 */
function extractMessageText(msg: WebhookMessage): string | null {
  if (msg.type === "text" && msg.text?.body) return msg.text.body;
  if (msg.type === "interactive" && msg.interactive?.type === "button_reply" && msg.interactive.button_reply?.title) {
    return msg.interactive.button_reply.title;
  }
  return null;
}

async function connectProfessionalByWaId(waId: string): Promise<boolean> {
  const digits = waId.replace(/\D/g, "");
  if (digits.length < 8) return false;

  // wa_id pode vir com ou sem o 9 extra do celular BR; profiles.phone é
  // DDD+numero sem DDI. Tenta sufixo de 9 dígitos, depois 8.
  let matches: { user_id: string }[] = [];
  for (const len of [9, 8]) {
    if (digits.length < len) continue;
    const { data, error } = await supabaseAdmin.rpc("find_professionals_by_phone_suffix", {
      p_suffix: digits.slice(-len),
    });
    if (error) {
      console.error("[wa-webhook] rpc find_professionals_by_phone_suffix:", error.message);
      return false;
    }
    matches = (data ?? []) as { user_id: string }[];
    if (matches.length) break;
  }
  if (!matches.length) return false;

  let connectedAny = false;
  for (const { user_id } of matches) {
    const { data: pref } = await supabaseAdmin
      .from("user_notification_preferences")
      .select("whatsapp_marketing_opt_in, whatsapp_connected")
      .eq("user_id", user_id)
      .maybeSingle();

    // Sem linha de preferências = default do banco (opt-in true)
    const optIn = (pref as { whatsapp_marketing_opt_in?: boolean | null } | null)?.whatsapp_marketing_opt_in !== false;
    const alreadyConnected = (pref as { whatsapp_connected?: boolean | null } | null)?.whatsapp_connected === true;
    if (!optIn) continue;

    if (!alreadyConnected) {
      const { error: upErr } = await supabaseAdmin
        .from("user_notification_preferences")
        .upsert(
          { user_id, whatsapp_connected: true, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (upErr) {
        console.error(`[wa-webhook] falha ao marcar whatsapp_connected para ${user_id}:`, upErr.message);
        continue;
      }
      connectedAny = true;
      console.log(`[wa-webhook] whatsapp_connected = true para ${user_id}`);
    }
  }
  return connectedAny;
}

export async function whatsappWebhookHandler(req: Request, res: Response) {
  // Log incondicional de entrada — prova se o POST da Meta chega ao processo
  console.log(`[wa-webhook] POST recebido ${new Date().toISOString()} ct=${req.header("content-type") ?? "?"} sig=${req.header("x-hub-signature-256") ? "presente" : "AUSENTE"} len=${req.header("content-length") ?? "?"}`);

  const rawBody = req.body as Buffer;
  if (!Buffer.isBuffer(rawBody)) {
    console.error("[wa-webhook] body não é Buffer (content-type inesperado?) — 400");
    return res.sendStatus(400);
  }
  if (!isValidSignature(rawBody, req.header("x-hub-signature-256"))) {
    console.error("[wa-webhook] assinatura X-Hub-Signature-256 inválida — 401 (conferir WHATSAPP_APP_SECRET no Render × App Secret do app na Meta)");
    return res.sendStatus(401);
  }

  // Meta exige 200 rápido — processa e responde best-effort, sem lançar.
  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody.toString("utf8")) as WebhookBody;
  } catch {
    return res.sendStatus(400);
  }
  res.sendStatus(200);

  try {
    if (body.object !== "whatsapp_business_account") return;
    const senders = new Set<string>();
    const inboundTexts: { from: string; text: string }[] = [];
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        for (const msg of change.value?.messages ?? []) {
          if (msg.from) senders.add(msg.from);
          const text = extractMessageText(msg);
          if (text && msg.from) inboundTexts.push({ from: msg.from, text });
        }
      }
    }
    for (const waId of senders) {
      const connectedNow = await connectProfessionalByWaId(waId);
      if (connectedNow) {
        const result = await sendWhatsAppText(waId, CONFIRMATION_TEXT);
        if (!result.ok) console.error(`[wa-webhook] falha ao confirmar para ${waId}:`, result.error);
      }
    }
    for (const { from, text } of inboundTexts) {
      await processInboundConversationMessage(from, text);
    }
  } catch (err) {
    console.error("[wa-webhook] erro ao processar evento:", err instanceof Error ? err.message : String(err));
  }
}

async function processInboundConversationMessage(waId: string, text: string): Promise<void> {
  try {
    const conv = await ensureConversation(waId);
    await insertMessage({
      conversation_id: conv.id,
      direction: "inbound",
      sender: "user",
      body: text,
    });
    await touchConversation(conv.id);

    if (conv.status === "human_active") {
      // Humano no controle — bot se cala, só registra a mensagem.
      return;
    }
    if (conv.status === "bot_active") {
      // Não chama o bot imediatamente — agenda com debounce, pra agrupar
      // mensagens que cheguem em sequência rápida numa única resposta.
      scheduleBotTurn(conv.phone, text);
    }
    // needs_human / resolved: nada a fazer, aguarda ação do admin.
  } catch (err) {
    console.error(`[wa-webhook] erro ao processar conversa de ${waId}:`, err instanceof Error ? err.message : String(err));
  }
}
