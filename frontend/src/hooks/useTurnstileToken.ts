import { useCallback, useRef } from 'react';
import type { TurnstileInstance } from '@marsidev/react-turnstile';

/**
 * Gerencia o ciclo de vida de um token do Cloudflare Turnstile pra usar em
 * chamadas supabase.auth.* que exigem captchaToken (signUp, signInWithPassword,
 * resetPasswordForEmail). Um token só pode ser usado uma vez, então getToken()
 * sempre dispara uma nova verificação — nunca reaproveita um token antigo.
 */
export function useTurnstileToken() {
  const widgetRef = useRef<TurnstileInstance>(null);
  const pendingRef = useRef<{ resolve: (token: string | undefined) => void; reject: (err: Error) => void } | null>(null);

  const onVerify = useCallback((token: string) => {
    pendingRef.current?.resolve(token);
    pendingRef.current = null;
  }, []);

  const onError = useCallback(() => {
    pendingRef.current?.reject(new Error('Verificação de segurança expirou ou falhou. Tente novamente.'));
    pendingRef.current = null;
  }, []);

  // Sem sitekey configurada (dev local, por exemplo) o widget não renderiza
  // (widgetRef.current fica null) — resolve sem token em vez de travar o
  // submit pra sempre.
  const getToken = useCallback((): Promise<string | undefined> => {
    if (!widgetRef.current) return Promise.resolve(undefined);
    return new Promise((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      widgetRef.current?.execute();
    });
  }, []);

  const reset = useCallback(() => {
    widgetRef.current?.reset();
  }, []);

  return { widgetRef, getToken, reset, onVerify, onError };
}
