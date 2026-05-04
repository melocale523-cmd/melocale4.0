import { memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';

interface Props {
  seriesData: any[];
  range: '7d' | '30d' | '90d' | '1y';
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1D24] border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-md">
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <p className="text-sm font-black text-white">
            {entry.name}:{' '}
            <span className="text-slate-100 font-medium">
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

function EstatisticasCharts({ seriesData, range }: Props) {
  const barSize = range === '7d' ? 30 : range === '30d' ? 12 : 30;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className={`bg-[#14161B] border border-white/5 rounded-3xl p-8 relative transition-opacity `}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-white font-bold text-lg">Solicitações e Propostas</h3>
            <p className="text-slate-500 text-xs mt-1">Comparativo de atividade no período</p>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={seriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: '20px' }}
              />
              <Bar name="Total" dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={barSize} />
              <Bar name="Aceitas" dataKey="aceitas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={barSize} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`bg-[#14161B] border border-white/5 rounded-3xl p-8 relative transition-opacity `}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-white font-bold text-lg">Evolução Financeira</h3>
            <p className="text-slate-500 text-xs mt-1">Crescimento do faturamento estimado</p>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={seriesData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area name="Faturamento" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default memo(EstatisticasCharts);
