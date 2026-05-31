import { Outlet, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function AuthLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen dark:bg-[#0E1C32] flex items-center justify-center p-11 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-15">
          <span className="text-3xl font-bold tracking-tight uppercase text-emerald-400">
             MeloCalé
          </span>
        </div>
        <div className="bg-white/[0.15] backdrop-blur-xl dark:bg-[#132540] border border-white/30 dark:border-[#2563eb33] p-8 rounded-3xl shadow-[0_0_40px_rgba(37,99,235,0.08)]">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-7 text-white/80 dark:text-[#B0C4D8] hover:text-white transition-colors text-sm font-medium mb-11 border border-white/30 dark:border-[#243F6A] hover:border-white/60 dark:hover:border-[#2563eb] px-8 py-1.5 rounded-xl"
          >
            <ArrowLeft size={15} />
            Voltar
          </button>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
