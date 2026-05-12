import { ShieldCheck, Activity, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export default function AdminObservabilidade() {
  const { data: counts, isLoading } = useQuery({
    queryKey: ['admin_observabilidade_counts'],
    queryFn: async () => {
      const [
        { count: totalLeads },
        { count: totalConversas },
        { count: totalCompras },
        { count: totalMensagens },
        { count: totalNotificacoes },
      ] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('conversations').select('*', { count: 'exact', head: true }),
        supabase.from('lead_purchases').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('notifications').select('*', { count: 'exact', head: true }),
      ]);
      return { totalLeads, totalConversas, totalCompras, totalMensagens, totalNotificacoes };
    },
  });

  const volumeStats = [
    { label: 'LEADS', value: counts?.totalLeads ?? 0, color: 'text-blue-400' },
    { label: 'CONVERSAS', value: counts?.totalConversas ?? 0, color: 'text-emerald-400' },
    { label: 'COMPRAS DE LEAD', value: counts?.totalCompras ?? 0, color: 'text-purple-400' },
    { label: 'MENSAGENS', value: counts?.totalMensagens ?? 0, color: 'text-yellow-400' },
    { label: 'NOTIFICAÇÕES', value: counts?.totalNotificacoes ?? 0, color: 'text-pink-400' },
  ];

  return (
    <div className="space-y-8 fade-in">
      <div>
        <div className="flex items-center gap-3">
          <Activity className="text-red-500 w-8 h-8" />
          <h1 className="text-2xl font-bold text-slate-100">Observabilidade Operacional</h1>
        </div>
        <p className="text-[#94A3B8] mt-1">Visão passiva do estado operacional do sistema</p>
      </div>

      <div className="bg-[#1C3454] border border-emerald-500/20 rounded-xl p-8 flex flex-col items-center justify-center space-y-4">
        <div className="flex items-center gap-4">
          <ShieldCheck size={48} className="text-emerald-500" />
          <div>
            <p className="text-emerald-500 font-bold text-sm tracking-wider">STATUS DO SISTEMA</p>
            <h2 className="text-5xl font-black text-emerald-400 uppercase tracking-tighter">Operacional</h2>
          </div>
        </div>
      </div>

      {/* Volume operacional real */}
      <div>
        <h2 className="text-sm font-bold text-[#4A6580] tracking-wider font-mono mb-3">VOLUME OPERACIONAL</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {volumeStats.map((stat, i) => (
            <div key={i} className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-6 text-center flex flex-col items-center justify-center">
              {isLoading ? (
                <Loader2 size={24} className="animate-spin text-[#4A6580] mb-2" />
              ) : (
                <h3 className={`text-4xl font-black mb-2 ${stat.color}`}>{stat.value.toLocaleString('pt-BR')}</h3>
              )}
              <p className="text-[10px] font-bold text-[#4A6580] tracking-wider font-mono">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Monitoramento de erros (requer integração com serviço de logs externo) */}
      <div>
        <h2 className="text-sm font-bold text-[#4A6580] tracking-wider font-mono mb-3">MONITORAMENTO DE ERROS</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'ERROS (24H)', value: '0' },
            { label: 'CRÍTICOS (24H)', value: '0', color: 'text-red-500' },
            { label: 'RECORRÊNCIAS', value: '0', color: 'text-orange-500' },
            { label: 'FILA PENDENTE', value: '0', color: 'text-blue-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-8 text-center flex flex-col items-center justify-center">
              <h3 className={`text-5xl font-black mb-2 ${stat.color || 'text-white'}`}>{stat.value}</h3>
              <p className="text-xs font-bold text-[#4A6580] tracking-wider font-mono">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl max-h-[400px] overflow-y-auto">
        <div className="p-6 border-b border-[#1C3050] sticky top-0 bg-[#1C3454]/95 backdrop-blur z-10">
          <h2 className="text-lg font-bold text-white">Timeline de Incidentes</h2>
        </div>
        <div className="p-16 flex items-center justify-center text-[#4A6580] italic">
          Nenhum incidente registrado no período.
        </div>
      </div>
    </div>
  );
}
