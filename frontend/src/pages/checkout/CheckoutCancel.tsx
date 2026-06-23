import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CreditCard, ArrowLeft, Zap, Infinity, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { getCoinPackage } from '../../lib/coinPackages';
import { toast } from 'sonner';

const ALLOWED_RETURN_PREFIXES = ['/profissional/', '/cliente/']

function safeReturnTo(value: string | null, role?: string | null): string {
  const fallback = role === 'client' ? '/cliente/dashboard' : '/profissional/dashboard'
  if (!value) return fallback
  try {
    // Usa URL API com base fictícia para validar pathname sem risco de open redirect
    const { pathname } = new URL(value, 'https://melocale.com.br')
    if (ALLOWED_RETURN_PREFIXES.some((p) => pathname.startsWith(p))) return pathname
  } catch {
    // value inválido como URL
  }
  return fallback
}

export default function CheckoutCancel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [buying, setBuying] = useState(false);

  const rawReturnTo = searchParams.get('return_to');
  const packageId = searchParams.get('package_id') ?? '';
  const type = searchParams.get('type') ?? 'one_time';

  const returnTo = safeReturnTo(rawReturnTo, user?.role);
  const pkg = type !== 'subscription' ? getCoinPackage(packageId) : undefined;
  const hasRecap = !!pkg;

  const handleRetry = async () => {
    if (!user) {
      toast.error('Sessão expirada. Faça login novamente.');
      navigate('/login');
      return;
    }
    setBuying(true);
    try {
      const res = await apiFetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: packageId,
          type,
          user_id: user.id,
          return_to: returnTo,
        }),
      });
      if (!res.ok) throw new Error('Erro ao abrir checkout');
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao processar.');
      setBuying(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0E1C32',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* gradient border wrapper */}
      <div
        style={{
          background: 'linear-gradient(90deg, #10b981, #38bdf8)',
          borderRadius: '1rem',
          padding: '2px',
          width: '100%',
          maxWidth: 420,
        }}
      >
        <div
          style={{
            background: '#0a1928',
            borderRadius: '1rem',
            padding: '2rem 1.75rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
            textAlign: 'center',
          }}
        >
          {/* icon */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#1C3454',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CreditCard size={26} color="#f59e0b" />
          </div>

          {/* headline */}
          <div>
            <h1
              style={{
                color: '#f1f5f9',
                fontSize: 19,
                fontWeight: 500,
                margin: '0 0 6px',
                letterSpacing: '-0.01em',
              }}
            >
              Seu pagamento não foi concluído
            </h1>
            <p style={{ color: '#7d93ad', fontSize: 13, margin: 0 }}>
              {hasRecap
                ? 'Nenhuma cobrança foi feita. Seu pacote continua reservado abaixo.'
                : 'Nenhuma cobrança foi feita. Você pode tentar de novo quando quiser.'}
            </p>
          </div>

          {/* recap card */}
          {hasRecap && (
            <div
              style={{
                width: '100%',
                background: '#132236',
                borderRadius: '1rem',
                padding: '16px 18px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>
                  {pkg.name}
                </span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: '#10b981',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  R$ {pkg.price}
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#7d93ad', margin: 0, textAlign: 'left' }}>
                {pkg.coins + pkg.bonus} moedas · {pkg.description}
              </p>
            </div>
          )}

          {/* benefits */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {[
              { Icon: Zap, text: 'Acesso liberado na hora após o pagamento' },
              { Icon: Infinity, text: 'Moedas não expiram, use quando quiser' },
              { Icon: ShieldCheck, text: 'Pagamento processado com segurança pela Stripe' },
            ].map(({ Icon, text }) => (
              <div
                key={text}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Icon size={15} color="#10b981" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: '#9fb3cc', textAlign: 'left' }}>{text}</span>
              </div>
            ))}
          </div>

          {/* buttons */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {packageId && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={buying}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#10b981',
                  border: 'none',
                  borderRadius: '1rem',
                  color: '#04342c',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: buying ? 'not-allowed' : 'pointer',
                  opacity: buying ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {buying ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : null}
                {buying
                  ? 'Aguarde...'
                  : hasRecap
                  ? `Concluir pagamento — R$ ${pkg.price}`
                  : 'Tentar de novo'}
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate(returnTo)}
              disabled={buying}
              style={{
                width: '100%',
                padding: '14px',
                background: 'transparent',
                border: '1px solid #2c4564',
                borderRadius: '1rem',
                color: '#e2e8f0',
                fontSize: 14,
                fontWeight: 500,
                cursor: buying ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <ArrowLeft size={15} />
              Voltar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
