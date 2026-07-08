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
  //
  // Timeout de 10s: se o desafio nunca resolver (ex.: script do Cloudflare
  // não carregou, rede bloqueando challenges.cloudflare.com, ou qualquer
  // outra falha silenciosa) o submit não pode ficar girando pra sempre —
  // rejeita com um erro claro em vez de travar o spinner indefinidamente.
  // Revertido de 4s pra 10s em 2026-07-07 — a tentativa de reduzir pra 4s
  // (e depois pra 4s) causou falha real de login em produção (desafio
  // managed do Turnstile as vezes demora mais que isso pra resolver,
  // sobretudo se escala pra interativo ou em rede ruim). Não mexer nesse
  // valor de novo sem dado real de latência do desafio (ver passo 3).
  const getToken = useCallback((): Promise<string | undefined> => {
    if (!widgetRef.current) return Promise.resolve(undefined);
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingRef.current = null;
        reject(new Error('Não foi possível verificar segurança, recarregue a página e tente novamente.'));
      }, 10_000);
      pendingRef.current = {
        resolve: (token) => { clearTimeout(timeoutId); resolve(token); },
        reject: (err) => { clearTimeout(timeoutId); reject(err); },
      };
      widgetRef.current?.execute();
    });
  }, []);

  const reset = useCallback(() => {
    widgetRef.current?.reset();
  }, []);

  return { widgetRef, getToken, reset, onVerify, onError };
}
