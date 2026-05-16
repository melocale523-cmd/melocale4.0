import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    const playBeep = (startTime: number, freq: number, duration: number, volume: number) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = freq;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playBeep(now, 880, 0.15, 0.3);
    playBeep(now + 0.18, 1100, 0.2, 0.25);
  } catch {
    // Web Audio API não disponível — silencioso
  }
}

export default function RealtimeNotificationHandler() {
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    if (import.meta.env.DEV) console.log('Iniciando escuta de notificações Realtime para o usuário:', user.id);

    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (import.meta.env.DEV) console.log('Nova notificação recebida via Realtime:', payload);
          const { title, body } = payload.new;

          toast.info(title, {
            description: body,
            duration: 5000,
          });

          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      if (import.meta.env.DEV) console.log('Limpando canal de notificações Realtime');
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [user, isAuthenticated]);

  return null;
}
