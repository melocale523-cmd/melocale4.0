import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export default function CheckoutCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center p-4">
      <div className="bg-[#1C1F26] p-8 rounded-2xl border border-red-500/20 max-w-md w-full text-center flex flex-col items-center">
        <XCircle className="text-red-500 mb-6" size={64} />
        <h1 className="text-2xl font-bold text-white mb-2">Pagamento cancelado</h1>
        <p className="text-slate-400 mb-6">O pagamento não foi concluído.</p>
        <button 
          onClick={() => navigate('/profissional/assinatura')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-all"
        >
          Voltar para planos
        </button>
      </div>
    </div>
  );
}
