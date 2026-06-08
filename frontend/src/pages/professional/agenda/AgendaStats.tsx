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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total */}
      <div className="bg-[#132236] border border-[#1C3050] rounded-2xl p-5 overflow-hidden relative">
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'#4A6580' }} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580] mb-2">Total do mês</p>
        <p className="text-2xl font-bold text-white">{val(stats.total)}</p>
        <p className="text-[11px] text-[#4A6580] mt-1">agendamentos</p>
      </div>
      {/* Agendados */}
      <div className="bg-[#132236] border border-[#1C3050] rounded-2xl p-5 overflow-hidden relative">
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'#378ADD' }} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580] mb-2">Agendados</p>
        <p className="text-2xl font-bold text-blue-400">{val(stats.pending)}</p>
        <p className="text-[11px] text-[#4A6580] mt-1">aguardando confirmação</p>
      </div>
      {/* Concluídos */}
      <div className="bg-[#132236] border border-[#1C3050] rounded-2xl p-5 overflow-hidden relative">
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'#10b981' }} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580] mb-2">Concluídos</p>
        <p className="text-2xl font-bold text-emerald-400">{val(stats.completed)}</p>
        <p className="text-[11px] text-[#4A6580] mt-1">serviços realizados</p>
      </div>
      {/* Hoje */}
      <div className="bg-[#132236] border border-[#1C3050] rounded-2xl p-5 overflow-hidden relative">
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'#f59e0b' }} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580] mb-2">Hoje</p>
        <p className="text-2xl font-bold text-yellow-400">{val(stats.today)}</p>
        <p className="text-[11px] text-[#4A6580] mt-1">compromissos hoje</p>
      </div>
    </div>
  );
}
