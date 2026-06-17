import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Bot, User, Loader2, ChevronDown, ChevronUp, Save, LifeBuoy, Clock, MapPin, MessageSquare, FileText } from 'lucide-react';
import { toast } from 'sonner';

type TicketStatus = 'open' | 'pending' | 'resolved';

interface ConversationMessage {
  role: 'user' | 'model';
  text: string;
  time?: string;
}

interface Ticket {
  id: string;
  user_id: string | null;
  email: string | null;
  conversation: ConversationMessage[];
  status: TicketStatus;
  internal_note: string | null;
  admin_note: string | null;
  status_history: { status: string; changed_at: string }[];
  created_at: string;
  updated_at: string;
  role?: 'client' | 'professional' | 'admin' | null;
  city?: string | null;
  full_name?: string | null;
}

async function fetchTickets(): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select(`*, profiles:user_id ( role, city, full_name )`)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((row: unknown) => {
    const r = row as Record<string, unknown>;
    const profile = r.profiles as { role?: string; city?: string; full_name?: string } | null;
    return {
      ...r,
      role: profile?.role ?? null,
      city: profile?.city ?? null,
      full_name: profile?.full_name ?? null,
      internal_note: (r.internal_note ?? r.admin_note ?? null) as string | null,
      status_history: (r.status_history ?? []) as { status: string; changed_at: string }[],
    } as Ticket;
  });
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; bg: string; border: string }> = {
  open:     { label: 'ABERTO',    color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' },
  pending:  { label: 'PENDENTE',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)'  },
  resolved: { label: 'RESOLVIDO', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)'  },
};

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  client:       { label: 'Cliente',      color: '#60a5fa', bg: 'rgba(96,165,250,0.1)'  },
  professional: { label: 'Profissional', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  admin:        { label: 'Admin',        color: '#f87171', bg: 'rgba(239,68,68,0.1)'   },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h`;
  return 'agora';
}

export default function AdminSuporte() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | TicketStatus>('all');

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['support_tickets'],
    queryFn: fetchTickets,
    refetchOnWindowFocus: false,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status?: TicketStatus; note?: string }) => {
      const payload: Record<string, unknown> = {};
      if (status !== undefined) {
        payload.status = status;
        const { data: current } = await supabase
          .from('support_tickets')
          .select('status_history')
          .eq('id', id)
          .single();
        const history = (current?.status_history ?? []) as { status: string; changed_at: string }[];
        payload.status_history = [...history, { status, changed_at: new Date().toISOString() }];
      }
      if (note !== undefined) {
        payload.internal_note = note;
        payload.admin_note = note;
      }
      const { error } = await supabase.from('support_tickets').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support_tickets'] });
      toast.success('Ticket atualizado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCount = tickets.filter(t => t.status === 'open').length;
  const pendingCount = tickets.filter(t => t.status === 'pending').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;
  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8rem 0' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#10b981' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', fontFamily: 'DM Sans, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LifeBuoy size={20} color="#f87171" />
          </div>
          <div>
            <h1 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 900, margin: '0 0 2px', letterSpacing: '-.02em' }}>Suporte</h1>
            <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>
              {openCount > 0
                ? <span style={{ color: '#f87171', fontWeight: 700 }}>{openCount} ticket{openCount > 1 ? 's' : ''} aberto{openCount > 1 ? 's' : ''}</span>
                : <span>Nenhum ticket aberto</span>}
              <span style={{ color: '#475569' }}> · {tickets.length} no total</span>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['open', 'pending', 'resolved'] as TicketStatus[]).map(s => {
            const cfg = STATUS_CONFIG[s];
            const count = s === 'open' ? openCount : s === 'pending' ? pendingCount : resolvedCount;
            return (
              <div key={s} style={{ background: '#0a1928', border: `1px solid ${cfg.border}`, borderRadius: '.625rem', padding: '8px 14px', textAlign: 'center', minWidth: 56 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: cfg.color, fontFamily: 'DM Mono, monospace', lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{cfg.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {(['all', 'open', 'pending', 'resolved'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? '#10b981' : '#0a1928',
              border: filter === f ? 'none' : '1px solid #1C3050',
              borderRadius: '.5rem',
              color: filter === f ? '#fff' : '#64748b',
              fontSize: 12, fontWeight: 700,
              padding: '6px 14px', cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {f === 'all' ? 'Todos' : f === 'open' ? 'Abertos' : f === 'pending' ? 'Pendentes' : 'Resolvidos'}
          </button>
        ))}
      </div>

      {tickets.length === 0 && (
        <div style={{ padding: '6rem 0', textAlign: 'center', color: '#4A6580' }}>
          <LifeBuoy size={48} style={{ margin: '0 auto 1rem', opacity: 0.2, display: 'block' }} />
          <p style={{ fontWeight: 500 }}>Nenhum ticket de suporte ainda.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((ticket) => {
          const expanded = expandedId === ticket.id;
          const status = ticket.status in STATUS_CONFIG ? ticket.status as TicketStatus : 'open';
          const cfg = STATUS_CONFIG[status];
          const roleCfg = ticket.role ? ROLE_CONFIG[ticket.role] : null;
          const lastMsg = ticket.conversation?.at(-1);
          const noteVal = notes[ticket.id] ?? (ticket.internal_note || '');
          const msgCount = ticket.conversation?.length ?? 0;
          const isResolved = status === 'resolved';

          return (
            <div key={ticket.id} style={{ background: '#0d1e33', border: '1px solid #1e3a5f', borderRadius: '1rem', overflow: 'hidden', opacity: isResolved ? 0.6 : 1 }}>
              <div style={{ height: 3, background: cfg.color }} />
              <div style={{ padding: '1rem 1.25rem' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <User size={16} color={cfg.color} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ticket.full_name || ticket.email || ticket.user_id || 'Visitante anônimo'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: '#64748b' }}>
                          {new Date(ticket.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {roleCfg && (
                          <span style={{ fontSize: 10, background: roleCfg.bg, color: roleCfg.color, padding: '1px 6px', borderRadius: 4 }}>
                            {roleCfg.label}
                          </span>
                        )}
                        {ticket.city && (
                          <span style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MapPin size={10} /> {ticket.city}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999 }}>
                      {cfg.label}
                    </span>
                    <button
                      onClick={() => setExpandedId(expanded ? null : ticket.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2, display: 'flex' }}
                    >
                      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={12} color={isResolved ? '#64748b' : cfg.color} />
                    <span style={{ fontSize: 11, color: isResolved ? '#64748b' : cfg.color, fontWeight: 600 }}>
                      {isResolved ? `Resolvido em ${timeAgo(ticket.updated_at)}` : `Aberto há ${timeAgo(ticket.created_at)}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <MessageSquare size={12} color="#64748b" />
                    <span style={{ fontSize: 11, color: '#64748b' }}>{msgCount} mensagens</span>
                  </div>
                </div>

                {/* Preview */}
                {lastMsg && (
                  <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lastMsg.role === 'model'
                      ? <Bot size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4, color: '#10b981' }} />
                      : <User size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />}
                    {lastMsg.text}
                  </p>
                )}

                {/* Nota visível no card */}
                {noteVal && (
                  <div style={{ background: '#0a1928', border: '1px solid #1C3050', borderRadius: '.5rem', padding: '7px 10px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <FileText size={12} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>{noteVal}</span>
                  </div>
                )}

                {/* Expanded */}
                {expanded && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid #1C3050', paddingTop: '1rem' }}>

                    {/* Conversa */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1rem', maxHeight: 200, overflowY: 'auto' }}>
                      {(ticket.conversation ?? []).map((msg, i) => (
                        <div key={i} style={{ display: 'flex', gap: 7, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                          {msg.role === 'model' && (
                            <div style={{ width: 18, height: 18, background: 'rgba(16,185,129,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                              <Bot size={9} color="#10b981" />
                            </div>
                          )}
                          <div style={{
                            background: msg.role === 'user' ? 'rgba(16,185,129,0.08)' : '#0a1928',
                            border: msg.role === 'user' ? '1px solid rgba(16,185,129,0.2)' : '1px solid #1C3050',
                            borderRadius: '.5rem',
                            borderBottomRightRadius: msg.role === 'user' ? 2 : '.5rem',
                            borderBottomLeftRadius: msg.role === 'model' ? 2 : '.5rem',
                            padding: '7px 9px', maxWidth: '78%',
                          }}>
                            <div style={{ color: msg.role === 'user' ? '#f1f5f9' : '#e2e8f0', fontSize: 11, lineHeight: 1.5 }}>{msg.text}</div>
                          </div>
                          {msg.role === 'user' && (
                            <div style={{ width: 18, height: 18, background: '#1C3454', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                              <User size={9} color="#94a3b8" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Histórico de status */}
                    {(ticket.status_history ?? []).length > 0 && (
                      <div style={{ background: '#0a1928', border: '1px solid #1C3050', borderRadius: '.5rem', padding: '8px 10px', marginBottom: '1rem' }}>
                        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Histórico de status</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {(ticket.status_history as { status: string; changed_at: string }[]).map((h, i) => {
                            const hcfg = STATUS_CONFIG[h.status as TicketStatus];
                            return (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: hcfg?.color ?? '#64748b', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                  {hcfg?.label ?? h.status} em {new Date(h.changed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Controles */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Status</label>
                        <select
                          value={status}
                          onChange={(e) => updateMutation.mutate({ id: ticket.id, status: e.target.value as TicketStatus })}
                          style={{ width: '100%', background: '#0a1928', border: '1px solid #1e3a5f', borderRadius: '.5rem', color: '#f1f5f9', fontSize: 12, padding: '8px 10px', fontFamily: 'DM Sans, sans-serif' }}
                        >
                          <option value="open">Aberto</option>
                          <option value="pending">Pendente</option>
                          <option value="resolved">Resolvido</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Nota interna</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="text"
                            value={noteVal}
                            onChange={(e) => setNotes(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                            placeholder="Adicionar nota..."
                            maxLength={500}
                            style={{ flex: 1, background: '#0a1928', border: '1px solid #1e3a5f', borderRadius: '.5rem', color: '#f1f5f9', fontSize: 11, padding: '8px 9px', fontFamily: 'DM Sans, sans-serif', outline: 'none', minWidth: 0 }}
                          />
                          <button
                            onClick={() => updateMutation.mutate({ id: ticket.id, note: noteVal })}
                            disabled={updateMutation.isPending}
                            style={{ background: '#10b981', border: 'none', borderRadius: '.5rem', color: '#fff', padding: '0 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            {updateMutation.isPending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
