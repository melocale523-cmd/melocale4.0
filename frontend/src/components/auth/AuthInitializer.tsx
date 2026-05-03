import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore, Role } from '../../store/authStore';

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((state) => state.setAuth);
  const setLoading = useAuthStore((state) => state.setLoading);

  const currentUserIdRef = useRef<string | null>(null);
  const processingIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const processSession = async (session: any) => {
      if (!session?.user) {
        if (isMounted) {
          currentUserIdRef.current = null;
          processingIdRef.current = null;
          setAuth(null);
          setLoading(false);
        }
        return;
      }

      const userId = session.user.id;

      if (currentUserIdRef.current === userId) {
        if (isMounted) setLoading(false);
        return;
      }

      if (processingIdRef.current === userId) return;
      processingIdRef.current = userId;

      if (isMounted) setLoading(true);

      try {
        // Only fetch what the store needs: role for routing decisions
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        const finalRole: Role = ((profile as any)?.role as Role) || 'client';

        let professionalId: string | undefined;
        if (finalRole === 'professional') {
          const { data: profId } = await supabase.rpc('ensure_professional_exists', { p_user_id: userId });
          professionalId = profId || undefined;
        }

        if (isMounted) {
          currentUserIdRef.current = userId;
          setAuth({ id: userId, professionalId, email: session.user.email || '', role: finalRole });
        }
      } catch (err) {
        console.error('AuthInitializer: critical failure', err);
        if (isMounted) {
          currentUserIdRef.current = userId;
          setAuth({ id: userId, email: session.user.email || '', role: 'client' });
        }
      } finally {
        if (isMounted) {
          processingIdRef.current = null;
          setLoading(false);
        }
      }
    };

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn('AuthInitializer: invalid session, clearing', error.message);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
