import { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle, XCircle, Loader2, Copy, X, Phone, MapPin, Calendar, Coins, Shield, User, ShoppingBag, AlertTriangle, MessageSquare, RefreshCw, Receipt, ChevronUp, ChevronDown, ChevronsUpDown, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService, type EnrichedUser } from '../../services/statsService';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useIsMobile } from '../../hooks/useIsMobile';

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
    <span style={{ fontSize: 10, color, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

function ActionBtn({ onClick, children, variant = 'default' }: { onClick: () => void; children: React.ReactNode; variant?: 'default' | 'danger' | 'success' }) {
  const colors = {
    default: { border: 'rgba(255,255,255,.08)', color: '#7a9ebf' },
    danger:  { border: 'rgba(239,68,68,.2)',    color: '#f87171' },
    success: { border: 'rgba(16,185,129,.2)',   color: '#34d399' },
  }[variant];
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 7, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.color, fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'normal', textAlign: 'left' }}
    >
      {children}
    </button>
  );
}

export default function AdminUsuarios() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'client' | 'professional' | 'admin' | 'pendencias' | 'churn'>('all');
  const [profileModal, setProfileModal] = useState<EnrichedUser | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingUser, setEditingUser] = useState<{ id: string; field: 'name' | 'category'; value: string } | null>(null);
  const [newCategoryMode, setNewCategoryMode] = useState(false);

  const { data: usuarios = [], isLoading, refetch } = useQuery({
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

  const { data: realCategories = [] } = useQuery({
    queryKey: ['adminCategoriesList'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('name').eq('is_active', true).order('name');
      return (data ?? []).map(c => c.name);
    },
    staleTime: 300_000,
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

  const fixRoleMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiFetch(`/api/admin/fix-role/${userId}`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Falha ao corrigir role');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Role corrigido para professional ✅');
      queryClient.invalidateQueries({ queryKey: ['adminUsersEnriched'] });
    },
    onError: () => toast.error('Erro ao corrigir role'),
  });

  const saveEditMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: 'name' | 'category'; value: string }) => {
      if (field === 'name') {
        const { error } = await supabase.from('profiles').update({ full_name: value }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('professionals').update({ category: value }).eq('user_id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Salvo com sucesso!');
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ['adminUsersEnriched'] });
    },
    onError: () => toast.error('Erro ao salvar'),
  });

  const hasInconsistency = (u: EnrichedUser) => u.role !== 'professional' && !!u.professional_id && !!u.category;

  const hasUnknownCategory = (u: EnrichedUser) =>
    u.role === 'professional' && !!u.category && !realCategories.includes(u.category);

  const getProfileScore = (u: EnrichedUser): number => {
    let score = 0;
    if (u.full_name?.trim()) score += 20;
    if (u.phone) score += 20;
    if (u.city) score += 20;
    if (u.role === 'professional') {
      if (u.category) score += 20;
      if (u.package_id) score += 20;
    } else {
      score += 40;
    }
    return score;
  };

  const getScoreColor = (score: number) => score >= 80 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171';

  const isChurnRisk = (u: EnrichedUser): boolean => {
    if (u.role !== 'professional') return false;
    const coins = u.balance_coins ?? 0;
    const lastLogin = u.last_sign_in_at ? new Date(u.last_sign_in_at) : null;
    const daysSinceLogin = lastLogin ? (Date.now() - lastLogin.getTime()) / 86400000 : 999;
    return coins === 0 && daysSinceLogin > 7;
  };

  const daysSince = (date: string | null): number => {
    if (!date) return 999;
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  };

  const highlight = (text: string, query: string): React.ReactNode => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return <>{text.slice(0, idx)}<mark style={{ background: 'rgba(251,191,36,.3)', borderRadius: 2, padding: '0 1px' }}>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const filtered = usuarios.filter(u => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.city ?? '').toLowerCase().includes(q) ||
      (u.category ?? '').toLowerCase().includes(q) ||
      (u.phone ?? '').includes(q);
    let matchFilter = true;
    if (activeFilter === 'client') matchFilter = u.role === 'client';
    else if (activeFilter === 'professional') matchFilter = u.role === 'professional';
    else if (activeFilter === 'admin') matchFilter = u.role === 'admin';
    else if (activeFilter === 'pendencias') matchFilter = !u.full_name?.trim() || (u.role === 'professional' && !u.category) || hasInconsistency(u) || hasUnknownCategory(u);
    else if (activeFilter === 'churn') matchFilter = isChurnRisk(u);
    return matchSearch && matchFilter;
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'full_name') return dir * (a.full_name ?? '').localeCompare(b.full_name ?? '');
    if (sortField === 'balance_coins') return dir * ((a.balance_coins ?? 0) - (b.balance_coins ?? 0));
    if (sortField === 'last_sign_in_at') return dir * (new Date(a.last_sign_in_at ?? 0).getTime() - new Date(b.last_sign_in_at ?? 0).getTime());
    if (sortField === 'created_at') return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (sortField === 'score') return dir * (getProfileScore(a) - getProfileScore(b));
    return 0;
  });

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () => {
    if (selected.size === sortedFiltered.length) setSelected(new Set());
    else setSelected(new Set(sortedFiltered.map(u => u.id)));
  };

  const selectedUsers = sortedFiltered.filter(u => selected.has(u.id));

  const exportCSV = (users: EnrichedUser[]) => {
    const headers = ['Nome', 'Email', 'Role', 'Telefone', 'Cidade', 'Categoria', 'Plano', 'Moedas', 'Cadastro', 'Último login'];
    const rows = users.map(u => [
      u.full_name ?? '', u.email ?? '', u.role, u.phone ?? '',
      u.city ?? '', u.category ?? '', u.package_id ?? '',
      String(u.balance_coins ?? 0), u.created_at, u.last_sign_in_at ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'usuarios.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const counts = {
    client: usuarios.filter(u => u.role === 'client').length,
    professional: usuarios.filter(u => u.role === 'professional').length,
    admin: usuarios.filter(u => u.role === 'admin').length,
  };

  const semPlano = usuarios.filter(u => u.role === 'professional' && !u.package_id).length;
  const pendenciasCount = usuarios.filter(u => !u.full_name?.trim() || (u.role === 'professional' && !u.category) || hasInconsistency(u) || hasUnknownCategory(u)).length;
  const churnRiskCount = usuarios.filter(isChurnRisk).length;

  const SortHeader = ({ field, label, width }: { field: string; label: string; width?: number }) => (
    <th
      onClick={() => handleSort(field)}
      style={{ padding: '0.5rem 0.625rem', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: sortField === field ? '#34d399' : '#4a6580', textAlign: 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...(width ? { width } : {}) }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {label}
        {sortField === field
          ? sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
          : <ChevronsUpDown size={10} style={{ opacity: 0.3 }} />
        }
      </span>
    </th>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 1100, margin: '0 auto' }}>

      {/* Overlay de loading ao atualizar */}
      {isRefreshing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(14,28,50,.75)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Loader2 size={40} className="animate-spin" style={{ color: '#10b981' }} />
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Atualizando usuários...</p>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: '0 0 4px' }}>Gestão de Usuários</h1>
          <p style={{ fontSize: 12, color: '#4a6580', margin: 0 }}>Espelho direto do banco · {usuarios.length} usuários cadastrados</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => exportCSV(sortedFiltered)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, color: '#4a6580', fontSize: 12, cursor: 'pointer' }}>
            Exportar CSV
          </button>
          <button onClick={async () => { setIsRefreshing(true); await refetch(); setIsRefreshing(false); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, color: '#4a6580', fontSize: 12, cursor: 'pointer' }}>
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
      </div>

      {/* KPI cards — 6 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3,1fr)' : 'repeat(6,1fr)', gap: '0.5rem' }}>
        {[
          { label: 'Total usuários',     value: String(usuarios.length),    color: 'white' },
          { label: 'Profissionais',      value: String(counts.professional), color: '#34d399' },
          { label: 'Clientes',           value: String(counts.client),       color: '#60a5fa' },
          { label: 'Sem plano',          value: String(semPlano),            color: semPlano > 0 ? '#fbbf24' : '#4a6580' },
          { label: 'Pendências',         value: String(pendenciasCount),     color: pendenciasCount > 0 ? '#f87171' : '#4a6580' },
          { label: 'Risco churn',        value: String(churnRiskCount),      color: churnRiskCount > 0 ? '#f87171' : '#4a6580' },
        ].map(k => (
          <div key={k.label} style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '0.625rem' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#4a6580', margin: '0 0 6px' }}>{k.label}</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: k.color, margin: 0, lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros + busca */}
      <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'client', 'professional', 'admin'] as const).map(r => (
            <button
              key={r}
              onClick={() => setActiveFilter(r)}
              style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: activeFilter === r ? '1px solid rgba(16,185,129,.4)' : '1px solid rgba(255,255,255,.06)', background: activeFilter === r ? 'rgba(16,185,129,.1)' : '#132540', color: activeFilter === r ? '#34d399' : '#94a3b8', transition: 'all .15s' }}
            >
              {ROLE_LABELS[r]} <span style={{ opacity: .6 }}>({r === 'all' ? usuarios.length : counts[r]})</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setActiveFilter(f => f === 'pendencias' ? 'all' : 'pendencias')}
          style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: activeFilter === 'pendencias' ? '1px solid rgba(248,113,113,.4)' : '1px solid rgba(255,255,255,.06)', background: activeFilter === 'pendencias' ? 'rgba(248,113,113,.1)' : '#132540', color: activeFilter === 'pendencias' ? '#f87171' : '#94a3b8' }}
        >
          ⚠ Pendências ({pendenciasCount})
        </button>
        <button
          onClick={() => setActiveFilter(f => f === 'churn' ? 'all' : 'churn')}
          style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: activeFilter === 'churn' ? '1px solid rgba(248,113,113,.4)' : '1px solid rgba(255,255,255,.06)', background: activeFilter === 'churn' ? 'rgba(248,113,113,.1)' : '#132540', color: activeFilter === 'churn' ? '#f87171' : '#94a3b8' }}
        >
          🔴 Risco churn ({churnRiskCount})
        </button>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#4a6580' }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, email, cidade, categoria, telefone..."
            style={{ width: '100%', background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '0.625rem 0.875rem 0.625rem 2.25rem', fontSize: 13, color: 'white', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Barra de ações em massa */}
      {selected.size > 0 && (
        <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#34d399' }}>{selected.size} selecionados</span>
          <div style={{ flex: 1 }} />
          <ActionBtn onClick={() => { selectedUsers.forEach(u => { if (u.phone) window.open(`https://wa.me/55${u.phone!.replace(/\D/g, '')}`, '_blank'); }); }}>
            WhatsApp em massa
          </ActionBtn>
          <ActionBtn onClick={() => exportCSV(selectedUsers)}>
            Exportar seleção
          </ActionBtn>
          <ActionBtn onClick={() => setSelected(new Set())}>
            Limpar seleção
          </ActionBtn>
        </div>
      )}

      {/* Edição inline */}
      {editingUser && (
        <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>
            {editingUser.field === 'name' ? 'Definir nome' : 'Definir categoria'}
          </span>
          {editingUser.field === 'category' && !newCategoryMode ? (
            <select
              value={editingUser.value}
              onChange={e => {
                if (e.target.value === '__new__') { setNewCategoryMode(true); setEditingUser(prev => prev ? { ...prev, value: '' } : null); }
                else setEditingUser(prev => prev ? { ...prev, value: e.target.value } : null);
              }}
              style={{ flex: 1, background: '#0E1C32', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '6px 10px', color: 'white', fontSize: 12 }}
              autoFocus
            >
              <option value="" disabled>Selecione a categoria real</option>
              {realCategories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__new__">➕ Criar nova categoria...</option>
            </select>
          ) : (
            <input
              value={editingUser.value}
              onChange={e => setEditingUser(prev => prev ? { ...prev, value: e.target.value } : null)}
              placeholder="Nome da nova categoria"
              style={{ flex: 1, background: '#0E1C32', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '6px 10px', color: 'white', fontSize: 12 }}
              autoFocus
            />
          )}
          <ActionBtn onClick={async () => {
            if (newCategoryMode && editingUser.value.trim()) {
              const slug = editingUser.value.trim().toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              await supabase.from('categories').insert({ name: editingUser.value.trim(), slug, is_active: true });
              queryClient.invalidateQueries({ queryKey: ['adminCategoriesList'] });
            }
            saveEditMutation.mutate(editingUser);
            setNewCategoryMode(false);
          }} variant="success">Salvar</ActionBtn>
          <ActionBtn onClick={() => { setEditingUser(null); setNewCategoryMode(false); }}>Cancelar</ActionBtn>
        </div>
      )}

      {/* Tabela */}
      <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 size={28} className="animate-spin" style={{ color: '#10b981' }} />
          </div>
        ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sortedFiltered.map(u => {
                const av = ROLE_AVATAR[u.role] ?? { bg: 'rgba(255,255,255,.06)', color: '#94a3b8' };
                const rb = ROLE_BADGE[u.role] ?? { bg: 'rgba(255,255,255,.06)', color: '#94a3b8', border: 'rgba(255,255,255,.1)', label: u.role };
                const plan = u.package_id ? PLAN_META[u.package_id] : null;
                const initials = (u.full_name ?? u.email ?? '?').charAt(0).toUpperCase();
                const score = getProfileScore(u);
                const churnUser = isChurnRisk(u);
                return (
                  <div key={u.id} style={{ background: '#132236', borderRadius: 12, border: '1px solid rgba(255,255,255,.06)', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: av.color, flexShrink: 0, overflow: 'hidden' }}>
                        {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} /> : initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: u.full_name ? 'white' : '#4a6580', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name || 'sem nome'}</p>
                        <p style={{ fontSize: 11, color: '#4a6580', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: rb.bg, color: rb.color, border: `1px solid ${rb.border}`, flexShrink: 0 }}>{rb.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: getScoreColor(score) }}>{score}%</span>
                      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,.08)', borderRadius: 2 }}>
                        <div style={{ width: `${score}%`, height: '100%', background: getScoreColor(score), borderRadius: 2 }} />
                      </div>
                      {churnUser && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'rgba(239,68,68,.12)', color: '#f87171', border: '1px solid rgba(239,68,68,.2)' }}>churn</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {u.city && <span style={{ fontSize: 10, color: '#4a6580' }}>📍 {u.city}</span>}
                      {u.phone && <span style={{ fontSize: 10, color: '#4a6580' }}>📱 {u.phone}</span>}
                      {plan && <span style={{ fontSize: 10, fontWeight: 700, color: plan.color }}>{plan.label}</span>}
                      {!plan && u.role === 'professional' && <span style={{ fontSize: 10, color: '#4a6580' }}>Sem plano</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <ActionBtn onClick={() => setProfileModal(u)}><User size={11} /> Ver perfil</ActionBtn>
                      {u.phone && (
                        <ActionBtn onClick={() => window.open(`https://wa.me/55${u.phone!.replace(/\D/g, '')}`, '_blank')}>
                          <MessageSquare size={11} /> WhatsApp
                        </ActionBtn>
                      )}
                      {u.role === 'professional' && u.is_active === true && (
                        <ActionBtn onClick={() => { if (window.confirm('Confirma desativar?')) updateStatusMutation.mutate({ id: u.id, status: 'inactive' }); }} variant="danger">
                          <XCircle size={11} /> Desativar
                        </ActionBtn>
                      )}
                      {u.role === 'professional' && u.is_active === false && (
                        <ActionBtn onClick={() => updateStatusMutation.mutate({ id: u.id, status: 'active' })} variant="success">
                          <CheckCircle size={11} /> Ativar
                        </ActionBtn>
                      )}
                      <ActionBtn onClick={() => { navigator.clipboard.writeText(u.id); toast.success('ID copiado!'); }}>
                        <Copy size={11} /> Copiar ID
                      </ActionBtn>
                    </div>
                  </div>
                );
              })}
              {sortedFiltered.length === 0 && (
                <p style={{ textAlign: 'center', color: '#4a6580', fontSize: 13, padding: '2rem' }}>Nenhum usuário encontrado.</p>
              )}
            </div>
          ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1130 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <th style={{ padding: '0.5rem 0.5rem 0.5rem 0.625rem', width: 32 }}>
                    <input
                      type="checkbox"
                      checked={sortedFiltered.length > 0 && selected.size === sortedFiltered.length}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', accentColor: '#10b981' }}
                    />
                  </th>
                  <SortHeader field="full_name" label="Usuário" width={200} />
                  <th style={{ padding: '0.5rem 0.625rem', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4a6580', textAlign: 'left', width: 180 }}>Contato</th>
                  <th style={{ padding: '0.5rem 0.625rem', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4a6580', textAlign: 'left', width: 140 }}>Tipo</th>
                  <th style={{ padding: '0.5rem 0.625rem', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4a6580', textAlign: 'left', width: 160 }}>Plano / Atividade</th>
                  <SortHeader field="created_at" label="Cadastro" width={110} />
                  <SortHeader field="last_sign_in_at" label="Último login" width={110} />
                  <th style={{ padding: '0.5rem 0.625rem', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4a6580', textAlign: 'left', width: 150 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.map(u => {
                  const av = ROLE_AVATAR[u.role] ?? { bg: 'rgba(255,255,255,.06)', color: '#94a3b8' };
                  const rb = ROLE_BADGE[u.role] ?? { bg: 'rgba(255,255,255,.06)', color: '#94a3b8', border: 'rgba(255,255,255,.1)', label: u.role };
                  const plan = u.package_id ? PLAN_META[u.package_id] : null;
                  const subSt = u.sub_status ? SUB_ST[u.sub_status] : null;
                  const initials = (u.full_name ?? u.email ?? '?').charAt(0).toUpperCase();
                  const inconsistent = hasInconsistency(u);
                  const score = getProfileScore(u);
                  const churnUser = isChurnRisk(u);
                  const daysLogin = daysSince(u.last_sign_in_at);

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', background: selected.has(u.id) ? 'rgba(16,185,129,.04)' : undefined }}>
                      {/* Checkbox */}
                      <td style={{ padding: '0.5rem 0.5rem 0.5rem 0.625rem' }}>
                        <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)} style={{ cursor: 'pointer', accentColor: '#10b981' }} />
                      </td>

                      {/* Usuário + Score */}
                      <td style={{ padding: '0.5rem 0.625rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 8, background: inconsistent ? 'rgba(245,158,11,.15)' : av.bg, border: `1.5px solid ${inconsistent ? 'rgba(245,158,11,.3)' : av.color + '44'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: inconsistent ? '#fbbf24' : av.color, flexShrink: 0, overflow: 'hidden' }}>
                            {u.avatar_url
                              ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                              : initials
                            }
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: u.full_name ? 'white' : '#4a6580', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                                {highlight(u.full_name || 'sem nome', searchQuery)}
                              </p>
                              {inconsistent && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'rgba(245,158,11,.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,.2)', flexShrink: 0 }}>⚠</span>}
                              {churnUser && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'rgba(239,68,68,.12)', color: '#f87171', border: '1px solid rgba(239,68,68,.2)', flexShrink: 0 }}>churn</span>}
                            </div>
                            {u.city && <Pill><MapPin size={9} />{u.city}</Pill>}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              <span style={{ fontSize: 10, color: getScoreColor(score), flexShrink: 0 }}>{score}%</span>
                              <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,.08)', borderRadius: 2, minWidth: 40 }}>
                                <div style={{ width: `${score}%`, height: '100%', background: getScoreColor(score), borderRadius: 2 }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contato */}
                      <td style={{ padding: '0.5rem 0.625rem' }}>
                        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                          {highlight(u.email ?? '—', searchQuery)}
                        </p>
                        {u.phone && <Pill><Phone size={10} />{u.phone}</Pill>}
                      </td>

                      {/* Tipo + Origem */}
                      <td style={{ padding: '0.5rem 0.625rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: rb.bg, color: rb.color, border: `1px solid ${rb.border}`, display: 'inline-block' }}>{rb.label}</span>
                          {u.role === 'professional' && u.category && (
                          <Pill color={hasUnknownCategory(u) ? '#f59e0b' : '#4a6580'}>
                            {hasUnknownCategory(u) && <AlertTriangle size={10} />}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120, display: 'block' }}>
                              {highlight(u.category, searchQuery)}
                            </span>
                          </Pill>
                        )}
                          <span style={{ fontSize: 10, color: '#60a5fa' }}>
                            {u.origin === 'meta_ads' ? '📣 Meta Ads' : u.origin === 'referral' ? '👥 Indicação' : u.origin === 'organic' ? '🌐 Orgânico' : '❔ Desconhecido'}
                          </span>
                        </div>
                      </td>

                      {/* Plano / Atividade */}
                      <td style={{ padding: '0.5rem 0.625rem' }}>
                        {u.role === 'professional' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: plan?.color ?? '#4a6580' }}>{plan?.label ?? 'Sem plano'}</span>
                              {subSt && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, color: subSt.color, border: `1px solid ${subSt.color}44`, background: subSt.color + '12' }}>{subSt.label}</span>}
                            </div>
                            {u.sub_started_at && <Pill><Calendar size={10} />Desde {fmtDate(u.sub_started_at)}</Pill>}
                            {u.balance_coins !== null && <Pill color="#fbbf24"><Coins size={10} />{u.balance_coins} moedas</Pill>}
                            {u.total_payments > 0 && <Pill color="#34d399"><Receipt size={10} />{u.total_payments} pag. · R${fmtBRL(u.total_spent)}</Pill>}
                          </div>
                        ) : u.role === 'client' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <Pill><ShoppingBag size={10} />{u.total_leads} pedidos</Pill>
                            {u.total_appointments > 0 && <Pill><Calendar size={10} />{u.total_appointments} agendamentos</Pill>}
                            {u.total_spent > 0 && <Pill color="#34d399"><Receipt size={10} />R${fmtBRL(u.total_spent)}</Pill>}
                          </div>
                        ) : (
                          <Pill><Shield size={10} />Acesso total</Pill>
                        )}
                      </td>

                      {/* Cadastro */}
                      <td style={{ padding: '0.5rem 0.625rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Pill><Calendar size={10} />{fmtDate(u.created_at)}</Pill>
                          <Pill><Clock size={10} />{new Date(u.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Pill>
                        </div>
                      </td>

                      {/* Último login */}
                      <td style={{ padding: '0.5rem 0.625rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Pill color={daysLogin > 30 ? '#f87171' : '#4a6580'}>
                            <Calendar size={10} />{fmtDate(u.last_sign_in_at)}
                            {daysLogin > 30 && <span style={{ fontSize: 9, background: 'rgba(239,68,68,.1)', color: '#f87171', padding: '1px 3px', borderRadius: 3, marginLeft: 2 }}>{daysLogin}d</span>}
                          </Pill>
                          {u.last_sign_in_at && (
                            <Pill><Clock size={10} />{new Date(u.last_sign_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Pill>
                          )}
                        </div>
                      </td>

                      {/* Ações */}
                      <td style={{ padding: '0.5rem 0.625rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {u.role === 'professional' && u.is_active === true && (
                            <ActionBtn onClick={() => { if (window.confirm('Confirma desativar este usuário?')) updateStatusMutation.mutate({ id: u.id, status: 'inactive' }); }} variant="danger">
                              <XCircle size={11} /> Desativar
                            </ActionBtn>
                          )}
                          {u.role === 'professional' && u.is_active === false && (
                            <ActionBtn onClick={() => updateStatusMutation.mutate({ id: u.id, status: 'active' })} variant="success">
                              <CheckCircle size={11} /> Ativar
                            </ActionBtn>
                          )}
                          <ActionBtn onClick={() => setProfileModal(u)}>
                            <User size={11} /> Ver perfil
                          </ActionBtn>
                          {u.phone && (
                            <ActionBtn onClick={() => window.open(`https://wa.me/55${u.phone!.replace(/\D/g, '')}`, '_blank')}>
                              <MessageSquare size={11} /> WhatsApp
                            </ActionBtn>
                          )}
                          {!u.full_name?.trim() && (
                            <ActionBtn onClick={() => setEditingUser({ id: u.id, field: 'name', value: '' })}>
                              <User size={11} /> Definir nome
                            </ActionBtn>
                          )}
                          {u.role === 'professional' && !u.category && (
                            <ActionBtn onClick={() => setEditingUser({ id: u.id, field: 'category', value: '' })}>
                              Definir categoria
                            </ActionBtn>
                          )}
                          {u.role === 'professional' && hasUnknownCategory(u) && (
                            <ActionBtn onClick={() => setEditingUser({ id: u.id, field: 'category', value: u.category ?? '' })} variant="danger">
                              <AlertTriangle size={11} /> Reclassificar
                            </ActionBtn>
                          )}
                          {inconsistent && (
                            <ActionBtn onClick={() => { if (window.confirm('Confirma corrigir role para professional?')) fixRoleMutation.mutate(u.id); }} variant="danger">
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
                {sortedFiltered.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#4a6580', fontSize: 13 }}>Nenhum usuário encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal perfil */}
      {profileModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)' }} onClick={() => setProfileModal(null)} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: '#0E1C32', border: '1px solid rgba(255,255,255,.09)', borderRadius: 20, overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: profileModal.role === 'professional' ? 'linear-gradient(90deg,#10b981,#059669)' : profileModal.role === 'admin' ? 'linear-gradient(90deg,#8b5cf6,#6d28d9)' : 'linear-gradient(90deg,#3b82f6,#1d4ed8)' }} />

            <div style={{ background: '#132540', padding: '1.25rem', flexShrink: 0, paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: ROLE_AVATAR[profileModal.role]?.bg ?? 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: ROLE_AVATAR[profileModal.role]?.color ?? '#94a3b8', overflow: 'hidden' }}>
                    {profileModal.avatar_url
                      ? <img src={profileModal.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
                      : (profileModal.full_name ?? profileModal.email ?? '?').charAt(0).toUpperCase()
                    }
                  </div>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: '0 0 5px', wordBreak: 'break-word' }}>{profileModal.full_name ?? 'Sem nome'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: ROLE_BADGE[profileModal.role]?.bg, color: ROLE_BADGE[profileModal.role]?.color, border: `1px solid ${ROLE_BADGE[profileModal.role]?.border}` }}>
                        {ROLE_BADGE[profileModal.role]?.label ?? profileModal.role}
                      </span>
                      {hasInconsistency(profileModal) && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,.25)' }}>⚠ inconsistente</span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setProfileModal(null)} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(0,0,0,.3)', border: 'none', color: '#4a6580', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '1rem' }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#4a6580', margin: '0 0 0.75rem' }}>Dados básicos</p>
                {[
                  { icon: <User size={12} />, label: 'Email', value: profileModal.email ?? '—' },
                  { icon: <Phone size={12} />, label: 'Telefone', value: profileModal.phone ?? '—' },
                  { icon: <MapPin size={12} />, label: 'Cidade', value: profileModal.city ?? '—' },
                  { icon: <Calendar size={12} />, label: 'Cadastro', value: fmtDate(profileModal.created_at) },
                  { icon: <Calendar size={12} />, label: 'Último login', value: fmtDate(profileModal.last_sign_in_at) },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <span style={{ fontSize: 12, color: '#4a6580', display: 'flex', alignItems: 'center', gap: 5 }}>{row.icon}{row.label}</span>
                    <span style={{ fontSize: 12, color: 'white', fontWeight: 500, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {profileModal.role === 'professional' && (
                <div style={{ background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 10, padding: '1rem' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#10b981', margin: '0 0 0.75rem' }}>Dados profissionais</p>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {[
                      { label: 'Categoria',   value: profileModal.category ?? '—',  color: 'white' },
                      { label: 'Status',      value: profileModal.is_active ? 'Ativo' : 'Inativo', color: profileModal.is_active ? '#34d399' : '#f87171' },
                      { label: 'Plano',       value: profileModal.package_id ? (PLAN_META[profileModal.package_id]?.label ?? profileModal.package_id) : 'Sem plano', color: profileModal.package_id ? (PLAN_META[profileModal.package_id]?.color ?? 'white') : '#4a6580' },
                      { label: 'Assinatura',  value: profileModal.sub_status ? (SUB_ST[profileModal.sub_status]?.label ?? profileModal.sub_status) : '—', color: profileModal.sub_status ? (SUB_ST[profileModal.sub_status]?.color ?? '#94a3b8') : '#4a6580' },
                      { label: 'Moedas',      value: String(profileModal.balance_coins ?? 0), color: '#fbbf24' },
                      { label: 'Pagamentos',  value: String(profileModal.total_payments), color: 'white' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '0.625rem', textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: '#4a6580', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {profileModal.total_spent > 0 && (
                    <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 8, padding: '0.625rem 0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#4a6580' }}>Total gasto na plataforma</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#34d399' }}>R${fmtBRL(profileModal.total_spent)}</span>
                    </div>
                  )}
                  {profileModal.sub_started_at && (
                    <p style={{ fontSize: 11, color: '#4a6580', margin: '0.5rem 0 0' }}>Plano ativo desde {fmtDate(profileModal.sub_started_at)}</p>
                  )}
                  {profileModal.bio && <p style={{ fontSize: 12, color: '#4a6580', margin: '0.75rem 0 0', lineHeight: 1.5, fontStyle: 'italic' }}>"{profileModal.bio}"</p>}
                </div>
              )}

              {profileModal.role === 'client' && (
                <div style={{ background: 'rgba(59,130,246,.05)', border: '1px solid rgba(59,130,246,.15)', borderRadius: 10, padding: '1rem' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#60a5fa', margin: '0 0 0.75rem' }}>Dados do cliente</p>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.5rem' }}>
                    {[
                      { label: 'Pedidos',      value: String(profileModal.total_leads),       color: 'white' },
                      { label: 'Agendamentos', value: String(profileModal.total_appointments), color: 'white' },
                      { label: 'Total gasto',  value: profileModal.total_spent > 0 ? `R$${fmtBRL(profileModal.total_spent)}` : 'R$0,00', color: profileModal.total_spent > 0 ? '#34d399' : '#4a6580' },
                      { label: 'Pagamentos',   value: String(profileModal.total_payments),    color: 'white' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '0.625rem', textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: '#4a6580', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '0.5rem 0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#4a6580', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>ID: {profileModal.id}</span>
                <button onClick={() => { navigator.clipboard.writeText(profileModal.id); toast.success('ID copiado!'); }} style={{ background: 'none', border: 'none', color: '#4a6580', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                  <Copy size={13} />
                </button>
              </div>
            </div>

            <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0, display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  if (profileModal.phone) window.open(`https://wa.me/55${profileModal.phone.replace(/\D/g, '')}`, '_blank');
                  else toast.error('Sem telefone cadastrado');
                }}
                style={{ flex: 1, height: 38, background: '#132540', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, color: '#7a9ebf', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <MessageSquare size={14} /> WhatsApp
              </button>
              <button
                onClick={() => setProfileModal(null)}
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
