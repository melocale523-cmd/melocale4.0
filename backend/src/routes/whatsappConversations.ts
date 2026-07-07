import { Router, Response } from "express";
import { AuthRequest, requireAuth, requireAdmin } from "../middleware/auth.js";
import { supabaseAdmin, anthropic } from "../config.js";
import { withTimeout } from "../lib/timeout.js";
import { sendWhatsAppText } from "../services/whatsappService.js";
import { insertMessage, touchConversation, type ConversationRow } from "../services/whatsappConversationService.js";

const router = Router();

type ProfileRow = { id: string; full_name: string | null; avatar_url: string | null };

router.get("/conversations", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    let query = supabaseAdmin
      .from("whatsapp_conversations")
      .select("*")
      .order("last_message_at", { ascending: false });
    if (status && status !== "all") query = query.eq("status", status);

    const { data: conversations, error } = await withTimeout(query);
    if (error) throw error;

    const rows = (conversations ?? []) as ConversationRow[];
    const contactIds = rows.map(r => r.contact_id).filter((id): id is string => Boolean(id));
    const conversationIds = rows.map(r => r.id);

    let profilesMap: Record<string, ProfileRow> = {};
    if (contactIds.length) {
      const { data: profiles } = await withTimeout(
        supabaseAdmin.from("profiles").select("id, full_name, avatar_url").in("id", contactIds)
      );
      profilesMap = Object.fromEntries(((profiles ?? []) as ProfileRow[]).map(p => [p.id, p]));
    }

    let previewMap: Record<string, { body: string; sender: string }> = {};
    if (conversationIds.length) {
      // Pega as mensagens mais recentes globalmente (ordenadas) e fica só com a
      // primeira ocorrência de cada conversa — suficiente pra popular o preview
      // sem 1 query por conversa. Limit generoso pra cobrir todas as conversas
      // listadas mesmo com atividade recente concentrada em poucas.
      const { data: msgs } = await withTimeout(
        supabaseAdmin
          .from("whatsapp_messages")
          .select("conversation_id, body, sender, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
          .limit(500)
      );
      for (const m of (msgs ?? []) as { conversation_id: string; body: string; sender: string }[]) {
        if (!previewMap[m.conversation_id]) previewMap[m.conversation_id] = { body: m.body, sender: m.sender };
      }
    }

    const result = rows.map(r => {
      const profile = r.contact_id ? profilesMap[r.contact_id] : undefined;
      return {
        ...r,
        full_name: profile?.full_name ?? "Desconhecido",
        avatar_url: profile?.avatar_url ?? null,
        last_message_preview: previewMap[r.id]?.body ?? null,
        last_message_sender: previewMap[r.id]?.sender ?? null,
      };
    });

    return res.json(result);
  } catch (err) {
    console.error("/api/admin/whatsapp/conversations error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.get("/conversations/:id/messages", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", req.params.id)
        .order("created_at", { ascending: true })
    );
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    console.error("/api/admin/whatsapp/conversations/:id/messages error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.post("/conversations/:id/assume", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await withTimeout(
      supabaseAdmin
        .from("whatsapp_conversations")
        .update({ status: "human_active" })
        .eq("id", req.params.id)
    );
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    console.error("/api/admin/whatsapp/conversations/:id/assume error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.post("/conversations/:id/return-to-bot", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await withTimeout(
      supabaseAdmin
        .from("whatsapp_conversations")
        .update({ status: "bot_active", handoff_reason: null })
        .eq("id", req.params.id)
    );
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    console.error("/api/admin/whatsapp/conversations/:id/return-to-bot error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.post("/conversations/:id/reply", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const body = (req.body?.body as string | undefined)?.trim();
    if (!body) return res.status(400).json({ error: "Mensagem vazia." });

    const { data: conv, error: convErr } = await withTimeout(
      supabaseAdmin.from("whatsapp_conversations").select("*").eq("id", req.params.id).maybeSingle()
    );
    if (convErr) throw convErr;
    if (!conv) return res.status(404).json({ error: "Conversa não encontrada." });

    const row = conv as ConversationRow;
    const result = await sendWhatsAppText(row.phone, body);
    if (!result.ok) return res.status(502).json({ error: `Falha ao enviar via WhatsApp: ${result.error}` });

    await insertMessage({ conversation_id: row.id, direction: "outbound", sender: "human", body });
    await touchConversation(row.id, row.status === "needs_human" ? { status: "human_active" } : {});

    return res.json({ ok: true });
  } catch (err) {
    console.error("/api/admin/whatsapp/conversations/:id/reply error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

router.post("/conversations/:id/suggest-reply", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { data: conv, error: convErr } = await withTimeout(
      supabaseAdmin.from("whatsapp_conversations").select("*").eq("id", req.params.id).maybeSingle()
    );
    if (convErr) throw convErr;
    if (!conv) return res.status(404).json({ error: "Conversa não encontrada." });

    const row = conv as ConversationRow;
    if (row.status !== "needs_human" && row.status !== "human_active") {
      return res.status(400).json({ error: "Sugestão só disponível para conversas em atendimento humano." });
    }

    const { data: profile } = row.contact_id
      ? await withTimeout(supabaseAdmin.from("profiles").select("full_name, city").eq("id", row.contact_id).maybeSingle())
      : { data: null };
    const name = (profile as { full_name?: string } | null)?.full_name ?? "Desconhecido";
    const city = (profile as { city?: string } | null)?.city ?? "não informada";

    const { data: msgs } = await withTimeout(
      supabaseAdmin
        .from("whatsapp_messages")
        .select("sender, body")
        .eq("conversation_id", row.id)
        .order("created_at", { ascending: false })
        .limit(10)
    );
    const history = ((msgs ?? []) as { sender: string; body: string }[]).reverse();
    const historyText = history.map(m => `${m.sender}: ${m.body}`).join("\n");

    const aiRes = await withTimeout(
      anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 300,
        system:
          "Você é um assistente que ajuda atendentes humanos da MeloCalé (plataforma de serviços domésticos no interior da Bahia) a responder clientes/profissionais no WhatsApp. Sugira uma resposta empática, específica pro caso e objetiva, em português informal mas profissional. Responda APENAS com o texto da mensagem sugerida, sem aspas nem comentários.",
        messages: [
          {
            role: "user",
            content: `Contato: ${name}. Cidade: ${city}. Campanha: ${row.campaign ?? "nenhuma"}. Motivo do handoff: ${row.handoff_reason ?? "não informado"}. Humor detectado: ${row.mood ?? "neutro"}.\n\nHistórico recente:\n${historyText || "(sem histórico)"}`,
          },
        ],
      }),
      15_000
    );
    const suggestion = aiRes.content[0].type === "text" ? aiRes.content[0].text.trim() : "";
    return res.json({ suggestion });
  } catch (err) {
    console.error("/api/admin/whatsapp/conversations/:id/suggest-reply error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Erro interno." });
  }
});

export default router;
