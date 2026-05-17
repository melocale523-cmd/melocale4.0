import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, BellRing } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { cn } from '../lib/utils';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

export default function NotificationBell() {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isSupported, isSubscribed, subscribe } = usePushNotifications();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      return (data ?? []) as Notification[];
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const unread = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();
    return () => { channel.unsubscribe(); supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Marca todas como lidas quando o dropdown abre (ação explícita do usuário).
  // Não dispara no mount — só quando open muda de false → true.
  useEffect(() => {
    if (!open || !user?.id) return;
    void supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }));
  }, [open, user?.id, queryClient]);

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notificações"
        className="relative w-11 h-11 flex items-center justify-center rounded-xl bg-[#1C3454] border border-[#243F6A] hover:border-yellow-400/40 transition-all"
      >
        <Bell size={22} className="text-yellow-400" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-lg shadow-red-500/50">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#132540] border border-[#243F6A] rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1C3050]">
            <span className="text-sm font-black text-white">Notificações</span>
            <div className="flex items-center gap-2">
              {isSupported && !isSubscribed && (
                <button onClick={subscribe} className="text-[10px] text-yellow-400 hover:text-yellow-300 font-bold flex items-center gap-1" title="Ativar notificações push">
                  <BellRing size={12} /> Ativar
                </button>
              )}
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1">
                  <Check size={12} /> Marcar todas lidas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-[#4A6580] hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={32} className="text-[#243F6A] mx-auto mb-2" />
                <p className="text-xs text-[#4A6580] font-medium">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={cn(
                    "px-4 py-3 border-b border-[#1C3050] cursor-pointer hover:bg-white/5 transition-all",
                    !n.is_read && "bg-emerald-500/5 border-l-2 border-l-emerald-500"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-black truncate", n.is_read ? "text-[#94A3B8]" : "text-white")}>{n.title}</p>
                      <p className="text-[11px] text-[#4A6580] mt-0.5 leading-relaxed">{n.body}</p>
                      <p className="text-[10px] text-[#4A6580] mt-1">{new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    {!n.is_read && <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0 mt-1"></div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
