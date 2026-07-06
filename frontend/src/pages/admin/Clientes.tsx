import { useMemo, useState } from 'react';
import { Search, Loader2, MapPin, MessageSquare, ChevronLeft, ChevronRight, ChevronDown, Coins } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminService, type EnrichedUser } from '../../services/dbServices';
import { supabase } from '../../lib/supabase';

type ChipFilter = 'all' | 'never' | 'recurring';

const PAGE_SIZE = 20;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function initials(name: string | null): string {
  if (!name?.trim()) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const full = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${full}`;
}

const ORIGIN_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  meta_ads: { label: 'Meta Ads', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' },
  organic:  { label: 'Orgânico', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)' },
  referral: { label: 'Indicação', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' },
};

function OriginBadge({ origin }: { origin: string | null }) {
  const b = origin ? ORIGIN_BADGE[origin] : undefined;
  if (!b) return <span style={{ fontSize: 12, color: '#4a6580' }}>—</span>;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: b.bg, color: b.color, border: `0.5px solid ${b.border}` }}>
      {b.label}
    </span>
  );
}

function CoinsBadge({ balance }: { balance: number }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: balance > 0 ? '#fbbf24' : '#4a6580', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Coins size={11} /> {balance}
    </span>
  );
}

// Mesmo padrão do Hint de Aprovados.tsx, adaptado pro contexto de cliente,
// com segunda linha da categoria mais pedida quando há pedidos
function ClientInsight({ totalLeads, topCategory }: { totalLeads: number; topCategory: string | null }) {
  if (totalLeads === 0)
    return <span style={{ fontSize: 11, color: '#f59e0b' }}>⚠ Nunca criou pedido</span>;
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: '#34d399' }}>✓ Criou {totalLeads} pedido{totalLeads === 1 ? '' : 's'}</span>
      {topCategory && <span style={{ fontSize: 10, color: '#64748b' }}>Mais pede: {topCategory}</span>}
    </span>
  );
}

export default function AdminClientes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [chip, setChip] = useState<ChipFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Mesma query (e queryKey) da tela Usuários — cache compartilhado
  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['adminUsersEnriched'],
    queryFn: async () => {
      const [users, authData] = await Promise.all([
        adminService.getUsersEnriched(),
        adminService.getUserAuthData(),
      ]);
      return users.map(u => ({
        ...u,
        email: authData[u.id]?.email ?? u.email,
        last_sign_in_at: authData[u.id]?.last_sign_in_at ?? u.last_sign_in_at,
      }));
    },
    staleTime: 60_000,
  });

  // Saldo de moedas do cliente: client_coins tem RLS "só a própria linha",
  // então o dado vem da RPC admin_get_approved_users (SECURITY DEFINER,
  // mesma queryKey da tela Aprovados — cache compartilhado)
  const { data: coinsMap = {} } = useQuery({
    queryKey: ['adminAprovadosCoinsMap'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_approved_users');
      if (error) return {};
      const map: Record<string, number> = {};
      ((data ?? []) as { user_id: string; client_coins_balance: number | null }[]).forEach(u => {
        map[u.user_id] = u.client_coins_balance ?? 0;
      });
      return map;
    },
    staleTime: 60_000,
  });

  // Categoria mais pedida por cliente (moda de leads.category por client_id)
  const { data: topCategoryMap = {} } = useQuery({
    queryKey: ['adminClientTopCategory'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('client_id, category');
      const counts: Record<string, Record<string, number>> = {};
      (data ?? []).forEach((l: { client_id: string | null; category: string | null }) => {
        if (!l.client_id || !l.category) return;
        if (!counts[l.client_id]) counts[l.client_id] = {};
        counts[l.client_id][l.category] = (counts[l.client_id][l.category] ?? 0) + 1;
      });
      const map: Record<string, string> = {};
      Object.entries(counts).forEach(([clientId, cats]) => {
        map[clientId] = Object.entries(cats).sort((a, b) => b[1] - a[1])[0][0];
      });
      return map;
    },
    staleTime: 60_000,
  });

  const clientes = useMemo(() => usuarios.filter(u => u.role === 'client'), [usuarios]);

  const totalCoins = useMemo(
    () => clientes.reduce((acc, c) => acc + (coinsMap[c.id] ?? 0), 0),
    [clientes, coinsMap]
  );

  const kpis = useMemo(() => {
    const total = clientes.length;
    const never = clientes.filter(c => c.total_leads === 0).length;
    const recurring = clientes.filter(c => c.total_leads > 1).length;
    const metaAds = clientes.filter(c => c.origin === 'meta_ads').length;
    const metaPct = total > 0 ? Math.round((metaAds / total) * 100) : 0;
    return [
      { label: 'Total clientes', value: String(total), color: 'white' },
      { label: 'Nunca pediram', value: String(never), color: '#f59e0b' },
      { label: 'Recorrentes', value: String(recurring), color: '#34d399' },
      { label: 'Via Meta Ads', value: `${metaAds} (${metaPct}%)`, color: '#a78bfa' },
      { label: 'Moedas em carteira', value: String(totalCoins), color: '#fbbf24' },
    ];
  }, [clientes, totalCoins]);

  const chipCounts: Record<ChipFilter, number> = useMemo(() => ({
    all: clientes.length,
    never: clientes.filter(c => c.total_leads === 0).length,
    recurring: clientes.filter(c => c.total_leads > 1).length,
  }), [clientes]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return clientes.filter(c => {
      const matchChip =
        chip === 'all' ||
        (chip === 'never' && c.total_leads === 0) ||
        (chip === 'recurring' && c.total_leads > 1);
      const matchSearch = !q ||
        (c.full_name ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q);
      return matchChip && matchSearch;
    });
  }, [clientes, chip, searchTerm]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedClients = filtered.filter(c => selected.has(c.id));

  const contactSelected = async () => {
    const phones = selectedClients
      .map(c => c.phone?.replace(/\D/g, ''))
      .filter((d): d is string => !!d)
      .map(d => `+${d.startsWith('55') ? d : `55${d}`}`);
    if (phones.length === 0) {
      toast.error('Nenhum cliente selecionado tem telefone cadastrado.');
      return;
    }
    try {
      await navigator.clipboard.writeText(phones.join('\n'));
      toast.success(`${phones.length} número${phones.length === 1 ? '' : 's'} copiado${phones.length === 1 ? '' : 's'} para a área de transferência.`);
    } catch {
      toast.error('Não foi possível copiar. Tente novamente.');
    }
  };

  const exportCSV = (rows: EnrichedUser[]) => {
    const headers = ['Nome', 'Email', 'Telefone', 'Cidade', 'Origem', 'Moedas', 'Pedidos criados', 'Agendamentos', 'Categoria mais pedida', 'Último acesso', 'Cadastro'];
    const body = rows.map(c => [
      c.full_name ?? '', c.email ?? '', c.phone ?? '', c.city ?? '',
      c.origin ?? '', String(coinsMap[c.id] ?? 0), String(c.total_leads), String(c.total_appointments),
      topCategoryMap[c.id] ?? '', c.last_sign_in_at ?? '', c.created_at,
    ]);
    const csv = [headers, ...body].map(r => r.map(x => `"${x}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'clientes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const chipLabels: Record<ChipFilter, string> = { all: 'Todos', never: 'Nunca pediram', recurring: 'Recorrentes' };
  const kpiColors = ['white', '#f59e0b', '#34d399', '#a78bfa', '#fbbf24'];

  const actionButton = (c: EnrichedUser, fullWidth = false) =>
    c.phone ? (
      <a
        href={waLink(c.phone)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        style={{ height: 32, padding: '0 12px', borderRadius: 8, background: fullWidth ? 'rgba(29,158,117,0.12)' : 'transparent', border: '1px solid rgba(29,158,117,0.35)', color: '#34d399', fontSize: 11, fontWeight: 700, display: fullWidth ? 'flex' : 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, textDecoration: 'none', width: fullWidth ? '100%' : undefined }}
      >
        <MessageSquare size={11} /> Contatar
      </a>
    ) : (
      <span style={{ fontSize: 11, color: '#4a6580' }}>Sem telefone</span>
    );

  return (
    <div className="space-y-11 animate-in fade-in duration-500">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Clientes</h1>
          <p className="text-[#94A3B8] mt-6">Lista de todos os usuários com o perfil de cliente.</p>
        </div>
        <button
          onClick={() => exportCSV(filtered)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, color: '#4a6580', fontSize: 12, cursor: 'pointer' }}
        >
          Exportar CSV
        </button>
      </div>

      {/* KPIs — mesmo estilo dos cards de Aprovados */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.625rem' }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{ background: '#132540', border: '1.5px solid rgba(255,255,255,0.07)', borderRadius: '.5rem', padding: '.875rem 1rem', display: 'flex', alignItems: 'stretch', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: kpiColors[i] }} />
            <div style={{ paddingLeft: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', margin: '0 0 5px' }}>{k.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: kpiColors[i], margin: 0, lineHeight: 1 }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar: chips + busca */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {(['all', 'never', 'recurring'] as ChipFilter[]).map(c => (
            <button
              key={c}
              onClick={() => { setChip(c); setPage(0); }}
              style={{ height: 34, padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: chip === c ? '1px solid rgba(29,158,117,0.3)' : '1px solid rgba(255,255,255,0.08)', background: chip === c ? 'rgba(29,158,117,0.12)' : 'transparent', color: chip === c ? '#34d399' : '#64748b' }}
            >
              {chipLabels[c]} <span style={{ opacity: .6 }}>({chipCounts[c]})</span>
            </button>
          ))}
        </div>
        <div className="flex-1 relative group" style={{ minWidth: 200 }}>
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors" size={16} />
           <input
             type="text"
             value={searchTerm}
             onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
             placeholder="Buscar por nome, email ou cidade..."
             maxLength={255}
             className="w-full bg-[#1C3454] border border-slate-800 rounded-xl pl-12 pr-4 py-8 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
           />
        </div>
      </div>

      {/* Barra de seleção em massa */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.625rem 1rem', background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#34d399', fontWeight: 600 }}>
            {selected.size} cliente{selected.size === 1 ? '' : 's'} selecionado{selected.size === 1 ? '' : 's'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={contactSelected}
              style={{ height: 32, padding: '0 14px', borderRadius: 8, background: '#1D9E75', border: 'none', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <MessageSquare size={12} /> Contatar selecionados
            </button>
            <button
              onClick={() => setSelected(new Set())}
              style={{ height: 32, padding: '0 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center p-12 bg-[#1C3454] rounded-2xl border border-slate-800"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
      )}

      {/* ── Desktop: tabela (md+) ─────────────────────────────────────── */}
      {!isLoading && (
      <div className="hidden md:block bg-[#1C3454] border border-slate-800 rounded-2xl overflow-hidden">
           <div className="overflow-x-auto">
           <table className="w-full text-left">
             <thead>
               <tr className="border-b border-[#1C3050] text-sm text-[#94A3B8] font-medium">
                 <th className="p-9 pl-6" style={{ width: 36 }}>
                   <input
                     type="checkbox"
                     checked={pageItems.length > 0 && pageItems.every(c => selected.has(c.id))}
                     onChange={e => {
                       setSelected(prev => {
                         const next = new Set(prev);
                         pageItems.forEach(c => { if (e.target.checked) next.add(c.id); else next.delete(c.id); });
                         return next;
                       });
                     }}
                     style={{ accentColor: '#1D9E75', cursor: 'pointer' }}
                   />
                 </th>
                 <th className="p-9">Cliente</th>
                 <th className="p-9">Origem</th>
                 <th className="p-9">Moedas</th>
                 <th className="p-9">Insight</th>
                 <th className="p-9">Ação</th>
                 <th className="p-9 pr-6" style={{ width: 36 }} />
               </tr>
             </thead>
             <tbody>
               {pageItems.map(c => (
                 <ClientRow
                   key={c.id}
                   c={c}
                   coins={coinsMap[c.id] ?? 0}
                   topCategory={topCategoryMap[c.id] ?? null}
                   checked={selected.has(c.id)}
                   onToggleCheck={() => toggleSelect(c.id)}
                   expanded={expanded === c.id}
                   onToggleExpand={() => setExpanded(prev => prev === c.id ? null : c.id)}
                   action={actionButton(c)}
                 />
               ))}
               {pageItems.length === 0 && (
                 <tr>
                   <td colSpan={7} className="p-8 text-center text-[#4A6580]">Nenhum cliente encontrado.</td>
                 </tr>
               )}
             </tbody>
           </table>
           </div>
           {paginationBar()}
      </div>
      )}

      {/* ── Mobile: cards (padrão Aprovados) ──────────────────────────── */}
      {!isLoading && (
      <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {pageItems.map(c => (
          <div key={c.id} style={{ background: '#132540', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: '1rem', overflow: 'hidden' }}>
            <div style={{ height: 3, background: '#185FA5' }} />
            <div style={{ padding: '1rem 1.125rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggleSelect(c.id)}
                  style={{ accentColor: '#1D9E75', cursor: 'pointer', marginTop: 4 }}
                />
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt={c.full_name ?? ''} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#60a5fa', flexShrink: 0 }}>
                    {initials(c.full_name)}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name ?? 'Sem nome'}</p>
                  <p style={{ fontSize: 11, color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={9} /> {c.city ?? 'Cidade não informada'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <OriginBadge origin={c.origin} />
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: 'rgba(251,191,36,0.08)', color: coinsMap[c.id] ? '#fbbf24' : '#64748b', border: '0.5px solid rgba(251,191,36,0.2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Coins size={10} /> {coinsMap[c.id] ?? 0} moedas
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {[
                  { label: 'Pedidos', value: String(c.total_leads) },
                  { label: 'Agendamentos', value: String(c.total_appointments) },
                  { label: 'Último acesso', value: formatDate(c.last_sign_in_at) },
                ].map((st, i) => (
                  <div key={st.label} style={{ padding: '0.5rem 0.625rem', background: '#0f1f35', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 3px' }}>{st.label}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'white', margin: 0 }}>{st.value}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <ClientInsight totalLeads={c.total_leads} topCategory={topCategoryMap[c.id] ?? null} />
              </div>
              {actionButton(c, true)}
            </div>
          </div>
        ))}
        {pageItems.length === 0 && (
          <p style={{ textAlign: 'center', color: '#4A6580', fontSize: 13, padding: '2rem 0' }}>Nenhum cliente encontrado.</p>
        )}
        <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          {paginationBar()}
        </div>
      </div>
      )}
    </div>
  );

  function paginationBar() {
    if (filtered.length === 0) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          Mostrando {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
            style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: safePage === 0 ? '#33465e' : '#94a3b8', cursor: safePage === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
            style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: safePage >= pageCount - 1 ? '#33465e' : '#94a3b8', cursor: safePage >= pageCount - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  }
}

function ClientRow({ c, coins, topCategory, checked, onToggleCheck, expanded, onToggleExpand, action }: {
  c: EnrichedUser;
  coins: number;
  topCategory: string | null;
  checked: boolean;
  onToggleCheck: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  action: React.ReactNode;
}) {
  return (
    <>
      <tr onClick={onToggleExpand} className="border-b border-[#1C3050] hover:bg-slate-800/20 transition-colors cursor-pointer">
        <td className="p-9 pl-6" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={checked} onChange={onToggleCheck} style={{ accentColor: '#1D9E75', cursor: 'pointer' }} />
        </td>
        <td className="p-9">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {c.avatar_url ? (
              <img src={c.avatar_url} alt={c.full_name ?? ''} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#60a5fa', flexShrink: 0 }}>
                {initials(c.full_name)}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name ?? 'Sem nome'}</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={9} /> {c.city ?? 'Cidade não informada'}
                {c.email && <><span style={{ opacity: .4 }}>·</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{c.email}</span></>}
              </p>
            </div>
          </div>
        </td>
        <td className="p-9"><OriginBadge origin={c.origin} /></td>
        <td className="p-9"><CoinsBadge balance={coins} /></td>
        <td className="p-9"><ClientInsight totalLeads={c.total_leads} topCategory={topCategory} /></td>
        <td className="p-9" onClick={e => e.stopPropagation()}>{action}</td>
        <td className="p-9 pr-6">
          <ChevronDown size={14} style={{ color: '#4a6580', transition: 'transform .15s', transform: expanded ? 'rotate(180deg)' : 'none' }} />
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[#1C3050] bg-[#0f1f35]">
          <td colSpan={7} className="p-9 pl-6">
            <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
              {[
                { label: 'Pedidos criados', value: String(c.total_leads) },
                { label: 'Agendamentos', value: String(c.total_appointments) },
                { label: 'Último acesso', value: formatDateStatic(c.last_sign_in_at) },
                { label: 'Cadastro', value: formatDateStatic(c.created_at) },
                { label: 'Telefone', value: c.phone ?? '—' },
              ].map(st => (
                <div key={st.label}>
                  <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 3px' }}>{st.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'white', margin: 0 }}>{st.value}</p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function formatDateStatic(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}
