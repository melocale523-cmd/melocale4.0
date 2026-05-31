import { ShieldCheck, Activity, MessageSquare, ShoppingCart, Bell, MessagesSquare, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/dbServices';

export default function AdminObservabilidade() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['adminObservabilityMetrics'],
    queryFn: adminService.getObservabilityMetrics,
  });

  const tableMetrics = [
    { label: 'CONVERSAS', value: metrics?.conversations ?? 0, icon: MessagesSquare, color: 'text-blue-400' },
    { label: 'MENSAGENS', value: metrics?.messages ?? 0, icon: MessageSquare, color: 'text-emerald-400' },
    { label: 'COMPRAS', value: metrics?.purchases ?? 0, icon: ShoppingCart, color: 'text-purple-400' },
    { label: 'NOTIFICAÇÕES', value: metrics?.notifications ?? 0, icon: Bell, color: 'text-yellow-400' },
  ];

  return (
    <div className="space-y-8 fade-in">
      <div>
        <div className="flex items-center gap-8">
          <Activity className="text-red-500 w-8 h-8" />
          <h1 className="text-2xl font-bold text-slate-100">Observabilidade Operacional</h1>
        </div>
        <p className="text-[#94A3B8] mt-6">Visão passiva do estado operacional do sistema</p>
      </div>

      <div className="bg-[#1C3454] border border-emerald-500/20 rounded-xl p-8 flex flex-col items-center justify-center space-y-9">
        <div className="flex items-center gap-9">
          <ShieldCheck size={48} className="text-emerald-500" />
          <div>
            <p className="text-emerald-500 font-bold text-sm tracking-wider">STATUS DO SISTEMA</p>
            <h2 className="text-5xl font-black text-emerald-400 uppercase tracking-tighter">Operacional</h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-9">
        {tableMetrics.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-8 text-center flex flex-col items-center justify-center">
              {isLoading ? (
                <Loader2 className="animate-spin text-slate-500 mb-7" size={32} />
              ) : (
                <h3 className={`text-5xl font-black mb-2 ${stat.color}`}>{stat.value}</h3>
              )}
              <Icon size={18} className={`mb-1 ${stat.color} opacity-60`} />
              <p className="text-xs font-bold text-[#4A6580] tracking-wider font-mono">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl max-h-[400px] overflow-y-auto">
        <div className="p-11 border-b border-[#1C3050] sticky top-0 bg-[#1C3454]/95 backdrop-blur z-10">
          <h2 className="text-lg font-bold text-white">Timeline de Incidentes</h2>
        </div>
        <div className="p-16 flex items-center justify-center text-[#4A6580] italic">
          Nenhum incidente registrado no período.
        </div>
      </div>
    </div>
  );
}
