import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Send, User, MoreVertical, Paperclip, Smile, CheckCheck, Check, Loader2, Mic, Image as ImageIcon, Trash2, Clock, X, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '../../services/dbServices';

interface Message {
  id: string;
  conversation_id: string;
  sender_type: string;
  body: string;
  created_at: string;
  read_at: string | null;
  attachments: unknown;
}

interface Conversation {
  id: string;
  professional_id: string;
  client_id: string;
  lead_id: string | null;
  last_message_at: string | null;
  unread_for_prof: number | null;
  created_at: string;
}

export default function ClientMensagens() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: chats, isLoading: chatsLoading } = useQuery({
    queryKey: ['chats'],
    queryFn: chatService.getChats,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', activeConversationId],
    queryFn: () => activeConversationId ? chatService.getMessages(activeConversationId) : Promise.resolve([]),
    enabled: !!activeConversationId,
  });

  const activeConversation = (chats as Conversation[] | undefined)?.find(c => c.id === activeConversationId);

  const sendMessageMutation = useMutation({
    mutationFn: ({ text, type, fileName }: { text: string; type?: string; fileName?: string }) =>
      chatService.sendMessage(activeConversationId!, text, type, fileName, activeConversation?.professional_id),
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

  const handleSendMessage = (e?: React.FormEvent, type: string = 'text', fileName?: string) => {
    e?.preventDefault();
    if (!messageInput.trim() && type === 'text') return;
    if (!activeConversationId) return;
    const msgText = type === 'text' ? messageInput : `[Envio de ${type}] ${fileName || ''}`;
    sendMessageMutation.mutate({ text: msgText, type, fileName });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const durationStr = `${Math.floor(recordingTime / 60)}:${(recordingTime % 60).toString().padStart(2, '0')}`;
        handleSendMessage(undefined, 'audio', `audio_${Date.now()}.webm`);
        void durationStr;
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
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

  const simulateFileUpload = (type: string) => {
    const names = { image: 'foto_obra.jpg', file: 'projeto_reforma.pdf', audio: 'audio_explicativo.mp3' };
    handleSendMessage(undefined, type, names[type as keyof typeof names]);
    toast.success(`${type === 'image' ? 'Foto' : type === 'file' ? 'Arquivo' : 'Áudio'} enviado com sucesso!`);
  };

  const isMyMessage = (msg: Message) =>
    msg.sender_type === 'client' || msg.sender_type === 'user';

  const emojis = ['👍', '🤝', '✅', '🏠', '🛠️', '🎨', '📐', '💰', '📅', '📍'];

  return (
    <div className="h-[calc(100vh-140px)] flex bg-[#1C3454] border border-[#1C3050] rounded-3xl overflow-hidden shadow-2xl relative animate-in fade-in duration-500">
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
            (chats as Conversation[]).map(conv => (
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
                <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center shrink-0 border border-[#1C3050] relative">
                  <User className="text-[#4A6580]" size={24} />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#1C3454] rounded-full" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-sm font-bold text-white truncate">Profissional</h4>
                    <span className="text-[10px] text-[#4A6580] font-bold">
                      {new Date(conv.last_message_at ?? conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-[#4A6580] truncate font-medium">
                    {conv.last_message_at ? 'Última mensagem' : 'Sem mensagens ainda'}
                  </p>
                </div>
              </button>
            ))
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

          <div className="p-4 sm:p-6 border-b border-[#1C3050] flex items-center justify-between bg-[#1C3454]/80 backdrop-blur-xl z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center shrink-0 border border-[#1C3050]">
                <User className="text-[#4A6580]" size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">Profissional</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Online</span>
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
                <div className="absolute right-0 mt-2 w-56 bg-[#1C3454] border border-[#243F6A] rounded-2xl shadow-2xl z-20 overflow-hidden animate-in zoom-in-95 duration-200">
                  <button className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-3 transition-colors">
                    <User size={16} /> Ver Perfil do Profissional
                  </button>
                  <button className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-3 transition-colors">
                    <Clock size={16} /> Mensagens Temporárias
                  </button>
                  <div className="h-px bg-white/5 mx-3" />
                  <button
                    onClick={() => deleteChatMutation.mutate(activeConversationId!)}
                    disabled={deleteChatMutation.isPending}
                    className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors font-bold disabled:opacity-50"
                  >
                    <Trash2 size={16} /> {deleteChatMutation.isPending ? 'Excluindo...' : 'Excluir Conversa'}
                  </button>
                </div>
              )}
            </div>
          </div>

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
                      {msg.body}
                    </div>
                    <div className="flex items-center gap-2 mt-2 px-1">
                      <span className="text-[10px] text-[#4A6580] font-bold uppercase tracking-wider">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {mine && (
                        <div className="flex items-center">
                          {msg.read_at
                            ? <CheckCheck size={14} className="text-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.5)]" />
                            : <Check size={14} className="text-slate-600" />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mb-6 text-emerald-500 border border-emerald-500/20 shadow-emerald-500/5 shadow-2xl">
                  <Send size={32} />
                </div>
                <h4 className="text-white font-bold text-lg mb-2">Sem mensagens ainda</h4>
                <p className="text-[#4A6580] font-medium text-sm max-w-[200px]">Inicie uma conversa com o profissional para fechar o serviço.</p>
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
                    <span className="text-emerald-500">Profissional</span> está digitando...
                  </p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-6 pb-8 border-t border-[#1C3050] bg-[#1C3454]/80 backdrop-blur-xl z-20">
            {showEmojiPicker && (
              <div className="absolute bottom-28 left-6 right-6 p-4 bg-[#1C3454] border border-[#243F6A] rounded-2xl shadow-2xl flex flex-wrap gap-2 animate-in slide-in-from-bottom-4 duration-300 border-b-emerald-500/20 border-b-4">
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
                    <button type="button" onClick={startRecording} className="p-3 text-[#4A6580] hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all" title="Gravar Áudio">
                      <Mic size={20} />
                    </button>
                    <button type="button" onClick={() => simulateFileUpload('image')} className="p-3 text-[#4A6580] hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all" title="Enviar Foto">
                      <ImageIcon size={20} />
                    </button>
                    <button type="button" onClick={() => simulateFileUpload('file')} className="p-3 text-[#4A6580] hover:text-purple-500 hover:bg-purple-500/10 rounded-xl transition-all" title="Enviar Arquivo">
                      <Paperclip size={20} />
                    </button>
                  </>
                )}
              </div>

              <div className="flex-1 relative group">
                <input
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder="Escreva algo para o profissional..."
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
          <h3 className="text-2xl font-bold text-white mb-3">Seu Canal de Comunicação</h3>
          <p className="text-[#4A6580] max-w-sm font-medium leading-relaxed">
            Selecione um profissional ao lado para negociar detalhes técnicos, aprovar orçamentos e acompanhar a execução do seu projeto.
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
    </div>
  );
}
