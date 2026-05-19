import { useState, useRef } from 'react';
import type { MutableRefObject, FormEvent } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { chatService } from '../services/dbServices';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/compressImage';
import type { Message } from '../types/chat';

interface UseChatMessagesParams {
  activeConversationId: string | null;
  role: 'professional' | 'client';
  currentUser: { id: string } | null;
  recipientId: string | undefined;
  typingChannel: MutableRefObject<RealtimeChannel | null>;
  scrollToBottom: () => void;
  onDeleteSuccess: () => void;
}

export function useChatMessages({
  activeConversationId,
  role,
  currentUser,
  recipientId,
  typingChannel,
  scrollToBottom,
  onDeleteSuccess,
}: UseChatMessagesParams) {
  const queryClient = useQueryClient();
  const [messageInput, setMessageInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const queryOptions = role === 'professional'
    ? { retry: false as const, refetchOnWindowFocus: false as const }
    : {};

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', activeConversationId],
    queryFn: () =>
      activeConversationId
        ? chatService.getMessages(activeConversationId)
        : Promise.resolve([]),
    enabled: !!activeConversationId,
    ...queryOptions,
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({ text }: { text: string }) =>
      chatService.sendMessage(activeConversationId!, text, 'text', undefined, recipientId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      setMessageInput('');
      scrollToBottom();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar mensagem. Tente novamente.');
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: chatService.deleteChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      onDeleteSuccess();
      toast.success('Conversa excluída com sucesso!');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir conversa. Tente novamente.');
    },
  });

  const handleSendMessage = (e?: FormEvent) => {
    e?.preventDefault();
    if (!messageInput.trim() || !activeConversationId) return;
    sendMessageMutation.mutate({ text: messageInput });
  };

  const handleTypingBroadcast = () => {
    if (typingChannel.current && currentUser) {
      typingChannel.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUser.id },
      });
    }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'file') => {
    if (!activeConversationId) return;
    setIsUploading(true);
    try {
      let fileToUpload = file;
      if (type === 'image') {
        try { fileToUpload = await compressImage(file); } catch { /* fallback silencioso */ }
      }
      const url = await chatService.uploadChatFile(activeConversationId, fileToUpload);
      await chatService.sendMessage(activeConversationId, url, type, file.name, recipientId, role);
      queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      scrollToBottom();
      toast.success(type === 'image' ? 'Foto enviada!' : 'Arquivo enviado!');
    } catch {
      toast.error('Erro ao enviar arquivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = async () => {
    const convId = activeConversationId;
    const recpId = recipientId;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        if (!convId) return;
        setIsUploading(true);
        try {
          const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
          const url = await chatService.uploadChatFile(convId, file);
          await chatService.sendMessage(convId, url, 'audio', file.name, recpId, role);
          queryClient.invalidateQueries({ queryKey: ['messages', convId] });
          queryClient.invalidateQueries({ queryKey: ['chats'] });
          scrollToBottom();
          toast.success('Áudio enviado!');
        } catch {
          toast.error('Erro ao enviar áudio.');
        } finally {
          setIsUploading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err: unknown) {
      if (role === 'professional') {
        const e = err as { name?: string; message?: string };
        if (e?.name === 'NotAllowedError') {
          toast.error('Permissão de microfone negada. Habilite nas configurações do navegador.');
        } else if (e?.name === 'NotFoundError') {
          toast.error('Nenhum microfone encontrado.');
        } else {
          toast.error('Erro ao acessar microfone: ' + (e?.message ?? String(err)));
        }
      } else {
        toast.error('Erro ao acessar microfone. Verifique as permissões.');
      }
      if (import.meta.env.DEV) console.error('[startRecording]', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  return {
    messages: messages as Message[] | undefined,
    messagesLoading,
    messageInput,
    setMessageInput,
    isUploading,
    isRecording,
    recordingTime,
    sendMessageMutation,
    deleteChatMutation,
    handleSendMessage,
    handleTypingBroadcast,
    handleFileUpload,
    startRecording,
    stopRecording,
  };
}
