import { lazy, Suspense, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadService } from '../../services/dbServices';
import { Eye, TrendingUp, CheckCircle2, DollarSign, Loader2, Calendar, AlertCircle, Zap } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { cn } from '../../lib/utils';
import { useInView } from '../../hooks/useInView';
import { useDeepMemo } from '../../hooks/useDeepMemo';

const EstatisticasCharts = lazy(() => import('./EstatisticasCharts'));

function ChartsSkeleton() {
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      {[0, 1].map((i) => (
        <div key={i} className="bg-[#132236] border border-[#1C3050] rounded-2xl p-4 h-[280px] flex items-center justify-center">
          <Loader2 className="animate-spin text-emerald-500/40" size={28} />
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
      <div className="w-full flex flex-col items-center justify-center py-8 gap-2">
        <AlertCircle size={36} className="text-red-400" />
        <p className="text-white font-bold text-lg">Sem dados disponíveis</p>
        <p className="text-slate-500 text-xs uppercase tracking-wide">Não foi possível carregar as estatísticas. Tente novamente.</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ paddingBottom: '2rem' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-lg font-bold text-white">Estatísticas</h1>
          <p className="text-xs uppercase tracking-wide text-slate-400">Acompanhe seu desempenho e crescimento</p>
        </div>

        <div className="flex items-center bg-[#0E1C32] border border-[#243F6A] rounded-xl p-1 gap-0.5">
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
                "h-8 px-3 text-xs font-semibold rounded-lg transition-all",
                range === item.id
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full" style={{ marginTop: '1.5rem' }}>
        {/* Visualizações */}
        <div className="bg-[#132236] border border-[#1C3050] rounded-2xl p-6 relative overflow-hidden">
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'#378ADD' }} />
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400"><Eye size={16} /></div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">+{stats?.visualizacoes || 0}</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580] mb-1">Visualizações</p>
          <p className="text-2xl font-bold text-blue-400">{stats?.visualizacoes || 0}</p>
          <p className="text-[11px] text-[#4A6580] mt-1">no período</p>
        </div>
        {/* Propostas */}
        <div className="bg-[#132236] border border-[#1C3050] rounded-2xl p-6 relative overflow-hidden">
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'#a855f7' }} />
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400"><TrendingUp size={16} /></div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-purple-500/10 text-purple-400">+{stats?.totalProposals || 0}</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580] mb-1">Propostas</p>
          <p className="text-2xl font-bold text-purple-400">{stats?.totalProposals || 0}</p>
          <p className="text-[11px] text-[#4A6580] mt-1">enviadas</p>
        </div>
        {/* Aceitas */}
        <div className="bg-[#132236] border border-[#1C3050] rounded-2xl p-6 relative overflow-hidden">
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'#10b981' }} />
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400"><CheckCircle2 size={16} /></div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
              {stats?.totalProposals ? Math.round((stats.acceptedProposalsCount / stats.totalProposals) * 100) : 0}%
            </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580] mb-1">Aceitas</p>
          <p className="text-2xl font-bold text-emerald-400">{stats?.acceptedProposalsCount || 0}</p>
          <p className="text-[11px] text-[#4A6580] mt-1">taxa de conversão</p>
        </div>
        {/* Faturamento */}
        <div className="bg-[#132236] border border-[#1C3050] rounded-2xl p-6 relative overflow-hidden">
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'#f59e0b' }} />
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-400"><DollarSign size={16} /></div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400">est.</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580] mb-1">Faturamento</p>
          <p className="text-2xl font-bold text-yellow-400">R$ {(stats?.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
          <p className="text-[11px] text-[#4A6580] mt-1">no período</p>
        </div>
      </div>

      {/* Charts — lazy-loaded when in viewport */}
      <div ref={chartsRef} style={{ marginTop: '1.5rem' }}>
        {seriesData.length === 0 ? (
          <div className="grid lg:grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="bg-[#132236] border border-[#1C3050] rounded-2xl p-4 h-[280px] flex flex-col items-center justify-center gap-2">
                <AlertCircle size={24} className="text-slate-600" />
                <p className="text-slate-500 text-xs uppercase tracking-wide">Sem dados disponíveis</p>
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

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ marginTop: '1.5rem' }}>
        <div className="bg-[#0d1929] border border-[#1C3050] rounded-2xl p-5 flex items-start gap-3">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 shrink-0"><TrendingUp size={15} /></div>
          <div>
            <p className="text-sm font-bold text-white mb-1">Taxa de conversão</p>
            <p className="text-xs text-[#4A6580] leading-relaxed">
              {stats?.totalProposals ? `${Math.round((stats.acceptedProposalsCount / stats.totalProposals) * 100)}% das propostas aceitas` : 'Envie propostas para ver sua taxa'}
            </p>
          </div>
        </div>
        <div className="bg-[#0d1929] border border-[#1C3050] rounded-2xl p-5 flex items-start gap-3">
          <div className="w-8 h-8 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-400 shrink-0"><DollarSign size={15} /></div>
          <div>
            <p className="text-sm font-bold text-white mb-1">ROI estimado</p>
            <p className="text-xs text-[#4A6580] leading-relaxed">
              {stats?.totalSpentCoins ? `${((stats.totalRevenue / (stats.totalSpentCoins / 10)) || 0).toFixed(1)}x de retorno vs investimento em leads` : 'Compre leads para calcular o ROI'}
            </p>
          </div>
        </div>
        <div className="bg-[#0d1929] border border-[#1C3050] rounded-2xl p-5 flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 shrink-0"><Zap size={15} /></div>
          <div>
            <p className="text-sm font-bold text-white mb-1">Dica de crescimento</p>
            <p className="text-xs text-[#4A6580] leading-relaxed">Responder leads em menos de 1h aumenta aceitação em até 3x</p>
          </div>
        </div>
      </div>

      {/* Resumo do Período */}
      <div className="bg-[#132236] border border-[#1C3050] rounded-2xl p-6" style={{ marginTop: '1.5rem' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <Calendar size={15} />
          </div>
          <h3 className="text-white font-bold text-sm">
            Resumo do Período ({range === '7d' ? 'Semanal' : range === '30d' ? 'Mensal' : 'Anual'})
          </h3>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-[#0d1929] border border-[#1C3050] rounded-xl p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Conversão</p>
            <p className="text-2xl font-bold text-emerald-400">
              {stats?.totalProposals ? ((stats.acceptedProposalsCount / stats.totalProposals) * 100).toFixed(1) : '0.0'}%
            </p>
            <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-1000"
                style={{ width: `${stats?.totalProposals ? (stats.acceptedProposalsCount / stats.totalProposals) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-[#0d1929] border border-[#1C3050] rounded-xl p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Ticket Médio</p>
            <p className="text-2xl font-bold text-yellow-400">
              R$ {stats?.acceptedProposalsCount ? (stats.totalRevenue / stats.acceptedProposalsCount).toLocaleString('pt-BR', { minimumFractionDigits: 0 }) : '0'}
            </p>
            <p className="text-slate-600 text-xs mt-1">Baseado em serviços aceitos</p>
          </div>

          <div className="bg-[#0d1929] border border-[#1C3050] rounded-xl p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">ROI (Est.)</p>
            <p className="text-2xl font-bold text-emerald-400">
              {stats?.totalSpentCoins ? ((stats.totalRevenue / (stats.totalSpentCoins / 10)) || 0).toFixed(1) : '0.0'}x
            </p>
            <p className="text-slate-600 text-xs mt-1">Retorno vs investimento em leads</p>
          </div>
        </div>
      </div>

      {/* Tabela de Detalhamento */}
      <div className="bg-[#132236] border border-[#1C3050] rounded-2xl overflow-hidden" style={{ marginTop: '1.5rem' }}>
        <div className="px-4 py-3 border-b border-[#1C3050] flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-sm">Detalhamento por Período</h3>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Valores por {(range === '7d' || range === '30d') ? 'dia' : 'mês'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: '520px' }}>
            <thead>
              <tr className="bg-[#0d1929]">
                <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-400 whitespace-nowrap" style={{ minWidth: '60px' }}>{range === '1y' || range === '90d' ? 'Mês' : 'Data'}</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-400 whitespace-nowrap">Total Propostas</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-400 whitespace-nowrap">Aceitas</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wide text-emerald-400 whitespace-nowrap" style={{ minWidth: '100px' }}>Faturamento</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-400 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[...(stats?.seriesData || [])].reverse().map((day, idx) => (
                <tr key={idx} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-300 group-hover:text-white transition-colors whitespace-nowrap">{day.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                    <span style={{ color: day.total === 0 ? '#3a5470' : 'inherit' }}>{day.total}</span>
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {day.aceitas === 0 ? <span style={{ color: '#3a5470' }}>0</span> : <span className="text-emerald-500 font-semibold">{day.aceitas}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap">
                    {Number(day.revenue) === 0 ? <span style={{ color: '#3a5470' }}>R$ 0,00</span> : <span className="text-emerald-400">{`R$ ${Number(day.revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {day.aceitas > 0
                      ? <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Aceita</span>
                      : <span style={{ fontSize:'10px', fontWeight:700, color:'#3a5470' }}>—</span>
                    }
                  </td>
                </tr>
              ))}
              {(!stats?.seriesData || stats.seriesData.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-500 text-xs uppercase tracking-wide">
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
