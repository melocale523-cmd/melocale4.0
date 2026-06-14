import { useState, useMemo } from 'react';
import { Search, CheckCircle, XCircle, Loader2, Clock, MapPin, Phone, Briefcase, User, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface PendingProfessional {
  user_id: string;
  full_name: string;
  phone: string;
  city: string;
  avatar_url: string | null;
  category: string;
  experience_years: number;
  bio: string | null;
  created_at: string;
  completeness: number;
  hours_in_queue: number;
}

function formatQueueTime(hours: number): string {
  if (hours < 1) return 'menos de 1h';
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return phone;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function CompletenessBar({ value }: { value: number }) {
  const color = value >= 90 ? '#34d399' : value >= 70 ? '#f59e0b' : '#f87171';
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>Completude</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 99, transition: 'width .4s' }} />
      </div>
    </div>
  );
}

function Avatar({ name, url, size = 46 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(29,158,117,0.15)', border: '1.5px solid rgba(29,158,117,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#1D9E75', flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

function Hint({ completeness }: { completeness: number }) {
  if (completeness < 70) return (
    <span style={{ fontSize: 11, color: '#f87171' }}>⚠ Perfil incompleto — revisar antes de aprovar</span>
  );
  if (completeness < 90) return (
    <span style={{ fontSize: 11, color: '#f59e0b' }}>ℹ Perfil razoável — verificar dados</span>
  );
  return (
    <span style={{ fontSize: 11, color: '#34d399' }}>✓ Perfil bem preenchido — pronto para aprovação</span>
  );
}

interface RejectModalProps {
  professional: PendingProfessional;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

function RejectModal({ professional, onConfirm, onCancel, isPending }: RejectModalProps) {
  const [reason, setReason] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#0E1C32', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: '1rem', overflow: 'hidden' }}>
        <div style={{ height: 3, background: '#f87171' }} />
        <div style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: '0 0 4px' }}>Rejeitar profissional</p>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 1.25rem' }}>{professional.full_name}</p>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Motivo (opcional)"
            rows={3}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '.5rem', padding: '.75rem', fontSize: 13, color: 'white', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
            <button
              onClick={onCancel}
              disabled={isPending}
              style={{ flex: 1, height: 38, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '.5rem', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(reason)}
              disabled={isPending}
              style={{ flex: 1, height: 38, background: '#7f1d1d', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '.5rem', color: '#fca5a5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: isPending ? .6 : 1 }}
            >
              {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Confirmar rejeição
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPendentes() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [rejectTarget, setRejectTarget] = useState<PendingProfessional | null>(null);
  const [localList, setLocalList] = useState<PendingProfessional[] | null>(null);

  const { data: fetched = [], isLoading, refetch } = useQuery<PendingProfessional[]>({
    queryKey: ['adminPendentes'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_pending_professionals');
      if (error) throw error;
      return (data ?? []) as PendingProfessional[];
    },
    staleTime: 60_000,
  });

  const { data: approvedToday = 0 } = useQuery<number>({
    queryKey: ['adminApprovedToday'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('professionals')
        .select('*', { count: 'exact', head: true })
        .gte('approved_at', today.toISOString());
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  const list = localList ?? fetched;

  const approveMutation = useMutation({
    mutationFn: async (professional: PendingProfessional) => {
      const { error } = await supabase
        .from('professionals')
        .update({ is_active: true, approved_at: new Date().toISOString() })
        .eq('user_id', professional.user_id);
      if (error) throw error;
    },
    onSuccess: (_data, professional) => {
      setLocalList(prev => (prev ?? list).filter(p => p.user_id !== professional.user_id));
      queryClient.invalidateQueries({ queryKey: ['adminApprovedToday'] });
      toast.success('Profissional aprovado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (professional: PendingProfessional) => {
      const { error } = await supabase
        .from('professionals')
        .update({ is_active: false })
        .eq('user_id', professional.user_id);
      if (error) throw error;
    },
    onSuccess: (_data, professional) => {
      setLocalList(prev => (prev ?? list).filter(p => p.user_id !== professional.user_id));
      setRejectTarget(null);
      toast.success('Profissional rejeitado.');
    },
    onError: (e: Error) => {
      setRejectTarget(null);
      toast.error(e.message);
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return list;
    return list.filter(p =>
      p.full_name.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.phone.includes(q)
    );
  }, [list, search]);

  const avgQueue = list.length > 0
    ? Math.round(list.reduce((a, b) => a + b.hours_in_queue, 0) / list.length)
    : 0;

  const kpis = [
    { label: 'Na fila', value: String(list.length), color: 'white' },
    { label: 'Aprovados hoje', value: String(approvedToday), color: '#34d399' },
    { label: 'Rejeitados (mês)', value: '0', color: '#f87171' },
    { label: 'Tempo médio fila', value: formatQueueTime(avgQueue), color: '#f59e0b' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: '0 0 4px' }}>Profissionais Pendentes</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Aprovação manual de novos cadastros · ordenado por mais antigo</p>
        </div>
        <button
          onClick={() => { setLocalList(null); refetch(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#0a1624', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#64748b', fontSize: 12, cursor: 'pointer' }}
        >
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.625rem' }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#0a1624', border: '1.5px solid rgba(255,255,255,0.07)', borderRadius: '.5rem', padding: '.875rem 1rem' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', margin: '0 0 5px' }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: 0, lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, cidade, categoria, telefone..."
          style={{ width: '100%', background: '#0a1624', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.625rem 0.875rem 0.625rem 2.25rem', fontSize: 13, color: 'white', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Separador de seção */}
      {!isLoading && filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em', whiteSpace: 'nowrap' }}>{filtered.length} aguardando revisão</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 size={28} style={{ color: '#34d399', animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '4rem 1rem', color: '#64748b' }}>
          <CheckCircle size={48} style={{ opacity: .3 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'white', margin: 0 }}>Nenhum profissional pendente</p>
          <p style={{ fontSize: 13, margin: 0, textAlign: 'center', color: '#64748b' }}>
            {search ? 'Nenhum resultado para a busca.' : 'Todos os novos cadastros são aprovados automaticamente no MVP.'}
          </p>
        </div>
      )}

      {/* Cards */}
      {!isLoading && filtered.map(p => {
        const isOld = p.hours_in_queue > 24;
        const sc = isOld ? '#f59e0b' : '#34d399';

        return (
          <div
            key={p.user_id}
            style={{ background: '#0E1C32', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: '1rem', overflow: 'hidden' }}
          >
            {/* Stripe topo */}
            <div style={{ height: 3, background: sc }} />

            <div style={{ padding: '1.125rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Row 1 — avatar + nome + data */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Avatar name={p.full_name} url={p.avatar_url} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: '0 0 3px' }}>{p.full_name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <MapPin size={10} />{p.city}
                      </span>
                      {/* categoria badge — neutro */}
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '0.5px solid rgba(255,255,255,0.1)' }}>
                        {p.category}
                      </span>
                      {/* fila badge */}
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: isOld ? 'rgba(186,117,23,0.1)' : 'rgba(29,158,117,0.08)', color: isOld ? '#f59e0b' : '#34d399', border: `0.5px solid ${isOld ? 'rgba(186,117,23,0.25)' : 'rgba(29,158,117,0.2)'}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={9} />{formatQueueTime(p.hours_in_queue)} na fila
                      </span>
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDate(p.created_at)}</span>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

              {/* Row 2 — métricas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 4px' }}>Telefone</p>
                  <a
                    href={`tel:${p.phone}`}
                    style={{ fontSize: 12, color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Phone size={11} />{formatPhone(p.phone)}
                  </a>
                </div>
                <CompletenessBar value={p.completeness} />
                <div>
                  <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 4px' }}>Experiência</p>
                  <span style={{ fontSize: 12, color: 'white', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Briefcase size={11} style={{ color: '#64748b' }} />
                    {p.experience_years} {p.experience_years === 1 ? 'ano' : 'anos'}
                  </span>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 4px' }}>Fila</p>
                  <span style={{ fontSize: 12, color: isOld ? '#f59e0b' : '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} />{formatQueueTime(p.hours_in_queue)}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

              {/* Row 3 — hint + ações */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <Hint completeness={p.completeness} />
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => setRejectTarget(p)}
                    disabled={rejectMutation.isPending && rejectTarget?.user_id === p.user_id}
                    style={{ height: 34, padding: '0 14px', borderRadius: '.5rem', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <XCircle size={13} /> Rejeitar
                  </button>
                  <button
                    onClick={() => window.location.assign(`/admin/usuarios?uid=${p.user_id}`)}
                    style={{ height: 34, padding: '0 14px', borderRadius: '.5rem', background: 'transparent', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <User size={13} /> Ver perfil
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(p)}
                    disabled={approveMutation.isPending}
                    style={{ height: 34, padding: '0 14px', borderRadius: '.5rem', background: '#1D9E75', border: 'none', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, opacity: approveMutation.isPending ? .7 : 1 }}
                  >
                    {approveMutation.isPending ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={13} />}
                    Aprovar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Modal rejeição */}
      {rejectTarget && (
        <RejectModal
          professional={rejectTarget}
          isPending={rejectMutation.isPending}
          onConfirm={() => rejectMutation.mutate(rejectTarget)}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}
