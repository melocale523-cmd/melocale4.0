import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MessageCircle, Smile, Meh, Frown, Loader2, Bot, User, Info, X,
  UserCheck, Undo2, Send, Sparkles, MapPin, Coins, Calendar, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useIsMobile } from '../../hooks/useIsMobile';
import {
  whatsappConversationsService,
  type WhatsAppConversation,
  type WhatsAppMessage,
  type ConversationStatus,
} from '../../services/whatsappConversationsService';

const CONTACT_TYPE_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  professional: { label: 'Profissional', color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' },
  client:       { label: 'Cliente',       color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)' },
  unknown:      { label: 'Desconhecido',  color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.25)' },
};

const STATUS_INFO: Record<ConversationStatus, { label: string; color: string; bg: string; border: string }> = {
  bot_active:   { label: 'Bot respondendo', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  needs_human:  { label: 'Aguardando você', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  human_active: { label: 'Você no controle', color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' },
  resolved:     { label: 'Resolvida', color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)' },
};

function MoodIcon({ mood }: { mood: string | null }) {
  if (mood === 'positive') return <Smile size={14} style={{ color: '#34d399' }} />;
  if (mood === 'negative') return <Frown size={14} style={{ color: '#f87171' }} />;
  return <Meh size={14} style={{ color: '#94a3b8' }} />;
}

function initials(name: string | null): string {
  if (!name?.trim() || name === 'Desconhecido') return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function Avatar({ name, avatarUrl, size = 42 }: { name: string | null; avatarUrl: string | null; size?: number }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name ?? ''} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: '0 2px 8px rgba(96,165,250,0.25)' }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(96,165,250,0.3), rgba(96,165,250,0.08))', border: '1px solid rgba(96,165,250,0.3)', boxShadow: '0 2px 8px rgba(96,165,250,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.32, fontWeight: 700, color: '#60a5fa', flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

type ListFilter = 'all' | 'you' | 'bot' | 'resolved';

function matchesFilter(status: ConversationStatus, filter: ListFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'you') return status === 'needs_human' || status === 'human_active';
  if (filter === 'bot') return status === 'bot_active';
  return status === 'resolved';
}

export default function AdminConversas() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile(900);
  const [filter, setFilter] = useState<ListFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [draft, setDraft] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ['whatsapp_conversations'],
    queryFn: () => whatsappConversationsService.listConversations(),
    refetchOnWindowFocus: false,
  });

  const filtered = useMemo(
    () => conversations.filter(c => matchesFilter(c.status, filter)),
    [conversations, filter]
  );

  const selected = conversations.find(c => c.id === selectedId) ?? null;

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['whatsapp_messages', selectedId],
    queryFn: () => whatsappConversationsService.getMessages(selectedId as string),
    enabled: Boolean(selectedId),
    refetchOnWindowFocus: false,
  });

  // Realtime: novas conversas/mensagens refletem sem refresh
  useEffect(() => {
    const channel = supabase
      .channel('admin-whatsapp-conversas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] });
        const convId = (payload.new as { conversation_id?: string } | null)?.conversation_id;
        if (convId) queryClient.invalidateQueries({ queryKey: ['whatsapp_messages', convId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    setSuggestion(null);
    setDraft('');
  }, [selectedId]);

  const handleAssume = async () => {
    if (!selected) return;
    try {
      await whatsappConversationsService.assume(selected.id);
      queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] });
      toast.success('Você assumiu a conversa.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao assumir conversa.');
    }
  };

  const handleReturnToBot = async () => {
    if (!selected) return;
    try {
      await whatsappConversationsService.returnToBot(selected.id);
      queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] });
      toast.success('Conversa devolvida pro bot.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao devolver conversa.');
    }
  };

  const handleSend = async (text: string) => {
    if (!selected || !text.trim() || sending) return;
    setSending(true);
    try {
      await whatsappConversationsService.reply(selected.id, text.trim());
      setDraft('');
      setSuggestion(null);
      queryClient.invalidateQueries({ queryKey: ['whatsapp_messages', selected.id] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleSuggest = async () => {
    if (!selected) return;
    setLoadingSuggestion(true);
    try {
      const text = await whatsappConversationsService.suggestReply(selected.id);
      setSuggestion(text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar sugestão.');
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const showList = !isMobile || !selectedId;
  const showThread = !isMobile || Boolean(selectedId);

  return (
    <div style={{ width: '100%', fontFamily: "'DM Sans',sans-serif", display: 'flex', flexDirection: 'column', gap: '1rem', height: 'calc(100vh - 7rem)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4A6580', marginBottom: '0.25rem' }}>WhatsApp</p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageCircle size={18} style={{ color: '#34d399' }} />
            Conversas
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#4A6580' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.6)', display: 'inline-block', animation: 'wa-pulse 1.6s ease-in-out infinite' }} />
          Ao vivo
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([
          { key: 'all', label: 'Todas' },
          { key: 'you', label: 'Você' },
          { key: 'bot', label: 'Bot ativo' },
          { key: 'resolved', label: 'Resolvidas' },
        ] as { key: ListFilter; label: string }[]).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              height: '2rem', padding: '0 0.875rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
              background: filter === f.key ? 'linear-gradient(135deg,#10b981,#059669)' : '#132236',
              border: filter === f.key ? 'none' : '1px solid #1C3050',
              color: filter === f.key ? 'white' : '#94a3b8',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>

        {/* Lista */}
        {showList && (
          <div style={{ width: isMobile ? '100%' : 360, flexShrink: 0, background: '#132236', border: '1px solid #1C3050', borderRadius: '1rem', overflowY: 'auto' }}>
            {loadingConversations && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: '#34d399' }} />
              </div>
            )}
            {!loadingConversations && filtered.length === 0 && (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#4A6580', fontSize: '0.8125rem' }}>
                Nenhuma conversa por aqui.
              </div>
            )}
            {filtered.map(c => {
              const badge = CONTACT_TYPE_BADGE[c.contact_type];
              const isSelected = c.id === selectedId;
              const preview = c.last_message_preview;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1rem',
                    background: isSelected ? 'rgba(52,211,153,0.08)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,.04)', border: 'none', borderLeft: isSelected ? '3px solid #34d399' : '3px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <Avatar name={c.full_name} avatarUrl={c.avatar_url} size={38} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name}</span>
                      <MoodIcon mood={c.mood} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '1px 7px', borderRadius: '1rem', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        {badge.label}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#4A6580', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                      {preview ?? 'Sem mensagens ainda'}
                    </p>
                  </div>
                  <span style={{ fontSize: '0.625rem', color: '#4A6580', flexShrink: 0 }}>{timeLabel(c.last_message_at)}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Thread */}
        {showThread && (
          <div style={{ flex: 1, minWidth: 0, background: '#132236', border: '1px solid #1C3050', borderRadius: '1rem', display: 'flex', flexDirection: 'column' }}>
            {!selected && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A6580', fontSize: '0.8125rem' }}>
                Selecione uma conversa
              </div>
            )}
            {selected && (
              <ConversationThread
                conversation={selected}
                messages={messages}
                loadingMessages={loadingMessages}
                isMobile={isMobile}
                onBack={() => setSelectedId(null)}
                onOpenInfo={() => setShowInfoModal(true)}
                onAssume={handleAssume}
                onReturnToBot={handleReturnToBot}
                draft={draft}
                setDraft={setDraft}
                onSend={() => handleSend(draft)}
                sending={sending}
                suggestion={suggestion}
                loadingSuggestion={loadingSuggestion}
                onSuggest={handleSuggest}
                onUseSuggestion={() => { if (suggestion) handleSend(suggestion); }}
                onEditSuggestion={() => { if (suggestion) { setDraft(suggestion); setSuggestion(null); } }}
                messagesEndRef={messagesEndRef}
              />
            )}
          </div>
        )}
      </div>

      {showInfoModal && selected && (
        <ContactInfoModal conversation={selected} onClose={() => setShowInfoModal(false)} />
      )}

      <style>{`@keyframes wa-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }`}</style>
    </div>
  );
}

function ConversationThread({
  conversation, messages, loadingMessages, isMobile, onBack, onOpenInfo, onAssume, onReturnToBot,
  draft, setDraft, onSend, sending, suggestion, loadingSuggestion, onSuggest, onUseSuggestion, onEditSuggestion,
  messagesEndRef,
}: {
  conversation: WhatsAppConversation;
  messages: WhatsAppMessage[];
  loadingMessages: boolean;
  isMobile: boolean;
  onBack: () => void;
  onOpenInfo: () => void;
  onAssume: () => void;
  onReturnToBot: () => void;
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  suggestion: string | null;
  loadingSuggestion: boolean;
  onSuggest: () => void;
  onUseSuggestion: () => void;
  onEditSuggestion: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const badge = CONTACT_TYPE_BADGE[conversation.contact_type];
  const status = STATUS_INFO[conversation.status];
  const canReply = conversation.status !== 'bot_active';
  const showSuggestCard = conversation.status === 'needs_human' || conversation.status === 'human_active';

  return (
    <>
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1C3050' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isMobile && (
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <Undo2 size={18} />
            </button>
          )}
          <Avatar name={conversation.full_name} avatarUrl={conversation.avatar_url} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'white' }}>{conversation.full_name}</span>
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '1px 7px', borderRadius: '1rem', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, textTransform: 'uppercase' }}>
                {badge.label}
              </span>
            </div>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: '1rem', background: status.bg, color: status.color, border: `1px solid ${status.border}`, display: 'inline-block', marginTop: 4 }}>
              {status.label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={onOpenInfo} title="Ver detalhes" style={{ width: 32, height: 32, borderRadius: '0.5rem', background: '#0d1929', border: '1px solid #1C3050', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Info size={15} />
            </button>
            {conversation.status === 'human_active' || conversation.status === 'needs_human' ? (
              <button onClick={onReturnToBot} style={{ height: 32, padding: '0 0.75rem', borderRadius: '0.5rem', background: 'transparent', border: '1px solid rgba(167,139,250,.3)', color: '#a78bfa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Bot size={13} /> {!isMobile && 'Devolver pro bot'}
              </button>
            ) : (
              <button onClick={onAssume} style={{ height: 32, padding: '0 0.75rem', borderRadius: '0.5rem', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                <UserCheck size={13} /> {!isMobile && 'Assumir conversa'}
              </button>
            )}
          </div>
        </div>
        {conversation.status === 'needs_human' && conversation.handoff_reason && (
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', fontWeight: 600, padding: '3px 10px', borderRadius: '0.5rem', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
            {conversation.handoff_reason}
          </div>
        )}
      </div>

      {/* Mensagens */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loadingMessages && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
            <Loader2 size={20} className="animate-spin" style={{ color: '#34d399' }} />
          </div>
        )}
        {!loadingMessages && messages.map(m => {
          if (m.sender === 'system') {
            return (
              <div key={m.id} style={{ textAlign: 'center', margin: '0.5rem 0' }}>
                <span style={{ fontSize: '0.6875rem', color: '#4A6580', background: '#0d1929', border: '1px solid #1C3050', borderRadius: '1rem', padding: '3px 12px' }}>
                  {m.body} às {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          }
          const isOutbound = m.direction === 'outbound';
          const senderLabel = m.sender === 'bot' ? 'IA' : m.sender === 'human' ? 'Você' : 'Contato';
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isOutbound ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '72%', padding: '0.5rem 0.75rem', borderRadius: '0.75rem',
                background: isOutbound ? 'rgba(16,185,129,0.14)' : '#0d1929',
                border: isOutbound ? '1px solid rgba(16,185,129,0.25)' : '1px solid #1C3050',
                borderBottomRightRadius: isOutbound ? 2 : '0.75rem',
                borderBottomLeftRadius: isOutbound ? '0.75rem' : 2,
              }}>
                {isOutbound && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    {m.sender === 'bot' ? <Bot size={11} style={{ color: '#a78bfa' }} /> : <User size={11} style={{ color: '#34d399' }} />}
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, color: m.sender === 'bot' ? '#a78bfa' : '#34d399' }}>{senderLabel}</span>
                  </div>
                )}
                <p style={{ fontSize: '0.8125rem', color: '#e2e8f0', margin: 0, whiteSpace: 'pre-wrap' }}>{m.body}</p>
                <p style={{ fontSize: '0.5625rem', color: '#4A6580', margin: '3px 0 0', textAlign: 'right' }}>
                  {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Rascunho sugerido */}
      {showSuggestCard && (
        <div style={{ margin: '0 1.25rem 0.75rem', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '0.75rem', padding: '0.75rem' }}>
          {!suggestion && (
            <button onClick={onSuggest} disabled={loadingSuggestion} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#a78bfa', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
              {loadingSuggestion ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Sugerir resposta com IA
            </button>
          )}
          {suggestion && (
            <div>
              <p style={{ fontSize: '0.75rem', color: '#e2e8f0', margin: '0 0 8px' }}>{suggestion}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onUseSuggestion} style={{ height: 28, padding: '0 0.75rem', borderRadius: '0.5rem', background: '#a78bfa', border: 'none', color: 'white', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}>Usar</button>
                <button onClick={onEditSuggestion} style={{ height: 28, padding: '0 0.75rem', borderRadius: '0.5rem', background: 'transparent', border: '1px solid rgba(167,139,250,.4)', color: '#a78bfa', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}>Editar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Caixa de resposta */}
      <div style={{ padding: '0.75rem 1.25rem 1.25rem' }}>
        {!canReply && (
          <p style={{ fontSize: '0.6875rem', color: '#4A6580', marginBottom: 6 }}>
            O bot está no controle desta conversa. Assuma a conversa pra responder manualmente.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, opacity: canReply ? 1 : 0.5 }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            disabled={!canReply || sending}
            placeholder={canReply ? 'Digite uma mensagem...' : 'Indisponível — bot ativo'}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            style={{ flex: 1, height: '2.5rem', background: '#0d1929', border: '1px solid #1C3050', borderRadius: '0.625rem', color: '#e2e8f0', fontSize: '0.8125rem', padding: '0 0.875rem', outline: 'none' }}
          />
          <button
            onClick={onSend}
            disabled={!canReply || sending || !draft.trim()}
            style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.625rem', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: 'white', cursor: canReply ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !canReply || sending || !draft.trim() ? 0.6 : 1 }}
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </>
  );
}

function ContactInfoModal({ conversation, onClose }: { conversation: WhatsAppConversation; onClose: () => void }) {
  const profileLink = conversation.contact_type === 'professional' ? '/admin/usuarios' : '/admin/clientes';
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#132236', border: '1px solid #1C3050', borderRadius: '1rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>Sobre {conversation.full_name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <InfoRow icon={<MapPin size={13} />} label="Telefone" value={conversation.phone} />
          <InfoRow icon={<Calendar size={13} />} label="Cadastro" value={new Date(conversation.created_at).toLocaleDateString('pt-BR')} />
          <InfoRow icon={<Coins size={13} />} label="Campanha" value={conversation.campaign ?? '—'} />
          <InfoRow icon={<Clock size={13} />} label="Última atividade" value={new Date(conversation.last_message_at).toLocaleString('pt-BR')} />
          <InfoRow icon={<MoodIcon mood={conversation.mood} />} label="Humor detectado" value={conversation.mood ?? 'neutro'} />
        </div>
        {conversation.contact_id && (
          <Link to={profileLink} onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: '1.25rem', fontSize: '0.8125rem', fontWeight: 700, color: '#60a5fa', textDecoration: 'none' }}>
            Ver perfil completo →
          </Link>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0d1929', border: '1px solid #1C3050', borderRadius: '0.625rem', padding: '0.625rem 0.875rem' }}>
      <span style={{ color: '#4A6580', display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: '0.75rem', color: '#4A6580', flex: 1 }}>{label}</span>
      <span style={{ fontSize: '0.8125rem', color: '#e2e8f0', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
