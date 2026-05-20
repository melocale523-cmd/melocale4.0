import { Search, User, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ConversationWithProfiles } from '../../types/chat';

interface ConversationListProps {
  conversations: ConversationWithProfiles[] | undefined;
  isLoading: boolean;
  activeConversationId: string | null;
  role: 'professional' | 'client';
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onlineUsers: string[];
  onSelectConversation: (id: string) => void;
  onViewProfessionalProfile: (userId: string, name: string, avatar: string | null | undefined) => void;
}

function getOtherName(conv: ConversationWithProfiles, role: 'professional' | 'client') {
  return role === 'professional'
    ? conv.client_profile?.full_name || 'Cliente'
    : conv.prof_profile?.full_name || 'Profissional';
}

function getOtherAvatar(conv: ConversationWithProfiles, role: 'professional' | 'client') {
  return role === 'professional' ? conv.client_profile?.avatar_url : conv.prof_profile?.avatar_url;
}

function getOtherUserId(conv: ConversationWithProfiles, role: 'professional' | 'client') {
  return role === 'professional' ? conv.client_id : conv.prof_user_id;
}

function getUnreadCount(conv: ConversationWithProfiles, role: 'professional' | 'client') {
  return role === 'professional' ? (conv.unread_for_prof ?? 0) : (conv.unread_client ?? 0);
}

function matchesSearch(conv: ConversationWithProfiles, role: 'professional' | 'client', q: string) {
  const name = role === 'professional'
    ? conv.client_profile?.full_name
    : conv.prof_profile?.full_name;
  return (
    name?.toLowerCase().includes(q) ||
    conv.last_message?.toLowerCase().includes(q) ||
    conv.leadTitle?.toLowerCase().includes(q)
  );
}

export function ConversationList({
  conversations,
  isLoading,
  activeConversationId,
  role,
  searchQuery,
  onSearchChange,
  onlineUsers,
  onSelectConversation,
  onViewProfessionalProfile,
}: ConversationListProps) {
  const filtered = conversations
    ? conversations.filter(conv => {
        if (!searchQuery.trim()) return true;
        return matchesSearch(conv, role, searchQuery.toLowerCase());
      })
    : [];

  return (
    <div className="flex w-full md:w-80 lg:w-96 border-r border-[#1C3050] flex-col shrink-0 bg-[#0E1C32]">
      <div className="p-6 border-b border-[#1C3050] bg-[#1C3454]/40 backdrop-blur-xl">
        <h2 className="text-xl font-bold text-white mb-4">Mensagens</h2>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors" size={16} />
          <input
            type="text"
            placeholder="Buscar conversas..."
            className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
            <Loader2 className="animate-spin text-emerald-500" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580]">Carregando chats...</p>
          </div>
        ) : filtered.length > 0 ? (
          filtered.map(conv => {
            const name = getOtherName(conv, role);
            const avatar = getOtherAvatar(conv, role);
            const isOnline = onlineUsers.includes(getOtherUserId(conv, role) ?? '');
            const unread = getUnreadCount(conv, role);
            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
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
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewProfessionalProfile(conv.prof_user_id!, getOtherName(conv, role), getOtherAvatar(conv, role));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onViewProfessionalProfile(conv.prof_user_id!, getOtherName(conv, role), getOtherAvatar(conv, role));
                            }
                          }}
                          className="text-[9px] font-bold text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/50 px-1.5 py-0.5 rounded-full transition-all shrink-0 cursor-pointer select-none"
                        >
                          Ver perfil
                        </span>
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
  );
}
