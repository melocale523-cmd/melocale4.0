import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
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
        // 4. Load profile and ensure professional record exists in one shot
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, phone, avatar_url, role')
          .eq('id', userId)
          .maybeSingle();

        const finalRole: Role = ((profile as any)?.role as Role) || 'client';

        let professionalId: string | undefined;
        if (finalRole === 'professional') {
          // ensure_professional_exists creates the row if missing and returns its UUID
          const { data: profId } = await supabase.rpc('ensure_professional_exists', { p_user_id: userId });
          professionalId = profId || undefined;
        }

        // 5. Commit to store only when component is still mounted
        if (isMounted) {
          currentUserIdRef.current = userId;
          setAuth({
            id: userId,
            professionalId,
            email: session.user.email || '',
            name: (profile as any)?.full_name || session.user.email?.split('@')[0] || 'Usuário',
            role: finalRole,
            phone: (profile as any)?.phone || '',
            avatar: (profile as any)?.avatar_url,
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
