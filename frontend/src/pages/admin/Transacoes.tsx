import { useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

interface WalletTransaction {
  id: string;
  user_id: string | null;
  amount: number;
  kind: string | null;
  reference: string | null;
  stripe_event_id: string | null;
  created_at: string;
}

export default function AdminTransacoes() {
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [search, setSearch] = useState('');

  const { data: transactions = [], isLoading } = useQuery<WalletTransaction[]>({
    queryKey: ['admin_transactions', search],
    queryFn: async () => {
      let query = supabase
        .from('wallet_transactions')
        .select('id, user_id, amount, kind, reference, stripe_event_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (search.trim()) {
        query = query.ilike('reference', `%${search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as WalletTransaction[];
    },
  });

  const totalEntradas = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const totalSaidas = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalBonus = transactions.filter(t => t.kind === 'bonus').reduce((sum, t) => sum + t.amount, 0);
  const totalReembolso = transactions.filter(t => t.kind === 'refund').reduce((sum, t) => sum + t.amount, 0);

  const kindClass = (kind: string | null, amount: number) => {
    if (amount < 0) return 'bg-red-500/10 text-red-400 border border-red-500/20';
    if (kind === 'bonus') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Comprado', value: totalEntradas, color: 'text-blue-400' },
          { label: 'Gasto', value: totalSaidas, color: 'text-red-400' },
          { label: 'Bônus', value: totalBonus, color: 'text-emerald-400' },
          { label: 'Reembolso', value: totalReembolso, color: 'text-yellow-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#1C3454] border border-slate-800/80 rounded-xl p-6">
            <h3 className="text-[#94A3B8] text-sm font-medium mb-2">{stat.label}</h3>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6580]" size={18} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por reference..."
            className="w-full bg-[#1C3454] border border-slate-800 rounded-lg pl-10 pr-4 py-3 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-[#1C3454] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#1C3050] flex justify-between items-center bg-[#181A20]">
          <h2 className="text-lg font-bold text-white">Transações Recentes</h2>
          {isLoading && <Loader2 size={18} className="animate-spin text-[#4A6580]" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1C3050] text-sm font-medium text-[#94A3B8]">
                <th className="p-4">Data</th>
                <th className="p-4">User ID</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Moedas</th>
                <th className="p-4">Reference</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {transactions.map(t => (
                <tr
                  key={t.id}
                  onClick={() => setSelectedTx(t)}
                  className="border-b border-[#1C3050] hover:bg-slate-800/30 transition-colors cursor-pointer"
                >
                  <td className="p-4 text-slate-300 whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-4 text-white font-mono text-xs">
                    {t.user_id ? `${t.user_id.slice(0, 8)}…` : '—'}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${kindClass(t.kind, t.amount)}`}>
                      {t.kind ?? '—'}
                    </span>
                  </td>
                  <td className={`p-4 font-bold ${t.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {t.amount > 0 ? '+' : ''}{t.amount}
                  </td>
                  <td className="p-4 text-slate-400 max-w-xs truncate">{t.reference ?? '—'}</td>
                </tr>
              ))}
              {!isLoading && transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[#4A6580]">Nenhuma transação encontrada</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTx(null)} />
          <div className="bg-[#1C3454] border border-slate-700 rounded-xl p-6 w-full max-w-md relative z-50">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Detalhes da Transação</h2>
              <button onClick={() => setSelectedTx(null)} className="text-[#94A3B8] hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between gap-4"><span className="text-[#4A6580] shrink-0">ID:</span><span className="text-white font-mono break-all text-xs">{selectedTx.id}</span></div>
              <div className="flex justify-between gap-4"><span className="text-[#4A6580] shrink-0">User ID:</span><span className="text-white font-mono break-all text-xs">{selectedTx.user_id ?? '—'}</span></div>
              <div className="flex justify-between gap-4"><span className="text-[#4A6580] shrink-0">Tipo:</span><span className="text-white">{selectedTx.kind ?? '—'}</span></div>
              <div className="flex justify-between gap-4"><span className="text-[#4A6580] shrink-0">Moedas:</span><span className={`font-bold ${selectedTx.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{selectedTx.amount > 0 ? '+' : ''}{selectedTx.amount}</span></div>
              <div className="flex justify-between gap-4"><span className="text-[#4A6580] shrink-0">Reference:</span><span className="text-white break-all">{selectedTx.reference ?? '—'}</span></div>
              <div className="flex justify-between gap-4"><span className="text-[#4A6580] shrink-0">Stripe Event:</span><span className="text-white font-mono break-all text-xs">{selectedTx.stripe_event_id ?? '—'}</span></div>
              <div className="flex justify-between gap-4"><span className="text-[#4A6580] shrink-0">Data:</span><span className="text-white">{new Date(selectedTx.created_at).toLocaleString('pt-BR')}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
