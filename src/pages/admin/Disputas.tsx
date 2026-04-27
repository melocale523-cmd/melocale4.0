import { AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';

export default function AdminDisputas() {
  return (
    <div className="space-y-6 fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Fila de Disputas</h1>
          <p className="text-slate-400 mt-1">Casos que exigem revisão humana, priorizados por risco</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-700 font-medium text-sm">
           <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      <div className="bg-yellow-500/5 text-yellow-500 border border-yellow-500/20 p-4 rounded-xl flex items-start gap-4">
        <AlertTriangle className="shrink-0 mt-0.5" />
        <div>
           <h3 className="font-bold text-yellow-500">Aviso de Governança</h3>
           <p className="text-yellow-500/80 text-sm mt-1">A IA não toma decisões. Todas as recomendações são apenas apoio técnico para revisão humana.</p>
        </div>
      </div>

      <div className="bg-[#14161B] border border-emerald-500/20 rounded-xl p-16 flex flex-col items-center justify-center text-center space-y-4">
         <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-emerald-500" />
         </div>
         <div>
            <h2 className="text-xl font-bold text-white mb-2">Nenhuma disputa aberta</h2>
            <p className="text-slate-400">Todos os casos foram resolvidos ou não há pendências.</p>
         </div>
      </div>
    </div>
  );
}
