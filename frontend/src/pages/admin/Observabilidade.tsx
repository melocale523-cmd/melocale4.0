import { ShieldCheck, Activity, AlertTriangle } from 'lucide-react';

export default function AdminObservabilidade() {
  return (
    <div className="space-y-8 fade-in">
      <div>
        <div className="flex items-center gap-3">
          <Activity className="text-red-500 w-8 h-8" />
          <h1 className="text-2xl font-bold text-slate-100">Observabilidade Operacional</h1>
        </div>
        <p className="text-slate-400 mt-1">Visão passiva do estado operacional do sistema</p>
      </div>

      <div className="bg-[#14161B] border border-emerald-500/20 rounded-xl p-8 flex flex-col items-center justify-center space-y-4">
         <div className="flex items-center gap-4">
           <ShieldCheck size={48} className="text-emerald-500" />
           <div>
             <p className="text-emerald-500 font-bold text-sm tracking-wider">STATUS DO SISTEMA</p>
             <h2 className="text-5xl font-black text-emerald-400 uppercase tracking-tighter">Operacional</h2>
           </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'ERROS (24H)', value: '0' },
          { label: 'CRÍTICOS (24H)', value: '0', color: 'text-red-500' },
          { label: 'RECORRÊNCIAS', value: '0', color: 'text-orange-500' },
          { label: 'FILA PENDENTE', value: '0', color: 'text-blue-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#14161B] border border-slate-800/50 rounded-xl p-8 text-center flex flex-col items-center justify-center">
            <h3 className={`text-5xl font-black mb-2 ${stat.color || 'text-white'}`}>{stat.value}</h3>
            <p className="text-xs font-bold text-slate-500 tracking-wider font-mono">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#14161B] border border-slate-800/50 rounded-xl max-h-[400px] overflow-y-auto">
        <div className="p-6 border-b border-white/5 sticky top-0 bg-[#14161B]/95 backdrop-blur z-10">
          <h2 className="text-lg font-bold text-white">Timeline de Incidentes</h2>
        </div>
        <div className="p-16 flex items-center justify-center text-slate-500 italic">
           Nenhum incidente registrado no período.
        </div>
      </div>
    </div>
  );
}
