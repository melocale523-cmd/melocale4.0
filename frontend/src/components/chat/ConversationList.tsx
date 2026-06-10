import { useState } from 'react';
import { Search, Loader2, Zap, ShieldCheck, Mic, Image as ImageIcon } from 'lucide-react';
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

const AVATAR_COLORS = ['#1e40af', '#7e22ce', '#c2410c', '#0f766e'];

function getAvatarInfo(name: string): { initials: string; color: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return { initials, color: AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] };
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

function getMessagePreview(msg: string | null | undefined): { icon: 'mic' | 'image' | null; text: string } {
  if (!msg) return { icon: null, text: 'Sem mensagens ainda' };
  const lower = msg.toLowerCase();
  if (lower.includes('áudio') || lower.includes('audio')) return { icon: 'mic', text: msg };
  if (lower.includes('foto') || lower.includes('imagem')) return { icon: 'image', text: msg };
  return { icon: null, text: msg };
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'active'>('all');

  const filtered = conversations
    ? conversations.filter(conv => {
        if (searchQuery.trim() && !matchesSearch(conv, role, searchQuery.toLowerCase())) return false;
        if (activeFilter === 'unread') return getUnreadCount(conv, role) > 0;
        if (activeFilter === 'active') {
          const otherId = getOtherUserId(conv, role);
          return onlineUsers.includes(otherId ?? '');
        }
        return true;
      })
    : [];

  const totalUnread = conversations?.reduce((acc, conv) => acc + getUnreadCount(conv, role), 0) ?? 0;
  const unreadConvCount = conversations?.filter(c => getUnreadCount(c, role) > 0).length ?? 0;
  const onlineConvCount = conversations?.filter(c => onlineUsers.includes(getOtherUserId(c, role) ?? '')).length ?? 0;

  const filters: { key: 'all' | 'unread' | 'active'; label: string; badge?: number }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'unread', label: 'Não lidas', badge: unreadConvCount },
    { key: 'active', label: 'Ativas', badge: onlineConvCount },
  ];

  return (
    <div style={{ width: '290px', minWidth: '290px', background: '#0a1928', borderRight: '1px solid #1C3050', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid #1C3050' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#f1f5f9', margin: 0, fontFamily: 'DM Sans, sans-serif' }}>Mensagens</h2>
          {totalUnread > 0 && (
            <span style={{ background: '#10b981', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: '999px', fontFamily: 'DM Mono, monospace' }}>
              {totalUnread}
            </span>
          )}
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#334155' }} size={14} />
          <input
            type="text"
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', background: '#0d1929', border: '1px solid #1C3050', borderRadius: '10px', padding: '8px 10px 8px 34px', fontSize: '13px', color: '#f1f5f9', outline: 'none', fontFamily: 'DM Sans, sans-serif', transition: 'border-color .2s' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.35)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#1C3050'; }}
          />
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          {filters.map(({ key, label, badge }) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                  background: isActive ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                  border: isActive ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  color: isActive ? '#10b981' : '#475569',
                  transition: 'all .2s',
                }}
              >
                {label}
                {badge != null && badge > 0 && (
                  <span style={{
                    background: isActive ? '#10b981' : 'rgba(255,255,255,0.12)',
                    color: isActive ? '#fff' : '#94a3b8',
                    fontSize: '9px', fontWeight: 800, minWidth: '14px', height: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '999px', padding: '0 3px', fontFamily: 'DM Mono, monospace',
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding: '8px 16px', fontSize: '10px', color: '#334155', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, fontFamily: 'DM Sans, sans-serif' }}>
        Recentes
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', opacity: 0.5 }}>
            <Loader2 className="animate-spin" size={20} style={{ color: '#10b981' }} />
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#4A6580', margin: 0 }}>Carregando...</p>
          </div>
        ) : filtered.length > 0 ? (
          filtered.map(conv => {
            const name = getOtherName(conv, role);
            const isOnline = onlineUsers.includes(getOtherUserId(conv, role) ?? '');
            const unread = getUnreadCount(conv, role);
            const { initials, color } = getAvatarInfo(name);
            const isSelected = activeConversationId === conv.id;
            const isNewOrcamento = role === 'professional' && conv.lead_id !== null && (conv.unread_for_prof ?? 0) > 0 && Date.now() - new Date(conv.created_at).getTime() < 48 * 60 * 60 * 1000;
            const preview = getMessagePreview(conv.last_message);

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelectConversation(conv.id)}
                style={{
                  width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px',
                  background: isSelected ? 'linear-gradient(90deg, #132236, #0d1929)' : 'transparent',
                  borderLeft: `3px solid ${isSelected ? '#10b981' : 'transparent'}`,
                  borderRight: 'none', borderTop: 'none', borderBottom: '1px solid rgba(255,255,255,0.03)',
                  cursor: 'pointer', position: 'relative', transition: 'all .15s', textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                {isNewOrcamento && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '1px 6px', borderRadius: '999px' }}>NOVO</span>
                  </div>
                )}

                {/* Avatar */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                    {initials}
                  </div>
                  <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '12px', height: '12px', borderRadius: '50%', background: isOnline ? '#10b981' : '#374151', border: '2px solid #0a1928' }} />
                  {unread > 0 && (
                    <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#10b981', color: '#fff', fontSize: '9px', fontWeight: 800, minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '999px', padding: '0 3px' }}>
                      {unread}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</h4>
                      {role === 'client' && conv.prof_user_id && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={e => { e.stopPropagation(); onViewProfessionalProfile(conv.prof_user_id!, getOtherName(conv, role), conv.prof_profile?.avatar_url); }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onViewProfessionalProfile(conv.prof_user_id!, getOtherName(conv, role), conv.prof_profile?.avatar_url); } }}
                          style={{ fontSize: '9px', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '999px', padding: '1px 6px', flexShrink: 0, cursor: 'pointer', userSelect: 'none' }}
                        >
                          Ver perfil
                        </span>
                      )}
                    </div>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#334155', flexShrink: 0 }}>
                      {new Date(conv.last_message_at ?? conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {conv.leadTitle && (
                    <p style={{ fontSize: '10px', color: '#10b981', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Zap size={9} style={{ flexShrink: 0 }} />
                      {conv.leadTitle}
                    </p>
                  )}

                  <p style={{ fontSize: '12px', color: '#475569', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {preview.icon === 'mic' && <Mic size={11} color="#10b981" style={{ flexShrink: 0 }} />}
                    {preview.icon === 'image' && <ImageIcon size={11} color="#60a5fa" style={{ flexShrink: 0 }} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.text}</span>
                  </p>

                  {isNewOrcamento && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); onSelectConversation(conv.id); }}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelectConversation(conv.id); } }}
                      style={{ marginTop: '6px', display: 'block', padding: '4px 0', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', color: '#10b981', fontSize: '10px', fontWeight: 700, textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: '100%' }}
                    >
                      Responder orçamento →
                    </span>
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#4A6580', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', margin: 0 }}>Nenhuma conversa</p>
          </div>
        )}
      </div>

      {/* Footer: security card */}
      <div style={{ padding: '10px 12px 14px' }}>
        <div style={{ background: '#132236', border: '1px solid #1C3050', borderRadius: '10px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={15} color="#10b981" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2, fontFamily: 'DM Sans, sans-serif' }}>Mensagens seguras</div>
            <div style={{ fontSize: '10px', color: '#475569', fontFamily: 'DM Sans, sans-serif' }}>Criptografia SSL</div>
          </div>
        </div>
      </div>
    </div>
  );
}
