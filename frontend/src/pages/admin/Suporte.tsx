import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Bot, User, Loader2, ChevronDown, ChevronUp, Save, LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

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
  created_at: string;
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; cls: string }> = {
  open:     { label: 'Aberto',    cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  pending:  { label: 'Pendente',  cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  resolved: { label: 'Resolvido', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
};

async function fetchTickets(): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Ticket[];
}

export default function AdminSuporte() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['support_tickets'],
    queryFn: fetchTickets,
    refetchOnWindowFocus: false,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status?: TicketStatus; note?: string }) => {
      const payload: Record<string, unknown> = {};
      if (status !== undefined) payload.status = status;
      if (note !== undefined) payload.internal_note = note;
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
          <LifeBuoy size={20} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Suporte</h1>
          <p className="text-[#94A3B8] text-sm">
            {openCount > 0
              ? <span className="text-red-400 font-semibold">{openCount} ticket{openCount > 1 ? 's' : ''} aberto{openCount > 1 ? 's' : ''}</span>
              : 'Nenhum ticket aberto'}
          </p>
        </div>
      </div>

      {tickets.length === 0 && (
        <div className="py-24 text-center text-[#4A6580]">
          <LifeBuoy size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-medium">Nenhum ticket de suporte ainda.</p>
        </div>
      )}

      <div className="space-y-3">
        {tickets.map((ticket) => {
          const expanded = expandedId === ticket.id;
          const status = (ticket.status as TicketStatus) in STATUS_CONFIG ? ticket.status as TicketStatus : 'open';
          const cfg = STATUS_CONFIG[status];
          const lastMsg = ticket.conversation?.at(-1);
          const noteVal = notes[ticket.id] ?? (ticket.internal_note || '');

          return (
            <div key={ticket.id} className="bg-[#1C3454] border border-[#1C3050] rounded-2xl overflow-hidden">
              {/* Card header */}
              <button
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpandedId(expanded ? null : ticket.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg border', cfg.cls)}>
                      {cfg.label}
                    </span>
                    <span className="text-slate-600 text-xs">
                      {new Date(ticket.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-white font-medium text-sm truncate">
                    {ticket.email || ticket.user_id || 'Visitante anônimo'}
                  </p>
                  {lastMsg && (
                    <p className="text-[#4A6580] text-xs mt-0.5 truncate">
                      {lastMsg.role === 'model' ? '🤖' : '👤'} {lastMsg.text}
                    </p>
                  )}
                </div>
                {expanded ? <ChevronUp size={16} className="text-[#4A6580] shrink-0" /> : <ChevronDown size={16} className="text-[#4A6580] shrink-0" />}
              </button>

              {/* Expanded content */}
              {expanded && (
                <div className="border-t border-[#1C3050] p-5 space-y-5">
                  {/* Conversation */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
                    {(ticket.conversation ?? []).map((msg, i) => (
                      <div key={i} className={cn('flex items-end gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                        {msg.role === 'model' && (
                          <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                            <Bot size={10} className="text-emerald-400" />
                          </div>
                        )}
                        <div className={cn(
                          'max-w-[75%] px-3 py-2 rounded-xl text-xs leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-emerald-500/15 border border-emerald-500/25 text-white rounded-br-sm'
                            : 'bg-[#0E1C32] border border-[#1C3050] text-slate-200 rounded-bl-sm'
                        )}>
                          {msg.text}
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-5 h-5 bg-slate-700 rounded-full flex items-center justify-center shrink-0">
                            <User size={10} className="text-slate-300" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Controls */}
                  <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-[#1C3050]">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#4A6580] uppercase tracking-widest">Status</label>
                      <select
                        value={status}
                        onChange={(e) => updateMutation.mutate({ id: ticket.id, status: e.target.value as TicketStatus })}
                        className="w-full bg-[#0E1C32] border border-[#243F6A] text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer"
                      >
                        <option value="open">Aberto</option>
                        <option value="pending">Pendente</option>
                        <option value="resolved">Resolvido</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#4A6580] uppercase tracking-widest">Nota interna</label>
                      <div className="flex gap-2">
                        <textarea
                          rows={1}
                          value={noteVal}
                          onChange={(e) => setNotes(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                          placeholder="Adicionar nota..."
                          className="flex-1 bg-[#0E1C32] border border-[#243F6A] text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500/50 resize-none"
                        />
                        <button
                          onClick={() => updateMutation.mutate({ id: ticket.id, note: noteVal })}
                          disabled={updateMutation.isPending}
                          className="px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl transition-colors"
                          title="Salvar nota"
                        >
                          {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
