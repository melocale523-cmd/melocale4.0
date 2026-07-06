import { useMemo, useState } from 'react';
import { Search, X, Loader2, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

interface Transaction {
  id: string;
  kind: string;
  amount: number | null;
  balance_after: number | null;
  reference: string | null;
  created_at: string;
  wallets?: {
    professionals?: {
      user_id?: string | null;
      profiles?: { full_name?: string | null } | null;
    } | null;
  } | null;
}

type PeriodFilter = 'all' | '30d' | '90d';

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

function txName(t: Transaction): string | null {
  return t.wallets?.professionals?.profiles?.full_name ?? null;
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function AdminTransacoes() {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [proFilter, setProFilter] = useState('all');

  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ['adminTransacoes'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // wallet_transactions NÃO tem FK para professionals (só para wallets e
      // payments) — o embed direto professionals(...) fazia o PostgREST
      // falhar com "relationship not found" e a tela zerar. O caminho com FK
      // real é wallet_id → wallets.professional_id → professionals.user_id →
      // profiles. (.returns: o typegen infere embeds como array, mas as
      // relações são many-to-one e o PostgREST retorna objeto em runtime.)
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*, wallets(professionals(user_id, profiles(full_name)))')
        .order('created_at', { ascending: false })
        .limit(200)
        .returns<Transaction[]>();
      if (error) throw error;
      return data ?? [];
    },
  });

  const kinds = useMemo(
    () => [...new Set(transacoes.map(t => t.kind))].sort(),
    [transacoes]
  );
  const professionals = useMemo(
    () => [...new Set(transacoes.map(txName).filter((n): n is string => !!n))].sort(),
    [transacoes]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const cutoff = periodFilter === '30d' ? now - 30 * 86_400_000
      : periodFilter === '90d' ? now - 90 * 86_400_000
      : null;
    return transacoes.filter(t => {
      if (kindFilter !== 'all' && t.kind !== kindFilter) return false;
      if (proFilter !== 'all' && txName(t) !== proFilter) return false;
      if (cutoff !== null && new Date(t.created_at).getTime() < cutoff) return false;
      if (!q) return true;
      const name = txName(t)?.toLowerCase() ?? '';
      return name.includes(q) || t.kind?.toLowerCase().includes(q) || (t.reference ?? '').toLowerCase().includes(q);
    });
  }, [transacoes, search, kindFilter, periodFilter, proFilter]);

  // Agrupamento por mês (mais recente primeiro — a lista já vem ordenada desc)
  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    filtered.forEach(t => {
      const k = monthKey(t.created_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    return [...map.entries()];
  }, [filtered]);

  const totals = transacoes.reduce((acc: Record<string, number>, t: Transaction) => {
    acc[t.kind] = (acc[t.kind] ?? 0) + (t.amount ?? 0);
    return acc;
  }, {} as Record<string, number>);

  const creditCount = transacoes.filter(t => t.kind === 'credit_purchase').length;
  const ticketMedio = creditCount > 0 ? Math.round(((totals['credit_purchase'] ?? 0) / creditCount) * 10) / 10 : 0;

  // Comparação mês atual vs mês anterior (credit_purchase) — mesmo padrão de
  // cálculo do painel de Faturamento do Dashboard (soma período vs anterior)
  const creditDiff = useMemo(() => {
    const now = new Date();
    const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    let cur = 0, prev = 0;
    transacoes.forEach(t => {
      if (t.kind !== 'credit_purchase') return;
      const k = monthKey(t.created_at);
      if (k === thisKey) cur += t.amount ?? 0;
      if (k === prevKey) prev += t.amount ?? 0;
    });
    if (prev <= 0) return null;
    return Math.round(((cur - prev) / prev) * 100);
  }, [transacoes]);

  const exportCSV = () => {
    const headers = ['Data', 'Profissional', 'Tipo', 'Valor (moedas)', 'Saldo após', 'Referência', 'ID'];
    const rows = filtered.map(t => [
      new Date(t.created_at).toLocaleString('pt-BR'),
      txName(t) ?? '', t.kind, String(t.amount ?? ''), String(t.balance_after ?? ''),
      t.reference ?? '', t.id,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'transacoes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const selectClass = 'bg-[#1C3454] border border-slate-800 rounded-lg px-3 py-8 text-sm text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer';

  return (
    <div className="space-y-11 fade-in">
      {/* Header + export */}
      <div className="flex items-start justify-between flex-wrap gap-9">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Transações</h1>
          <p className="text-[#94A3B8] mt-6">Movimentações de moedas dos profissionais.</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-5 px-3 py-6 bg-[#132540] border border-white/5 rounded-lg text-[#4a6580] text-xs cursor-pointer"
        >
          Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-9">
        {[
          {
            label: 'Compra de Moedas', value: totals['credit_purchase'] ?? 0, color: 'text-blue-400',
            badge: creditDiff !== null ? `${creditDiff >= 0 ? '+' : ''}${creditDiff}% vs mês anterior` : null,
          },
          { label: 'Gasto em Leads', value: totals['debit_lead'] ?? 0, color: 'text-red-400', badge: null },
          { label: 'Bônus', value: totals['bonus'] ?? 0, color: 'text-emerald-400', badge: null },
          { label: 'Ticket médio', value: ticketMedio, color: 'text-purple-400', badge: null },
          { label: 'Total Transações', value: transacoes.length, color: 'text-yellow-400', badge: null },
        ].map((stat, i) => (
          <div key={i} className="bg-[#1C3454] border border-slate-800/80 rounded-xl p-11">
            <h3 className="text-[#94A3B8] text-sm font-medium mb-7">{stat.label}</h3>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            {stat.badge && (
              <span className={`inline-block mt-6 text-xs font-bold px-2 py-0.5 rounded border ${stat.badge.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                {stat.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-9 mb-11 flex-wrap items-center">
        <div className="flex-1 relative" style={{ minWidth: 220 }}>
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
        <select value={proFilter} onChange={e => setProFilter(e.target.value)} className={selectClass}>
          <option value="all">Todos os profissionais</option>
          {professionals.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={kindFilter} onChange={e => setKindFilter(e.target.value)} className={selectClass}>
          <option value="all">Todos os tipos</option>
          {kinds.map(k => <option key={k} value={k}>{formatKind(k)}</option>)}
        </select>
        <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value as PeriodFilter)} className={selectClass}>
          <option value="all">Todo o período</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
        </select>
      </div>

      {/* Lista agrupada por mês */}
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
                <th className="p-9">Perfil</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {grouped.map(([mKey, txs]) => (
                <MonthGroup key={mKey} mKey={mKey} txs={txs} onSelect={setSelectedTx} />
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[#4A6580]">Nenhuma transação encontrada.</td>
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
              <div className="flex justify-between"><span className="text-[#4A6580]">Profissional:</span><span className="text-white">{txName(selectedTx) ?? '—'}</span></div>
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

function MonthGroup({ mKey, txs, onSelect }: { mKey: string; txs: Transaction[]; onSelect: (t: Transaction) => void }) {
  return (
    <>
      <tr className="bg-[#16294a]">
        <td colSpan={5} className="px-9 py-6 text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
          {monthLabel(mKey)} · {txs.length} transaç{txs.length === 1 ? 'ão' : 'ões'}
        </td>
      </tr>
      {txs.map(t => (
        <tr key={t.id} onClick={() => onSelect(t)} className="border-b border-[#1C3050] hover:bg-slate-800/30 transition-colors cursor-pointer">
          <td className="p-9 text-slate-300">
            {new Date(t.created_at).toLocaleDateString('pt-BR')} {new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </td>
          <td className="p-9 text-white font-medium">{txName(t) ?? '—'}</td>
          <td className="p-9">
            <span className={`border px-2 py-0.5 rounded text-xs font-bold uppercase ${kindColor(t.kind)}`}>
              {formatKind(t.kind, t.reference)}
            </span>
          </td>
          <td className={`p-4 font-bold ${t.kind === 'debit_lead' ? 'text-red-400' : 'text-emerald-400'}`}>
            {t.kind === 'debit_lead' ? '-' : '+'}{t.amount}
          </td>
          <td className="p-9">
            <a
              href="/admin/usuarios"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-4 px-3 py-4 rounded-lg border border-blue-500/30 text-blue-400 text-xs font-semibold no-underline"
            >
              <User size={12} /> Ver perfil
            </a>
          </td>
        </tr>
      ))}
    </>
  );
}
