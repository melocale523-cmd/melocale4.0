import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  useEffect(() => {
    // Invalida o cache para recarregar o saldo
    queryClient.invalidateQueries({ queryKey: ['wallet'] });

    const dest = user?.role === 'professional' ? '/profissional/carteira' : '/cliente/dashboard';
    const timer = setTimeout(() => {
      navigate(dest);
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate, queryClient, user?.role]);

  return (
    <div className="min-h-screen bg-[#0E1C32] flex items-center justify-center p-4">
      <div className="bg-[#1C1F26] p-8 rounded-2xl border border-emerald-500/20 max-w-md w-full text-center flex flex-col items-center">
        <CheckCircle2 className="text-emerald-500 mb-6" size={64} />
        <h1 className="text-2xl font-bold text-white mb-2">Pagamento confirmado!</h1>
        <p className="text-[#94A3B8] mb-6">Seus créditos foram adicionados com sucesso.<br/>Redirecionando para sua carteira...</p>
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    </div>
  );
}
