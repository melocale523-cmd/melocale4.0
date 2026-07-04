import { useMemo, useState } from 'react';
import { Search, Loader2, ChevronDown, ArrowUpDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useIsMobile } from '../../hooks/useIsMobile';

interface LeadOverview {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  category_icon: string | null;
  category_color: string | null;
  city: string | null;
  location: string | null;
  state: string | null;
  budget_min: number | null;
  budget_max: number | null;
  status: string;
  visualizacoes: number;
  purchases_count: number;
  created_at: string;
  updated_at: string;
  client_id: string | null;
  client_name: string | null;
  notified_count: number;
  first_notified_at: string | null;
  first_proposal_at: string | null;
}

type Bucket = 'aberto' | 'andamento' | 'finalizado' | 'arquivado';
type StatusFilter = 'all' | 'aberto' | 'andamento' | 'finalizado';
type StepState = 'done' | 'current' | 'pending';

interface Step {
  key: string;
  label: string;
  time: string | null;
  state: StepState;
  alert?: boolean;
}

const C = {
  bg: '#0a0e1a',
  card: '#101b2e',
  cardAlt: '#0f1826',
  border: 'rgba(255,255,255,.07)',
  text: '#f1f5f9',
  textSec: '#94a3b8',
  textTer: '#64748b',
  green: '#10b981',
  greenLight: '#34d399',
  yellow: '#f59e0b',
  yellowLight: '#fbbf24',
  red: '#ef4444',
  redLight: '#f87171',
  blue: '#60a5fa',
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  open:       { label: 'Aberto',     color: C.greenLight },
  available:  { label: 'Disponível', color: C.blue },
  'orçando':  { label: 'Orçando',    color: C.yellowLight },
  finalizado: { label: 'Finalizado', color: C.textSec },
  arquivado:  { label: 'Arquivado',  color: C.redLight },
};

function bucketOf(status: string): Bucket {
  if (status === 'finalizado') return 'finalizado';
  if (status === 'arquivado') return 'arquivado';
  if (status === 'orçando') return 'andamento';
  return 'aberto';
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(148,163,184,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function formatBudget(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  const fmt = (v: number) => `R$${v.toLocaleString('pt-BR')}`;
  if (min != null && max != null) {
    if (min === max) return fmt(min);
    if (min === 0) return `até ${fmt(max)}`;
    return `${fmt(min)} – ${fmt(max)}`;
  }
  return fmt((min ?? max)!);
}

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #1e3a5f, #0f2744)',
  'linear-gradient(135deg, #3b2f5e, #241b3d)',
  'linear-gradient(135deg, #1f4a3d, #123328)',
  'linear-gradient(135deg, #4a3220, #2b1c11)',
];
function avatarGradient(name: string | null): string {
  const s = name ?? '?';
  let hash = 0;
  for (const ch of s) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

function formatDuration(ms: number): string {
  const hours = ms / 3600000;
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60000))}min`;
  if (hours < 24) return `${hours.toFixed(1).replace('.0', '')}h`;
  return `${Math.round(hours / 24)}d`;
}

function slaInfo(p: LeadOverview): { color: string; label: string } {
  if (p.status === 'finalizado') {
    const ms = new Date(p.updated_at).getTime() - new Date(p.created_at).getTime();
    return { color: C.green, label: `Finalizado em ${formatDuration(Math.max(ms, 0))}` };
  }
  const hours = (Date.now() - new Date(p.created_at).getTime()) / 3600000;
  if (hours < 2) return { color: C.green, label: 'No prazo' };
  if (hours < 24) return { color: C.yellow, label: 'Atenção' };
  return { color: C.red, label: 'Atrasado' };
}

function buildTimeline(p: LeadOverview): Step[] {
  const notifiedDone = p.notified_count > 0;
  const viewedDone = p.visualizacoes > 0;
  const proposalDone = p.purchases_count > 0;
  const finalDone = p.status === 'finalizado';

  const steps: Step[] = [
    { key: 'criado', label: 'Pedido criado', time: p.created_at, state: 'done' },
    {
      key: 'notificado',
      label: notifiedDone
        ? `${p.notified_count} profissiona${p.notified_count > 1 ? 'is' : 'l'} notificado${p.notified_count > 1 ? 's' : ''}`
        : 'Nenhum profissional notificado',
      time: p.first_notified_at,
      state: notifiedDone ? 'done' : 'pending',
      alert: !notifiedDone,
    },
    {
      key: 'visualizado',
      label: viewedDone ? `${p.visualizacoes} visualiza${p.visualizacoes > 1 ? 'ram' : 'ção'}` : 'Ainda não visualizado',
      time: null,
      state: viewedDone ? 'done' : 'pending',
    },
    {
      key: 'proposta',
      label: proposalDone
        ? `${p.purchases_count} proposta${p.purchases_count > 1 ? 's' : ''} enviada${p.purchases_count > 1 ? 's' : ''}`
        : 'Nenhuma proposta ainda',
      time: p.first_proposal_at,
      state: proposalDone ? 'done' : 'pending',
    },
    {
      key: 'finalizado',
      label: finalDone ? 'Pedido finalizado' : 'Aguardando finalização',
      time: finalDone ? p.updated_at : null,
      state: finalDone ? 'done' : 'pending',
    },
  ];

  const firstPending = steps.findIndex(s => s.state === 'pending');
  if (firstPending !== -1) steps[firstPending] = { ...steps[firstPending], state: 'current' };
  return steps;
}

function fmtDateTime(iso: string): string {
  return `${new Date(iso).toLocaleDateString('pt-BR')} ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

// ── Subcomponentes de apresentação ──────────────────────────────────────────

function ClientAvatar({ name, size = 36 }: { name: string | null; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: avatarGradient(name), border: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: C.text,
    }}>
      {initials(name)}
    </div>
  );
}

function AlcanceStats({ p }: { p: LeadOverview }) {
  const zeroNotified = p.notified_count === 0;
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 12, flexWrap: 'wrap' }}>
      <span style={{ color: zeroNotified ? C.red : C.textSec, fontWeight: zeroNotified ? 700 : 500 }}>
        🔔 {p.notified_count} notificado{p.notified_count === 1 ? '' : 's'}
      </span>
      <span style={{ color: C.textSec }}>👁 {p.visualizacoes} visualizou{p.visualizacoes === 1 ? '' : 'aram'}</span>
      <span style={{ color: C.textSec }}>💬 {p.purchases_count} proposta{p.purchases_count === 1 ? '' : 's'}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { label: status, color: C.textSec };
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
      padding: '3px 8px', borderRadius: 5,
      color: cfg.color, background: hexToRgba(cfg.color, 0.12), border: `1px solid ${hexToRgba(cfg.color, 0.3)}`,
    }}>
      {cfg.label}
    </span>
  );
}

function SlaDot({ p }: { p: LeadOverview }) {
  const sla = slaInfo(p);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: sla.color, fontWeight: 600 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: sla.color, flexShrink: 0 }} />
      {sla.label}
    </span>
  );
}

function Timeline({ p }: { p: LeadOverview }) {
  const steps = buildTimeline(p);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
      {steps.map((s, i) => {
        const color = s.alert && s.state === 'current' ? C.red : s.state === 'done' ? C.green : s.state === 'current' ? C.yellow : C.textTer;
        const isLast = i === steps.length - 1;
        return (
          <div key={s.key} style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                background: s.state === 'pending' ? 'transparent' : color,
                border: `2px solid ${color}`,
              }} />
              {!isLast && <span style={{ width: 2, flex: 1, minHeight: 20, background: s.state === 'done' ? C.green : C.border, marginTop: 2 }} />}
            </div>
            <div style={{ paddingBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: s.state === 'pending' ? 400 : 600, color: s.state === 'pending' ? C.textTer : C.text }}>
                {s.label}
              </p>
              {s.time && <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textTer }}>{fmtDateTime(s.time)}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────────

export default function AdminPedidos() {
  const isMobile = useIsMobile(768);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortDesc, setSortDesc] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['adminPedidosOverview'],
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<LeadOverview[]> => {
      const { data, error } = await supabase.rpc('admin_get_leads_overview');
      if (error) throw error;
      return (data ?? []) as LeadOverview[];
    },
  });

  const cities = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach(p => { const c = p.city ?? p.location; if (c) set.add(c); });
    return [...set].sort();
  }, [pedidos]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach(p => { if (p.category) set.add(p.category); });
    return [...set].sort();
  }, [pedidos]);

  const buckets = useMemo(() => {
    const acc = { aberto: 0, andamento: 0, finalizado: 0, arquivado: 0, slaVencido: 0 };
    pedidos.forEach(p => {
      acc[bucketOf(p.status)] += 1;
      const hours = (Date.now() - new Date(p.created_at).getTime()) / 3600000;
      if (p.status !== 'finalizado' && hours > 24) acc.slaVencido += 1;
    });
    return acc;
  }, [pedidos]);

  const filtered = pedidos.filter(p => {
    if (statusFilter !== 'all' && bucketOf(p.status) !== statusFilter) return false;
    if (cityFilter !== 'all' && (p.city ?? p.location) !== cityFilter) return false;
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hit = [p.client_name, p.title, p.category, p.city, p.location, p.status]
        .some(v => v?.toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortDesc ? -diff : diff;
  });

  const selectStyle: React.CSSProperties = {
    background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text,
    borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', cursor: 'pointer',
  };

  const kpis: { label: string; value: number; color: string; sub?: string }[] = [
    { label: 'Total de Pedidos', value: pedidos.length, color: C.blue, sub: buckets.slaVencido > 0 ? `${buckets.slaVencido} vencendo SLA (>24h)` : undefined },
    { label: 'Aberto', value: buckets.aberto, color: C.greenLight },
    { label: 'Em Andamento', value: buckets.andamento, color: C.yellowLight },
    { label: 'Finalizados', value: buckets.finalizado, color: C.textSec },
  ];

  const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'aberto', label: 'Aberto' },
    { key: 'andamento', label: 'Em andamento' },
    { key: 'finalizado', label: 'Finalizado' },
  ];

  return (
    <div style={{ background: C.bg, minHeight: '100%', margin: '-0.75rem -0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Pedidos de Clientes</h1>
        <p style={{ color: C.textSec, margin: '4px 0 0', fontSize: 13 }}>Todos os pedidos de serviço/orçamento criados pelos clientes na plataforma</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
            <p style={{ color: C.textSec, fontSize: 12, fontWeight: 600, margin: '0 0 6px' }}>{k.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
            {k.sub && <p style={{ fontSize: 10, color: C.red, fontWeight: 700, margin: '4px 0 0' }}>⚠ {k.sub}</p>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {STATUS_CHIPS.map(chip => (
          <button
            key={chip.key}
            onClick={() => setStatusFilter(chip.key)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: statusFilter === chip.key ? C.green : C.cardAlt,
              color: statusFilter === chip.key ? '#04150f' : C.textSec,
              border: `1px solid ${statusFilter === chip.key ? C.green : C.border}`,
            }}
          >
            {chip.label}
          </button>
        ))}

        <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} style={selectStyle}>
          <option value="all">Todas as cidades</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={selectStyle}>
          <option value="all">Todas as categorias</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textTer }} size={16} />
          <input
            type="text"
            placeholder="Buscar cliente, categoria, cidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            maxLength={255}
            style={{ width: '100%', boxSizing: 'border-box', background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px 8px 34px', color: C.text, fontSize: 13, outline: 'none' }}
          />
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.cardAlt }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Pedidos ({sorted.length})</h2>
          {isLoading && <Loader2 size={16} className="animate-spin" style={{ color: C.green }} />}
        </div>

        {!isLoading && sorted.length === 0 && (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: C.textTer, fontSize: 13 }}>
            {pedidos.length === 0 ? 'Nenhum pedido ainda.' : 'Nenhum pedido corresponde aos filtros.'}
          </div>
        )}

        {sorted.length > 0 && isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
            {sorted.map(p => {
              const zeroNotified = p.notified_count === 0;
              const stripeColor = zeroNotified ? C.red : (p.category_color ?? C.textTer);
              const expanded = expandedId === p.id;
              return (
                <div key={p.id} style={{ background: C.cardAlt, borderRadius: 10, border: `1px solid ${C.border}`, borderLeftWidth: 3, borderLeftColor: stripeColor, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                      <ClientAvatar name={p.client_name} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.client_name ?? '—'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textTer }}>{fmtDateTime(p.created_at)} · {timeAgo(p.created_at)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedId(expanded ? null : p.id)}
                      style={{ background: 'transparent', border: 'none', color: C.textTer, cursor: 'pointer', padding: 4, flexShrink: 0 }}
                    >
                      <ChevronDown size={18} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                    </button>
                  </div>

                  {zeroNotified && (
                    <div style={{ marginTop: 8, background: hexToRgba(C.red, 0.1), border: `1px solid ${hexToRgba(C.red, 0.3)}`, borderRadius: 6, padding: '6px 8px', fontSize: 11, color: C.redLight, fontWeight: 700 }}>
                      ⚠ Sem profissional na categoria/cidade
                    </div>
                  )}

                  <div style={{ marginTop: 10, fontSize: 13, color: C.textSec, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{p.category_icon ?? '🔧'}</span>
                    <span>{p.category ?? '—'}</span>
                    <span style={{ color: C.textTer }}>· {p.city ?? p.location ?? '—'}</span>
                  </div>

                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: C.greenLight, fontSize: 14 }}>{formatBudget(p.budget_min, p.budget_max)}</span>
                    <StatusBadge status={p.status} />
                  </div>

                  <div style={{ marginTop: 8 }}><AlcanceStats p={p} /></div>
                  <div style={{ marginTop: 8 }}><SlaDot p={p} /></div>

                  {expanded && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                      <Timeline p={p} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {sorted.length > 0 && !isMobile && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textSec, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  <th style={{ padding: '10px 8px', width: 28 }} />
                  <th style={{ padding: '10px 8px' }}>Cliente</th>
                  <th style={{ padding: '10px 8px' }}>
                    <button
                      onClick={() => setSortDesc(v => !v)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'inherit', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', padding: 0 }}
                      title={sortDesc ? 'Mais recentes primeiro' : 'Mais antigos primeiro'}
                    >
                      Aberto há <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th style={{ padding: '10px 8px' }}>Categoria</th>
                  <th style={{ padding: '10px 8px' }}>Cidade</th>
                  <th style={{ padding: '10px 8px' }}>Valor</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px' }}>Alcance</th>
                  <th style={{ padding: '10px 8px' }}>SLA</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => {
                  const zeroNotified = p.notified_count === 0;
                  const stripeColor = zeroNotified ? C.red : (p.category_color ?? C.textTer);
                  const expanded = expandedId === p.id;
                  return (
                    <>
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: expanded ? 'none' : `1px solid ${C.border}`,
                          borderLeft: `3px solid ${stripeColor}`,
                          background: zeroNotified ? hexToRgba(C.red, 0.04) : 'transparent',
                        }}
                      >
                        <td style={{ padding: '10px 8px' }}>
                          <button
                            onClick={() => setExpandedId(expanded ? null : p.id)}
                            style={{ background: 'transparent', border: 'none', color: C.textTer, cursor: 'pointer', padding: 2, display: 'flex' }}
                          >
                            <ChevronDown size={16} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                          </button>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <ClientAvatar name={p.client_name} size={30} />
                            <div>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>{p.client_name ?? '—'}</p>
                              {zeroNotified && (
                                <p style={{ margin: '2px 0 0', fontSize: 10, color: C.redLight, fontWeight: 700 }}>⚠ Sem profissional na categoria/cidade</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: 12, color: C.textSec, whiteSpace: 'nowrap' }}>
                          {fmtDateTime(p.created_at)}
                          <span style={{ display: 'block', color: C.textTer, fontSize: 11 }}>{timeAgo(p.created_at)}</span>
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: 13, color: C.textSec }}>
                          <span>{p.category_icon ?? '🔧'} {p.category ?? '—'}</span>
                          {p.title && <span style={{ display: 'block', fontSize: 11, color: C.textTer }}>{p.title}</span>}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: 13, color: C.textSec }}>
                          {p.city ?? p.location ?? '—'}{p.city && p.state ? ` - ${p.state}` : ''}
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 700, color: C.greenLight, fontSize: 13 }}>{formatBudget(p.budget_min, p.budget_max)}</td>
                        <td style={{ padding: '10px 8px' }}><StatusBadge status={p.status} /></td>
                        <td style={{ padding: '10px 8px' }}><AlcanceStats p={p} /></td>
                        <td style={{ padding: '10px 8px' }}><SlaDot p={p} /></td>
                      </tr>
                      {expanded && (
                        <tr style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${stripeColor}` }}>
                          <td />
                          <td colSpan={8} style={{ padding: '4px 8px 16px' }}>
                            <Timeline p={p} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
