import { supabaseAdmin, anthropic } from "../config.js";
import { withTimeout } from "../lib/timeout.js";
import { runTrackedJob } from "../lib/automationJobs.js";

const NO_REPLY_THRESHOLD_MS = 60 * 60 * 1000; // 1 hora
const MAX_CONV_AGE_MS = 24 * 60 * 60 * 1000;  // ignorar convs com mais de 24h paradas

const SYSTEM_PROMPT = `Você é o Assistente MeloCalé, uma plataforma de serviços domésticos no interior da Bahia.
O profissional ainda não respondeu e você está enviando uma mensagem automática em nome da plataforma para tranquilizar o cliente.
Seja cordial, empático e breve (máximo 2 frases).
Informe que o profissional foi notificado e responderá em breve.
NÃO prometa prazos específicos. NÃO invente informações. NÃO fale como se fosse o profissional.
Termine com algo encorajador.`;

type MsgRow = {
  id: string;
  conversation_id: string;
  body: string;
  sender_type: string;
  created_at: string;
};

type ConvRow = {
  id: string;
  last_message_at: string;
};

export async function runAiChatResponder() {
  console.log("[aiChat] verificando chats sem resposta...");

  const now = Date.now();
  const thresholdIso = new Date(now - NO_REPLY_THRESHOLD_MS).toISOString();
  const maxAgeIso    = new Date(now - MAX_CONV_AGE_MS).toISOString();

  try {
    // Conversations where last message is old enough to trigger AI, but not stale
    const { data: convs, error: convErr } = await withTimeout(
      supabaseAdmin
        .from("conversations")
        .select("id, last_message_at")
        .lte("last_message_at", thresholdIso)
        .gte("last_message_at", maxAgeIso)
    );
    if (convErr) throw convErr;
    if (!convs?.length) {
      console.log("[aiChat] nenhuma conversa elegível");
      return;
    }

    const convIds = (convs as ConvRow[]).map(c => c.id);

    // Fetch latest message per conversation
    const { data: latestMsgs, error: msgErr } = await withTimeout(
      supabaseAdmin
        .from("messages")
        .select("id, conversation_id, body, sender_type, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
    );
    if (msgErr) throw msgErr;

    // Group messages by conversation: latest first
    const byConv = new Map<string, MsgRow[]>();
    for (const m of (latestMsgs ?? []) as MsgRow[]) {
      const arr = byConv.get(m.conversation_id) ?? [];
      arr.push(m);
      byConv.set(m.conversation_id, arr);
    }

    let responded = 0;

    for (const conv of convs as ConvRow[]) {
      const msgs = byConv.get(conv.id);
      if (!msgs?.length) continue;

      const lastMsg = msgs[0]; // already sorted desc

      // Only respond if last message is from client
      if (lastMsg.sender_type !== "client") continue;

      // Don't respond if AI already replied in this conversation
      const alreadyHasAi = msgs.some(m => m.sender_type === "ai");
      if (alreadyHasAi) continue;

      // Build context from last few messages (up to 4)
      const context = msgs
        .slice(0, 4)
        .reverse()
        .map(m => `${m.sender_type === "client" ? "Cliente" : "Profissional"}: ${m.body.slice(0, 300)}`)
        .join("\n");

      try {
        const aiRes = await withTimeout(
          anthropic.messages.create({
            model: "claude-sonnet-5",
            max_tokens: 150,
            system: SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: `Histórico da conversa:\n${context}\n\nÚltima mensagem do cliente: "${lastMsg.body.slice(0, 500)}"`,
              },
            ],
          }),
          15_000
        );

        const aiText =
          aiRes.content[0].type === "text" ? aiRes.content[0].text.trim() : "";
        if (!aiText) continue;

        // Insert AI message
        const { error: insertErr } = await withTimeout(
          supabaseAdmin.from("messages").insert({
            conversation_id: conv.id,
            body: aiText,
            sender_type: "ai",
            attachments: [],
          })
        );
        if (insertErr) {
          console.error("[aiChat] erro ao inserir mensagem:", insertErr.message);
          continue;
        }

        // Update last_message_at on conversation
        await withTimeout(
          supabaseAdmin
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conv.id)
        );

        responded++;
        console.log(`[aiChat] respondeu conv ${conv.id}`);
      } catch (err) {
        console.error(`[aiChat] erro na conv ${conv.id}:`, err instanceof Error ? err.message : String(err));
      }
    }

    console.log(`[aiChat] concluído — ${responded} resposta(s) enviada(s)`);
  } catch (err) {
    console.error("[aiChat] erro geral:", err instanceof Error ? err.message : String(err));
  }
}

export function startAiChatResponder() {
  void runTrackedJob("ai_chat_responder", runAiChatResponder);
  setInterval(() => void runTrackedJob("ai_chat_responder", runAiChatResponder), 30 * 60 * 1000);
  console.log("[aiChat] job iniciado (a cada 30min)");
}
