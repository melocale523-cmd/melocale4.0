import { useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useAuthStore, Role } from '../../store/authStore';
import { toast } from 'sonner';

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
          // New keys (from Login.tsx role buttons)
          const signupRole = sessionStorage.getItem('melocale_signup_role') as Role | null;
          const isSignupFlag = sessionStorage.getItem('melocale_is_signup') === 'true';
          // Clean up immediately before any await
          sessionStorage.removeItem('melocale_signup_role');
          sessionStorage.removeItem('melocale_is_signup');
          sessionStorage.removeItem('melocale_login_role');
          // Backward compat key (kept for any old code paths)
          const pendingRole = localStorage.getItem('pending_oauth_role') as Role | null;
          localStorage.removeItem('pending_oauth_role');

          const metaRole = session.user.user_metadata?.role as Role | undefined;
          const safeMetaRole: Role = metaRole === 'professional' ? 'professional' : 'client';
          const safeSignupRole: Role = signupRole === 'professional' ? 'professional' : 'client';
          const safePendingRole: Role = pendingRole === 'professional' ? 'professional' : 'client';
          const roleToSet: Role = metaRole ? safeMetaRole : signupRole ? safeSignupRole : safePendingRole;

          finalRole = roleToSet;
          await supabase.from('profiles').upsert({
            id: userId,
            full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email || '',
            role: roleToSet,
          }, { onConflict: 'id' });

          // New OAuth signup → mark for profile completion
          if (isSignupFlag) {
            sessionStorage.setItem('melocale_needs_completion', 'true');
            sessionStorage.setItem('melocale_new_user_role', roleToSet);
          }
        } else {
          // Clean up signup flags (no-op if not set)
          const loginRole = sessionStorage.getItem('melocale_login_role') as Role | null;
          sessionStorage.removeItem('melocale_login_role');
          sessionStorage.removeItem('melocale_signup_role');
          sessionStorage.removeItem('melocale_is_signup');
          localStorage.removeItem('pending_oauth_role');

          // Role mismatch toast for Google login
          if (loginRole && loginRole !== (profile.role as Role)) {
            const roleName = profile.role === 'professional' ? 'Profissional' : 'Cliente';
            toast.info(`Você tem uma conta de ${roleName}. Redirecionando...`, { duration: 4000 });
          }
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
