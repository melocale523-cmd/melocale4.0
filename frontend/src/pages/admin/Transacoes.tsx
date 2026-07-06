import { useMemo, useState } from 'react';
import { Search, X, Loader2, User, CreditCard, Gift } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

interface Transaction {
  id: string;
  kind: string;
  amount: number | null;
  balance_after: number | null;
  reference: string | null;
  payment_id: string | null;
  created_at: string;
  wallets?: {
    professionals?: {
      user_id?: string | null;
      profiles?: { full_name?: string | null } | null;
    } | null;
  } | null;
}

type PeriodFilter = 'all' | '30d' | '90d';

// Card elevado — padrão visual aprovado (borda sutil + sombra + brilho no topo)
const ELEV: React.CSSProperties = {
  background: '#122444',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
  boxShadow: '0 6px 18px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)',
};
const STRIP = 'linear-gradient(90deg, #60a5fa, #a78bfa, #34d399)';

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

// Crédito manual do admin (não é receita real via Stripe):
// reference no formato stripe_credit:admin_award_<uid>_<ts>
function isAdminCredit(t: Transaction): boolean {
  return t.kind === 'credit_purchase' && (t.reference ?? '').startsWith('stripe_credit:admin_award');
}

function isRealPurchase(t: Transaction): boolean {
  return t.kind === 'credit_purchase' && !isAdminCredit(t);
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

function OriginIcon({ t }: { t: Transaction }) {
  if (t.kind !== 'credit_purchase') return <span style={{ color: '#4a6580', fontSize: 12 }}>—</span>;
  const admin = isAdminCredit(t);
  return (
    <span
      title={admin ? 'Crédito manual do admin' : 'Compra real via Stripe'}
      className={`inline-flex items-center gap-4 text-xs font-semibold ${admin ? 'text-purple-400' : 'text-blue-400'}`}
      style={{ padding: '2px 8px', borderRadius: 99, background: admin ? 'rgba(167,139,250,0.1)' : 'rgba(96,165,250,0.1)', border: `1px solid ${admin ? 'rgba(167,139,250,0.25)' : 'rgba(96,165,250,0.25)'}` }}
    >
      {admin ? <Gift size={12} /> : <CreditCard size={12} />} {admin ? 'Admin' : 'Stripe'}
    </span>
  );
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

  // Pacote comprado: payment_id → payments.package_id → coin_packages.name
  const { data: packageNameByPayment = {} } = useQuery({
    queryKey: ['adminTxPackageNames'],
    queryFn: async () => {
      const [paymentsRes, packagesRes] = await Promise.all([
        supabase.from('payments').select('id, package_id'),
        supabase.from('coin_packages').select('id, name'),
      ]);
      const pkgName = Object.fromEntries(((packagesRes.data ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name]));
      const map: Record<string, string> = {};
      ((paymentsRes.data ?? []) as { id: string; package_id: string | null }[]).forEach(p => {
        if (p.package_id) map[p.id] = pkgName[p.package_id] ?? p.package_id;
      });
      return map;
    },
    staleTime: 60_000,
  });

  const packageOf = (t: Transaction): string | null =>
    t.payment_id ? (packageNameByPayment[t.payment_id] ?? null) : null;

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

  // KPIs: separa receita real (Stripe) de crédito manual do admin —
  // misturados, o KPI de "Compra de Moedas" inflava a receita
  const real = transacoes.filter(isRealPurchase);
  const adminCredits = transacoes.filter(isAdminCredit);
  const realTotal = real.reduce((a, t) => a + (t.amount ?? 0), 0);
  const adminTotal = adminCredits.reduce((a, t) => a + (t.amount ?? 0), 0);
  const debitTotal = transacoes.filter(t => t.kind === 'debit_lead').reduce((a, t) => a + (t.amount ?? 0), 0);
  const ticketMedio = real.length > 0 ? Math.round((realTotal / real.length) * 10) / 10 : 0;

  // Comparação mês atual vs mês anterior (só compra real) — mesmo padrão de
  // cálculo do painel de Faturamento do Dashboard (soma período vs anterior)
  const realDiff = useMemo(() => {
    const now = new Date();
    const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    let cur = 0, prev = 0;
    transacoes.forEach(t => {
      if (!isRealPurchase(t)) return;
      const k = monthKey(t.created_at);
      if (k === thisKey) cur += t.amount ?? 0;
      if (k === prevKey) prev += t.amount ?? 0;
    });
    if (prev <= 0) return null;
    return Math.round(((cur - prev) / prev) * 100);
  }, [transacoes]);

  const exportCSV = () => {
    const headers = ['Data', 'Profissional', 'Tipo', 'Origem', 'Pacote', 'Valor (moedas)', 'Saldo após', 'Referência', 'ID'];
    const rows = filtered.map(t => [
      new Date(t.created_at).toLocaleString('pt-BR'),
      txName(t) ?? '', t.kind,
      t.kind === 'credit_purchase' ? (isAdminCredit(t) ? 'admin' : 'stripe') : '',
      packageOf(t) ?? '',
      String(t.amount ?? ''), String(t.balance_after ?? ''),
      t.reference ?? '', t.id,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'transacoes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const selectClass = 'bg-[#1C3454] border border-slate-800 rounded-lg px-3 py-8 text-sm text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer';

  const kpiCards = [
    {
      label: 'Compra real (Stripe)', value: realTotal, sub: `${real.length} pagamento${real.length === 1 ? '' : 's'}`, color: 'text-blue-400',
      badge: realDiff !== null ? `${realDiff >= 0 ? '+' : ''}${realDiff}% vs mês anterior` : null,
    },
    { label: 'Créditos admin', value: adminTotal, sub: `${adminCredits.length} crédito${adminCredits.length === 1 ? '' : 's'}`, color: 'text-purple-400', badge: null },
    { label: 'Ticket médio (real)', value: ticketMedio, sub: 'moedas por compra', color: 'text-emerald-400', badge: null },
    { label: 'Gasto em Leads', value: debitTotal, sub: null, color: 'text-red-400', badge: null },
  ];

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

      {/* Hero KPI — UM card elevado, células com divisor fino */}
      <div style={{ ...ELEV, overflow: 'hidden' }}>
        <div style={{ height: 3, background: STRIP }} />
        <div className="grid grid-cols-2 md:grid-cols-4">
          {kpiCards.map((stat, i) => (
            <div
              key={i}
              className="p-4 md:p-8"
              style={{
                borderRight: (i % 2 === 0) ? '1px solid rgba(255,255,255,0.06)' : undefined,
                borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : undefined,
              }}
            >
              <h3 className="text-[#94A3B8] text-[10px] md:text-xs font-bold uppercase tracking-wide mb-2">{stat.label}</h3>
              <p className={`text-lg md:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              {stat.sub && <p className="text-[#4A6580] text-[10px] md:text-xs mt-1">{stat.sub}</p>}
              {stat.badge && (
                <span className={`inline-block mt-2 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded border ${stat.badge.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {stat.badge}
                </span>
              )}
            </div>
          ))}
        </div>
        {/* Proporção Stripe vs Admin (dados reais dos KPIs acima) */}
        {realTotal + adminTotal > 0 && (() => {
          const realPct = Math.round((realTotal / (realTotal + adminTotal)) * 100);
          return (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.625rem 1rem 0.75rem' }}>
              <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ width: `${realPct}%`, background: '#60a5fa' }} />
                <div style={{ width: `${100 - realPct}%`, background: '#a78bfa' }} />
              </div>
              <p style={{ fontSize: 10, color: '#64748b', margin: '6px 0 0' }}>
                <span style={{ color: '#60a5fa', fontWeight: 700 }}>{realPct}%</span> receita real · <span style={{ color: '#a78bfa', fontWeight: 700 }}>{100 - realPct}%</span> cortesia administrativa
              </p>
            </div>
          );
        })()}
      </div>

      {/* Filtros */}
      <div className="flex gap-9 mb-11 flex-wrap items-center">
        <div className="flex-1 relative" style={{ minWidth: 200 }}>
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

      {/* ── Desktop: tabela agrupada por mês ──────────────────────────── */}
      <div className="hidden md:block" style={{ ...ELEV, overflow: 'hidden' }}>
        <div style={{ height: 3, background: STRIP }} />
        <div className="p-9 border-b border-[#1C3050] flex justify-between items-center">
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
                <th className="p-9">Origem</th>
                <th className="p-9">Pacote</th>
                <th className="p-9">Valor (moedas)</th>
                <th className="p-9">Perfil</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {grouped.map(([mKey, txs]) => (
                <MonthGroup key={mKey} mKey={mKey} txs={txs} packageOf={packageOf} onSelect={setSelectedTx} />
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#4A6580]">Nenhuma transação encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile: UM card elevado, linhas com divisor fino ──────────── */}
      <div className="md:hidden" style={{ ...ELEV, overflow: 'hidden' }}>
        <div style={{ height: 3, background: STRIP }} />
        {isLoading && <div className="flex justify-center p-8"><Loader2 size={22} className="animate-spin text-emerald-500" /></div>}
        {grouped.map(([mKey, txs]) => (
          <div key={mKey}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] px-4 py-2" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', margin: 0 }}>
              {monthLabel(mKey)} · {txs.length} transaç{txs.length === 1 ? 'ão' : 'ões'}
            </p>
            {txs.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTx(t)}
                className="w-full text-left p-4 space-y-2"
                style={{ background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-[13px] font-semibold truncate">{txName(t) ?? '—'}</p>
                    <p className="text-[#4A6580] text-[11px]">
                      {new Date(t.created_at).toLocaleDateString('pt-BR')} {new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className={`font-bold text-sm ${t.kind === 'debit_lead' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {t.kind === 'debit_lead' ? '-' : '+'}{t.amount}
                    </span>
                    {t.balance_after !== null && (
                      <span style={{ display: 'block', fontSize: 10, color: '#64748b' }}>saldo: {t.balance_after}</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`border px-2 py-0.5 rounded text-xs font-bold uppercase ${kindColor(t.kind)}`}>
                    {formatKind(t.kind, t.reference)}
                  </span>
                  <OriginIcon t={t} />
                  {packageOf(t) && (
                    <span className="border border-yellow-500/25 bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded text-xs font-bold">
                      {packageOf(t)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="p-8 text-center text-[#4A6580] text-sm">Nenhuma transação encontrada.</p>
        )}
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
              <div className="flex justify-between"><span className="text-[#4A6580]">Origem:</span><span><OriginIcon t={selectedTx} /></span></div>
              <div className="flex justify-between"><span className="text-[#4A6580]">Pacote:</span><span className="text-white">{packageOf(selectedTx) ?? '—'}</span></div>
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

function MonthGroup({ mKey, txs, packageOf, onSelect }: {
  mKey: string;
  txs: Transaction[];
  packageOf: (t: Transaction) => string | null;
  onSelect: (t: Transaction) => void;
}) {
  return (
    <>
      <tr className="bg-[#16294a]">
        <td colSpan={7} className="px-9 py-6 text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
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
          <td className="p-9"><OriginIcon t={t} /></td>
          <td className="p-9 text-[#94A3B8]">{packageOf(t) ?? '—'}</td>
          <td className="p-4">
            <span className={`font-bold ${t.kind === 'debit_lead' ? 'text-red-400' : 'text-emerald-400'}`}>
              {t.kind === 'debit_lead' ? '-' : '+'}{t.amount}
            </span>
            {t.balance_after !== null && (
              <span style={{ display: 'block', fontSize: 10, color: '#64748b' }}>saldo: {t.balance_after}</span>
            )}
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
