import { useState } from 'react';
import { Search, Loader2, ArrowUpDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

interface Pedido {
  id: string;
  title: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  location: string | null;
  budget_min: number | null;
  budget_max: number | null;
  status: string;
  created_at: string;
  client_name: string | null;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  open:       { label: 'Aberto',     cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  available:  { label: 'Disponível', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  'orçando':  { label: 'Orçando',    cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  finalizado: { label: 'Finalizado', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  arquivado:  { label: 'Arquivado',  cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

function formatBudget(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  const fmt = (v: number) => `R$${v.toLocaleString('pt-BR')}`;
  if (min != null && max != null) {
    if (min === max) return fmt(min);
    if (min === 0) return `até ${fmt(max)}`;
    return `${fmt(min)} – ${fmt(max)}`;
  }
  return fmt((min ?? max)!);
}

export default function AdminPedidos() {
  const [search, setSearch] = useState('');
  const [sortDesc, setSortDesc] = useState(true);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['adminPedidos'],
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Pedido[]> => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, title, category, city, state, location, budget_min, budget_max, status, created_at, client_id')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = data ?? [];

      const clientIds = [...new Set(rows.map(l => l.client_id).filter((id): id is string => !!id))];
      const { data: profiles } = clientIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', clientIds)
        : { data: [] };
      const nameById = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name]));

      return rows.map(l => ({
        id: l.id,
        title: l.title,
        category: l.category,
        city: l.city,
        state: l.state,
        location: l.location,
        budget_min: l.budget_min,
        budget_max: l.budget_max,
        status: l.status,
        created_at: l.created_at,
        client_name: l.client_id ? (nameById[l.client_id] ?? null) : null,
      }));
    },
  });

  const filtered = pedidos.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [p.client_name, p.title, p.category, p.city, p.location, p.status]
      .some(v => v?.toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortDesc ? -diff : diff;
  });

  const abertos = pedidos.filter(p => p.status === 'open' || p.status === 'available' || p.status === 'orçando').length;
  const finalizados = pedidos.filter(p => p.status === 'finalizado').length;

  return (
    <div className="space-y-11 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Pedidos de Clientes</h1>
        <p className="text-[#94A3B8] mt-6">Todos os pedidos de serviço/orçamento criados pelos clientes na plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-9">
        {[
          { label: 'Total de Pedidos', value: pedidos.length, color: 'text-blue-400' },
          { label: 'Em Andamento', value: abertos, color: 'text-emerald-400' },
          { label: 'Finalizados', value: finalizados, color: 'text-slate-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#1C3454] border border-slate-800/80 rounded-xl p-11">
            <h3 className="text-[#94A3B8] text-sm font-medium mb-7">{stat.label}</h3>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-9 mb-11">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6580]" size={18} />
          <input
            type="text"
            placeholder="Buscar cliente, categoria, cidade, status..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            maxLength={255}
            className="w-full bg-[#1C3454] border border-slate-800 rounded-lg pl-10 pr-4 py-8 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-[#1C3454] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="p-9 border-b border-[#1C3050] flex justify-between items-center bg-[#181A20]">
          <h2 className="text-lg font-bold text-white">Pedidos ({sorted.length})</h2>
          {isLoading && <Loader2 size={18} className="animate-spin text-emerald-500" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1C3050] text-sm font-medium text-[#94A3B8]">
                <th className="p-9">Cliente</th>
                <th className="p-9">
                  <button
                    onClick={() => setSortDesc(v => !v)}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                    title={sortDesc ? 'Mais recentes primeiro' : 'Mais antigos primeiro'}
                  >
                    Data/Hora <ArrowUpDown size={13} />
                  </button>
                </th>
                <th className="p-9">Categoria</th>
                <th className="p-9">Cidade</th>
                <th className="p-9">Valor</th>
                <th className="p-9">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {sorted.map(p => (
                <tr key={p.id} className="border-b border-[#1C3050] hover:bg-slate-800/30 transition-colors">
                  <td className="p-9 text-white font-medium">{p.client_name ?? '—'}</td>
                  <td className="p-9 text-slate-300">
                    {new Date(p.created_at).toLocaleDateString('pt-BR')} {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-9 text-slate-300">
                    {p.category ?? '—'}
                    {p.title && <span className="block text-xs text-[#4A6580]">{p.title}</span>}
                  </td>
                  <td className="p-9 text-slate-300">{p.city ?? p.location ?? '—'}{p.city && p.state ? ` - ${p.state}` : ''}</td>
                  <td className="p-9 font-bold text-emerald-400">{formatBudget(p.budget_min, p.budget_max)}</td>
                  <td className="p-9">
                    <span className={`border px-2 py-0.5 rounded text-xs font-bold uppercase ${STATUS_BADGE[p.status]?.cls ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                      {STATUS_BADGE[p.status]?.label ?? p.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!isLoading && sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#4A6580]">
                    {search.trim() ? 'Nenhum pedido corresponde à busca.' : 'Nenhum pedido ainda.'}
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
