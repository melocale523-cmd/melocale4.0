import { useState, useMemo } from 'react';
import { Search, RefreshCw, MapPin, Phone, Coins, ShoppingBag, Calendar, User, MessageSquare, PowerOff, Power } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsMobile } from '../../hooks/useIsMobile';
import { supabase } from '../../lib/supabase';
import { adminService } from '../../services/statsService';
import { toast } from 'sonner';

interface ApprovedUser {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  avatar_url: string | null;
  role: 'professional' | 'client' | 'admin';
  category: string | null;
  is_active: boolean;
  approved_at: string;
  created_at: string;
  plan_id: string | null;
  sub_status: string | null;
  coins_balance: number;
  leads_purchased: number;
  completeness: number | null;
  client_coins_balance: number;
  pedidos_criados: number;
  agendamentos: number;
  email?: string | null;
  last_sign_in_at?: string | null;
}

type RoleFilter = 'all' | 'professional' | 'client' | 'admin';

// ── helpers ──────────────────────────────────────────────────────────────────

function initials(name: string | null): string {
  if (!name?.trim()) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function formatPhone(phone: string | null): string {
  if (!phone) return '—';
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return phone;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatPlan(plan_id: string | null, sub_status: string | null): string {
  if (!plan_id) return 'Sem plano';
  const names: Record<string, string> = {
    plan_basic: 'Basic',
    plan_starter: 'Starter',
    plan_pro: 'PRO',
    plan_business: 'Business',
    plan_elite: 'Elite',
  };
  const name = names[plan_id] ?? plan_id;
  if (sub_status === 'canceling') return `${name} (cancel.)`;
  if (sub_status === 'canceled') return `${name} (cancelado)`;
  return name;
}

function stripeColor(u: ApprovedUser): string {
  if (u.sub_status === 'canceling') return '#f59e0b';
  if (u.role === 'professional' && u.sub_status === 'active') return '#1D9E75';
  if (u.role === 'professional') return '#64748b';
  if (u.role === 'client') return '#185FA5';
  return '#534AB7';
}

function planColor(plan_id: string | null, sub_status: string | null): string {
  if (!plan_id) return '#64748b';
  if (sub_status === 'canceling') return '#f59e0b';
  if (sub_status === 'canceled') return '#64748b';
  const map: Record<string, string> = {
    plan_basic: '#60a5fa', plan_starter: '#60a5fa',
    plan_pro: '#34d399', plan_business: '#34d399',
    plan_elite: '#fbbf24',
  };
  return map[plan_id] ?? 'white';
}

// ── sub-components ────────────────────────────────────────────────────────────

function Avatar({ name, url, size = 46 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(29,158,117,0.15)', border: '1.5px solid rgba(29,158,117,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, color: '#1D9E75', flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

function Hint({ u }: { u: ApprovedUser }) {
  if (u.sub_status === 'canceling')
    return <span style={{ fontSize: 11, color: '#f59e0b' }}>⚠ Assinatura cancelando — contatar para retenção</span>;
  if (u.role === 'professional' && !u.plan_id)
    return <span style={{ fontSize: 11, color: '#64748b' }}>ℹ Sem plano — nunca assinou</span>;
  if (u.role === 'professional' && (u.completeness ?? 100) < 80)
    return <span style={{ fontSize: 11, color: '#64748b' }}>ℹ Perfil incompleto ({u.completeness}%)</span>;
  if (u.role === 'professional' && u.leads_purchased === 0)
    return <span style={{ fontSize: 11, color: '#64748b' }}>ℹ Nunca comprou lead</span>;
  return <span style={{ fontSize: 11, color: '#34d399' }}>✓ Usuário ativo</span>;
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em', whiteSpace: 'nowrap' }}>
        {label} ({count})
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: '#0d1e33', border: '1.5px solid rgba(255,255,255,0.07)', borderRadius: '1rem', overflow: 'hidden', opacity: 0.5 }}>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ padding: '1.125rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ height: 13, width: '40%', borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
            <div style={{ height: 11, width: '60%', borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
          </div>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: 36, borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function AdminAprovados() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<RoleFilter>('all');

  const { data: list = [], isLoading, refetch } = useQuery<ApprovedUser[]>({
    queryKey: ['adminAprovados'],
    queryFn: async () => {
      const [rpcRes, authData] = await Promise.all([
        supabase.rpc('admin_get_approved_users'),
        adminService.getUserAuthData(),
      ]);
      if (rpcRes.error) throw rpcRes.error;
      return ((rpcRes.data ?? []) as ApprovedUser[]).map(u => ({
        ...u,
        email: authData[u.user_id]?.email ?? null,
        last_sign_in_at: authData[u.user_id]?.last_sign_in_at ?? null,
      }));
    },
    staleTime: 60_000,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ user_id, is_active }: { user_id: string; is_active: boolean; role: string }) => {
      const { error } = await supabase
        .from('professionals')
        .update({ is_active })
        .eq('user_id', user_id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.setQueryData<ApprovedUser[]>(['adminAprovados'], prev =>
        (prev ?? []).map(u => u.user_id === vars.user_id ? { ...u, is_active: vars.is_active } : u)
      );
      toast.success(vars.is_active ? 'Profissional reativado.' : 'Profissional desativado.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => [
    { label: 'Total aprovados', value: list.length, color: 'white' },
    { label: 'Profissionais', value: list.filter(u => u.role === 'professional').length, color: '#34d399' },
    { label: 'Clientes', value: list.filter(u => u.role === 'client').length, color: '#60a5fa' },
    { label: 'Com plano ativo', value: list.filter(u => u.sub_status === 'active').length, color: '#fbbf24' },
  ], [list]);

  const kpiColors = ['white', '#34d399', '#60a5fa', '#fbbf24'];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return list.filter(u => {
      const matchRole = filterRole === 'all' || u.role === filterRole;
      const matchSearch = !q ||
        (u.full_name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.city ?? '').toLowerCase().includes(q) ||
        (u.category ?? '').toLowerCase().includes(q) ||
        (u.phone ?? '').includes(q);
      return matchRole && matchSearch;
    });
  }, [list, search, filterRole]);

  const roleCounts: Record<RoleFilter, number> = useMemo(() => ({
    all: list.length,
    professional: list.filter(u => u.role === 'professional').length,
    client: list.filter(u => u.role === 'client').length,
    admin: list.filter(u => u.role === 'admin').length,
  }), [list]);

  const sections: { key: 'professional' | 'client' | 'admin'; label: string }[] =
    filterRole === 'all'
      ? [
          { key: 'professional', label: 'profissionais' },
          { key: 'client', label: 'clientes' },
          { key: 'admin', label: 'admin' },
        ]
      : [];

  const roleLabels: Record<RoleFilter, string> = {
    all: 'Todos', professional: 'Profissionais', client: 'Clientes', admin: 'Admin',
  };

  function renderCard(u: ApprovedUser) {
    const sc = stripeColor(u);
    const pc = planColor(u.plan_id, u.sub_status);
    const isProfessional = u.role === 'professional';
    const isClient = u.role === 'client';

    const contactHref = u.email
      ? `mailto:${u.email}`
      : u.phone ? `tel:${u.phone}` : undefined;

    const roleBadge = {
      professional: { bg: 'rgba(29,158,117,0.12)', color: '#34d399', border: 'rgba(29,158,117,0.25)' },
      client:       { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa', border: 'rgba(96,165,250,0.2)' },
      admin:        { bg: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: 'rgba(167,139,250,0.2)' },
    }[u.role];

    return (
      <div key={u.user_id} style={{ background: '#132540', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: '1rem', overflow: 'hidden' }}>
        <div style={{ height: 3, background: sc }} />
        <div style={{ padding: '1.125rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* Row 1 — avatar + nome + aprovado em */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <Avatar name={u.full_name ?? ''} url={u.avatar_url} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name ?? 'Sem nome'}</p>
                <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  <MapPin size={10} />
                  <span>{u.city ?? 'Cidade não informada'}</span>
                  {u.email && <><span style={{ opacity: .4 }}>·</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{u.email}</span></>}
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {/* role badge */}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: roleBadge.bg, color: roleBadge.color, border: `0.5px solid ${roleBadge.border}` }}>
                    {roleLabels[u.role as RoleFilter]}
                  </span>
                  {/* plano badge */}
                  {isProfessional && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.05)', color: pc, border: '0.5px solid rgba(255,255,255,0.1)' }}>
                      {formatPlan(u.plan_id, u.sub_status)}
                    </span>
                  )}
                  {/* alerta canceling */}
                  {u.sub_status === 'canceling' && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: 'rgba(186,117,23,0.12)', color: '#f59e0b', border: '0.5px solid rgba(186,117,23,0.25)' }}>
                      ⚠ Cancelando
                    </span>
                  )}
                  {/* categoria */}
                  {u.category && (
                    <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '0.5px solid rgba(255,255,255,0.1)' }}>
                      {u.category}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '.05em' }}>Aprovado</p>
              <p style={{ fontSize: 12, color: 'white', fontWeight: 600, margin: 0 }}>{formatDate(u.approved_at)}</p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

          {/* Stats grid — dinâmico por role */}
          {(() => {
            const statsCols = isProfessional ? [
              { label: 'Plano', icon: <span style={{ fontSize: 11, color: pc, fontWeight: 700 }}>{formatPlan(u.plan_id, u.sub_status)}</span> },
              { label: 'Moedas', icon: <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 3 }}><Coins size={11} />{u.coins_balance}</span> },
              { label: 'Leads comprados', icon: <span style={{ fontSize: 12, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 3 }}><ShoppingBag size={11} style={{ color: '#64748b' }} />{u.leads_purchased}</span> },
              { label: 'Último login', icon: <span style={{ fontSize: 11, color: 'white', display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} style={{ color: '#64748b' }} />{formatDate(u.last_sign_in_at)}</span> },
              { label: 'Telefone', icon: <span style={{ fontSize: 11, color: 'white', display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={11} style={{ color: '#64748b' }} />{formatPhone(u.phone)}</span> },
            ] : isClient ? [
              { label: 'Pedidos criados', icon: <span style={{ fontSize: 12, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 3 }}><ShoppingBag size={11} style={{ color: '#64748b' }} />{u.pedidos_criados}</span> },
              { label: 'Agendamentos', icon: <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} />{u.agendamentos}</span> },
              { label: 'Moedas', icon: <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 3 }}><Coins size={11} />{u.client_coins_balance}</span> },
              { label: 'Último login', icon: <span style={{ fontSize: 11, color: 'white', display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} style={{ color: '#64748b' }} />{formatDate(u.last_sign_in_at)}</span> },
              { label: 'Telefone', icon: <span style={{ fontSize: 11, color: 'white', display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={11} style={{ color: '#64748b' }} />{formatPhone(u.phone)}</span> },
            ] : [
              { label: 'Acesso', icon: <span style={{ fontSize: 11, color: '#a78bfa' }}>Total</span> },
              { label: 'Último login', icon: <span style={{ fontSize: 11, color: 'white', display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} style={{ color: '#64748b' }} />{formatDate(u.last_sign_in_at)}</span> },
              { label: 'Telefone', icon: <span style={{ fontSize: 11, color: 'white', display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={11} style={{ color: '#64748b' }} />{formatPhone(u.phone)}</span> },
            ];
            return (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${statsCols.length}, 1fr)`, gap: 0 }}>
                {statsCols.map((stat, i) => (
                  <div key={i} style={{ padding: '0.625rem 0.75rem', background: '#0f1f35', borderRight: i < statsCols.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 4px' }}>{stat.label}</p>
                    {stat.icon}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

          {/* Row 3 — hint + ações */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <Hint u={u} />
            <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
              {isProfessional && (
                u.is_active ? (
                  <button
                    onClick={() => toggleActiveMutation.mutate({ user_id: u.user_id, is_active: false, role: u.role })}
                    disabled={toggleActiveMutation.isPending}
                    style={{ height: 32, padding: '0 12px', borderRadius: '.5rem', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <PowerOff size={12} /> Desativar
                  </button>
                ) : (
                  <button
                    onClick={() => toggleActiveMutation.mutate({ user_id: u.user_id, is_active: true, role: u.role })}
                    disabled={toggleActiveMutation.isPending}
                    style={{ height: 32, padding: '0 12px', borderRadius: '.5rem', background: '#1D9E75', border: 'none', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Power size={12} /> Reativar
                  </button>
                )
              )}
              {!isProfessional && (
                <button
                  onClick={() => toast.info('Desativação de clientes em breve.')}
                  style={{ height: 32, padding: '0 12px', borderRadius: '.5rem', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <PowerOff size={12} /> Desativar
                </button>
              )}
              {contactHref && (
                <a
                  href={contactHref}
                  style={{ height: 32, padding: '0 12px', borderRadius: '.5rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                >
                  <MessageSquare size={12} /> Contatar
                </a>
              )}
              <a
                href="/admin/usuarios"
                style={{ height: 32, padding: '0 12px', borderRadius: '.5rem', background: 'transparent', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
              >
                <User size={12} /> Ver perfil
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: '0 0 4px' }}>Usuários Aprovados</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Lista completa de usuários ativos na plataforma</p>
        </div>
        <button
          onClick={() => refetch()}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#0d1e33', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#64748b', fontSize: 12, cursor: 'pointer' }}
        >
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '0.625rem' }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{ background: '#132540', border: '1.5px solid rgba(255,255,255,0.07)', borderRadius: '.5rem', padding: '.875rem 1rem', display: 'flex', alignItems: 'stretch', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: kpiColors[i] }} />
            <div style={{ paddingLeft: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', margin: '0 0 5px' }}>{k.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: kpiColors[i], margin: 0, lineHeight: 1 }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', maxWidth: '100%', paddingBottom: 2 }}>
          {(['all', 'professional', 'client', 'admin'] as RoleFilter[]).map(r => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              style={{ height: 34, padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, border: filterRole === r ? '1px solid rgba(29,158,117,0.3)' : '1px solid rgba(255,255,255,0.08)', background: filterRole === r ? 'rgba(29,158,117,0.12)' : 'transparent', color: filterRole === r ? '#34d399' : '#64748b' }}
            >
              {roleLabels[r]} <span style={{ opacity: .6 }}>({roleCounts[r]})</span>
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, email, cidade, categoria, telefone..."
            style={{ width: '100%', background: '#0d1e33', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.625rem 0.875rem 0.625rem 2.25rem', fontSize: 13, color: 'white', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '4rem 1rem' }}>
          <User size={48} style={{ opacity: .2, color: '#64748b' }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'white', margin: 0 }}>Nenhum usuário encontrado</p>
          <p style={{ fontSize: 13, margin: 0, color: '#64748b' }}>{search ? 'Nenhum resultado para a busca.' : 'Sem usuários aprovados ainda.'}</p>
        </div>
      )}

      {/* Cards */}
      {!isLoading && filtered.length > 0 && (
        filterRole === 'all'
          ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {sections.map(({ key, label }) => {
                const items = filtered.filter(u => u.role === key);
                if (items.length === 0) return null;
                return (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <SectionLabel label={label} count={items.length} />
                    {items.map(renderCard)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {filtered.map(renderCard)}
            </div>
          )
      )}
    </div>
  );
}
