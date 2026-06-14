import { useState, useEffect, useRef } from 'react';
import { Search, MoreVertical, CheckCircle, XCircle, Loader2, Copy, X, Phone, MapPin, Calendar, Coins, Shield, User, ShoppingBag, AlertTriangle, MessageSquare, RefreshCw, Receipt, Star } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService, type EnrichedUser } from '../../services/statsService';
import { toast } from 'sonner';

type RoleFilter = 'all' | 'client' | 'professional' | 'admin';

const ROLE_LABELS: Record<RoleFilter, string> = {
  all: 'Todos', client: 'Clientes', professional: 'Profissionais', admin: 'Admin',
};

const PLAN_META: Record<string, { label: string; color: string }> = {
  plan_basic:    { label: 'Starter',  color: '#60a5fa' },
  plan_starter:  { label: 'Starter',  color: '#60a5fa' },
  plan_pro:      { label: 'PRO',      color: '#34d399' },
  plan_business: { label: 'PRO',      color: '#34d399' },
  plan_elite:    { label: 'Elite',    color: '#fbbf24' },
};

const SUB_ST: Record<string, { label: string; color: string }> = {
  active:    { label: 'Ativo',      color: '#34d399' },
  canceling: { label: 'Cancelando', color: '#f87171' },
  cancelled: { label: 'Cancelado',  color: '#64748b' },
};

const ROLE_AVATAR: Record<string, { bg: string; color: string }> = {
  professional: { bg: 'rgba(16,185,129,.15)',  color: '#34d399' },
  client:       { bg: 'rgba(59,130,246,.15)',  color: '#60a5fa' },
  admin:        { bg: 'rgba(139,92,246,.15)',  color: '#a78bfa' },
};

const ROLE_BADGE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  professional: { bg: 'rgba(16,185,129,.1)', color: '#34d399', border: 'rgba(16,185,129,.25)', label: 'Profissional' },
  client:       { bg: 'rgba(59,130,246,.1)', color: '#60a5fa', border: 'rgba(59,130,246,.25)', label: 'Cliente' },
  admin:        { bg: 'rgba(139,92,246,.1)', color: '#a78bfa', border: 'rgba(139,92,246,.25)', label: 'Admin' },
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}
function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function Pill({ children, color = '#4a6580' }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontSize: 11, color, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

function ActionBtn({ onClick, children, variant = 'default' }: { onClick: () => void; children: React.ReactNode; variant?: 'default' | 'danger' | 'success' }) {
  const colors = {
    default: { border: 'rgba(255,255,255,.08)', color: '#7a9ebf', hover: '#fff' },
    danger:  { border: 'rgba(239,68,68,.2)',    color: '#f87171', hover: '#fca5a5' },
    success: { border: 'rgba(16,185,129,.2)',   color: '#34d399', hover: '#6ee7b7' },
  }[variant];
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.color, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
    >
      {children}
    </button>
  );
}

export default function AdminUsuarios() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<RoleFilter>('all');
  const [selected, setSelected] = useState<EnrichedUser | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: usuarios = [], isLoading, refetch } = useQuery({
    queryKey: ['adminUsersEnriched'],
    queryFn: () => adminService.getUsersEnriched(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminService.updateUserStatus(id, status),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminUsersEnriched'] }); toast.success('Status atualizado!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = usuarios.filter(u => {
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.city ?? '').toLowerCase().includes(q) ||
      (u.category ?? '').toLowerCase().includes(q) ||
      (u.phone ?? '').includes(q);
    return matchRole && matchSearch;
  });

  const counts = {
    all: usuarios.length,
    client: usuarios.filter(u => u.role === 'client').length,
    professional: usuarios.filter(u => u.role === 'professional').length,
    admin: usuarios.filter(u => u.role === 'admin').length,
  };

  const totalSpent = usuarios.reduce((a, u) => a + u.total_spent, 0);
  const emailsOk = usuarios.length;

  const hasInconsistency = (u: EnrichedUser) => u.role !== 'professional' && !!u.professional_id && !!u.category;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 1400, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: '0 0 4px' }}>Gestão de Usuários</h1>
          <p style={{ fontSize: 12, color: '#4a6580', margin: 0 }}>Espelho direto do banco · {usuarios.length} usuários cadastrados</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => refetch()} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, color: '#4a6580', fontSize: 12, cursor: 'pointer' }}>
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.625rem' }}>
        {[
          { label: 'Total usuários', value: String(usuarios.length), color: 'white' },
          { label: 'Profissionais ativos', value: String(counts.professional), color: '#34d399' },
          { label: 'Gasto total plataforma', value: `R$${Math.round(totalSpent).toLocaleString('pt-BR')}`, color: '#fbbf24' },
          { label: 'Emails confirmados', value: `${emailsOk}/${usuarios.length}`, color: '#60a5fa' },
        ].map(k => (
          <div key={k.label} style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '1rem' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#4a6580', margin: '0 0 6px' }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: 0, lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros + busca */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'client', 'professional', 'admin'] as RoleFilter[]).map(r => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: filterRole === r ? '1px solid rgba(16,185,129,.4)' : '1px solid rgba(255,255,255,.06)', background: filterRole === r ? 'rgba(16,185,129,.1)' : '#132540', color: filterRole === r ? '#34d399' : '#94a3b8', transition: 'all .15s' }}
            >
              {ROLE_LABELS[r]} <span style={{ opacity: .6 }}>({counts[r]})</span>
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#4a6580' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, email, cidade, categoria, telefone..."
            style={{ width: '100%', background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '0.625rem 0.875rem 0.625rem 2.25rem', fontSize: 13, color: 'white', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Tabela */}
      <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 size={28} className="animate-spin" style={{ color: '#10b981' }} />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                {['Usuário', 'Contato', 'Tipo', 'Plano / Atividade', 'Datas & Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4a6580', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const av = ROLE_AVATAR[u.role] ?? { bg: 'rgba(255,255,255,.06)', color: '#94a3b8' };
                const rb = ROLE_BADGE[u.role] ?? { bg: 'rgba(255,255,255,.06)', color: '#94a3b8', border: 'rgba(255,255,255,.1)', label: u.role };
                const plan = u.package_id ? PLAN_META[u.package_id] : null;
                const subSt = u.sub_status ? SUB_ST[u.sub_status] : null;
                const initials = (u.full_name ?? u.email ?? '?').charAt(0).toUpperCase();
                const inconsistent = hasInconsistency(u);

                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    {/* Usuário */}
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: inconsistent ? 'rgba(245,158,11,.15)' : av.bg, border: `1.5px solid ${inconsistent ? 'rgba(245,158,11,.3)' : av.color + '44'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: inconsistent ? '#fbbf24' : av.color, flexShrink: 0 }}>{initials}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name ?? 'Sem nome'}</p>
                            {inconsistent && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(245,158,11,.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,.2)', flexShrink: 0 }}>⚠ inconsistente</span>}
                          </div>
                          {u.city && <Pill><MapPin size={10} />{u.city}</Pill>}
                        </div>
                      </div>
                    </td>
                    {/* Contato */}
                    <td style={{ padding: '1rem' }}>
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{u.email ?? '—'}</p>
                      {u.phone && <Pill><Phone size={10} />{u.phone}</Pill>}
                    </td>
                    {/* Tipo */}
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: rb.bg, color: rb.color, border: `1px solid ${rb.border}`, display: 'inline-block' }}>{rb.label}</span>
                        {u.category && <Pill color="#4a6580">{u.category}</Pill>}
                      </div>
                    </td>
                    {/* Plano / Atividade */}
                    <td style={{ padding: '1rem' }}>
                      {u.role === 'professional' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: plan?.color ?? '#4a6580' }}>{plan?.label ?? 'Sem plano'}</span>
                            {subSt && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, color: subSt.color, border: `1px solid ${subSt.color}44`, background: subSt.color + '12' }}>{subSt.label}</span>}
                          </div>
                          {u.sub_started_at && <Pill><Calendar size={10} />Desde {fmtDate(u.sub_started_at)}</Pill>}
                          {u.balance_coins !== null && <Pill color="#fbbf24"><Coins size={10} />{u.balance_coins} moedas</Pill>}
                          {u.total_payments > 0 && <Pill color="#34d399"><Receipt size={10} />{u.total_payments} pagamentos · R${fmtBRL(u.total_spent)}</Pill>}
                        </div>
                      ) : u.role === 'client' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <Pill><ShoppingBag size={10} />{u.total_leads} pedidos criados</Pill>
                          {u.total_appointments > 0 && <Pill><Calendar size={10} />{u.total_appointments} agendamentos</Pill>}
                          {u.total_spent > 0 && <Pill color="#34d399"><Receipt size={10} />R${fmtBRL(u.total_spent)} gastos</Pill>}
                        </div>
                      ) : (
                        <Pill><Shield size={10} />Acesso total</Pill>
                      )}
                    </td>
                    {/* Datas & Status */}
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <Pill><User size={10} />Cadastro: {fmtDate(u.created_at)}</Pill>
                        {u.last_sign_in_at && <Pill>Login: {fmtDate(u.last_sign_in_at)}</Pill>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: u.is_active === false ? '#ef4444' : '#10b981', display: 'inline-block' }} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: u.is_active === false ? '#f87171' : '#34d399' }}>
                            {u.is_active === false ? 'Inativo' : 'Ativo'}
                          </span>
                        </div>
                      </div>
                    </td>
                    {/* Ações */}
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {u.role === 'professional' && u.is_active === true && (
                          <ActionBtn onClick={() => updateStatusMutation.mutate({ id: u.id, status: 'inactive' })} variant="danger">
                            <XCircle size={11} /> Desativar
                          </ActionBtn>
                        )}
                        {u.role === 'professional' && u.is_active === false && (
                          <ActionBtn onClick={() => updateStatusMutation.mutate({ id: u.id, status: 'active' })} variant="success">
                            <CheckCircle size={11} /> Ativar
                          </ActionBtn>
                        )}
                        <ActionBtn onClick={() => setSelected(u)}>
                          <User size={11} /> Ver perfil
                        </ActionBtn>
                        <ActionBtn onClick={() => { navigator.clipboard.writeText(u.phone ?? ''); toast.success('Telefone copiado!'); }}>
                          <MessageSquare size={11} /> Contatar
                        </ActionBtn>
                        {inconsistent && (
                          <ActionBtn onClick={() => toast.info('Corrija o role no banco: profiles.role = professional')} variant="danger">
                            <AlertTriangle size={11} /> Corrigir role
                          </ActionBtn>
                        )}
                        <ActionBtn onClick={() => { navigator.clipboard.writeText(u.id); toast.success('ID copiado!'); }}>
                          <Copy size={11} /> Copiar ID
                        </ActionBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#4a6580', fontSize: 13 }}>Nenhum usuário encontrado.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal premium */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)' }} onClick={() => setSelected(null)} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: '#0E1C32', border: '1px solid rgba(255,255,255,.09)', borderRadius: 20, overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

            {/* Stripe colorida topo */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: selected.role === 'professional' ? 'linear-gradient(90deg,#10b981,#059669)' : selected.role === 'admin' ? 'linear-gradient(90deg,#8b5cf6,#6d28d9)' : 'linear-gradient(90deg,#3b82f6,#1d4ed8)' }} />

            {/* Header modal */}
            <div style={{ background: '#132540', padding: '1.25rem', flexShrink: 0, paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: ROLE_AVATAR[selected.role]?.bg ?? 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: ROLE_AVATAR[selected.role]?.color ?? '#94a3b8' }}>
                    {(selected.full_name ?? selected.email ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: '0 0 5px' }}>{selected.full_name ?? 'Sem nome'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: ROLE_BADGE[selected.role]?.bg, color: ROLE_BADGE[selected.role]?.color, border: `1px solid ${ROLE_BADGE[selected.role]?.border}` }}>
                        {ROLE_BADGE[selected.role]?.label ?? selected.role}
                      </span>
                      {hasInconsistency(selected) && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,.25)' }}>⚠ inconsistente</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(0,0,0,.3)', border: 'none', color: '#4a6580', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Dados básicos */}
              <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '1rem' }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#4a6580', margin: '0 0 0.75rem' }}>Dados básicos</p>
                {[
                  { icon: <User size={12} />, label: 'Email', value: selected.email ?? '—' },
                  { icon: <Phone size={12} />, label: 'Telefone', value: selected.phone ?? '—' },
                  { icon: <MapPin size={12} />, label: 'Cidade', value: selected.city ?? '—' },
                  { icon: <Calendar size={12} />, label: 'Cadastro', value: fmtDate(selected.created_at) },
                  { icon: <Calendar size={12} />, label: 'Último login', value: fmtDate(selected.last_sign_in_at) },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <span style={{ fontSize: 12, color: '#4a6580', display: 'flex', alignItems: 'center', gap: 5 }}>{row.icon}{row.label}</span>
                    <span style={{ fontSize: 12, color: 'white', fontWeight: 500, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Profissional */}
              {selected.role === 'professional' && (
                <div style={{ background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 10, padding: '1rem' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#10b981', margin: '0 0 0.75rem' }}>Dados profissionais</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {[
                      { label: 'Categoria', value: selected.category ?? '—', color: 'white' },
                      { label: 'Status', value: selected.is_active ? 'Ativo' : 'Inativo', color: selected.is_active ? '#34d399' : '#f87171' },
                      { label: 'Plano', value: selected.package_id ? (PLAN_META[selected.package_id]?.label ?? selected.package_id) : 'Sem plano', color: selected.package_id ? (PLAN_META[selected.package_id]?.color ?? 'white') : '#4a6580' },
                      { label: 'Assinatura', value: selected.sub_status ? (SUB_ST[selected.sub_status]?.label ?? selected.sub_status) : '—', color: selected.sub_status ? (SUB_ST[selected.sub_status]?.color ?? '#94a3b8') : '#4a6580' },
                      { label: 'Moedas', value: String(selected.balance_coins ?? 0), color: '#fbbf24' },
                      { label: 'Pagamentos', value: String(selected.total_payments), color: 'white' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '0.625rem', textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: '#4a6580', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {selected.total_spent > 0 && (
                    <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 8, padding: '0.625rem 0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#4a6580' }}>Total gasto na plataforma</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#34d399' }}>R${fmtBRL(selected.total_spent)}</span>
                    </div>
                  )}
                  {selected.sub_started_at && (
                    <p style={{ fontSize: 11, color: '#4a6580', margin: '0.5rem 0 0' }}>Plano ativo desde {fmtDate(selected.sub_started_at)}</p>
                  )}
                  {selected.bio && <p style={{ fontSize: 12, color: '#4a6580', margin: '0.75rem 0 0', lineHeight: 1.5, fontStyle: 'italic' }}>"{selected.bio}"</p>}
                </div>
              )}

              {/* Cliente */}
              {selected.role === 'client' && (
                <div style={{ background: 'rgba(59,130,246,.05)', border: '1px solid rgba(59,130,246,.15)', borderRadius: 10, padding: '1rem' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#60a5fa', margin: '0 0 0.75rem' }}>Dados do cliente</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {[
                      { label: 'Pedidos', value: String(selected.total_leads), color: 'white' },
                      { label: 'Agendamentos', value: String(selected.total_appointments), color: 'white' },
                      { label: 'Total gasto', value: selected.total_spent > 0 ? `R$${fmtBRL(selected.total_spent)}` : 'R$0,00', color: selected.total_spent > 0 ? '#34d399' : '#4a6580' },
                      { label: 'Pagamentos', value: String(selected.total_payments), color: 'white' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '0.625rem', textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: '#4a6580', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ID */}
              <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#4a6580', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>ID: {selected.id}</span>
                <button onClick={() => { navigator.clipboard.writeText(selected.id); toast.success('ID copiado!'); }} style={{ background: 'none', border: 'none', color: '#4a6580', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                  <Copy size={13} />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0, display: 'flex', gap: 8 }}>
              <button
                onClick={() => { navigator.clipboard.writeText(selected.phone ?? ''); toast.success('Telefone copiado!'); }}
                style={{ flex: 1, height: 38, background: '#132540', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, color: '#7a9ebf', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <MessageSquare size={14} /> Contatar
              </button>
              <button
                onClick={() => setSelected(null)}
                style={{ flex: 1, height: 38, background: '#10b981', border: 'none', borderRadius: 10, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
