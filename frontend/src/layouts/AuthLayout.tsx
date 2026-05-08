import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#0E1C32] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-10">
          <span className="text-3xl font-bold tracking-tight uppercase text-emerald-400">
             MeloCalé
          </span>
        </div>
        <div className="bg-[#132540] border border-[#2563eb33] p-8 rounded-3xl shadow-[0_0_40px_rgba(37,99,235,0.08)]">
           <Outlet />
        </div>
      </div>
    </div>
  );
}
