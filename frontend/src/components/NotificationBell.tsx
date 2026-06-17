import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell, BellRing, X, Check,
  Trophy, Coins, Briefcase, MessageCircle,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { usePushNotifications } from '../hooks/usePushNotifications';

// ── types ─────────────────────────────────────────────────────────────────────
interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

type NotifType = 'award' | 'coins' | 'lead' | 'message' | 'system';
type FilterId  = 'all' | 'unread' | 'coins' | 'leads';

// ── helpers ───────────────────────────────────────────────────────────────────
function getNotifType(n: Notification): NotifType {
  const t = (n.data?.type as string | undefined) ?? '';
  const title = n.title.toLowerCase();
  if (t === 'award'   || title.includes('premiado'))                                    return 'award';
  if (t === 'coins'   || title.includes('moeda') || title.includes('starter') ||
      title.includes('pro') || title.includes('elite'))                                 return 'coins';
  if (t === 'lead'    || title.includes('orçamento') || title.includes('lead'))        return 'lead';
  if (t === 'message' || title.includes('mensagem'))                                    return 'message';
  return 'system';
}

const TYPE_CFG = {
  award:   { Icon: Trophy,        bg: 'rgba(234,179,8,0.15)',    color: '#CA8A04', chipText: (n: Notification) => `+${n.data?.coins ?? ''} moedas`, chipBg: 'rgba(234,179,8,0.15)',    chipColor: '#CA8A04'  },
  coins:   { Icon: Coins,         bg: 'rgba(16,185,129,0.12)',   color: '#10b981', chipText: (n: Notification) => `+${n.data?.coins ?? ''} moedas`, chipBg: 'rgba(16,185,129,0.12)',   chipColor: '#10b981'  },
  lead:    { Icon: Briefcase,     bg: 'rgba(59,130,246,0.12)',   color: '#3B82F6', chipText: ()                => 'Lead',                           chipBg: 'rgba(59,130,246,0.12)',   chipColor: '#3B82F6'  },
  message: { Icon: MessageCircle, bg: 'rgba(139,92,246,0.12)',   color: '#8B5CF6', chipText: ()                => 'Mensagem',                       chipBg: 'rgba(139,92,246,0.12)',   chipColor: '#8B5CF6'  },
  system:  { Icon: Bell,          bg: 'rgba(148,163,184,0.10)',  color: '#94A3B8', chipText: ()                => '',                               chipBg: 'transparent',             chipColor: '#94A3B8'  },
} satisfies Record<NotifType, {
  Icon: React.FC<{ size?: number; color?: string }>;
  bg: string; color: string;
  chipText: (n: Notification) => string;
  chipBg: string; chipColor: string;
}>;

function fmtTs(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000)  return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all',    label: 'Todas'     },
  { id: 'unread', label: 'Não lidas' },
  { id: 'coins',  label: 'Moedas'    },
  { id: 'leads',  label: 'Leads'     },
];

// ── component ─────────────────────────────────────────────────────────────────
export default function NotificationBell() {
  const user          = useAuthStore(s => s.user);
  const queryClient   = useQueryClient();
  const [open, setOpen]     = useState(false);
  const [filter, setFilter] = useState<FilterId>('all');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const ref             = useRef<HTMLDivElement>(null);
  const buttonRef       = useRef<HTMLButtonElement>(null);
  const hasBeenOpened   = useRef(false);
  const { isSupported, isSubscribed, subscribe } = usePushNotifications();

  const handleToggle = useCallback(() => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  }, [open]);

  // ── data ────────────────────────────────────────────────────────────────────
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40);
      return (data ?? []) as Notification[];
    },
    enabled: !!user?.id,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const unread = notifications.filter(n => !n.is_read).length;

  // ── realtime ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
      .subscribe();
    return () => { channel.unsubscribe(); supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  // ── click outside ─────────────────────────────────────────────────────────
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideWrapper = ref.current?.contains(target);
      const insidePortal  = dropdownRef.current?.contains(target);
      if (!insideWrapper && !insidePortal) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── mark all read on close ─────────────────────────────────────────────────
  useEffect(() => {
    if (open) { hasBeenOpened.current = true; return; }
    if (!hasBeenOpened.current || !user?.id) return;
    void supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }));
  }, [open, user?.id, queryClient]);

  // ── actions ─────────────────────────────────────────────────────────────────
  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('is_read', false);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markRead = async (id: string) => {
    if (!user?.id) return;
    await supabase.from('notifications').update({ is_read: true })
      .eq('id', id).eq('user_id', user.id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  // ── filter ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return notifications.filter(n => {
      if (filter === 'unread') return !n.is_read;
      if (filter === 'coins') {
        const t = getNotifType(n);
        return t === 'coins' || t === 'award';
      }
      if (filter === 'leads') return getNotifType(n) === 'lead';
      return true;
    });
  }, [notifications, filter]);

  // ── group today / older ──────────────────────────────────────────────────────
  const today   = filtered.filter(n =>  isToday(n.created_at));
  const earlier = filtered.filter(n => !isToday(n.created_at));

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative' }} ref={ref}>

      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        aria-label="Notificações"
        style={{
          position: 'relative', width: 44, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 12, background: '#1C3454',
          border: '1px solid #243F6A', cursor: 'pointer',
          transition: 'border-color 0.2s',
        }}
      >
        <Bell size={20} color="#EAB308" />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 18, height: 18, padding: '0 4px',
            background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 900,
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 8px rgba(239,68,68,0.5)',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown — rendered via portal to escape header's stacking context */}
      {open && createPortal(
        <div ref={dropdownRef} style={{
          position: 'fixed', top: dropdownPos.top, right: dropdownPos.right,
          width: 360, zIndex: 99999,
          background: '#0E1C32',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}>

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={16} color="#94A3B8" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>Notificações</span>
              {unread > 0 && (
                <span style={{
                  minWidth: 20, height: 20, padding: '0 6px',
                  background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 700,
                  borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{unread}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isSupported && !isSubscribed && (
                <button
                  onClick={subscribe}
                  style={{
                    fontSize: 10, color: '#EAB308', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                  title="Ativar notificações push"
                >
                  <BellRing size={11} /> Ativar
                </button>
              )}
              {unread > 0 && (
                <button
                  onClick={() => void markAllRead()}
                  style={{
                    fontSize: 10, color: '#10b981', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <Check size={11} /> Marcar todas lidas
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Filters ──────────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', gap: 4, padding: '10px 12px 8px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            {FILTERS.map(f => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                    background: active ? 'rgba(16,185,129,0.15)' : 'transparent',
                    color: active ? '#10b981' : '#94A3B8',
                    outline: active ? '1px solid rgba(16,185,129,0.3)' : 'none',
                  }}
                >{f.label}</button>
              );
            })}
          </div>

          {/* ── List ─────────────────────────────────────────────────────── */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                <Bell size={30} color="#243F6A" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: 12, color: '#4A6580', fontWeight: 500 }}>Nenhuma notificação</p>
              </div>
            ) : (
              <>
                {today.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, color: '#64748B', padding: '8px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Hoje
                    </div>
                    {today.map(n => <NotifItem key={n.id} n={n} onRead={markRead} />)}
                  </>
                )}
                {earlier.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, color: '#64748B', padding: '8px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Anteriores
                    </div>
                    {earlier.map(n => <NotifItem key={n.id} n={n} onRead={markRead} />)}
                  </>
                )}
              </>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '10px 16px',
            textAlign: 'center',
          }}>
            <span
              onClick={() => setOpen(false)}
              style={{ fontSize: 12, color: '#10b981', cursor: 'pointer', fontWeight: 500 }}
            >
              Ver todas as notificações
            </span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── NotifItem ─────────────────────────────────────────────────────────────────
function NotifItem({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const type = getNotifType(n);
  const cfg  = TYPE_CFG[type];
  const { Icon } = cfg;
  const chip = cfg.chipText(n);

  return (
    <div
      onClick={() => onRead(n.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
        background: hovered
          ? 'rgba(255,255,255,0.04)'
          : !n.is_read
            ? 'rgba(16,185,129,0.04)'
            : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: cfg.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={17} color={cfg.color} />
      </div>

      {/* content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500, color: '#F1F5F9',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{n.title}</div>

        {n.body && (
          <div style={{
            fontSize: 11, color: '#94A3B8', marginTop: 2,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
            lineHeight: 1.5,
          }}>{n.body}</div>
        )}

        {/* meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
          {chip && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
              background: cfg.chipBg, color: cfg.chipColor,
            }}>{chip}</span>
          )}
          <span style={{ fontSize: 10, color: '#64748B' }}>{fmtTs(n.created_at)}</span>
        </div>
      </div>

      {/* unread dot */}
      {!n.is_read && (
        <div style={{
          width: 7, height: 7, borderRadius: '50%', background: '#10b981',
          flexShrink: 0, marginTop: 4,
        }} />
      )}
    </div>
  );
}
