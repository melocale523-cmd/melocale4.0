import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';

interface VConversationRow {
  id: string;
  client_id?: string | null;
  professional_id?: string | null;
  professional_user_id?: string | null;
  lead_id?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
  unread_for_prof?: number | null;
  unread_for_client?: number | null;
  last_message?: string | null;
  prof_full_name?: string | null;
  prof_avatar_url?: string | null;
  client_full_name?: string | null;
  client_avatar_url?: string | null;
}

export const chatService = {
  async getChats() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('v_conversations')
      .select('id,client_id,professional_id,professional_user_id,lead_id,last_message_at,created_at,unread_for_prof,unread_for_client,last_message,prof_full_name,prof_avatar_url,client_full_name,client_avatar_url')
      .or(`client_id.eq.${user.id},professional_user_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) throw error;
    const mapped = (data ?? []).map((conv: VConversationRow) => ({
      id: conv.id,
      client_id: conv.client_id,
      professional_id: conv.professional_id,
      professional_user_id: conv.professional_user_id,
      lead_id: conv.lead_id,
      last_message_at: conv.last_message_at,
      created_at: conv.created_at,
      unread_for_prof: conv.unread_for_prof,
      last_message: conv.last_message ?? null,
      unread_client: conv.unread_for_client ?? 0,
      prof_user_id: conv.professional_user_id ?? null,
      prof_profile: conv.prof_full_name || conv.prof_avatar_url
        ? { full_name: conv.prof_full_name ?? null, avatar_url: conv.prof_avatar_url ?? null }
        : null,
      client_profile: {
        full_name: conv.client_full_name ?? null,
        avatar_url: conv.client_avatar_url ?? null,
      },
      leadTitle: null as string | null,
    }));

    const leadIds = [...new Set(mapped.map(c => c.lead_id).filter((id): id is string => !!id))];
    if (leadIds.length > 0) {
      const { data: leads } = await supabase
        .from('leads')
        .select('id, title')
        .in('id', leadIds);
      if (leads) {
        const leadMap = Object.fromEntries(
          (leads as { id: string; title: string | null }[]).map(l => [l.id, l.title])
        );
        mapped.forEach(c => { c.leadTitle = c.lead_id ? (leadMap[c.lead_id] ?? null) : null; });
      }
    }

    return mapped;
  },

  async uploadChatFile(conversationId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `chats/${conversationId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('chat-files').upload(path, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(path);
    return publicUrl;
  },

  async getMessages(conversationId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('id,conversation_id,body,sender_type,attachments,read_at,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(0, 99);
    if (error) throw error;
    return data || [];
  },

  async sendMessage(conversationId: string, text: string, type: string = 'text', fileName?: string, recipientId?: string, role?: 'client' | 'professional') {
    const { data: { user } } = await supabase.auth.getUser();

    // role is passed by callers who already know it (eliminates the extra DB round-trip).
    const senderType = role ?? 'user';

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        body: text,
        sender_type: senderType,
        attachments: type !== 'text' ? [{ type, fileName, url: text }] : [],
      })
      .select('id,conversation_id,body,sender_type,attachments,read_at,created_at')
      .single();
    if (error) throw error;

    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    // Always notify — backend determines the target from the conversation.
    // recipientId guard kept only to skip self-notifications (same user in both sides, edge case).
    if (user && (!recipientId || recipientId !== user.id)) {
      const message_preview = type === 'text'
        ? (text.length > 100 ? text.substring(0, 97) + '...' : text)
        : type === 'image' ? '📷 Foto'
        : type === 'audio' ? '🎤 Áudio'
        : `📎 ${fileName || 'Arquivo'}`;
      try {
        await apiFetch('/api/notifications/send-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: 'message_sent', resource_id: conversationId, message_preview }),
        });
      } catch (err) {
        console.error('[sendMessage] send-event failed:', err);
      }
    }
    return data;
  },

  async deleteChat(conversationId: string) {
    const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
    if (error) throw error;
    return true;
  }
};
