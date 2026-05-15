import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

export default function RealtimeNotificationHandler() {
  const { user, isAuthenticated } = useAuthStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // TODO: adicionar /public/notification.mp3
    // const audio = new Audio('/notification.mp3');
    // audio.volume = 0.3;
    // audioRef.current = audio;
    return () => {
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    if (import.meta.env.DEV) console.log('Iniciando escuta de notificações Realtime para o usuário:', user.id);

    // Subscreve para mudanças na tabela 'notifications' filtrando pelo user_id
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
          
          // Exibe o Toast
          toast.info(title, {
            description: body,
            duration: 5000,
          });

          // Tocar som de alerta reutilizando o elemento criado no mount
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          }
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
