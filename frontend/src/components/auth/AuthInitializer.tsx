import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { authService } from '../../services/dbServices';
import { useAuthStore, Role } from '../../store/authStore';

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((state) => state.setAuth);
  const setLoading = useAuthStore((state) => state.setLoading);

  // currentUserIdRef: evita chamadas redundantes se o usuário já estiver processado
  const currentUserIdRef = useRef<string | null>(null);
  
  // processingIdRef: bloqueia condições de corrida (race conditions) quando 
  // onAuthStateChange e getSession disparam ao mesmo tempo.
  const processingIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const processSession = async (session: any) => {
      // 1. Tratamento para deslogado
      if (!session?.user) {
        if (isMounted) {
          currentUserIdRef.current = null;
          processingIdRef.current = null;
          
          setAuth(null);
          setLoading(false); // Libera o app imediatamente
        }
        return;
      }

      const userId = session.user.id;

      // 2. Prevenção de Loop e Redundância
      // Se já carregamos ESSE usuário, ignoramos o evento (Ex: TOKEN_REFRESHED).
      if (currentUserIdRef.current === userId) {
        if (isMounted) setLoading(false);
        return;
      }

      // 3. Prevenção de Race Condition
      // Se uma requisição de profile para esse ID já está em andamento, ignoramos.
      if (processingIdRef.current === userId) {
        return;
      }

      // Marcamos que começamos a processar
      processingIdRef.current = userId;

      if (isMounted) {
        setLoading(true);
      }

      try {
        // 4. Fonte Única da Verdade: buscamos profile sem depender de user_metadata
        const profile = await authService.getProfile(userId);

        if (!profile) {
          console.error('AuthInitializer: Erro ao carregar o profile ou profile não existe.');
        }

        let professionalId = undefined;
        // O papel verdadeiro SEMPRE vem do banco (profile). Fallback para 'client'
        let finalRole: Role = ((profile as any)?.role as Role) || 'client';

        if (finalRole === 'professional') {
          const prof = await authService.getProfessionalByUserId(userId);
          if (prof) professionalId = (prof as any).id;
        }

        // 5. Atualização de Estado Consistente
        // Setamos dados apenas se o componente ainda estiver montado
        if (isMounted) {
          currentUserIdRef.current = userId; // Confirma que ESSE usuário está validado
          setAuth({
            id: userId,
            professionalId,
            email: session.user.email || '',
            name: profile?.full_name || profile?.name || session.user.email?.split('@')[0] || 'Usuário',
            role: finalRole,
            phone: profile?.phone || '',
            avatar: profile?.avatar_url || profile?.avatar,
          });
        }
      } catch (err) {
        console.error('AuthInitializer: Falha crítica', err);
        // Fallback robusto mitigando loop:
        // Mantemos a sessão ativa sem profile, impedindo Loading Eterno
        if (isMounted) {
          currentUserIdRef.current = userId;
          setAuth({
            id: userId,
            email: session.user.email || '',
            name: session.user.email?.split('@')[0] || 'Usuário',
            role: 'client',
            phone: '',
            avatar: undefined,
          });
        }
      } finally {
        if (isMounted) {
          processingIdRef.current = null; // Libera o lock
          setLoading(false); // Garante a renderização liberando o Loading Spinner
        }
      }
    };

    // A. Bootstrap inicial — verifica sessão e trata token inválido proativamente
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Token inválido ou expirado — faz signOut para limpar localStorage e evitar loop
        console.warn('AuthInitializer: Sessão inválida detectada, limpando...', error.message);
        supabase.auth.signOut();
        if (isMounted) {
          currentUserIdRef.current = null;
          processingIdRef.current = null;
          setAuth(null);
          setLoading(false);
        }
        return;
      }
      processSession(session);
    });

    // B. Reage a eventos REAIS e previne corridas com o processSession debounce pattern
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`AuthInitializer: Evento Auth [${event}]`);

      // SIGNED_OUT cobre: logout manual, token inválido e refresh failure
      if (event === 'SIGNED_OUT') {
        if (isMounted) {
          currentUserIdRef.current = null;
          processingIdRef.current = null;
          setAuth(null);
          setLoading(false);
        }
        return;
      }

      processSession(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [setAuth, setLoading]);

  return <>{children}</>;
}
