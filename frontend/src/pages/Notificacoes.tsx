import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import {
  type Notification, type FilterId,
  getNotifType, TYPE_CFG, fmtTs, isToday, FILTERS,
} from '../utils/notifications';

const PAGE_SIZE = 20;

export default function Notificacoes() {
  const user        = useAuthStore(s => s.user);
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterId>('all');
  const [page, setPage]     = useState(1);

  useEffect(() => {
    if (user && user.role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const dashboardPath = user?.role === 'professional'
    ? '/profissional/dashboard'
    : '/cliente/dashboard';

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(300);
      return (data ?? []) as Notification[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('notifications-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
      .subscribe();
    return () => { channel.unsubscribe(); supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const unread = notifications.filter(n => !n.is_read).length;

  const filtered = useMemo(() => notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'coins') { const t = getNotifType(n); return t === 'coins' || t === 'award'; }
    if (filter === 'leads') return getNotifType(n) === 'lead';
    return true;
  }), [notifications, filter]);

  useEffect(() => { setPage(1); }, [filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const today      = paginated.filter(n =>  isToday(n.created_at));
  const earlier    = paginated.filter(n => !isToday(n.created_at));

  const markAllRead = async () => {
    if (!user?.id) return;
    queryClient.setQueryData<Notification[]>(['notifications', user.id], old =>
      (old ?? []).map(n => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('is_read', false);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const toggleRead = async (n: Notification) => {
    const next = !n.is_read;
    queryClient.setQueryData<Notification[]>(['notifications', user?.id], old =>
      (old ?? []).map(item => item.id === n.id ? { ...item, is_read: next } : item));
    await supabase.from('notifications').update({ is_read: next })
      .eq('id', n.id).eq('user_id', user?.id ?? '');
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const emptyMessage =
    filter === 'unread' ? 'Nenhuma notificação não lida' :
    filter === 'coins'  ? 'Nenhuma notificação de moedas' :
    filter === 'leads'  ? 'Nenhuma notificação de leads' :
    'Nenhuma notificação ainda';

  const emptyHint = filter !== 'all'
    ? 'Tente outro filtro ou verifique mais tarde.'
    : 'Suas notificações aparecerão aqui.';

  return (
    <div style={{ minHeight: '100vh', background: '#0E1C32', fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div style={{
        background: '#132236',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 16,
        height: 64,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <button
          onClick={() => navigate(dashboardPath)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 14, fontWeight: 500, padding: '8px 0',
          }}
        >
          <ArrowLeft size={18} />
          Voltar
        </button>

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.08)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <Bell size={20} color="#EAB308" />
          <span style={{ fontSize: 17, fontWeight: 700, color: '#F1F5F9' }}>Notificações</span>
          {unread > 0 && (
            <span style={{
              minWidth: 22, height: 22, padding: '0 6px',
              background: '#10b981', color: '#fff', fontSize: 11, fontWeight: 700,
              borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>

        {unread > 0 && (
          <button
            onClick={() => void markAllRead()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10,
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.25)',
              color: '#10b981', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Check size={14} />
            Marcar todas lidas
          </button>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px 48px' }}>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: '7px 18px', borderRadius: 30, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                  background: active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                  color:      active ? '#10b981' : '#94A3B8',
                  outline:    active ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
                }}
              >{f.label}</button>
            );
          })}
        </div>

        {/* List */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748B', fontSize: 14 }}>
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '4rem 2rem',
            background: '#132236', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Bell size={40} color="#243F6A" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontSize: 15, color: '#4A6580', fontWeight: 600, margin: '0 0 6px' }}>
              {emptyMessage}
            </p>
            <p style={{ fontSize: 13, color: '#374F68', margin: 0 }}>
              {emptyHint}
            </p>
          </div>
        ) : (
          <div style={{
            background: '#132236', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden',
          }}>
            {today.length > 0 && (
              <>
                <SectionLabel text="Hoje" />
                {today.map(n => <NotifRow key={n.id} n={n} onToggle={toggleRead} />)}
              </>
            )}
            {earlier.length > 0 && (
              <>
                <SectionLabel text="Anteriores" />
                {earlier.map(n => <NotifRow key={n.id} n={n} onToggle={toggleRead} />)}
              </>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, marginTop: 24, flexWrap: 'wrap',
          }}>
            <PageBtn disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={16} />
            </PageBtn>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <PageBtn key={p} active={p === page} onClick={() => setPage(p)}>
                {p}
              </PageBtn>
            ))}
            <PageBtn disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={16} />
            </PageBtn>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 11, color: '#64748B', padding: '10px 20px 8px',
      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      {text}
    </div>
  );
}

function NotifRow({ n, onToggle }: { n: Notification; onToggle: (n: Notification) => void }) {
  const [hovered, setHovered] = useState(false);
  const type = getNotifType(n);
  const cfg  = TYPE_CFG[type];
  const { Icon } = cfg;
  const chip = cfg.chipText(n);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: hovered
          ? 'rgba(255,255,255,0.04)'
          : !n.is_read
            ? 'rgba(16,185,129,0.04)'
            : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* type icon */}
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: cfg.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={19} color={cfg.color} />
      </div>

      {/* body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', marginBottom: 2 }}>
          {n.title}
        </div>
        {n.body && (
          <div style={{
            fontSize: 12, color: '#94A3B8', lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}>
            {n.body}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          {chip && (
            <span style={{
              fontSize: 10, padding: '2px 10px', borderRadius: 20, fontWeight: 700,
              background: cfg.chipBg, color: cfg.chipColor,
            }}>
              {chip}
            </span>
          )}
          <span style={{ fontSize: 11, color: '#64748B' }}>{fmtTs(n.created_at)}</span>
        </div>
      </div>

      {/* right: unread dot + toggle button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, paddingTop: 2 }}>
        {!n.is_read && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
        )}
        <button
          onClick={() => onToggle(n)}
          title={n.is_read ? 'Marcar como não lida' : 'Marcar como lida'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: n.is_read ? (hovered ? '#94A3B8' : '#374F68') : '#10b981',
            display: 'flex', alignItems: 'center',
            transition: 'color 0.15s',
            opacity: hovered || !n.is_read ? 1 : 0,
          }}
        >
          <Check size={15} />
        </button>
      </div>
    </div>
  );
}

function PageBtn({
  children, active, disabled, onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 36, height: 36, padding: '0 10px',
        borderRadius: 8, border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active   ? '#10b981'
                  : disabled ? 'rgba(255,255,255,0.03)'
                  :            'rgba(255,255,255,0.07)',
        color: active   ? '#fff'
             : disabled ? '#374F68'
             :            '#94A3B8',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}
