interface Stats {
  total: number;
  pending: number;
  completed: number;
  today: number;
}

interface AgendaStatsProps {
  stats: Stats;
  isLoading: boolean;
}

export function AgendaStats({ stats, isLoading }: AgendaStatsProps) {
  const val = (n: number) => (isLoading ? '—' : n);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-2">
        <h4 className="text-[#4A6580] text-xs font-bold uppercase tracking-widest mb-2">Total</h4>
        <p className="text-lg font-bold text-white">{val(stats.total)}</p>
      </div>
      <div className="bg-[#1C3454] border border-blue-500/20 rounded-xl p-2">
        <h4 className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Agendados</h4>
        <p className="text-lg font-bold text-blue-400">{val(stats.pending)}</p>
      </div>
      <div className="bg-[#1C3454] border border-emerald-500/20 rounded-xl p-2">
        <h4 className="text-emerald-500 text-xs font-bold uppercase tracking-widest mb-2">Concluídos</h4>
        <p className="text-lg font-bold text-emerald-500">{val(stats.completed)}</p>
      </div>
      <div className="bg-[#1C3454] border border-yellow-500/20 rounded-xl p-2">
        <h4 className="text-yellow-500 text-xs font-bold uppercase tracking-widest mb-2">Hoje</h4>
        <p className="text-lg font-bold text-yellow-500">{val(stats.today)}</p>
      </div>
    </div>
  );
}
