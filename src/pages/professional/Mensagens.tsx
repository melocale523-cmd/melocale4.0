import { useState, useEffect, useRef } from 'react';
import { Search, Send, User, MoreVertical, Paperclip, Smile, CheckCheck, Check, Loader2, Mic, Image as ImageIcon, File as FileIcon, Trash2, Clock, X, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '../../services/dbServices';

interface Message {
  id: string;
  sender_id: string;
  text: string;
  created_at: string;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'image' | 'file' | 'audio';
  file_name?: string;
  duration?: string;
}

interface Chat {
  id: string;
  user_name: string;
  last_message: string;
  updated_at: string;
  unread_count: number;
  recipient_id: string; // Adicionado
}

export default function ProfessionalMensagens() {
  const queryClient = useQueryClient();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: chats, isLoading: chatsLoading } = useQuery({
    queryKey: ['chats'],
    queryFn: chatService.getChats,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', activeChatId],
    queryFn: () => activeChatId ? chatService.getMessages(activeChatId) : Promise.resolve([]),
    enabled: !!activeChatId,
  });

  const activeChat = chats?.find(c => c.id === activeChatId);

  const sendMessageMutation = useMutation({
    mutationFn: ({ text, type, fileName, recipientId }: { text: string, type?: string, fileName?: string, recipientId?: string }) => 
      chatService.sendMessage(activeChatId!, text, type, fileName, recipientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', activeChatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      setMessageInput('');
      scrollToBottom();
    }
  });

  const deleteChatMutation = useMutation({
    mutationFn: chatService.deleteChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      setActiveChatId(null);
      setIsMenuOpen(false);
      toast.success('Conversa excluída com sucesso!');
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = (e?: React.FormEvent, type: string = 'text', fileName?: string, duration?: string) => {
    e?.preventDefault();
    if (!messageInput.trim() && type === 'text') return;
    if (!activeChatId) return;

    const msgText = type === 'text' ? messageInput : `[Envio de ${type}] ${fileName || ''}`;
    sendMessageMutation.mutate({ text: msgText, type, fileName, recipientId: activeChat?.recipient_id } as any);
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
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const durationStr = `${Math.floor(recordingTime / 60)}:${(recordingTime % 60).toString().padStart(2, '0')}`;
        handleSendMessage(undefined, 'audio', `audio_${Date.now()}.webm`, durationStr);
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

  const emojis = ['👍', '🤝', '✅', '🏠', '🛠️', '🎨', '📐', '💰', '📅', '📍'];

  return (
    <div className="h-[calc(100vh-140px)] flex bg-[#14161B] border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative animate-in fade-in duration-500">
      {/* Sidebar de Chats */}
      <div className="w-full md:w-80 lg:w-96 border-r border-white/5 flex flex-col shrink-0 bg-[#0A0B0D]">
        <div className="p-6 border-b border-white/5 bg-[#14161B]/40 backdrop-blur-xl">
          <h2 className="text-xl font-bold text-white mb-4">Mensagens</h2>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Buscar conversas..."
              className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {chatsLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
              <Loader2 className="animate-spin text-emerald-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Carregando chats...</p>
            </div>
          ) : chats && chats.length > 0 ? (
            chats.map(chat => (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={cn(
                  "w-full p-6 flex items-start gap-4 transition-all border-b border-white/[0.02] relative",
                  activeChatId === chat.id ? "bg-emerald-500/5" : "hover:bg-white/[0.02]"
                )}
              >
                {activeChatId === chat.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>}
                <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center shrink-0 border border-white/5 relative">
                  <User className="text-slate-500" size={24} />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#14161B] rounded-full"></div>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-sm font-bold text-white truncate">{chat.user_name}</h4>
                    <span className="text-[10px] text-slate-500 font-bold">{new Date(chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-xs text-slate-500 truncate font-medium">{chat.last_message}</p>
                    {chat.unread_count > 0 && (
                      <span className="bg-emerald-500 text-[#0A0B0D] text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shadow-lg shadow-emerald-500/20">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : (
             <div className="p-12 text-center">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Nenhuma conversa encontrada</p>
             </div>
          )}
        </div>
      </div>

      {/* Área do Chat */}
      {activeChat ? (
        <div className="flex-1 flex flex-col bg-[#0A0B0D]/30 relative overflow-hidden">
          {/* Background Decorative Gradient */}
          <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full"></div>
          
          {/* Header do Chat */}
          <div className="p-4 sm:p-6 border-b border-white/5 flex items-center justify-between bg-[#14161B]/80 backdrop-blur-xl z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center shrink-0 border border-white/5">
                <User className="text-slate-500" size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">{activeChat.user_name}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Online</span>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2.5 text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
              >
                <MoreVertical size={20} />
              </button>
              
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#14161B] border border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden animate-in zoom-in-95 duration-200">
                  <button className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-3 transition-colors">
                    <User size={16} /> Ver Perfil do Cliente
                  </button>
                  <button className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-3 transition-colors">
                    <Clock size={16} /> Mensagens Temporárias
                  </button>
                  <div className="h-px bg-white/5 mx-3"></div>
                  <button 
                    onClick={() => deleteChatMutation.mutate(activeChatId!)}
                    disabled={deleteChatMutation.isPending}
                    className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors font-bold disabled:opacity-50"
                  >
                    <Trash2 size={16} /> {deleteChatMutation.isPending ? 'Excluindo...' : 'Excluir Conversa'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
            {messagesLoading ? (
               <div className="h-full flex items-center justify-center">
                  <Loader2 className="animate-spin text-emerald-500" size={32} />
               </div>
            ) : messages && messages.length > 0 ? (
              messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[85%] sm:max-w-[70%] group animate-in slide-in-from-bottom-2",
                    msg.sender_id === 'me' ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className={cn(
                    "p-4 rounded-2xl text-[13px] leading-relaxed relative shadow-lg",
                    msg.sender_id === 'me' 
                      ? "bg-emerald-600 text-white rounded-tr-sm" 
                      : "bg-[#14161B] text-slate-200 border border-white/5 rounded-tl-sm hover:border-emerald-500/30 transition-colors"
                  )}>
                    {msg.type === 'image' && (
                      <div className="mb-2 p-1 bg-black/20 rounded-lg overflow-hidden border border-white/10 group-hover:bg-black/30 transition-all">
                        <div className="aspect-video bg-emerald-500/10 flex items-center justify-center rounded-md border border-white/5 relative group/img">
                          <ImageIcon size={32} className="text-emerald-500 opacity-50 transition-transform group-hover/img:scale-110" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity"></div>
                        </div>
                      </div>
                    )}
                    {msg.type === 'file' && (
                      <div className="mb-2 p-3 bg-black/20 rounded-xl flex items-center gap-3 border border-white/5 hover:bg-black/40 transition-all cursor-pointer">
                        <div className="w-10 h-10 bg-red-500/20 text-red-500 rounded-lg flex items-center justify-center">
                          <FileIcon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{msg.file_name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">PDF, 2.4 MB</p>
                        </div>
                      </div>
                    )}
                    {msg.type === 'audio' && (
                      <div className="mb-2 p-3 bg-black/20 rounded-xl flex items-center gap-3 border border-white/5 min-w-[200px]">
                        <div className="w-8 h-8 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center">
                          <Mic size={16} />
                        </div>
                        <div className="flex-1 h-3 bg-white/10 rounded-full relative overflow-hidden">
                           <div className="absolute left-0 top-0 bottom-0 w-[60%] bg-emerald-500 animate-pulse"></div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">0:12</span>
                      </div>
                    )}
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-2 mt-2 px-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.sender_id === 'me' && (
                      <div className="flex items-center">
                        {msg.status === 'sent' && <Check size={14} className="text-slate-600" />}
                        {msg.status === 'delivered' && <CheckCheck size={14} className="text-slate-400" />}
                        {msg.status === 'read' && <CheckCheck size={14} className="text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.5)]" />}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                   <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mb-6 text-emerald-500 border border-emerald-500/20 shadow-emerald-500/5 shadow-2xl">
                      <Send size={32} />
                   </div>
                   <h4 className="text-white font-bold text-lg mb-2">Sem mensagens ainda</h4>
                   <p className="text-slate-500 font-medium text-sm max-w-[200px]">Inicie uma conversa com {activeChat.user_name} para fechar o serviço.</p>
                </div>
            )}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex flex-col items-start max-w-[70%] animate-in slide-in-from-bottom-2 duration-300">
                <div className="bg-[#14161B] text-slate-400 py-3 px-5 rounded-2xl rounded-tl-sm border border-white/5 flex items-center gap-3 shadow-lg">
                  <div className="flex gap-1 pt-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce"></div>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter">
                    <span className="text-emerald-500">{activeChat.user_name}</span> está digitando...
                  </p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 pb-8 border-t border-white/5 bg-[#14161B]/80 backdrop-blur-xl z-20">
            {showEmojiPicker && (
              <div className="absolute bottom-28 left-6 right-6 p-4 bg-[#14161B] border border-white/10 rounded-2xl shadow-2xl flex flex-wrap gap-2 animate-in slide-in-from-bottom-4 duration-300 border-b-emerald-500/20 border-b-4">
                {emojis.map(emoji => (
                  <button 
                    key={emoji} 
                    onClick={() => {
                       setMessageInput(prev => prev + emoji);
                       setShowEmojiPicker(false);
                    }}
                    className="text-2xl hover:scale-125 transition-transform p-2 bg-white/5 rounded-xl hover:bg-emerald-500/20"
                  >
                    {emoji}
                  </button>
                ))}
                <button 
                  onClick={() => setShowEmojiPicker(false)}
                  className="absolute -top-3 -right-3 w-8 h-8 bg-black border border-white/10 rounded-full flex items-center justify-center text-slate-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white/5 py-1 px-1.5 rounded-[1.25rem] border border-white/5 shadow-inner">
                {isRecording ? (
                  <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 rounded-xl border border-red-500/20 animate-pulse">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs font-mono font-bold text-red-500">
                      {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                    </span>
                    <button 
                      type="button"
                      onClick={stopRecording}
                      className="p-1 hover:bg-black/20 rounded-md text-red-500"
                    >
                      <Square size={16} fill="currentColor" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button 
                      type="button" 
                      onClick={startRecording}
                      className="p-3 text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all" 
                      title="Gravar Áudio"
                    >
                      <Mic size={20} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => simulateFileUpload('image')}
                      className="p-3 text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
                      title="Enviar Foto"
                    >
                      <ImageIcon size={20} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => simulateFileUpload('file')}
                      className="p-3 text-slate-500 hover:text-purple-500 hover:bg-purple-500/10 rounded-xl transition-all"
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
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder="Escreva algo para o cliente..."
                  className="w-full bg-[#0A0B0D] border border-white/5 rounded-[1.25rem] py-4 px-6 pr-14 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all font-medium shadow-inner"
                />
                <button 
                  type="button" 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={cn(
                    "absolute right-4 top-1/2 -translate-y-1/2 transition-colors",
                    showEmojiPicker ? "text-yellow-500" : "text-slate-600 hover:text-yellow-500"
                  )}
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
                {sendMessageMutation.isPending && <div className="absolute inset-0 bg-emerald-500/20 rounded-[1.25rem] animate-pulse"></div>}
              </button>
            </form>
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-4 text-center">As mensagens são criptografadas de ponta a ponta</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#0A0B0D]/20">
           <div className="w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-[2.5rem] flex items-center justify-center mb-8 text-emerald-500 border border-white/5 shadow-2xl relative group">
              <User size={48} />
              <div className="absolute inset-0 bg-emerald-500/10 rounded-[2.5rem] animate-ping opacity-20"></div>
           </div>
           <h3 className="text-2xl font-bold text-white mb-3">Suas Conversas Ativas</h3>
           <p className="text-slate-500 max-w-sm font-medium leading-relaxed">
             Selecione um cliente ao lado para negociar orçamentos, enviar fotos dos serviços realizados e fechar novos negócios.
           </p>
           <div className="mt-12 flex gap-4">
              <div className="flex flex-col items-center gap-1 opacity-40">
                 <Mic size={20} className="text-slate-500" />
                 <span className="text-[8px] font-bold uppercase">Áudio</span>
              </div>
              <div className="flex flex-col items-center gap-1 opacity-40">
                 <ImageIcon size={20} className="text-slate-500" />
                 <span className="text-[8px] font-bold uppercase">Fotos</span>
              </div>
              <div className="flex flex-col items-center gap-1 opacity-40">
                 <Paperclip size={20} className="text-slate-500" />
                 <span className="text-[8px] font-bold uppercase">Arquivos</span>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
