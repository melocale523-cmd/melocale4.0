import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0E1C32] flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-emerald-500 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-white mb-2">Página não encontrada</h2>
        <p className="text-[#94A3B8] mb-8">O link pode estar errado ou a página foi removida.</p>
        <button
          onClick={() => navigate('/')}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Voltar ao início
        </button>
      </div>
    </div>
  );
}
