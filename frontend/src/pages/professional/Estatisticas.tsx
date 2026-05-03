import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadService } from '../../services/dbServices';
import { Eye, TrendingUp, CheckCircle2, DollarSign, Loader2, Calendar } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, TooltipProps
} from 'recharts';
import { cn } from '../../lib/utils';

export default function ProfessionalEstatisticas() {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const { data: stats, isLoading, isFetching } = useQuery({
    queryKey: ['professionalStats', range],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => leadService.getProfessionalStats(range),
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1A1D24] border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-md">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <p className="text-sm font-black text-white">
                {entry.name}: <span className="text-slate-100 font-medium">
                  {entry.name === 'Revenue' || entry.name === 'Faturamento' 
                    ? `R$ ${Number(entry.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                    : entry.value}
                </span>
              </p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Estatísticas</h1>
          <p className="text-slate-500 text-sm">Acompanhe seu desempenho e crescimento</p>
        </div>
        
        <div className="flex items-center bg-[#14161B] p-1 rounded-xl border border-white/5">
          {[
            { id: '7d', label: '7 Dias' },
            { id: '30d', label: '30 Dias' },
            { id: '90d', label: '3 Meses' },
            { id: '1y', label: 'Este Ano' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setRange(item.id as any)}
              className={cn(
                "px-4 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-lg",
                range === item.id 
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6 relative overflow-hidden transition-all hover:border-blue-500/30 group">
           <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
             <Eye size={20} />
           </div>
           <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Visualizações</h4>
           <p className="text-3xl font-bold text-white">{stats?.visualizacoes || 0}</p>
        </div>

        <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6 relative overflow-hidden transition-all hover:border-purple-500/30 group">
           <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
             <TrendingUp size={20} />
           </div>
           <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Propostas</h4>
           <p className="text-3xl font-bold text-white">{stats?.totalProposals || 0}</p>
        </div>

        <div className="bg-[#14161B] border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_15px_-3px_rgba(16,185,129,0.1)] transition-all hover:border-emerald-500/40 group">
           <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-4 group-hover:scale-110 transition-transform text-white">
             <CheckCircle2 size={20} />
           </div>
           <h4 className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-1">Aceitas</h4>
           <p className="text-3xl font-bold text-emerald-400">{stats?.acceptedProposalsCount || 0}</p>
        </div>

        <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6 relative overflow-hidden transition-all hover:border-yellow-500/30 group">
           <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-500 mb-4 group-hover:scale-110 transition-transform">
             <DollarSign size={20} />
           </div>
           <h4 className="text-yellow-500 text-[10px] font-black uppercase tracking-widest mb-1">Faturamento</h4>
           <p className="text-3xl font-bold text-white">
             R$ {(stats?.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
           </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
         {/* Propostas Chart */}
         <div className={cn("bg-[#14161B] border border-white/5 rounded-3xl p-8 relative transition-opacity", isFetching && "opacity-50")}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-white font-bold text-lg">Solicitações e Propostas</h3>
                <p className="text-slate-500 text-xs mt-1">Comparativo de atividade no período</p>
              </div>
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400">
                <TrendingUp size={20} />
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.seriesData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#475569" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#475569" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle"
                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: '20px' }}
                  />
                  <Bar name="Total" dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={range === '7d' ? 30 : range === '30d' ? 12 : 30} />
                  <Bar name="Aceitas" dataKey="aceitas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={range === '7d' ? 30 : range === '30d' ? 12 : 30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>

         {/* Faturamento Chart */}
         <div className={cn("bg-[#14161B] border border-white/5 rounded-3xl p-8 relative transition-opacity", isFetching && "opacity-50")}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-white font-bold text-lg">Evolução Financeira</h3>
                <p className="text-slate-500 text-xs mt-1">Crescimento do faturamento estimado</p>
              </div>
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400">
                <DollarSign size={20} />
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.seriesData || []}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#475569" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#475569" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `R$${value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    name="Faturamento" 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
         </div>
      </div>

      {/* Relatório Rápido */}
      <div className="bg-[#14161B] border border-white/5 rounded-3xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <Calendar size={18} />
          </div>
          <h3 className="text-white font-bold">Resumo do Período ({range === '7d' ? 'Semanal' : range === '30d' ? 'Mensal' : 'Anual'})</h3>
        </div>

        <div className="grid sm:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Conversão</p>
            <p className="text-2xl font-bold text-white">
              {stats?.totalProposals ? ((stats.acceptedProposalsCount / stats.totalProposals) * 100).toFixed(1) : '0.0'}%
            </p>
            <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-emerald-500 transition-all duration-1000" 
                 style={{ width: `${stats?.totalProposals ? (stats.acceptedProposalsCount / stats.totalProposals) * 100 : 0}%` }}
               />
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Ticket Médio</p>
            <p className="text-2xl font-bold text-white">
              R$ {stats?.acceptedProposalsCount ? (stats.totalRevenue / stats.acceptedProposalsCount).toLocaleString('pt-BR', { minimumFractionDigits: 0 }) : '0'}
            </p>
            <p className="text-slate-600 text-[10px] mt-1 font-bold">Baseado em serviços aceitos</p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">ROI (Est.)</p>
            <p className="text-2xl font-bold text-emerald-400">
               {stats?.totalSpentCoins ? ((stats.totalRevenue / (stats.totalSpentCoins / 10)) || 0).toFixed(1) : '0.0'}x
            </p>
            <p className="text-slate-600 text-[10px] mt-1 font-bold">Retorno vs Investimento em leads</p>
          </div>
        </div>
      </div>
      {/* Relatório Detalhado - Tabela */}
      <div className="bg-[#14161B] border border-white/5 rounded-3xl overflow-hidden">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold">Detalhamento por Período</h3>
            <p className="text-slate-500 text-xs mt-1">Valores individuais por {(range === '7d' || range === '30d') ? 'dia' : 'mês'}</p>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-8 py-4">{range === '1y' || range === '90d' ? 'Mês' : 'Data'}</th>
                <th className="px-8 py-4">Total Propostas</th>
                <th className="px-8 py-4">Aceitas</th>
                <th className="px-8 py-4 text-emerald-400">Faturamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[...(stats?.seriesData || [])].reverse().map((day, idx) => (
                <tr key={idx} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-8 py-4 text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{day.name}</td>
                  <td className="px-8 py-4 text-sm text-slate-400">{day.total}</td>
                  <td className="px-8 py-4 text-sm text-slate-400">
                    <span className={cn(day.aceitas > 0 ? "text-emerald-500 font-bold" : "")}>{day.aceitas}</span>
                  </td>
                  <td className="px-8 py-4 text-sm font-black text-slate-100 italic">
                    R$ {Number(day.revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {(!stats?.seriesData || stats.seriesData.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-slate-500 italic">Nenhum dado disponível no período selecionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
