import { lazy, Suspense, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadService } from '../../services/dbServices';
import { Eye, TrendingUp, CheckCircle2, DollarSign, Loader2, Calendar, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { cn } from '../../lib/utils';
import { useInView } from '../../hooks/useInView';
import { useDeepMemo } from '../../hooks/useDeepMemo';

const EstatisticasCharts = lazy(() => import('./EstatisticasCharts'));

function ChartsSkeleton() {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-4 h-[420px] flex items-center justify-center">
          <Loader2 className="animate-spin text-emerald-500/40" size={32} />
        </div>
      ))}
    </div>
  );
}

export default function ProfessionalEstatisticas() {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  const [chartsRef, chartsInView] = useInView({ threshold: 0, rootMargin: '200px' });

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['professionalStats', range],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => leadService.getProfessionalStats(range),
  });

  useEffect(() => {
    if (!isLoading) { setLoadingTimedOut(false); return; }
    const t = setTimeout(() => setLoadingTimedOut(true), 10_000);
    return () => clearTimeout(t);
  }, [isLoading, range]);

  const seriesData = useDeepMemo(() => stats?.seriesData ?? [], [stats?.seriesData]);

  if (isLoading && !loadingTimedOut) return <LoadingSpinner />;

  if (isError || loadingTimedOut) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-8 gap-3">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-white font-bold text-lg">Sem dados disponíveis</p>
        <p className="text-[#4A6580] text-sm">Não foi possível carregar as estatísticas. Tente novamente.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-3">Estatísticas</h1>
          <p className="text-[#4A6580] text-sm">Acompanhe seu desempenho e crescimento</p>
        </div>

        <div className="flex items-center bg-[#1C3454] p-3 rounded-xl border border-[#1C3050]">
          {([
            { id: '7d', label: '7 Dias' },
            { id: '30d', label: '30 Dias' },
            { id: '90d', label: '3 Meses' },
            { id: '1y', label: 'Este Ano' },
          ] as Array<{ id: '7d' | '30d' | '90d' | '1y'; label: string }>).map((item) => (
            <button
              key={item.id}
              onClick={() => setRange(item.id)}
              className={cn(
                "px-4 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-lg",
                range === item.id
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                  : "text-[#4A6580] hover:text-slate-300"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards — renderizam sem recharts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-11 relative overflow-hidden transition-all hover:border-blue-500/30 group">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 mb-3 group-hover:scale-110 transition-transform">
            <Eye size={20} />
          </div>
          <h4 className="text-[#94A3B8] text-[10px] font-black uppercase tracking-widest mb-3">Visualizações</h4>
          <p className="text-3xl font-bold text-white">{stats?.visualizacoes || 0}</p>
        </div>

        <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-11 relative overflow-hidden transition-all hover:border-purple-500/30 group">
          <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 mb-3 group-hover:scale-110 transition-transform">
            <TrendingUp size={20} />
          </div>
          <h4 className="text-[#94A3B8] text-[10px] font-black uppercase tracking-widest mb-3">Propostas</h4>
          <p className="text-3xl font-bold text-white">{stats?.totalProposals || 0}</p>
        </div>

        <div className="bg-[#1C3454] border border-emerald-500/20 rounded-2xl p-11 relative overflow-hidden shadow-[0_0_15px_-3px_rgba(16,185,129,0.1)] transition-all hover:border-emerald-500/40 group">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-3 group-hover:scale-110 transition-transform">
            <CheckCircle2 size={20} />
          </div>
          <h4 className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-3">Aceitas</h4>
          <p className="text-3xl font-bold text-emerald-400">{stats?.acceptedProposalsCount || 0}</p>
        </div>

        <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-11 relative overflow-hidden transition-all hover:border-yellow-500/30 group">
          <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-500 mb-3 group-hover:scale-110 transition-transform">
            <DollarSign size={20} />
          </div>
          <h4 className="text-yellow-500 text-[10px] font-black uppercase tracking-widest mb-3">Faturamento</h4>
          <p className="text-3xl font-bold text-white">
            R$ {(stats?.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Gráficos — vendor-charts só é baixado quando esta div entra na viewport */}
      <div ref={chartsRef}>
        {seriesData.length === 0 ? (
          <div className="grid lg:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-4 h-[420px] flex flex-col items-center justify-center gap-3">
                <AlertCircle size={28} className="text-[#4A6580]" />
                <p className="text-[#4A6580] text-sm font-bold">Sem dados disponíveis</p>
              </div>
            ))}
          </div>
        ) : chartsInView ? (
          <Suspense fallback={<ChartsSkeleton />}>
            <EstatisticasCharts
              key={range}
              seriesData={seriesData}
              range={range}
            />
          </Suspense>
        ) : (
          <ChartsSkeleton />
        )}
      </div>

      {/* Relatório Rápido — renderiza sem recharts */}
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-13">
          <div className="p-7 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <Calendar size={18} />
          </div>
          <h3 className="text-white font-bold">
            Resumo do Período ({range === '7d' ? 'Semanal' : range === '30d' ? 'Mensal' : 'Anual'})
          </h3>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="p-11 rounded-2xl bg-white/[0.02] border border-[#1C3050]">
            <p className="text-[#4A6580] text-[10px] font-black uppercase tracking-widest mb-7">Conversão</p>
            <p className="text-2xl font-bold text-white">
              {stats?.totalProposals ? ((stats.acceptedProposalsCount / stats.totalProposals) * 100).toFixed(1) : '0.0'}%
            </p>
            <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-1000"
                style={{ width: `${stats?.totalProposals ? (stats.acceptedProposalsCount / stats.totalProposals) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="p-11 rounded-2xl bg-white/[0.02] border border-[#1C3050]">
            <p className="text-[#4A6580] text-[10px] font-black uppercase tracking-widest mb-7">Ticket Médio</p>
            <p className="text-2xl font-bold text-white">
              R$ {stats?.acceptedProposalsCount ? (stats.totalRevenue / stats.acceptedProposalsCount).toLocaleString('pt-BR', { minimumFractionDigits: 0 }) : '0'}
            </p>
            <p className="text-slate-600 text-[10px] mt-3 font-bold">Baseado em serviços aceitos</p>
          </div>

          <div className="p-11 rounded-2xl bg-white/[0.02] border border-[#1C3050]">
            <p className="text-[#4A6580] text-[10px] font-black uppercase tracking-widest mb-7">ROI (Est.)</p>
            <p className="text-2xl font-bold text-emerald-400">
              {stats?.totalSpentCoins ? ((stats.totalRevenue / (stats.totalSpentCoins / 10)) || 0).toFixed(1) : '0.0'}x
            </p>
            <p className="text-slate-600 text-[10px] mt-3 font-bold">Retorno vs Investimento em leads</p>
          </div>
        </div>
      </div>

      {/* Tabela — renderiza sem recharts */}
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#1C3050] flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold">Detalhamento por Período</h3>
            <p className="text-[#4A6580] text-xs mt-3">
              Valores individuais por {(range === '7d' || range === '30d') ? 'dia' : 'mês'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] text-[#4A6580] text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-4 py-3">{range === '1y' || range === '90d' ? 'Mês' : 'Data'}</th>
                <th className="px-4 py-3">Total Propostas</th>
                <th className="px-4 py-3">Aceitas</th>
                <th className="px-4 py-3 text-emerald-400">Faturamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[...(stats?.seriesData || [])].reverse().map((day, idx) => (
                <tr key={idx} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-4 py-3 text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{day.name}</td>
                  <td className="px-4 py-3 text-sm text-[#94A3B8]">{day.total}</td>
                  <td className="px-4 py-3 text-sm text-[#94A3B8]">
                    <span className={cn(day.aceitas > 0 ? "text-emerald-500 font-bold" : "")}>{day.aceitas}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-black text-slate-100 italic">
                    R$ {Number(day.revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {(!stats?.seriesData || stats.seriesData.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-[#4A6580] italic">
                    Nenhum dado disponível no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
