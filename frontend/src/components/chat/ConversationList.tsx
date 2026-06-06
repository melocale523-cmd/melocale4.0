import { Search, Loader2 } from 'lucide-react';
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
    <div className="flex w-[280px] border-r border-[#1C3050] flex-col shrink-0 bg-[#0E1C32]">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-[#1C3050] bg-[#0E1C32]">
        <h2 className="text-xl font-bold text-white mb-3">Mensagens</h2>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors" size={15} />
          <input
            type="text"
            placeholder="Buscar conversas..."
            className="w-full bg-[#132236] border border-white/[0.06] rounded-full py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-emerald-500/40 transition-all placeholder:text-white/30"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
            <Loader2 className="animate-spin text-emerald-500" size={20} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580]">Carregando...</p>
          </div>
        ) : filtered.length > 0 ? (
          filtered.map(conv => {
            const name = getOtherName(conv, role);
            const isOnline = onlineUsers.includes(getOtherUserId(conv, role) ?? '');
            const unread = getUnreadCount(conv, role);
            const { initials, colorClass } = getAvatarInfo(name);
            const isNewOrcamento =
              role === 'professional' &&
              conv.lead_id !== null &&
              (conv.unread_for_prof ?? 0) > 0 &&
              Date.now() - new Date(conv.created_at).getTime() < 48 * 60 * 60 * 1000;
            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={cn(
                  'w-full px-4 py-3 flex items-start gap-3 transition-all border-b border-white/[0.03] relative',
                  activeConversationId === conv.id ? 'bg-white/5' : 'hover:bg-white/[0.03]',
                  isNewOrcamento && activeConversationId !== conv.id ? 'bg-emerald-500/[0.03]' : '',
                )}
              >
                {isNewOrcamento && (
                  <div className="absolute top-2 right-2">
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full">
                      NOVO
                    </span>
                  </div>
                )}

                {/* Avatar with initials */}
                <div className="relative shrink-0">
                  <div className={cn('w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-bold text-white', colorClass)}>
                    {initials}
                  </div>
                  {/* Online indicator */}
                  <div className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-[#0E1C32] rounded-full',
                    isOnline ? 'bg-emerald-500' : 'bg-slate-600',
                  )} />
                  {/* Unread badge */}
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 shadow-md shadow-emerald-500/30">
                      {unread}
                    </span>
                  )}
                </div>

                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-center mb-0.5 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{name}</h4>
                      {role === 'client' && conv.prof_user_id && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewProfessionalProfile(conv.prof_user_id!, getOtherName(conv, role), conv.prof_profile?.avatar_url);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onViewProfessionalProfile(conv.prof_user_id!, getOtherName(conv, role), conv.prof_profile?.avatar_url);
                            }
                          }}
                          className="text-[9px] font-bold text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/50 px-1.5 py-0.5 rounded-full transition-all shrink-0 cursor-pointer select-none"
                        >
                          Ver perfil
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#4A6580] shrink-0">
                      {new Date(conv.last_message_at ?? conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {conv.leadTitle && (
                    <p className="text-[11px] text-emerald-400/70 truncate mb-0.5">📋 {conv.leadTitle}</p>
                  )}
                  <p className="text-xs text-[#4A6580] truncate">
                    {conv.last_message ?? (conv.last_message_at ? '...' : 'Sem mensagens ainda')}
                  </p>
                  {isNewOrcamento && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); onSelectConversation(conv.id); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          onSelectConversation(conv.id);
                        }
                      }}
                      className="mt-1.5 block w-full py-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold rounded-lg transition-all text-center cursor-pointer select-none"
                    >
                      Responder orçamento →
                    </span>
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div className="p-8 text-center">
            <p className="text-xs text-[#4A6580] font-bold uppercase tracking-widest">Nenhuma conversa</p>
          </div>
        )}
      </div>
    </div>
  );
}
