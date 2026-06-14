import { useState, useMemo } from 'react';
import { Search, RefreshCw, Banknote, User, Phone, Calendar, Coins, CheckCircle, XCircle, CreditCard } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface WithdrawalRequest {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  coins_amount: number;
  brl_amount: number;
  pix_key: string;
  pix_key_type: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  admin_note: string | null;
  requested_at: string;
  processed_at: string | null;
  current_balance: number;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'paid' | 'rejected';

// ── helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return phone;
}

const STATUS_META: Record<string, { label: string; stripe: string; badge: { bg: string; color: string; border: string } }> = {
  pending:  { label: 'Pendente',  stripe: '#f59e0b', badge: { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b',  border: 'rgba(245,158,11,0.3)'  } },
  approved: { label: 'Aprovado',  stripe: '#60a5fa', badge: { bg: 'rgba(96,165,250,0.1)',   color: '#60a5fa',  border: 'rgba(96,165,250,0.3)'  } },
  paid:     { label: 'Pago',      stripe: '#34d399', badge: { bg: 'rgba(52,211,153,0.1)',   color: '#34d399',  border: 'rgba(52,211,153,0.3)'  } },
  rejected: { label: 'Rejeitado', stripe: '#f87171', badge: { bg: 'rgba(248,113,113,0.1)',  color: '#f87171',  border: 'rgba(248,113,113,0.3)' } },
};

// ── sub-components ────────────────────────────────────────────────────────────

function Avatar({ name, size = 46 }: { name: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(96,165,250,0.15)', border: '1.5px solid rgba(96,165,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, color: '#60a5fa', flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

function NoteInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Nota admin (opcional)"
      style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '.5rem', padding: '0 10px', height: 32, fontSize: 12, color: 'white', outline: 'none', minWidth: 0 }}
    />
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function AdminSaques() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const { data: list = [], isLoading, refetch } = useQuery<WithdrawalRequest[]>({
    queryKey: ['adminSaques'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_withdrawal_requests')
        .select('*')
        .order('requested_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WithdrawalRequest[];
    },
    staleTime: 30_000,
  });

  const processWithdrawal = async (id: string, action: 'approve' | 'reject' | 'pay') => {
    setProcessing(id + action);
    const note = notes[id] ?? '';
    const { data, error } = await supabase.rpc('admin_process_withdrawal', {
      p_request_id: id,
      p_action: action,
      p_note: note || null,
    });
    setProcessing(null);
    if (error || !(data as { ok?: boolean })?.ok) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? 'Erro desconhecido');
      return;
    }
    toast.success(
      action === 'pay' ? 'Marcado como pago!' :
      action === 'approve' ? 'Saque aprovado!' :
      'Rejeitado — moedas devolvidas ao cliente.'
    );
    setNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
    refetch();
  };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const kpis = useMemo(() => {
    const pending = list.filter(r => r.status === 'pending');
    const toPay = list.filter(r => r.status === 'pending' || r.status === 'approved');
    const paidMonth = list.filter(r => r.status === 'paid' && (r.processed_at ?? '') >= startOfMonth);
    const rejMonth = list.filter(r => r.status === 'rejected' && (r.processed_at ?? '') >= startOfMonth);
    return [
      { label: 'Pendentes', value: String(pending.length), color: '#f59e0b' },
      { label: 'Total a pagar', value: `R$${formatBRL(toPay.reduce((a, r) => a + r.brl_amount, 0))}`, color: '#60a5fa' },
      { label: 'Pagos este mês', value: String(paidMonth.length), color: '#34d399' },
      { label: 'Rejeitados (mês)', value: String(rejMonth.length), color: '#f87171' },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const statusCounts = useMemo(() => ({
    all: list.length,
    pending: list.filter(r => r.status === 'pending').length,
    approved: list.filter(r => r.status === 'approved').length,
    paid: list.filter(r => r.status === 'paid').length,
    rejected: list.filter(r => r.status === 'rejected').length,
  }), [list]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return list.filter(r => {
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      const matchSearch = !q ||
        r.full_name.toLowerCase().includes(q) ||
        r.pix_key.toLowerCase().includes(q) ||
        r.phone.includes(q);
      return matchStatus && matchSearch;
    });
  }, [list, filterStatus, search]);

  const statusLabels: Record<StatusFilter, string> = {
    all: 'Todos', pending: 'Pendentes', approved: 'Aprovados', paid: 'Pagos', rejected: 'Rejeitados',
  };

  function renderCard(r: WithdrawalRequest) {
    const meta = STATUS_META[r.status] ?? STATUS_META.pending;
    const isPending = r.status === 'pending';
    const isApproved = r.status === 'approved';
    const isDone = r.status === 'paid' || r.status === 'rejected';
    const noteVal = notes[r.id] ?? '';

    return (
      <div key={r.id} style={{ background: '#132540', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: '1rem', overflow: 'hidden' }}>
        <div style={{ height: 3, background: meta.stripe }} />
        <div style={{ padding: '1.125rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* Row 1 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={r.full_name} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: '0 0 3px' }}>{r.full_name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Phone size={10} />{formatPhone(r.phone)}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: meta.badge.bg, color: meta.badge.color, border: `0.5px solid ${meta.badge.border}` }}>
                    {meta.label}
                  </span>
                  {r.current_balance !== undefined && (
                    <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Coins size={10} />saldo atual: {r.current_balance}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '.05em' }}>Solicitado</p>
              <p style={{ fontSize: 12, color: 'white', fontWeight: 600, margin: 0 }}>{formatDate(r.requested_at)}</p>
              {r.processed_at && <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>Processado: {formatDate(r.processed_at)}</p>}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {[
              { label: 'Moedas', icon: <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 3 }}><Coins size={12} />{r.coins_amount.toLocaleString('pt-BR')}</span> },
              { label: 'Valor R$', icon: <span style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>R${formatBRL(r.brl_amount)}</span> },
              { label: 'Chave Pix', icon: <span style={{ fontSize: 11, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%' }}>{r.pix_key}</span> },
              { label: 'Tipo Pix', icon: <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{r.pix_key_type}</span> },
            ].map((s, i) => (
              <div key={i} style={{ padding: '0.625rem 0.75rem', background: '#0f1f35', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 4px' }}>{s.label}</p>
                {s.icon}
              </div>
            ))}
          </div>

          {/* Nota admin existente */}
          {r.admin_note && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '.5rem', padding: '0.5rem 0.75rem', fontSize: 12, color: '#94a3b8' }}>
              📝 {r.admin_note}
            </div>
          )}

          {/* Ações */}
          {!isDone && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <NoteInput value={noteVal} onChange={v => setNotes(prev => ({ ...prev, [r.id]: v }))} />
                <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                  <button
                    onClick={() => processWithdrawal(r.id, 'reject')}
                    disabled={processing !== null}
                    style={{ height: 32, padding: '0 12px', borderRadius: '.5rem', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: processing ? .6 : 1 }}
                  >
                    <XCircle size={12} /> Rejeitar
                  </button>
                  {isPending && (
                    <button
                      onClick={() => processWithdrawal(r.id, 'approve')}
                      disabled={processing !== null}
                      style={{ height: 32, padding: '0 12px', borderRadius: '.5rem', background: 'transparent', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: processing ? .6 : 1 }}
                    >
                      <CheckCircle size={12} /> Aprovar
                    </button>
                  )}
                  <button
                    onClick={() => processWithdrawal(r.id, 'pay')}
                    disabled={processing !== null}
                    style={{ height: 32, padding: '0 12px', borderRadius: '.5rem', background: '#1D9E75', border: 'none', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: processing ? .6 : 1 }}
                  >
                    <CreditCard size={12} /> Marcar como Pago
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: '0 0 4px' }}>Gestão de Saques</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Solicitações de saque via Pix · aprovação e pagamento manual</p>
        </div>
        <button
          onClick={() => refetch()}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#0d1e33', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#64748b', fontSize: 12, cursor: 'pointer' }}
        >
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.625rem' }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{ background: '#132540', border: '1.5px solid rgba(255,255,255,0.07)', borderRadius: '.5rem', padding: '.875rem 1rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: k.color }} />
            <div style={{ paddingLeft: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', margin: '0 0 5px' }}>{k.label}</p>
              <p style={{ fontSize: i === 1 ? 16 : 22, fontWeight: 700, color: k.color, margin: 0, lineHeight: 1 }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {(['all', 'pending', 'approved', 'paid', 'rejected'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{ height: 34, padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: filterStatus === s ? `1px solid ${STATUS_META[s]?.badge.border ?? 'rgba(29,158,117,0.3)'}` : '1px solid rgba(255,255,255,0.08)', background: filterStatus === s ? (STATUS_META[s]?.badge.bg ?? 'rgba(29,158,117,0.12)') : 'transparent', color: filterStatus === s ? (STATUS_META[s]?.badge.color ?? '#34d399') : '#64748b' }}
            >
              {statusLabels[s]} <span style={{ opacity: .6 }}>({statusCounts[s]})</span>
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, chave Pix, telefone..."
            style={{ width: '100%', background: '#0d1e33', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.625rem 0.875rem 0.625rem 2.25rem', fontSize: 13, color: 'white', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Banknote size={32} style={{ color: '#f59e0b', opacity: .5 }} />
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '4rem 1rem' }}>
          <Banknote size={48} style={{ opacity: .2, color: '#64748b' }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'white', margin: 0 }}>Nenhum saque encontrado</p>
          <p style={{ fontSize: 13, margin: 0, color: '#64748b' }}>{search ? 'Nenhum resultado para a busca.' : 'Nenhuma solicitação de saque ainda.'}</p>
        </div>
      )}

      {/* Cards */}
      {!isLoading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {filtered.map(renderCard)}
        </div>
      )}
    </div>
  );
}
