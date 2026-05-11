import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

export default function RealtimeNotificationHandler() {
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

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
          const { title, body } = payload.new;
          
          // Exibe o Toast
          toast.info(title, {
            description: body,
            duration: 5000,
          });

          // Opcional: Tocar um som leve de alerta
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => {}); // Browsers podem bloquear autoplay sem interação
          } catch (e) {
            // Ignora erros de áudio
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAuthenticated]);

  return null;
}
