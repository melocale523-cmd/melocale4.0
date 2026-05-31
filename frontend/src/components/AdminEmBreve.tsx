import { Construction } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminEmBreve() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-9">
      <Construction size={48} className="text-[#243F6A]" />
      <h2 className="text-white font-bold text-xl">Em breve</h2>
      <p className="text-[#94A3B8] text-sm">Esta funcionalidade está em desenvolvimento.</p>
      <button
        onClick={() => navigate(-1)}
        className="mt-7 px-9 py-7 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Voltar
      </button>
    </div>
  );
}
