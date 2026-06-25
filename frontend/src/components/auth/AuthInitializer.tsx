import { useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useAuthStore, Role } from '../../store/authStore';
import { readOAuthSignupRole, clearOAuthSignupFlag } from '../../lib/oauthSignupFlag';
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

      // signupRole só é honrada se a URL atual confirmar volta real do redirect do Google
      // (?oauth=1) E a flag tiver menos de 5min — ver lib/oauthSignupFlag.ts pro porquê.
      const signupRole: Role | null = readOAuthSignupRole();
      const loginRole = sessionStorage.getItem('melocale_login_role') as Role | null;

      if (import.meta.env.DEV) {
        console.log('[Auth] processSession userId:', userId);
        console.log('[Auth] signupRole resolved:', signupRole);
        console.log('[Auth] user_metadata:', session.user.user_metadata);
      }

      try {
        // Fetch role AND phone so we can detect incomplete profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, phone')
          .eq('id', userId)
          .maybeSingle();

        if (import.meta.env.DEV) {
          console.log('[Auth] profile from DB:', profile);
        }

        let finalRole: Role = (profile?.role as Role | undefined) ?? 'client';

        // Always clean up all signup/login storage flags in one place
        clearOAuthSignupFlag();
        sessionStorage.removeItem('melocale_is_signup');
        sessionStorage.removeItem('melocale_login_role');
        localStorage.removeItem('pending_oauth_role');

        if (!profile) {
          // ── Brand-new user ────────────────────────────────────────────────
          const metaRole = session.user.user_metadata?.role as Role | undefined;
          const roleToSet: Role =
            metaRole === 'professional' ? 'professional'
            : signupRole === 'professional' ? 'professional'
            : 'client';

          if (import.meta.env.DEV) {
            console.log('[Auth] new user — metaRole:', metaRole, '— roleToSet:', roleToSet);
          }

          finalRole = roleToSet;
          await supabase.from('profiles').upsert({
            id: userId,
            full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email || '',
            role: roleToSet,
          }, { onConflict: 'id' });

          // Signal AuthRedirect (inside router) to send user to /completar-perfil.
          // Must be set BEFORE setAuth() so the first render after auth sees it.
          localStorage.setItem('melocale_needs_completion', userId);
          sessionStorage.setItem('melocale_new_user_role', roleToSet);

          if (import.meta.env.DEV) {
            console.log('[Auth] melocale_needs_completion SET (new user), role:', roleToSet);
          }
        } else {
          // ── Existing profile ─────────────────────────────────────────────

          // Role correction: user explicitly chose a role during this signup flow
          // but the DB has a different (stale) role — update it.
          if (signupRole && signupRole !== (profile.role as Role)) {
            const safeSignupRole: Role = signupRole === 'professional' ? 'professional' : 'client';
            if (import.meta.env.DEV) {
              console.log('[Auth] role correction:', profile.role, '→', safeSignupRole);
            }
            finalRole = safeSignupRole;
            await supabase.from('profiles').update({ role: safeSignupRole }).eq('id', userId);
          }

          // Role mismatch toast for Google login (not signup)
          if (!signupRole && loginRole && loginRole !== (profile.role as Role)) {
            const roleName = profile.role === 'professional' ? 'Profissional' : 'Cliente';
            toast.info(`Você tem uma conta de ${roleName}. Redirecionando...`, { duration: 4000 });
          }

          // If the profile has no phone the user never finished onboarding —
          // send them to /completar-perfil regardless of how they got here.
          if (!profile.phone) {
            localStorage.setItem('melocale_needs_completion', userId);
            sessionStorage.setItem('melocale_new_user_role', finalRole);
            if (import.meta.env.DEV) {
              console.log('[Auth] melocale_needs_completion SET (existing profile, no phone)');
            }
          } else {
            // Profile is complete — clear any stale flag from a previous incomplete session
            localStorage.removeItem('melocale_needs_completion');
            if (import.meta.env.DEV) {
              console.log('[Auth] profile complete, going to dashboard');
            }
          }
        }

        let professionalId: string | undefined;
        if (finalRole === 'professional') {
          const { data: profId } = await supabase.rpc('ensure_professional_exists', { p_user_id: userId });
          professionalId = profId || undefined;
        }

        if (import.meta.env.DEV) {
          console.log('[Auth] calling setAuth — role:', finalRole, '| needs_completion in LS:', localStorage.getItem('melocale_needs_completion'));
        }

        if (isMounted) {
          currentUserIdRef.current = userId;
          setAuth({ id: userId, professionalId, email: session.user.email || '', role: finalRole });
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[Auth] critical failure', err);
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
        if (import.meta.env.DEV) console.warn('[Auth] invalid session, clearing', error.message);
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
