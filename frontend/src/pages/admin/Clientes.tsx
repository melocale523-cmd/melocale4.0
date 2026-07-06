import { useMemo, useState } from 'react';
import { Search, Loader2, MapPin, MessageSquare, ChevronLeft, ChevronRight, ChevronDown, Coins, Users, UserX, Megaphone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminService, type EnrichedUser } from '../../services/dbServices';
import { supabase } from '../../lib/supabase';

type ChipFilter = 'all' | 'never' | 'recurring';

const PAGE_SIZE = 20;
const PRIORITY_DAYS = 14;

// Card elevado — padrão visual aprovado (borda sutil + sombra + brilho no topo)
const ELEV: React.CSSProperties = {
  background: '#122444',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
  boxShadow: '0 6px 18px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)',
};
const STRIP = 'linear-gradient(90deg, #34d399, #60a5fa, #a78bfa)';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
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

function Avatar({ c, size = 34 }: { c: EnrichedUser; size?: number }) {
  if (c.avatar_url) {
    return <img src={c.avatar_url} alt={c.full_name ?? ''} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: '0 2px 8px rgba(96,165,250,0.25)' }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(96,165,250,0.3), rgba(96,165,250,0.08))', border: '1px solid rgba(96,165,250,0.3)', boxShadow: '0 2px 8px rgba(96,165,250,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.32, fontWeight: 700, color: '#60a5fa', flexShrink: 0 }}>
      {initials(c.full_name)}
    </div>
  );
}

// Insight com "dias sem pedido" real (leads.max(created_at) ou created_at do cadastro)
function ClientInsight({ totalLeads, topCategory, days }: { totalLeads: number; topCategory: string | null; days: number | null }) {
  if (totalLeads === 0) {
    return (
      <span style={{ fontSize: 11, color: '#f59e0b' }}>
        {days !== null ? `⚠ Há ${days} dia${days === 1 ? '' : 's'} sem pedido` : '⚠ Nunca criou pedido'}
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: '#34d399' }}>
        {days !== null
          ? `✓ Pediu ${topCategory ?? 'serviço'} há ${days} dia${days === 1 ? '' : 's'}`
          : `✓ Criou ${totalLeads} pedido${totalLeads === 1 ? '' : 's'}`}
      </span>
      {days !== null && <span style={{ fontSize: 10, color: '#64748b' }}>{totalLeads} pedido{totalLeads === 1 ? '' : 's'} no total</span>}
    </span>
  );
}

// Ícone circular de contato (mockup aprovado) — 30x30, verde translúcido
function WaButton({ phone }: { phone: string | null }) {
  if (!phone) return <span style={{ fontSize: 11, color: '#4a6580' }}>—</span>;
  return (
    <a
      href={waLink(phone)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title="Contatar no WhatsApp"
      style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(29,158,117,0.15)', border: '1px solid rgba(29,158,117,0.35)', boxShadow: '0 2px 8px rgba(29,158,117,0.2)', color: '#34d399', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}
    >
      <MessageSquare size={13} />
    </a>
  );
}

// Sparkline real: novos clientes por semana (últimas 4 semanas)
function Sparkline({ points }: { points: number[] }) {
  const w = 64, h = 22, pad = 2;
  const max = Math.max(...points, 1);
  const step = (w - pad * 2) / (points.length - 1 || 1);
  const coords = points.map((v, i) => `${pad + i * step},${h - pad - (v / max) * (h - pad * 2)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={coords} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
  // então o dado vem da RPC admin_get_approved_users (SECURITY DEFINER)
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

  // Categoria mais pedida + data do último pedido por cliente (uma query só)
  const { data: leadsInfo = { topCategory: {}, lastLeadAt: {} } } = useQuery({
    queryKey: ['adminClientLeadsInfo'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('client_id, category, created_at');
      const counts: Record<string, Record<string, number>> = {};
      const lastLeadAt: Record<string, string> = {};
      (data ?? []).forEach((l: { client_id: string | null; category: string | null; created_at: string }) => {
        if (!l.client_id) return;
        if (!lastLeadAt[l.client_id] || l.created_at > lastLeadAt[l.client_id]) lastLeadAt[l.client_id] = l.created_at;
        if (!l.category) return;
        if (!counts[l.client_id]) counts[l.client_id] = {};
        counts[l.client_id][l.category] = (counts[l.client_id][l.category] ?? 0) + 1;
      });
      const topCategory: Record<string, string> = {};
      Object.entries(counts).forEach(([clientId, cats]) => {
        topCategory[clientId] = Object.entries(cats).sort((a, b) => b[1] - a[1])[0][0];
      });
      return { topCategory, lastLeadAt };
    },
    staleTime: 60_000,
  });

  const clientes = useMemo(() => usuarios.filter(u => u.role === 'client'), [usuarios]);

  // Dias sem pedido: desde o último lead, ou desde o cadastro se nunca pediu
  const daysNoOrder = (c: EnrichedUser): number | null => {
    if (c.total_leads === 0) return c.created_at ? daysSince(c.created_at) : null;
    const last = leadsInfo.lastLeadAt[c.id];
    return last ? daysSince(last) : null;
  };

  const totalCoins = useMemo(
    () => clientes.reduce((acc, c) => acc + (coinsMap[c.id] ?? 0), 0),
    [clientes, coinsMap]
  );

  // Sparkline: novos clientes por semana, últimas 4 semanas (created_at real)
  const weeklySignups = useMemo(() => {
    const buckets = [0, 0, 0, 0];
    const now = Date.now();
    clientes.forEach(c => {
      const age = now - new Date(c.created_at).getTime();
      const week = Math.floor(age / (7 * 86_400_000));
      if (week >= 0 && week < 4) buckets[3 - week] += 1;
    });
    return buckets;
  }, [clientes]);

  const heroStats = useMemo(() => {
    const total = clientes.length;
    const never = clientes.filter(c => c.total_leads === 0).length;
    const metaAds = clientes.filter(c => c.origin === 'meta_ads').length;
    const metaPct = total > 0 ? Math.round((metaAds / total) * 100) : 0;
    const recurring = clientes.filter(c => c.total_leads > 1).length;
    return { total, never, metaAds, metaPct, recurring };
  }, [clientes]);

  const chipCounts: Record<ChipFilter, number> = useMemo(() => ({
    all: clientes.length,
    never: heroStats.never,
    recurring: heroStats.recurring,
  }), [clientes, heroStats]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const list = clientes.filter(c => {
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
    // "Nunca pediram" ordena por dias sem pedido DESC — quem espera há mais
    // tempo aparece primeiro (é assim que o Samuel decide quem contatar)
    if (chip === 'never') {
      list.sort((a, b) => (daysNoOrder(b) ?? -1) - (daysNoOrder(a) ?? -1));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, chip, searchTerm, leadsInfo]);

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
    const headers = ['Nome', 'Email', 'Telefone', 'Cidade', 'Origem', 'Moedas', 'Pedidos criados', 'Agendamentos', 'Categoria mais pedida', 'Dias sem pedido', 'Último acesso', 'Cadastro'];
    const body = rows.map(c => [
      c.full_name ?? '', c.email ?? '', c.phone ?? '', c.city ?? '',
      c.origin ?? '', String(coinsMap[c.id] ?? 0), String(c.total_leads), String(c.total_appointments),
      leadsInfo.topCategory[c.id] ?? '', String(daysNoOrder(c) ?? ''),
      c.last_sign_in_at ?? '', c.created_at,
    ]);
    const csv = [headers, ...body].map(r => r.map(x => `"${x}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'clientes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const chipLabels: Record<ChipFilter, string> = { all: 'Todos', never: 'Nunca pediram', recurring: 'Recorrentes' };

  const heroCells = [
    {
      icon: <Users size={13} style={{ color: '#34d399' }} />, label: 'Total clientes', color: 'white',
      value: (
        <span style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <span>{heroStats.total}</span>
          <Sparkline points={weeklySignups} />
        </span>
      ),
    },
    { icon: <UserX size={13} style={{ color: '#f59e0b' }} />, label: 'Sem pedido', color: '#f59e0b', value: String(heroStats.never) },
    { icon: <Megaphone size={13} style={{ color: '#a78bfa' }} />, label: 'Via Meta Ads', color: '#a78bfa', value: `${heroStats.metaAds} (${heroStats.metaPct}%)` },
  ];

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

      {/* Hero KPI — UM card elevado, células com divisor fino */}
      <div style={{ ...ELEV, overflow: 'hidden' }}>
        <div style={{ height: 3, background: STRIP }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {heroCells.map((cell, i) => (
            <div key={cell.label} style={{ padding: '0.875rem 1rem', borderRight: i < heroCells.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 5 }}>
                {cell.icon} {cell.label}
              </p>
              <div style={{ fontSize: 20, fontWeight: 700, color: cell.color, lineHeight: 1 }}>{cell.value}</div>
            </div>
          ))}
        </div>
        {/* Métricas secundárias movidas da Hero (decisão: manter visíveis num rodapé fino) */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.5rem 1rem', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>Recorrentes: <strong style={{ color: '#34d399' }}>{heroStats.recurring}</strong></span>
          <span style={{ fontSize: 11, color: '#64748b' }}>Moedas em carteira: <strong style={{ color: '#fbbf24' }}>{totalCoins}</strong></span>
        </div>
      </div>

      {/* Toolbar: chips + busca */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', maxWidth: '100%', paddingBottom: 2 }}>
          {(['all', 'never', 'recurring'] as ChipFilter[]).map(c => (
            <button
              key={c}
              onClick={() => { setChip(c); setPage(0); }}
              style={{ height: 34, padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, border: chip === c ? '1px solid rgba(29,158,117,0.3)' : '1px solid rgba(255,255,255,0.08)', background: chip === c ? 'rgba(29,158,117,0.12)' : 'transparent', color: chip === c ? '#34d399' : '#64748b' }}
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
        <div style={{ ...ELEV, display: 'flex', justifyContent: 'center', padding: '3rem' }}><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
      )}

      {/* ── Desktop: tabela em card elevado (md+) ─────────────────────── */}
      {!isLoading && (
      <div className="hidden md:block" style={{ ...ELEV, overflow: 'hidden' }}>
           <div style={{ height: 3, background: STRIP }} />
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
                   topCategory={leadsInfo.topCategory[c.id] ?? null}
                   days={daysNoOrder(c)}
                   checked={selected.has(c.id)}
                   onToggleCheck={() => toggleSelect(c.id)}
                   expanded={expanded === c.id}
                   onToggleExpand={() => setExpanded(prev => prev === c.id ? null : c.id)}
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

      {/* ── Mobile: UM card elevado, linhas com divisor fino ───────────── */}
      {!isLoading && (
      <div className="md:hidden" style={{ ...ELEV, overflow: 'hidden' }}>
        <div style={{ height: 3, background: STRIP }} />
        {pageItems.map((c, idx) => {
          const days = daysNoOrder(c);
          const priority = (days ?? 0) > PRIORITY_DAYS && c.total_leads === 0;
          return (
          <div key={c.id} style={{ position: 'relative', padding: '0.875rem 1rem', borderBottom: idx < pageItems.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            {priority && <div style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, background: '#f59e0b' }} />}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggleSelect(c.id)}
                style={{ accentColor: '#1D9E75', cursor: 'pointer', marginTop: 8 }}
              />
              <Avatar c={c} size={36} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name ?? 'Sem nome'}</p>
                <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={9} /> {c.city ?? 'Cidade não informada'}
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                  <OriginBadge origin={c.origin} />
                  <CoinsBadge balance={coinsMap[c.id] ?? 0} />
                </div>
                <ClientInsight totalLeads={c.total_leads} topCategory={leadsInfo.topCategory[c.id] ?? null} days={days} />
              </div>
              <WaButton phone={c.phone} />
            </div>
          </div>
          );
        })}
        {pageItems.length === 0 && (
          <p style={{ textAlign: 'center', color: '#4A6580', fontSize: 13, padding: '2rem 0' }}>Nenhum cliente encontrado.</p>
        )}
        {paginationBar()}
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

function ClientRow({ c, coins, topCategory, days, checked, onToggleCheck, expanded, onToggleExpand }: {
  c: EnrichedUser;
  coins: number;
  topCategory: string | null;
  days: number | null;
  checked: boolean;
  onToggleCheck: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const priority = (days ?? 0) > PRIORITY_DAYS && c.total_leads === 0;
  return (
    <>
      <tr onClick={onToggleExpand} className="border-b border-[#1C3050] hover:bg-slate-800/20 transition-colors cursor-pointer">
        <td className="p-9 pl-6" style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          {priority && <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, background: '#f59e0b' }} />}
          <input type="checkbox" checked={checked} onChange={onToggleCheck} style={{ accentColor: '#1D9E75', cursor: 'pointer' }} />
        </td>
        <td className="p-9">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar c={c} />
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
        <td className="p-9"><ClientInsight totalLeads={c.total_leads} topCategory={topCategory} days={days} /></td>
        <td className="p-9" onClick={e => e.stopPropagation()}><WaButton phone={c.phone} /></td>
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
                { label: 'Último acesso', value: formatDate(c.last_sign_in_at) },
                { label: 'Cadastro', value: formatDate(c.created_at) },
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
