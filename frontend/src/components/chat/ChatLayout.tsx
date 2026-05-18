import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Send, User, MoreVertical, Paperclip, Smile,
  CheckCheck, Check, Loader2, Mic, Image as ImageIcon,
  Trash2, Clock, X, Square, Download, CalendarPlus, MapPin, ChevronLeft,
  Star, Briefcase,
} from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { compressImage } from '../../lib/compressImage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService, appointmentService } from '../../services/dbServices';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface ChatLayoutProps {
  role: 'professional' | 'client';
}

interface ProfessionalProfile {
  id: string;
  bio: string | null;
  category: string | null;
  city: string | null;
  is_active: boolean;
}

interface ClientProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  total_leads: number;
  recent_leads: { id: string; title: string; status: string; created_at: string }[];
}

interface ProfessionalReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  client_name?: string | null;
}

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
  unread_client: number;
  created_at: string;
  prof_user_id: string | null;
  prof_profile: ProfileData | null;
  client_profile: ProfileData | null;
  leadTitle?: string | null;
}

function ProfileModal({ userId, name, avatar, onClose }: {
  userId: string;
  name: string;
  avatar: string | null | undefined;
  onClose: () => void;
}) {
  const [prof, setProf] = useState<ProfessionalProfile | null>(null);
  const [reviews, setReviews] = useState<ProfessionalReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('professionals')
      .select('id, bio, category, city, is_active')
      .eq('user_id', userId)
      .single()
      .then(({ data: profData }) => {
        setProf(profData);
        if (profData?.id) {
          return supabase
            .from('reviews')
            .select('id, rating, comment, created_at')
            .eq('professional_id', profData.id)
            .order('created_at', { ascending: false })
            .limit(5)
            .then(({ data }) => setReviews(data || []));
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#1C3454] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="h-20 bg-gradient-to-r from-slate-800 to-emerald-900/30 shrink-0" />
        <button type="button" onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-black/30 hover:bg-black/50 text-white transition-all">
          <X size={18} />
        </button>
        <div className="px-6 -mt-10 pb-4 border-b border-slate-700/50 shrink-0">
          <div className="flex items-end gap-4 mb-3">
            <div className="w-20 h-20 rounded-full border-4 border-[#1C3454] bg-emerald-600 flex items-center justify-center text-white font-bold text-xl overflow-hidden shrink-0">
              {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> : initials}
            </div>
            <div className="pb-1">
              <h3 className="text-xl font-black text-white">{name}</h3>
              {prof && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {prof.category && <span className="text-xs text-emerald-400 font-medium flex items-center gap-1"><Briefcase size={12} /> {prof.category}</span>}
                  {prof.city && <span className="text-xs text-[#94A3B8] flex items-center gap-1"><MapPin size={12} /> {prof.city}</span>}
                </div>
              )}
            </div>
          </div>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={14} className={s <= Math.round(avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600 fill-slate-600'} />
                ))}
              </div>
              <span className="text-yellow-400 font-bold text-sm">{avgRating.toFixed(1)}</span>
              <span className="text-[#4A6580] text-xs">({reviews.length} avaliação{reviews.length !== 1 ? 'ões' : ''})</span>
            </div>
          )}
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-emerald-500" size={28} /></div>
          ) : (
            <>
              {prof?.bio && (
                <div>
                  <p className="text-xs font-bold text-[#4A6580] uppercase tracking-widest mb-2">Sobre</p>
                  <p className="text-sm text-[#94A3B8] leading-relaxed">{prof.bio}</p>
                </div>
              )}
              {reviews.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-[#4A6580] uppercase tracking-widest mb-3">Avaliações</p>
                  <div className="space-y-3">
                    {reviews.map(r => (
                      <div key={r.id} className="bg-[#0E1C32] rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-200">{r.client_name ?? 'Cliente'}</span>
                          <span className="text-xs text-[#4A6580]">{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className="flex">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={12} className={s <= r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700 fill-slate-700'} />
                          ))}
                        </div>
                        {r.comment && <p className="text-xs text-[#94A3B8]">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!prof?.bio && reviews.length === 0 && !loading && (
                <p className="text-center text-[#4A6580] text-sm py-4">Nenhuma informação adicional disponível.</p>
              )}
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-700/50 shrink-0">
          <button type="button" onClick={onClose}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all text-sm">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatLayout({ role }: ChatLayoutProps) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [profileModal, setProfileModal] = useState<{
    userId: string;
    name: string;
    avatar: string | null | undefined;
  } | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
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

  const [showDeleteConvModal, setShowDeleteConvModal] = useState(false);
  const [clientProfileModal, setClientProfileModal] = useState<ClientProfile | null>(null);

  // Professional-only state
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentClient, setAppointmentClient] = useState<{ id: string; name: string } | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    location: '',
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingChannel = useRef<RealtimeChannel | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  // --- Role-derived values ---
  const otherLabel = role === 'professional' ? 'Cliente' : 'Profissional';
  const inputPlaceholder = role === 'professional'
    ? 'Escreva algo para o cliente...'
    : 'Escreva algo para o profissional...';
  const emptyStateTitle = role === 'professional'
    ? 'Suas Conversas Ativas'
    : 'Seu Canal de Comunicação';
  const emptyStateDescription = role === 'professional'
    ? 'Selecione um cliente ao lado para negociar orçamentos, enviar fotos dos serviços realizados e fechar novos negócios.'
    : 'Selecione um profissional ao lado para negociar detalhes técnicos, aprovar orçamentos e acompanhar a execução do seu projeto.';
  const menuProfileLabel = role === 'professional'
    ? 'Ver Perfil do Cliente'
    : 'Ver Perfil do Profissional';

  const getOtherName = (conv: ConversationWithProfiles) =>
    role === 'professional'
      ? conv.client_profile?.full_name || 'Cliente'
      : conv.prof_profile?.full_name || 'Profissional';

  const getOtherAvatar = (conv: ConversationWithProfiles) =>
    role === 'professional'
      ? conv.client_profile?.avatar_url
      : conv.prof_profile?.avatar_url;

  const getOtherUserId = (conv: ConversationWithProfiles) =>
    role === 'professional'
      ? conv.client_id
      : conv.prof_user_id;

  const getRecipientId = (conv: ConversationWithProfiles) =>
    role === 'professional'
      ? conv.client_id
      : conv.prof_user_id ?? undefined;

  const getUnreadCount = (conv: ConversationWithProfiles) =>
    role === 'professional'
      ? (conv.unread_for_prof ?? 0)
      : (conv.unread_client ?? 0);

  const getSearchName = (conv: ConversationWithProfiles) =>
    role === 'professional'
      ? conv.client_profile?.full_name
      : conv.prof_profile?.full_name;

  const isMyMessage = (msg: Message) => msg.sender_type === role;

  // --- Query options ---
  const queryOptions = role === 'professional'
    ? { retry: false as const, refetchOnWindowFocus: false as const }
    : {};

  // --- Auth ---
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) setCurrentUser(user);
    });
    return () => { cancelled = true; };
  }, []);

  // --- Professional ID (for scheduling) ---
  const { data: professional } = useQuery({
    queryKey: ['my_professional_id', currentUser?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('professionals')
        .select('id')
        .eq('user_id', currentUser!.id)
        .maybeSingle();
      return data;
    },
    enabled: role === 'professional' && !!currentUser?.id,
  });

  // --- Scheduling (professional only) ---
  const scheduleMutation = useMutation({
    mutationFn: ({ clientId, conversationId }: { clientId: string; conversationId: string }) =>
      appointmentService.createAppointment({
        professional_id: professional!.id,
        client_id: clientId,
        conversation_id: conversationId,
        scheduled_at: new Date(`${scheduleForm.date}T${scheduleForm.time}:00`).toISOString(),
        title: scheduleForm.title,
        location: scheduleForm.location || undefined,
      }),
    onSuccess: () => {
      toast.success('Agendamento criado! O cliente foi notificado.');
      setScheduleModalOpen(false);
      setShowAppointmentModal(false);
      setAppointmentClient(null);
      setScheduleForm({ title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '09:00', location: '' });
    },
    onError: () => toast.error('Erro ao criar agendamento'),
  });

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.title) { toast.error('Informe o título do serviço'); return; }
    if (!professional?.id) { toast.error('Perfil profissional não carregado'); return; }
    if (!activeConversation) return;
    scheduleMutation.mutate({
      clientId: activeConversation.client_id,
      conversationId: activeConversation.id,
    });
  };

  // --- Queries ---
  const { data: chats, isLoading: chatsLoading } = useQuery({
    queryKey: ['chats'],
    queryFn: chatService.getChats,
    ...queryOptions,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', activeConversationId],
    queryFn: () => activeConversationId ? chatService.getMessages(activeConversationId) : Promise.resolve([]),
    enabled: !!activeConversationId,
    ...queryOptions,
  });

  const activeConversation = (chats as ConversationWithProfiles[] | undefined)?.find(c => c.id === activeConversationId);
  const recipientId = activeConversation ? getRecipientId(activeConversation) : undefined;
  const otherName = activeConversation ? getOtherName(activeConversation) : otherLabel;
  const otherAvatar = activeConversation ? getOtherAvatar(activeConversation) : undefined;
  const isOtherUserOnline = activeConversation
    ? onlineUsers.includes(getOtherUserId(activeConversation) ?? '')
    : false;

  // --- Mutations ---
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
      setActiveConversationId(null);
      setIsMenuOpen(false);
      toast.success('Conversa excluída com sucesso!');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir conversa. Tente novamente.');
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // --- URL param ---
  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chatId');
    if (chatIdFromUrl && chatIdFromUrl !== 'null' && chatIdFromUrl.length > 10) {
      setActiveConversationId(chatIdFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // --- Realtime new messages ---
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

  // --- Typing indicator ---
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
      ch.unsubscribe();
      supabase.removeChannel(ch);
      typingChannel.current = null;
    };
  }, [activeConversationId, currentUser]);

  // --- Presence (canal por conversa — não cresce com o número de usuários globais) ---
  useEffect(() => {
    if (!currentUser || !activeConversationId) return;
    const ch = supabase.channel(`presence:conv:${activeConversationId}`);
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const ids = Object.values(state).flat().map((p) => (p as unknown as { user_id: string }).user_id);
      setOnlineUsers(ids);
    }).subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ user_id: currentUser.id, online_at: new Date().toISOString() });
      }
    });
    return () => { ch.unsubscribe(); supabase.removeChannel(ch); };
  }, [activeConversationId, currentUser]);

  // --- Mark messages as read ---
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

  const loadClientProfile = async (clientId: string) => {
    const [profileRes, clientRes, leadsRes, countRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url, city, created_at').eq('id', clientId).single(),
      supabase.from('clients').select('state').eq('id', clientId).maybeSingle(),
      supabase.from('leads').select('id, title, status, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    ]);
    if (profileRes.error || !profileRes.data) return;
    setClientProfileModal({
      ...profileRes.data,
      state: clientRes.data?.state ?? null,
      total_leads: countRes.count ?? 0,
      recent_leads: leadsRes.data ?? [],
    });
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageInput.trim() || !activeConversationId) return;
    sendMessageMutation.mutate({ text: messageInput });
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
          toast.error('Erro ao acessar microfone: ' + (e?.message ?? err));
        }
      } else {
        toast.error('Erro ao acessar microfone. Verifique as permissões.');
      }
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

  function getFileName(url: string): string {
    const parts = url.split('/');
    const raw = decodeURIComponent(parts[parts.length - 1] || 'arquivo');
    const cleaned = raw.replace(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-?/i, '');
    const name = cleaned || 'arquivo';
    return name.length > 30 ? name.substring(0, 27) + '...' : name;
  }

  const renderMessageContent = (msg: Message) => {
    const att = Array.isArray(msg.attachments) ? msg.attachments[0] : msg.attachments;
    if (att?.type === 'image') {
      return (
        <img
          src={msg.body}
          alt="Foto"
          loading="lazy"
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
          {getFileName(msg.body)}
        </a>
      );
    }
    return <span>{msg.body}</span>;
  };

  const emojis = ['👍', '🤝', '✅', '🏠', '🛠️', '🎨', '📐', '💰', '📅', '📍'];

  return (
    <>
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
      <div className={`${showChat ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r border-[#1C3050] flex-col shrink-0 bg-[#0E1C32]`}>
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
                getSearchName(conv)?.toLowerCase().includes(q) ||
                conv.last_message?.toLowerCase().includes(q) ||
                conv.leadTitle?.toLowerCase().includes(q)
              );
            }).map(conv => {
              const name = getOtherName(conv);
              const avatar = getOtherAvatar(conv);
              const isOnline = onlineUsers.includes(getOtherUserId(conv) ?? '');
              const unread = getUnreadCount(conv);
              return (
                <button
                  key={conv.id}
                  onClick={() => { setActiveConversationId(conv.id); setShowChat(true); }}
                  className={cn(
                    'w-full p-6 flex items-start gap-4 transition-all border-b border-white/[0.02] relative',
                    activeConversationId === conv.id ? 'bg-emerald-500/5' : 'hover:bg-white/[0.02]',
                  )}
                >
                  {activeConversationId === conv.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                  )}
                  <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center shrink-0 border border-[#1C3050] relative overflow-hidden">
                    {avatar
                      ? <img src={avatar} alt={name} loading="lazy" className="w-full h-full object-cover" />
                      : <User className="text-[#4A6580]" size={24} />
                    }
                    <div className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-[#1C3454] rounded-full',
                      isOnline ? 'bg-emerald-500' : 'bg-slate-600',
                    )} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex justify-between items-center mb-1 gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{name}</h4>
                        {role === 'client' && conv.prof_user_id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProfileModal({
                                userId: conv.prof_user_id!,
                                name: getOtherName(conv),
                                avatar: getOtherAvatar(conv),
                              });
                            }}
                            className="text-[9px] font-bold text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/50 px-1.5 py-0.5 rounded-full transition-all shrink-0"
                          >
                            Ver perfil
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-[#4A6580] font-bold shrink-0">
                        {new Date(conv.last_message_at ?? conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {conv.leadTitle && (
                      <p className="text-xs text-emerald-400/70 truncate mt-0.5">📋 {conv.leadTitle}</p>
                    )}
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-xs text-[#4A6580] truncate font-medium">
                        {conv.last_message ? conv.last_message : conv.last_message_at ? '...' : 'Sem mensagens ainda'}
                      </p>
                      {unread > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shadow-lg shadow-emerald-500/20">
                          {unread}
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

      {/* Chat Area */}
      {activeConversation ? (
        <div className={`${showChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-[#0E1C32]/30 relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full" />

          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-[#1C3050] flex items-center justify-between bg-[#1C3454]/80 backdrop-blur-xl z-10">
            <div className="flex items-center gap-4">
              <button onClick={() => setShowChat(false)} className="md:hidden text-[#4A6580] hover:text-white transition-colors">
                <ChevronLeft size={22} />
              </button>
              <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center shrink-0 border border-[#1C3050] overflow-hidden">
                {otherAvatar
                  ? <img src={otherAvatar} alt={otherName} loading="lazy" className="w-full h-full object-cover" />
                  : <User className="text-[#4A6580]" size={24} />
                }
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white leading-tight">{otherName}</h3>
                  {role === 'client' && activeConversation.prof_user_id && (
                    <button
                      type="button"
                      onClick={() => setProfileModal({
                        userId: activeConversation.prof_user_id!,
                        name: otherName,
                        avatar: otherAvatar,
                      })}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/50 px-2 py-0.5 rounded-full transition-all shrink-0"
                    >
                      Ver perfil
                    </button>
                  )}
                </div>
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

            <div className="flex items-center gap-2">
              {role === 'professional' && (
                <button
                  onClick={() => {
                    setAppointmentClient({
                      id: activeConversation.client_id,
                      name: activeConversation.client_profile?.full_name || 'Cliente',
                    });
                    setShowAppointmentModal(true);
                  }}
                  className="p-2 rounded-xl hover:bg-white/5 text-[#4A6580] hover:text-emerald-400 transition-colors"
                  title="Agendar serviço"
                >
                  <CalendarPlus size={18} />
                </button>
              )}
              <div>
                <button
                  ref={menuButtonRef}
                  onClick={() => {
                    if (!isMenuOpen && menuButtonRef.current) {
                      const rect = menuButtonRef.current.getBoundingClientRect();
                      setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                    }
                    setIsMenuOpen(!isMenuOpen);
                  }}
                  className="p-2.5 text-[#4A6580] hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                >
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Lead banner */}
          {activeConversation?.leadTitle && (
            <div className="px-4 py-2 bg-[#0E1C32] border-b border-[#1C3050] flex items-center gap-2 z-10">
              <span className="text-xs text-emerald-400">📋</span>
              <span className="text-xs text-[#94A3B8]">Pedido:</span>
              <span className="text-xs font-medium text-white truncate">{activeConversation.leadTitle}</span>
            </div>
          )}

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
                <p className="text-[#4A6580] font-medium text-sm max-w-[200px]">Inicie uma conversa com o {otherLabel.toLowerCase()} para fechar o serviço.</p>
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

            {role === 'professional' ? (
              <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative group">
                    <input
                      value={messageInput}
                      maxLength={2000}
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
                      placeholder={inputPlaceholder}
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
                  </button>
                </div>
                <div className="flex items-center gap-1 px-1">
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
                      <button type="button" onClick={startRecording} disabled={isUploading} className="p-2.5 text-[#4A6580] hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all disabled:opacity-50" title="Gravar Áudio">
                        {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
                      </button>
                      <button type="button" onClick={() => imageInputRef.current?.click()} disabled={isUploading} className="p-2.5 text-[#4A6580] hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all disabled:opacity-50" title="Enviar Foto">
                        <ImageIcon size={20} />
                      </button>
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="p-2.5 text-[#4A6580] hover:text-purple-500 hover:bg-purple-500/10 rounded-xl transition-all disabled:opacity-50" title="Enviar Arquivo">
                        <Paperclip size={20} />
                      </button>
                      <button type="button" onClick={() => setScheduleModalOpen(true)} disabled={isUploading} className="p-2.5 text-[#4A6580] hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all disabled:opacity-50" title="Agendar Visita">
                        <CalendarPlus size={20} />
                      </button>
                    </>
                  )}
                </div>
              </form>
            ) : (
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
                    maxLength={2000}
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
                    placeholder={inputPlaceholder}
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
            )}
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-4 text-center">As mensagens são protegidas por SSL em trânsito</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#0E1C32]/20">
          <div className="w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-[2.5rem] flex items-center justify-center mb-8 text-emerald-500 border border-[#1C3050] shadow-2xl relative group">
            <User size={48} />
            <div className="absolute inset-0 bg-emerald-500/10 rounded-[2.5rem] animate-ping opacity-20" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">{emptyStateTitle}</h3>
          <p className="text-[#4A6580] max-w-sm font-medium leading-relaxed">
            {emptyStateDescription}
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

      {/* Schedule Modal (professional only) */}
      {role === 'professional' && (scheduleModalOpen || showAppointmentModal) && activeConversation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => { setScheduleModalOpen(false); setShowAppointmentModal(false); setAppointmentClient(null); }}
          />
          <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-500 rounded-lg">
                  <CalendarPlus size={20} />
                </div>
                Agendar Visita
              </h2>
              <button
                onClick={() => { setScheduleModalOpen(false); setShowAppointmentModal(false); setAppointmentClient(null); }}
                className="text-[#4A6580] hover:text-white transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <p className="text-xs text-[#94A3B8] mb-6">
              Para: <span className="text-white font-semibold">{activeConversation.client_profile?.full_name || 'Cliente'}</span>
            </p>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest">Título do Serviço *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Instalação elétrica"
                  value={scheduleForm.title}
                  onChange={e => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                  className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest">Data *</label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.date}
                    onChange={e => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                    className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest">Horário *</label>
                  <input
                    type="time"
                    required
                    value={scheduleForm.time}
                    onChange={e => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                    className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-1">
                  <MapPin size={12} /> Endereço
                </label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro..."
                  value={scheduleForm.location}
                  onChange={e => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                  className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={scheduleMutation.isPending}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {scheduleMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                {scheduleMutation.isPending ? 'Salvando...' : 'Criar Agendamento'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>

    {showDeleteConvModal && (
      <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowDeleteConvModal(false)}
        />
        <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <div className="p-2 bg-red-500/20 text-red-500 rounded-lg">
                <Trash2 size={20} />
              </div>
              Excluir conversa?
            </h2>
            <button
              onClick={() => setShowDeleteConvModal(false)}
              className="text-[#4A6580] hover:text-white transition-colors"
            >
              <X size={22} />
            </button>
          </div>
          <p className="text-sm text-[#94A3B8] mb-8 leading-relaxed">
            Esta ação é permanente e não pode ser desfeita. Todo o histórico de mensagens será apagado.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConvModal(false)}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-2xl transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => { deleteChatMutation.mutate(activeConversationId!); setShowDeleteConvModal(false); }}
              disabled={deleteChatMutation.isPending}
              className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white font-bold rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {deleteChatMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              {deleteChatMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </div>
    )}

    {profileModal && (
      <ProfileModal
        userId={profileModal.userId}
        name={profileModal.name}
        avatar={profileModal.avatar}
        onClose={() => setProfileModal(null)}
      />
    )}

    {clientProfileModal && (
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setClientProfileModal(null)} />
        <div className="relative w-full max-w-md bg-[#1C3454] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
          <div className="h-20 bg-gradient-to-r from-slate-800 to-blue-900/30 shrink-0" />
          <button type="button" onClick={() => setClientProfileModal(null)}
            className="absolute top-4 right-4 p-2 rounded-xl bg-black/30 hover:bg-black/50 text-white transition-all">
            <X size={18} />
          </button>
          {/* Avatar + nome */}
          <div className="px-6 -mt-10 pb-4 border-b border-slate-700/50 shrink-0">
            <div className="flex items-end gap-4 mb-3">
              <div className="w-20 h-20 rounded-full border-4 border-[#1C3454] bg-blue-600 flex items-center justify-center text-white font-bold text-xl overflow-hidden shrink-0">
                {clientProfileModal.avatar_url
                  ? <img src={clientProfileModal.avatar_url} alt={clientProfileModal.full_name ?? ''} className="w-full h-full object-cover" />
                  : (clientProfileModal.full_name ?? 'C').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                }
              </div>
              <div className="pb-1">
                <h3 className="text-xl font-black text-white">{clientProfileModal.full_name ?? 'Cliente'}</h3>
                {(clientProfileModal.city || clientProfileModal.state) && (
                  <span className="text-xs text-[#94A3B8] flex items-center gap-1 mt-1">
                    <MapPin size={12} />
                    {[clientProfileModal.city, clientProfileModal.state].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Dados */}
          <div className="overflow-y-auto flex-1 p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0E1C32] rounded-xl p-4">
                <p className="text-xs text-[#4A6580] uppercase tracking-widest mb-1">Membro desde</p>
                <p className="text-white font-bold text-sm">{new Date(clientProfileModal.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="bg-[#0E1C32] rounded-xl p-4">
                <p className="text-xs text-[#4A6580] uppercase tracking-widest mb-1">Total de pedidos</p>
                <p className="text-white font-bold text-sm">{clientProfileModal.total_leads}</p>
              </div>
            </div>
            {clientProfileModal.recent_leads.length > 0 && (
              <div>
                <p className="text-xs font-bold text-[#4A6580] uppercase tracking-widest mb-3">Últimos pedidos</p>
                <div className="space-y-2">
                  {clientProfileModal.recent_leads.map(lead => {
                    const statusColors: Record<string, string> = {
                      open:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
                      'orçando':  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
                      finalizado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                      cancelado:  'bg-red-500/10 text-red-400 border-red-500/20',
                    };
                    const colorClass = statusColors[lead.status] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                    return (
                      <div key={lead.id} className="bg-[#0E1C32] rounded-xl p-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{lead.title}</p>
                          <p className="text-xs text-[#4A6580]">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold border ${colorClass}`}>
                          {lead.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-slate-700/50 shrink-0">
            <button type="button" onClick={() => setClientProfileModal(null)}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all text-sm">
              Fechar
            </button>
          </div>
        </div>
      </div>
    )}

    {isMenuOpen && menuPos && (
      <>
        <div className="fixed inset-0 z-[350]" onClick={() => setIsMenuOpen(false)} />
        <div
          style={{ top: menuPos.top, right: menuPos.right }}
          className="fixed w-56 bg-[#1C3454] border border-[#243F6A] rounded-2xl shadow-2xl z-[360] overflow-hidden animate-in zoom-in-95 duration-200"
        >
          <button
            onClick={() => {
              setIsMenuOpen(false);
              if (role === 'client' && activeConversation?.prof_user_id) {
                setProfileModal({
                  userId: activeConversation.prof_user_id,
                  name: otherName,
                  avatar: otherAvatar,
                });
              } else if (role === 'professional' && activeConversation?.client_id) {
                void loadClientProfile(activeConversation.client_id);
              }
            }}
            className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-3 transition-colors"
          >
            <User size={16} /> {menuProfileLabel}
          </button>
          <button
            onClick={() => { setIsMenuOpen(false); toast('Em breve!'); }}
            className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-3 transition-colors"
          >
            <Clock size={16} /> Mensagens Temporárias
          </button>
          <div className="h-px bg-white/5 mx-3" />
          <button
            onClick={() => { setIsMenuOpen(false); setShowDeleteConvModal(true); }}
            disabled={deleteChatMutation.isPending}
            className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors font-bold disabled:opacity-50"
          >
            <Trash2 size={16} /> Excluir Conversa
          </button>
        </div>
      </>
    )}
    </>
  );
}
