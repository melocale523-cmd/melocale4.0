import { forwardRef } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

// Sitekey pública (não é segredo) — configurada via env pra permitir trocar
// sem rebuild de código e pra manter dev/preview/prod com sitekeys distintas
// se necessário. Precisa estar setada no Vercel (VITE_TURNSTILE_SITE_KEY).
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError: () => void;
}

// Widget invisível do Cloudflare Turnstile — não renderiza nada visível pro
// usuário. `execution: 'execute'` faz com que o desafio só rode quando
// chamamos ref.current.execute() manualmente (no submit do form), em vez de
// automaticamente ao montar o componente — assim cada tentativa de
// login/cadastro gera um token novo, do jeito que o Supabase exige (token é
// de uso único e expira em 5min).
const TurnstileWidget = forwardRef<TurnstileInstance, TurnstileWidgetProps>(
  function TurnstileWidget({ onVerify, onError }, ref) {
    if (!SITE_KEY) {
      console.warn('[turnstile] VITE_TURNSTILE_SITE_KEY não configurada — captcha desativado');
      return null;
    }
    return (
      <Turnstile
        ref={ref}
        siteKey={SITE_KEY}
        options={{ size: 'invisible', execution: 'execute' }}
        onSuccess={onVerify}
        onError={onError}
        onExpire={onError}
        style={{ display: 'none' }}
      />
    );
  }
);

export default TurnstileWidget;
