import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface UseChatRealtimeParams {
  activeConversationId: string | null;
  currentUser: { id: string } | null;
  role: 'professional' | 'client';
  onTyping: (isTyping: boolean) => void;
  onOnlineUsers: (ids: string[]) => void;
}

export function useChatRealtime({
  activeConversationId,
  currentUser,
  role,
  onTyping,
  onOnlineUsers,
}: UseChatRealtimeParams) {
  const queryClient = useQueryClient();
  const typingChannel = useRef<RealtimeChannel | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Realtime new messages
  useEffect(() => {
    if (!activeConversationId) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    };
    const channel = supabase
      .channel(`messages:${activeConversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeConversationId}`,
      }, invalidate)
      .subscribe();
    return () => { channel.unsubscribe(); supabase.removeChannel(channel); };
  }, [activeConversationId, queryClient]);

  // Typing indicator
  useEffect(() => {
    if (!activeConversationId || !currentUser) return;
    const ch = supabase.channel(`typing:${activeConversationId}`);
    typingChannel.current = ch;
    ch.on('broadcast', { event: 'typing' }, ({ payload }: { payload: { userId: string } }) => {
      if (payload.userId !== currentUser.id) {
        onTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => onTyping(false), 2000);
      }
    }).subscribe();
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      ch.unsubscribe();
      supabase.removeChannel(ch);
      typingChannel.current = null;
    };
  }, [activeConversationId, currentUser, onTyping]);

  // Presence
  useEffect(() => {
    if (!currentUser || !activeConversationId) return;
    const ch = supabase.channel(`presence:conv:${activeConversationId}`);
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const ids = Object.values(state).flat().map((p) => (p as unknown as { user_id: string }).user_id);
      onOnlineUsers(ids);
    }).subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ user_id: currentUser.id, online_at: new Date().toISOString() });
      }
    });
    return () => { ch.unsubscribe(); supabase.removeChannel(ch); };
  }, [activeConversationId, currentUser, onOnlineUsers]);

  // Mark messages as read
  useEffect(() => {
    if (!activeConversationId) return;
    supabase.rpc('mark_messages_read', {
      p_conversation_id: activeConversationId,
      p_sender_type: role,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      if (role === 'client') {
        queryClient.invalidateQueries({ queryKey: ['client_unread_count'] });
      } else if (role === 'professional') {
        queryClient.invalidateQueries({ queryKey: ['unread_count'] });
      }
    });
  }, [activeConversationId, role, queryClient]);

  return { typingChannel };
}
