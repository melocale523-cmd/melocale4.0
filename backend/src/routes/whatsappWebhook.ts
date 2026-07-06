import { Request, Response } from "express";
import crypto from "node:crypto";
import { supabaseAdmin } from "../config.js";
import { sendWhatsAppText } from "../services/whatsappService.js";
import { ensureConversation, insertMessage, processBotTurn, touchConversation } from "../services/whatsappConversationService.js";

// Webhook da Meta (WhatsApp Cloud API).
// GET  → verificação inicial (hub.challenge) com WHATSAPP_WEBHOOK_VERIFY_TOKEN
// POST → mensagens recebidas no número business. Quando um profissional com
//        whatsapp_marketing_opt_in = true manda mensagem, marcamos
//        whatsapp_connected = true e respondemos confirmação (janela 24h).

const CONFIRMATION_TEXT =
  "WhatsApp conectado! Você vai receber avisos de novos pedidos por aqui. ✅";

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

type WebhookMessage = { from?: string; id?: string; type?: string; text?: { body?: string } };
type WebhookChange = { field?: string; value?: { messages?: WebhookMessage[] } };
type WebhookBody = { object?: string; entry?: { changes?: WebhookChange[] }[] };

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
    const textMessages: WebhookMessage[] = [];
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        for (const msg of change.value?.messages ?? []) {
          if (msg.from) senders.add(msg.from);
          if (msg.type === "text" && msg.text?.body) textMessages.push(msg);
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
    for (const msg of textMessages) {
      await processInboundConversationMessage(msg.from as string, msg.text!.body as string);
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
      await processBotTurn(conv, text);
    }
    // needs_human / resolved: nada a fazer, aguarda ação do admin.
  } catch (err) {
    console.error(`[wa-webhook] erro ao processar conversa de ${waId}:`, err instanceof Error ? err.message : String(err));
  }
}
