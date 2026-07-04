import { useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

interface Transaction {
  id: string;
  kind: string;
  amount: number | null;
  balance_after: number | null;
  reference: string | null;
  created_at: string;
  professionals?: {
    user_id?: string | null;
    profiles?: { full_name?: string | null } | null;
  } | null;
}

function formatKind(kind: string, reference?: string | null) {
  if (reference?.startsWith('lead_purchase:') || kind === 'debit_lead') return 'Compra de Lead';
  if (kind === 'credit_purchase' || kind === 'purchase') return 'Compra de moedas';
  if (kind === 'bonus') return 'Bônus';
  if (kind === 'subscription') return 'Assinatura';
  return kind.charAt(0).toUpperCase() + kind.slice(1).replace(/_/g, ' ');
}

function kindColor(kind: string) {
  if (kind === 'debit_lead') return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (kind === 'credit_purchase' || kind === 'bonus' || kind === 'subscription') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
}

export default function AdminTransacoes() {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');

  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ['adminTransacoes'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // .returns: o typegen infere professionals() como array, mas a relação
      // wallet_transactions → professionals é many-to-one e o PostgREST
      // retorna objeto em runtime.
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*, professionals(user_id, profiles(full_name))')
        .order('created_at', { ascending: false })
        .limit(200)
        .returns<Transaction[]>();
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = transacoes.filter((t: Transaction) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = t.professionals?.profiles?.full_name?.toLowerCase() ?? '';
    return name.includes(q) || t.kind?.toLowerCase().includes(q) || t.reference?.toLowerCase().includes(q);
  });

  const totals = transacoes.reduce((acc: Record<string, number>, t: Transaction) => {
    acc[t.kind] = (acc[t.kind] ?? 0) + (t.amount ?? 0);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-11 fade-in">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-9">
        {[
          { label: 'Compra de Moedas', value: totals['credit_purchase'] ?? 0, color: 'text-blue-400' },
          { label: 'Gasto em Leads', value: totals['debit_lead'] ?? 0, color: 'text-red-400' },
          { label: 'Bônus', value: totals['bonus'] ?? 0, color: 'text-emerald-400' },
          { label: 'Total Transações', value: transacoes.length, color: 'text-yellow-400' },
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
            placeholder="Buscar profissional, tipo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            maxLength={255}
            className="w-full bg-[#1C3454] border border-slate-800 rounded-lg pl-10 pr-4 py-8 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-[#1C3454] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="p-9 border-b border-[#1C3050] flex justify-between items-center bg-[#181A20]">
          <h2 className="text-lg font-bold text-white">Transações ({filtered.length})</h2>
          {isLoading && <Loader2 size={18} className="animate-spin text-emerald-500" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1C3050] text-sm font-medium text-[#94A3B8]">
                <th className="p-9">Data</th>
                <th className="p-9">Profissional</th>
                <th className="p-9">Tipo</th>
                <th className="p-9">Valor (moedas)</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.map((t: Transaction) => (
                <tr key={t.id} onClick={() => setSelectedTx(t)} className="border-b border-[#1C3050] hover:bg-slate-800/30 transition-colors cursor-pointer">
                  <td className="p-9 text-slate-300">
                    {new Date(t.created_at).toLocaleDateString('pt-BR')} {new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-9 text-white font-medium">
                    {t.professionals?.profiles?.full_name ?? '—'}
                  </td>
                  <td className="p-9">
                    <span className={`border px-2 py-0.5 rounded text-xs font-bold uppercase ${kindColor(t.kind)}`}>
                      {formatKind(t.kind, t.reference)}
                    </span>
                  </td>
                  <td className={`p-4 font-bold ${t.kind === 'debit_lead' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {t.kind === 'debit_lead' ? '-' : '+'}{t.amount}
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[#4A6580]">Nenhuma transação encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-9">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTx(null)} />
          <div className="bg-[#1C3454] border border-slate-700 rounded-xl p-11 w-full max-w-md relative z-50">
            <div className="flex justify-between items-center mb-11">
              <h2 className="text-xl font-bold text-white">Detalhes da Transação</h2>
              <button onClick={() => setSelectedTx(null)} className="text-[#94A3B8] hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-9 text-sm">
              <div className="flex justify-between"><span className="text-[#4A6580]">Profissional:</span><span className="text-white">{selectedTx.professionals?.profiles?.full_name ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-[#4A6580]">Tipo:</span><span className="text-white">{formatKind(selectedTx.kind, selectedTx.reference)}</span></div>
              <div className="flex justify-between"><span className="text-[#4A6580]">Valor:</span><span className="text-white font-bold">{selectedTx.amount} moedas</span></div>
              <div className="flex justify-between"><span className="text-[#4A6580]">Saldo após:</span><span className="text-white">{selectedTx.balance_after ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-[#4A6580]">Referência:</span><span className="text-white font-mono break-all text-xs">{selectedTx.reference ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-[#4A6580]">Data:</span><span className="text-white">{new Date(selectedTx.created_at).toLocaleString('pt-BR')}</span></div>
              <div className="flex justify-between"><span className="text-[#4A6580]">ID:</span><span className="text-white font-mono break-all text-xs">{selectedTx.id}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
