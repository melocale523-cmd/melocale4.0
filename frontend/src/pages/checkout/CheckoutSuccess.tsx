import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const sessionId = new URLSearchParams(location.search).get('session_id');

  useEffect(() => {
    if (!sessionId) {
      navigate('/profissional/dashboard', { replace: true });
      return;
    }

    // Invalida o cache para recarregar o saldo quando o webhook processar
    queryClient.invalidateQueries({ queryKey: ['walletBalance'] });

    const timer = setTimeout(() => {
      navigate('/profissional/carteira');
    }, 3000);

    return () => clearTimeout(timer);
  }, [sessionId, navigate, queryClient]);

  if (!sessionId) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0E1C32',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2.25rem',
    }}>
      <div style={{
        background: '#0a1928',
        padding: '2rem',
        borderRadius: '1rem',
        border: '1px solid rgba(16,185,129,0.2)',
        maxWidth: '28rem',
        width: '100%',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <CheckCircle2 style={{ color: '#10b981', marginBottom: '2.75rem' }} size={64} />
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', marginBottom: '1.75rem', margin: '0 0 1.75rem' }}>Pagamento confirmado!</h1>
        <p style={{ color: '#94A3B8', marginBottom: '2.75rem' }}>
          Seu pagamento foi processado. As moedas serão creditadas em instantes.<br/>Redirecionando para sua carteira...
        </p>
        <div style={{
          width: '3rem',
          height: '3rem',
          borderRadius: '50%',
          border: '4px solid rgba(16,185,129,0.3)',
          borderTopColor: '#10b981',
          animation: 'spin 1s linear infinite',
        }}></div>
      </div>
    </div>
  );
}
