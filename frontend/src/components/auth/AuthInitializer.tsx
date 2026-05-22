import { useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useAuthStore, Role } from '../../store/authStore';

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((state) => state.setAuth);
  const setLoading = useAuthStore((state) => state.setLoading);

  const currentUserIdRef = useRef<string | null>(null);
  const processingIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const processSession = async (session: Session | null) => {
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
      if (!isMounted) return;
      processingIdRef.current = userId;

      if (isMounted) setLoading(true);

      try {
        // Only fetch what the store needs: role for routing decisions
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        let finalRole: Role = (profile?.role as Role | undefined) ?? 'client';

        if (!profile) {
          const metaRole = session.user.user_metadata?.role as Role | undefined;
          // For Google OAuth, user_metadata.role is not set by the provider.
          // AuthModal stores the user's selection in localStorage before redirecting.
          const pendingRole = localStorage.getItem('pending_oauth_role') as Role | null;
          localStorage.removeItem('pending_oauth_role'); // clean up before any await
          // admin nunca deve ser atribuível via fluxo de registro do cliente.
          const safeMetaRole: Role = metaRole === 'professional' ? 'professional' : 'client';
          const safePendingRole: Role = pendingRole === 'professional' ? 'professional' : 'client';
          const roleToSet: Role = metaRole ? safeMetaRole : safePendingRole;
          finalRole = roleToSet;
          await supabase.from('profiles').upsert({
            id: userId,
            full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email || '',
            role: roleToSet,
          }, { onConflict: 'id' });
        }

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
        if (import.meta.env.DEV) console.error('AuthInitializer: critical failure', err);
        if (isMounted) {
          currentUserIdRef.current = userId;
          setAuth({ id: userId, email: session.user.email || '', role: 'client' });
        }
      } finally {
        if (processingIdRef.current === userId) processingIdRef.current = null;
        if (isMounted) setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;
      if (error) {
        if (import.meta.env.DEV) console.warn('AuthInitializer: invalid session, clearing', error.message);
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
      processingIdRef.current = null;
      subscription.unsubscribe();
    };
  }, [setAuth, setLoading]);

  return <>{children}</>;
}
