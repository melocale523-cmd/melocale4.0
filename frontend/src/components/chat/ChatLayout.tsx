import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, MoreVertical, CalendarPlus, ChevronLeft, Mic, Image as ImageIcon, Paperclip, Trash2, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { chatService } from '../../services/dbServices';
import { supabase } from '../../lib/supabase';

import { useChatRealtime } from '../../hooks/useChatRealtime';
import { useChatMessages } from '../../hooks/useChatMessages';
import { ConversationList } from './ConversationList';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ProfessionalProfileModal } from './ProfessionalProfileModal';
import { ClientProfileModal } from './ClientProfileModal';
import { ChatScheduleModal } from './ChatScheduleModal';

import type { ConversationWithProfiles, ClientProfile } from '../../types/chat';

interface ChatLayoutProps {
  role: 'professional' | 'client';
}

function getAvatarInfo(name: string): { initials: string; colorClass: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  const palette = ['bg-blue-800', 'bg-purple-700', 'bg-orange-700', 'bg-teal-700'];
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return { initials, colorClass: palette[Math.abs(hash) % palette.length] };
}

export default function ChatLayout({ role }: ChatLayoutProps) {
  const [searchParams] = useSearchParams();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  const [profileModal, setProfileModal] = useState<{ userId: string; name: string; avatar: string | null | undefined } | null>(null);
  const [clientProfileModal, setClientProfileModal] = useState<ClientProfile | null>(null);
  const [showDeleteConvModal, setShowDeleteConvModal] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Auth
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) setCurrentUser(user);
    });
    return () => { cancelled = true; };
  }, []);

  // URL param → open chat (also sets showChat so mobile shows the chat panel)
  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chatId');
    if (chatIdFromUrl && chatIdFromUrl !== 'null' && chatIdFromUrl.length > 10) {
      setActiveConversationId(chatIdFromUrl);
      setShowChat(true);
    }
  }, [searchParams]);

  const queryOptions = role === 'professional'
    ? { retry: false as const, refetchOnWindowFocus: false as const }
    : {};

  const { data: chats, isLoading: chatsLoading } = useQuery({
    queryKey: ['chats', currentUser?.id],
    queryFn: chatService.getChats,
    ...queryOptions,
  });

  // Professional ID for scheduling
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

  const activeConversation = (chats as ConversationWithProfiles[] | undefined)?.find(c => c.id === activeConversationId);

  const getOtherName = (conv: ConversationWithProfiles) =>
    role === 'professional' ? conv.client_profile?.full_name || 'Cliente' : conv.prof_profile?.full_name || 'Profissional';
  const getOtherAvatar = (conv: ConversationWithProfiles) =>
    role === 'professional' ? conv.client_profile?.avatar_url : conv.prof_profile?.avatar_url;
  const getOtherUserId = (conv: ConversationWithProfiles) =>
    role === 'professional' ? conv.client_id : conv.prof_user_id;
  const getRecipientId = (conv: ConversationWithProfiles) =>
    role === 'professional' ? conv.client_id : conv.prof_user_id ?? undefined;

  const otherLabel = role === 'professional' ? 'Cliente' : 'Profissional';
  const otherName = activeConversation ? getOtherName(activeConversation) : otherLabel;
  const otherAvatar = activeConversation ? getOtherAvatar(activeConversation) : undefined;
  const recipientId = activeConversation ? getRecipientId(activeConversation) : undefined;
  const isOtherUserOnline = activeConversation ? onlineUsers.includes(getOtherUserId(activeConversation) ?? '') : false;
  const menuProfileLabel = role === 'professional' ? 'Ver Perfil do Cliente' : 'Ver Perfil do Profissional';

  const { typingChannel } = useChatRealtime({
    activeConversationId,
    currentUser,
    role,
    onTyping: setIsTyping,
    onOnlineUsers: setOnlineUsers,
  });

  const {
    messages,
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
  } = useChatMessages({
    activeConversationId,
    role,
    currentUser,
    recipientId,
    typingChannel,
    scrollToBottom,
    onDeleteSuccess: () => {
      setActiveConversationId(null);
      setIsMenuOpen(false);
    },
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

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

  const emptyStateTitle = role === 'professional' ? 'Suas Conversas Ativas' : 'Seu Canal de Comunicação';
  const emptyStateDescription = role === 'professional'
    ? 'Selecione um cliente ao lado para negociar orçamentos, enviar fotos dos serviços realizados e fechar novos negócios.'
    : 'Selecione um profissional ao lado para negociar detalhes técnicos, aprovar orçamentos e acompanhar a execução do seu projeto.';

  const { initials: headerInitials, colorClass: headerColorClass } = getAvatarInfo(otherName);

  return (
    <>
      <div className="h-[calc(100vh-140px)] flex bg-[#0a1628] border border-[#1C3050] rounded-3xl overflow-hidden shadow-2xl relative animate-in fade-in duration-500">

        {/* Sidebar */}
        <div className={showChat ? 'hidden md:flex' : 'flex'}>
          <ConversationList
            conversations={chats as ConversationWithProfiles[] | undefined}
            isLoading={chatsLoading}
            activeConversationId={activeConversationId}
            role={role}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onlineUsers={onlineUsers}
            onSelectConversation={(id) => { setActiveConversationId(id); setShowChat(true); }}
            onViewProfessionalProfile={(userId, name, avatar) => setProfileModal({ userId, name, avatar })}
          />
        </div>

        {/* Chat area */}
        {activeConversation ? (
          <div className={`${showChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-[#0E1C32] relative overflow-hidden`}>
            <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-emerald-500/[0.03] blur-[120px] pointer-events-none rounded-full" />

            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between z-10" style={{ background: '#0a1928', borderTop: '3px solid #10b981' }}>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowChat(false)} className="md:hidden text-white/40 hover:text-white transition-colors">
                  <ChevronLeft size={22} />
                </button>
                {/* Avatar initials */}
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0', headerColorClass)}>
                  {headerInitials}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white leading-tight">{otherName}</h3>
                    {role === 'client' && activeConversation.prof_user_id && (
                      <button
                        type="button"
                        onClick={() => setProfileModal({ userId: activeConversation.prof_user_id!, name: otherName, avatar: otherAvatar })}
                        style={{ background: '#132236', border: '1px solid #1C3050', borderRadius: '6px', padding: '3px 10px', fontSize: '11px', color: '#10b981', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}
                      >
                        Ver perfil
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={cn('w-1.5 h-1.5 rounded-full', isOtherUserOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-400')} />
                    <span className={cn('text-[10px] font-semibold', isOtherUserOnline ? 'text-emerald-500' : 'text-red-400')}>
                      {isOtherUserOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  {role === 'client' && ((activeConversation as Record<string, unknown>).prof_category || (activeConversation as Record<string, unknown>).prof_city) && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                      {(activeConversation as Record<string, unknown>).prof_category && (
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{String((activeConversation as Record<string, unknown>).prof_category)}</span>
                      )}
                      {(activeConversation as Record<string, unknown>).prof_category && (activeConversation as Record<string, unknown>).prof_city && (
                        <span style={{ fontSize: '10px', color: '#1C3050' }}>·</span>
                      )}
                      {(activeConversation as Record<string, unknown>).prof_city && (
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{String((activeConversation as Record<string, unknown>).prof_city)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {role === 'professional' && (
                  <button
                    onClick={() => setScheduleModalOpen(true)}
                    className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-emerald-400 transition-colors"
                    title="Agendar serviço"
                  >
                    <CalendarPlus size={18} />
                  </button>
                )}
                <button
                  ref={menuButtonRef}
                  onClick={() => {
                    if (!isMenuOpen && menuButtonRef.current) {
                      const rect = menuButtonRef.current.getBoundingClientRect();
                      setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                    }
                    setIsMenuOpen(!isMenuOpen);
                  }}
                  className="p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                >
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>

            {/* Lead banner */}
            {activeConversation.leadTitle && (
              <div style={{ padding: '8px 16px', background: '#0d1929', borderTop: '1px solid #1C3050', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10 }}>
                <span style={{ fontSize: '14px' }}>📋</span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Pedido:</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeConversation.leadTitle}</span>
                <span style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '999px', padding: '2px 8px', fontSize: '10px', color: '#10b981', fontWeight: 700, flexShrink: 0 }}>Em andamento</span>
              </div>
            )}

            <MessageList
              messages={messages}
              isLoading={messagesLoading}
              isTyping={isTyping}
              otherName={otherName}
              otherLabel={otherLabel}
              role={role}
              messagesEndRef={messagesEndRef}
            />

            <MessageInput
              role={role}
              messageInput={messageInput}
              setMessageInput={setMessageInput}
              onSendMessage={handleSendMessage}
              onTypingBroadcast={handleTypingBroadcast}
              onFileUpload={handleFileUpload}
              isUploading={isUploading}
              isRecording={isRecording}
              recordingTime={recordingTime}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              sendMessagePending={sendMessageMutation.isPending}
              imageInputRef={imageInputRef}
              fileInputRef={fileInputRef}
              inputPlaceholder={role === 'professional' ? `Escreva algo para o cliente...` : `Escreva algo para ${otherName}...`}
              onOpenScheduleModal={role === 'professional' ? () => setScheduleModalOpen(true) : undefined}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#0E1C32]/30">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-[2.5rem] flex items-center justify-center mb-6 text-emerald-500 border border-[#1C3050] shadow-2xl relative">
              <User size={40} />
              <div className="absolute inset-0 bg-emerald-500/10 rounded-[2.5rem] animate-ping opacity-20" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">{emptyStateTitle}</h3>
            <p className="text-[#4A6580] max-w-sm font-medium leading-relaxed text-sm">{emptyStateDescription}</p>
            <div className="mt-8 flex gap-6">
              <div className="flex flex-col items-center gap-2 opacity-40">
                <Mic size={18} className="text-[#4A6580]" />
                <span className="text-[8px] font-bold uppercase">Áudio</span>
              </div>
              <div className="flex flex-col items-center gap-2 opacity-40">
                <ImageIcon size={18} className="text-[#4A6580]" />
                <span className="text-[8px] font-bold uppercase">Fotos</span>
              </div>
              <div className="flex flex-col items-center gap-2 opacity-40">
                <Paperclip size={18} className="text-[#4A6580]" />
                <span className="text-[8px] font-bold uppercase">Arquivos</span>
              </div>
            </div>
          </div>
        )}

        {/* Schedule modal */}
        {role === 'professional' && activeConversation && professional?.id && (
          <ChatScheduleModal
            open={scheduleModalOpen}
            onClose={() => setScheduleModalOpen(false)}
            professionalId={professional.id}
            clientId={activeConversation.client_id}
            clientName={activeConversation.client_profile?.full_name || 'Cliente'}
            conversationId={activeConversation.id}
          />
        )}
      </div>

      {/* Delete conversation modal */}
      {showDeleteConvModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowDeleteConvModal(false)} />
          <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-red-500/20 text-red-500 rounded-lg"><Trash2 size={18} /></div>
                Excluir conversa?
              </h2>
            </div>
            <p className="text-sm text-[#94A3B8] mb-5 leading-relaxed">
              Esta ação é permanente e não pode ser desfeita. Todo o histórico de mensagens será apagado.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConvModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-2xl transition-all">
                Cancelar
              </button>
              <button
                onClick={() => { deleteChatMutation.mutate(activeConversationId!); setShowDeleteConvModal(false); }}
                disabled={deleteChatMutation.isPending}
                className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white font-bold rounded-2xl transition-all disabled:opacity-50"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {isMenuOpen && menuPos && (
        <>
          <div className="fixed inset-0 z-[350]" onClick={() => setIsMenuOpen(false)} />
          <div
            style={{ top: menuPos.top, right: menuPos.right }}
            className="fixed w-56 bg-[#0a1628] border border-white/10 rounded-2xl shadow-2xl z-[360] overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <button
              onClick={() => {
                setIsMenuOpen(false);
                if (role === 'client' && activeConversation?.prof_user_id) {
                  setProfileModal({ userId: activeConversation.prof_user_id, name: otherName, avatar: otherAvatar });
                } else if (role === 'professional' && activeConversation?.client_id) {
                  void loadClientProfile(activeConversation.client_id);
                }
              }}
              className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-3 transition-colors"
            >
              <User size={15} /> {menuProfileLabel}
            </button>
            <button
              onClick={() => { setIsMenuOpen(false); toast('Em breve!'); }}
              className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-3 transition-colors"
            >
              <Clock size={15} /> Mensagens Temporárias
            </button>
            <div className="h-px bg-white/5 mx-3" />
            <button
              onClick={() => { setIsMenuOpen(false); setShowDeleteConvModal(true); }}
              disabled={deleteChatMutation.isPending}
              className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors font-bold disabled:opacity-50"
            >
              <Trash2 size={15} /> Excluir Conversa
            </button>
          </div>
        </>
      )}

      {profileModal && (
        <ProfessionalProfileModal
          userId={profileModal.userId}
          name={profileModal.name}
          avatar={profileModal.avatar}
          onClose={() => setProfileModal(null)}
        />
      )}

      {clientProfileModal && (
        <ClientProfileModal
          profile={clientProfileModal}
          onClose={() => setClientProfileModal(null)}
        />
      )}
    </>
  );
}
