import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Send, User, MoreVertical, Paperclip, Smile, CheckCheck, Check, Loader2, Mic, Image as ImageIcon, Trash2, X, Square, Download } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '../../services/dbServices';
import { supabase } from '../../lib/supabase';

interface MessageAttachments {
  type: 'image' | 'file' | 'audio';
  fileName?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: string;
  body: string;
  created_at: string;
  read_at: string | null;
  attachments: MessageAttachments | null;
}

interface ProfileData {
  full_name: string | null;
  avatar_url: string | null;
}

interface ConversationWithProfiles {
  id: string;
  professional_id: string;
  client_id: string;
  lead_id: string | null;
  last_message_at: string | null;
  last_message: string | null;
  unread_for_prof: number | null;
  created_at: string;
  prof_user_id: string | null;
  prof_profile: ProfileData | null;
  client_profile: ProfileData | null;
}

export default function ProfessionalMensagens() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingChannel = useRef<any>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUser(user);
    });
  }, []);

  const { data: chats, isLoading: chatsLoading } = useQuery({
    queryKey: ['chats'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: chatService.getChats,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', activeConversationId],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => activeConversationId ? chatService.getMessages(activeConversationId) : Promise.resolve([]),
    enabled: !!activeConversationId,
  });

  const activeConversation = (chats as ConversationWithProfiles[] | undefined)?.find(c => c.id === activeConversationId);
  // client_id = clients.id = auth user UUID, so it is the correct recipientId directly
  const recipientId = activeConversation?.client_id ?? undefined;
  const otherName = activeConversation?.client_profile?.full_name || 'Cliente';
  const otherAvatar = activeConversation?.client_profile?.avatar_url;
  const isOtherUserOnline = onlineUsers.includes(activeConversation?.client_id ?? '');

  const sendMessageMutation = useMutation({
    mutationFn: ({ text }: { text: string }) =>
      chatService.sendMessage(activeConversationId!, text, 'text', undefined, recipientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      setMessageInput('');
      scrollToBottom();
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: chatService.deleteChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      setActiveConversationId(null);
      setIsMenuOpen(false);
      toast.success('Conversa excluída com sucesso!');
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chatId');
    if (chatIdFromUrl && chatIdFromUrl !== 'null' && chatIdFromUrl.length > 10) {
      setActiveConversationId(chatIdFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

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
    return () => { supabase.removeChannel(channel); };
  }, [activeConversationId, queryClient]);

  // Typing indicator channel
  useEffect(() => {
    if (!activeConversationId || !currentUser) return;
    const ch = supabase.channel(`typing:${activeConversationId}`);
    typingChannel.current = ch;
    ch.on('broadcast', { event: 'typing' }, ({ payload }: { payload: { userId: string } }) => {
      if (payload.userId !== currentUser.id) {
        setIsTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setIsTyping(false), 2000);
      }
    }).subscribe();
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      supabase.removeChannel(ch);
      typingChannel.current = null;
    };
  }, [activeConversationId, currentUser]);

  // Presence: track who is online
  useEffect(() => {
    if (!currentUser) return;
    const ch = supabase.channel('online_users');
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const ids = Object.values(state).flat().map((p: any) => p.user_id as string);
      setOnlineUsers(ids);
    }).subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ user_id: currentUser.id, online_at: new Date().toISOString() });
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [currentUser]);

  // Mark incoming messages as read when conversation opens
  useEffect(() => {
    if (!activeConversationId) return;
    supabase.rpc('mark_messages_read', {
      p_conversation_id: activeConversationId,
      p_sender_type: 'professional',
    }).then(() => { queryClient.invalidateQueries({ queryKey: ['chats'] }); });
  }, [activeConversationId]);

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageInput.trim() || !activeConversationId) return;
    sendMessageMutation.mutate({ text: messageInput });
  };

  const handleFileUpload = async (file: File, type: 'image' | 'file') => {
    if (!activeConversationId) return;
    setIsUploading(true);
    try {
      const url = await chatService.uploadChatFile(activeConversationId, file);
      await chatService.sendMessage(activeConversationId, url, type, file.name, recipientId);
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
          await chatService.sendMessage(convId, url, 'audio', file.name, recpId);
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
    } catch (err) {
      toast.error('Erro ao acessar microfone. Verifique as permissões.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const isMyMessage = (msg: Message) => msg.sender_type === 'professional';

  const renderMessageContent = (msg: Message) => {
    const att = Array.isArray(msg.attachments) ? msg.attachments[0] : msg.attachments;
    if (att?.type === 'image') {
      return (
        <img
          src={msg.body}
          alt="Foto"
          className="max-w-full rounded-xl max-h-64 object-cover cursor-pointer"
          onClick={() => window.open(msg.body, '_blank')}
        />
      );
    }
    if (att?.type === 'audio') {
      return <audio controls src={msg.body} className="max-w-full min-w-[200px]" />;
    }
    if (att?.type === 'file') {
      return (
        <a
          href={msg.body}
          download={att.fileName}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-sm underline hover:no-underline"
        >
          <Download size={14} />
          {att.fileName || 'Arquivo'}
        </a>
      );
    }
    return <span>{msg.body}</span>;
  };

  const emojis = ['👍', '🤝', '✅', '🏠', '🛠️', '🎨', '📐', '💰', '📅', '📍'];

  return (
    <div className="h-[calc(100vh-140px)] flex bg-[#1C3454] border border-[#1C3050] rounded-3xl overflow-hidden shadow-2xl relative animate-in fade-in duration-500">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'image'); e.target.value = ''; }}
      />
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'file'); e.target.value = ''; }}
      />

      {/* Sidebar */}
      <div className="w-full md:w-80 lg:w-96 border-r border-[#1C3050] flex flex-col shrink-0 bg-[#0E1C32]">
        <div className="p-6 border-b border-[#1C3050] bg-[#1C3454]/40 backdrop-blur-xl">
          <h2 className="text-xl font-bold text-white mb-4">Mensagens</h2>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Buscar conversas..."
              className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {chatsLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
              <Loader2 className="animate-spin text-emerald-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580]">Carregando chats...</p>
            </div>
          ) : chats && chats.length > 0 ? (
            (chats as ConversationWithProfiles[]).filter(conv => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return (
                conv.client_profile?.full_name?.toLowerCase().includes(q) ||
                conv.last_message?.toLowerCase().includes(q)
              );
            }).map(conv => {
              const clientName = conv.client_profile?.full_name || 'Cliente';
              const clientAvatar = conv.client_profile?.avatar_url;
              const isOnline = onlineUsers.includes(conv.client_id);
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  className={cn(
                    'w-full p-6 flex items-start gap-4 transition-all border-b border-white/[0.02] relative',
                    activeConversationId === conv.id ? 'bg-emerald-500/5' : 'hover:bg-white/[0.02]',
                  )}
                >
                  {activeConversationId === conv.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                  )}
                  <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center shrink-0 border border-[#1C3050] relative overflow-hidden">
                    {clientAvatar
                      ? <img src={clientAvatar} alt={clientName} className="w-full h-full object-cover" />
                      : <User className="text-[#4A6580]" size={24} />
                    }
                    <div className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-[#1C3454] rounded-full',
                      isOnline ? 'bg-emerald-500' : 'bg-slate-600',
                    )} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-sm font-bold text-white truncate">{clientName}</h4>
                      <span className="text-[10px] text-[#4A6580] font-bold">
                        {new Date(conv.last_message_at ?? conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-xs text-[#4A6580] truncate font-medium">
                        {conv.last_message ? conv.last_message : conv.last_message_at ? '...' : 'Sem mensagens ainda'}
                      </p>
                      {(conv.unread_for_prof ?? 0) > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shadow-lg shadow-emerald-500/20">
                          {conv.unread_for_prof}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-12 text-center">
              <p className="text-xs text-[#4A6580] font-bold uppercase tracking-widest">Nenhuma conversa encontrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Área do Chat */}
      {activeConversation ? (
        <div className="flex-1 flex flex-col bg-[#0E1C32]/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full" />

          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-[#1C3050] flex items-center justify-between bg-[#1C3454]/80 backdrop-blur-xl z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center shrink-0 border border-[#1C3050] overflow-hidden">
                {otherAvatar
                  ? <img src={otherAvatar} alt={otherName} className="w-full h-full object-cover" />
                  : <User className="text-[#4A6580]" size={24} />
                }
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">{otherName}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    isOtherUserOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600',
                  )} />
                  <span className={cn(
                    'text-[10px] font-bold uppercase tracking-widest',
                    isOtherUserOnline ? 'text-emerald-500' : 'text-slate-500',
                  )}>
                    {isOtherUserOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2.5 text-[#4A6580] hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
              >
                <MoreVertical size={20} />
              </button>

              {isMenuOpen && (
                <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setIsMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-[#1C3454] border border-[#243F6A] rounded-2xl shadow-2xl z-[9999] overflow-hidden animate-in zoom-in-95 duration-200">
                  <button
                    onClick={() => { setShowProfileModal(true); setIsMenuOpen(false); }}
                    className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-3 transition-colors"
                  >
                    <User size={16} /> Ver Perfil do Cliente
                  </button>
                  <div className="h-px bg-white/5 mx-3" />
                  <button
                    onClick={() => {
                      if (!window.confirm('Excluir esta conversa? Esta ação não pode ser desfeita.')) return;
                      deleteChatMutation.mutate(activeConversationId!);
                    }}
                    disabled={deleteChatMutation.isPending}
                    className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors font-bold disabled:opacity-50"
                  >
                    <Trash2 size={16} /> {deleteChatMutation.isPending ? 'Excluindo...' : 'Excluir Conversa'}
                  </button>
                </div>
                </>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
            {messagesLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-emerald-500" size={32} />
              </div>
            ) : messages && messages.length > 0 ? (
              (messages as Message[]).map((msg) => {
                const mine = isMyMessage(msg);
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex flex-col max-w-[85%] sm:max-w-[70%] group animate-in slide-in-from-bottom-2',
                      mine ? 'ml-auto items-end' : 'mr-auto items-start',
                    )}
                  >
                    <div className={cn(
                      'p-4 rounded-2xl text-[13px] leading-relaxed relative shadow-lg',
                      mine
                        ? 'bg-emerald-600 text-white rounded-tr-sm'
                        : 'bg-[#1C3454] text-slate-200 border border-[#1C3050] rounded-tl-sm hover:border-emerald-500/30 transition-colors',
                    )}>
                      {renderMessageContent(msg)}
                    </div>
                    <div className="flex items-center gap-2 mt-2 px-1">
                      <span className="text-[10px] text-[#4A6580] font-bold uppercase tracking-wider">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {mine && (
                        <div className="flex items-center">
                          {msg.read_at
                            ? <CheckCheck size={14} className="text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.5)]" />
                            : <Check size={14} className="text-slate-600" />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mb-6 text-emerald-500 border border-emerald-500/20 shadow-2xl">
                  <Send size={32} />
                </div>
                <h4 className="text-white font-bold text-lg mb-2">Sem mensagens ainda</h4>
                <p className="text-[#4A6580] font-medium text-sm max-w-[200px]">Inicie uma conversa com o cliente para fechar o serviço.</p>
              </div>
            )}

            {isTyping && (
              <div className="flex flex-col items-start max-w-[70%] animate-in slide-in-from-bottom-2 duration-300">
                <div className="bg-[#1C3454] text-[#94A3B8] py-3 px-5 rounded-2xl rounded-tl-sm border border-[#1C3050] flex items-center gap-3 shadow-lg">
                  <div className="flex gap-1 pt-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter">
                    <span className="text-emerald-500">{otherName}</span> está digitando...
                  </p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-6 pb-8 border-t border-[#1C3050] bg-[#1C3454]/80 backdrop-blur-xl z-20 relative">
            {showEmojiPicker && (
              <div className="absolute bottom-28 left-6 right-6 p-4 bg-[#1C3454] border border-[#243F6A] rounded-2xl shadow-2xl flex flex-wrap gap-2 animate-in slide-in-from-bottom-4 duration-300 border-b-4 border-b-emerald-500/20">
                {emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => { setMessageInput(prev => prev + emoji); setShowEmojiPicker(false); }}
                    className="text-2xl hover:scale-125 transition-transform p-2 bg-white/5 rounded-xl hover:bg-emerald-500/20"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => setShowEmojiPicker(false)}
                  className="absolute -top-3 -right-3 w-8 h-8 bg-black border border-[#243F6A] rounded-full flex items-center justify-center text-[#4A6580] hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white/5 py-1 px-1.5 rounded-[1.25rem] border border-[#1C3050] shadow-inner">
                {isRecording ? (
                  <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 rounded-xl border border-red-500/20 animate-pulse">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-xs font-mono font-bold text-red-500">
                      {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                    </span>
                    <button type="button" onClick={stopRecording} className="p-1 hover:bg-black/20 rounded-md text-red-500">
                      <Square size={16} fill="currentColor" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={isUploading}
                      className="p-3 text-[#4A6580] hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all disabled:opacity-50"
                      title="Gravar Áudio"
                    >
                      {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isUploading}
                      className="p-3 text-[#4A6580] hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all disabled:opacity-50"
                      title="Enviar Foto"
                    >
                      <ImageIcon size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="p-3 text-[#4A6580] hover:text-purple-500 hover:bg-purple-500/10 rounded-xl transition-all disabled:opacity-50"
                      title="Enviar Arquivo"
                    >
                      <Paperclip size={20} />
                    </button>
                  </>
                )}
              </div>

              <div className="flex-1 relative group">
                <input
                  value={messageInput}
                  onChange={e => {
                    setMessageInput(e.target.value);
                    if (typingChannel.current && currentUser) {
                      typingChannel.current.send({
                        type: 'broadcast',
                        event: 'typing',
                        payload: { userId: currentUser.id },
                      });
                    }
                  }}
                  placeholder="Escreva algo para o cliente..."
                  className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-[1.25rem] py-4 px-6 pr-14 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all font-medium shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={cn('absolute right-4 top-1/2 -translate-y-1/2 transition-colors', showEmojiPicker ? 'text-yellow-500' : 'text-slate-600 hover:text-yellow-500')}
                >
                  <Smile size={24} />
                </button>
              </div>

              <button
                disabled={!messageInput.trim() || sendMessageMutation.isPending}
                type="submit"
                className="w-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[1.25rem] flex items-center justify-center transition-all shadow-xl shadow-emerald-500/20 disabled:grayscale disabled:opacity-30 disabled:cursor-not-allowed shrink-0 relative active:scale-90"
              >
                <Send size={22} className="translate-x-0.5 -translate-y-0.5" />
                {sendMessageMutation.isPending && <div className="absolute inset-0 bg-emerald-500/20 rounded-[1.25rem] animate-pulse" />}
              </button>
            </form>
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-4 text-center">As mensagens são criptografadas de ponta a ponta</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#0E1C32]/20">
          <div className="w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-[2.5rem] flex items-center justify-center mb-8 text-emerald-500 border border-[#1C3050] shadow-2xl relative group">
            <User size={48} />
            <div className="absolute inset-0 bg-emerald-500/10 rounded-[2.5rem] animate-ping opacity-20" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">Suas Conversas Ativas</h3>
          <p className="text-[#4A6580] max-w-sm font-medium leading-relaxed">
            Selecione um cliente ao lado para negociar orçamentos, enviar fotos dos serviços realizados e fechar novos negócios.
          </p>
          <div className="mt-12 flex gap-4">
            <div className="flex flex-col items-center gap-1 opacity-40">
              <Mic size={20} className="text-[#4A6580]" />
              <span className="text-[8px] font-bold uppercase">Áudio</span>
            </div>
            <div className="flex flex-col items-center gap-1 opacity-40">
              <ImageIcon size={20} className="text-[#4A6580]" />
              <span className="text-[8px] font-bold uppercase">Fotos</span>
            </div>
            <div className="flex flex-col items-center gap-1 opacity-40">
              <Paperclip size={20} className="text-[#4A6580]" />
              <span className="text-[8px] font-bold uppercase">Arquivos</span>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && activeConversation && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="bg-[#132540] border border-[#243F6A] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-lg">Perfil do Cliente</h3>
              <button onClick={() => setShowProfileModal(false)} className="text-[#4A6580] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              {activeConversation.client_profile?.avatar_url ? (
                <img src={activeConversation.client_profile.avatar_url} alt="avatar" className="w-20 h-20 rounded-full object-cover border-2 border-[#243F6A]" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#1C3454] border-2 border-[#243F6A] flex items-center justify-center">
                  <User size={32} className="text-[#4A6580]" />
                </div>
              )}
              <div className="text-center">
                <p className="text-white font-bold text-xl">{activeConversation.client_profile?.full_name || 'Cliente'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
