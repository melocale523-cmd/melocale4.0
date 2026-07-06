import { apiFetch } from '../lib/api';

export type ContactType = 'professional' | 'client' | 'unknown';
export type ConversationStatus = 'bot_active' | 'needs_human' | 'human_active' | 'resolved';
export type Mood = 'positive' | 'neutral' | 'negative';

export interface WhatsAppConversation {
  id: string;
  phone: string;
  contact_id: string | null;
  contact_type: ContactType;
  campaign: string | null;
  status: ConversationStatus;
  handoff_reason: string | null;
  mood: Mood | null;
  last_message_at: string;
  created_at: string;
  full_name: string;
  avatar_url: string | null;
  last_message_preview: string | null;
  last_message_sender: string | null;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  sender: 'user' | 'bot' | 'human' | 'system';
  body: string;
  is_template: boolean;
  template_name: string | null;
  created_at: string;
}

export const whatsappConversationsService = {
  async listConversations(status?: ConversationStatus | 'all'): Promise<WhatsAppConversation[]> {
    const qs = status && status !== 'all' ? `?status=${status}` : '';
    const res = await apiFetch(`/api/admin/whatsapp/conversations${qs}`);
    if (!res.ok) throw new Error('Erro ao carregar conversas.');
    return res.json();
  },

  async getMessages(conversationId: string): Promise<WhatsAppMessage[]> {
    const res = await apiFetch(`/api/admin/whatsapp/conversations/${conversationId}/messages`);
    if (!res.ok) throw new Error('Erro ao carregar mensagens.');
    return res.json();
  },

  async assume(conversationId: string): Promise<void> {
    const res = await apiFetch(`/api/admin/whatsapp/conversations/${conversationId}/assume`, { method: 'POST' });
    if (!res.ok) throw new Error('Erro ao assumir conversa.');
  },

  async returnToBot(conversationId: string): Promise<void> {
    const res = await apiFetch(`/api/admin/whatsapp/conversations/${conversationId}/return-to-bot`, { method: 'POST' });
    if (!res.ok) throw new Error('Erro ao devolver conversa pro bot.');
  },

  async reply(conversationId: string, body: string): Promise<void> {
    const res = await apiFetch(`/api/admin/whatsapp/conversations/${conversationId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Erro ao enviar mensagem.');
  },

  async suggestReply(conversationId: string): Promise<string> {
    const res = await apiFetch(`/api/admin/whatsapp/conversations/${conversationId}/suggest-reply`, { method: 'POST' });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Erro ao gerar sugestão.');
    const data = await res.json();
    return data.suggestion as string;
  },
};
